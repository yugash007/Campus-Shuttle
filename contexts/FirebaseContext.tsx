import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, database } from '../firebase';
// FIX: Imported 'push' to create new nodes in the database.
import { ref, onValue, set, get, update, remove, push } from 'firebase/database';
import { User, Student, Driver, Ride, RideStatus, UserRole } from '../types';
import { calculateDriverBonus } from '../ai/EcoNudgeEngine';

interface FirebaseContextState {
    authUser: User | null;
    student: Student | null;
    driver: Driver | null;
    activeRide: Ride | null;
    driverForRide: Driver | null;
    rideRequests: Ride[];
    recentRides: Ride[];
    allRides: Ride[];
    loading: boolean;
    bookRide: (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => void;
    cancelRide: () => void;
    toggleDriverStatus: () => void;
    handleRideRequest: (rideId: string, accepted: boolean) => void;
    completeRide: () => void;
    submitRating: (rideId: string, driverId: string, rating: number, feedback: string) => void;
    logout: () => void;
}

const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [student, setStudent] = useState<Student | null>(null);
    const [driver, setDriver] = useState<Driver | null>(null);
    const [activeRide, setActiveRide] = useState<Ride | null>(null);
    const [driverForRide, setDriverForRide] = useState<Driver | null>(null);
    const [rideRequests, setRideRequests] = useState<Ride[]>([]);
    const [recentRides, setRecentRides] = useState<Ride[]>([]);
    const [allRides, setAllRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    // Effect for handling authentication state
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                // Check if user is a student
                let snapshot = await get(ref(database, `students/${firebaseUser.uid}`));
                if (snapshot.exists()) {
                    const studentData = snapshot.val() as Student;
                    setAuthUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: UserRole.STUDENT });
                    setStudent(studentData);
                    setDriver(null); // Clear driver data
                } else {
                    // Check if user is a driver
                    snapshot = await get(ref(database, `drivers/${firebaseUser.uid}`));
                    if(snapshot.exists()) {
                        const driverData = snapshot.val() as Driver;
                        setAuthUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: UserRole.DRIVER });
                        setDriver(driverData);
                        setStudent(null); // Clear student data
                    } else {
                        console.error("User not found in database");
                        setAuthUser(null);
                        setStudent(null);
                        setDriver(null);
                    }
                }
            } else {
                setAuthUser(null);
                setStudent(null);
                setDriver(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Effect for listening to user-specific data updates
    useEffect(() => {
        if (!authUser) return;

        let unsubscribeUser: () => void;
        let unsubscribeAllRides: (() => void) | null = null;
        
        if (authUser.role === UserRole.STUDENT) {
            const studentRef = ref(database, `students/${authUser.uid}`);
            unsubscribeUser = onValue(studentRef, snapshot => setStudent(snapshot.val()));
        } else if (authUser.role === UserRole.DRIVER) {
            const driverRef = ref(database, `drivers/${authUser.uid}`);
            unsubscribeUser = onValue(driverRef, snapshot => setDriver(snapshot.val()));

            // Add listener for all rides for the driver's heatmap
            const allRidesRef = ref(database, 'rides');
            unsubscribeAllRides = onValue(allRidesRef, (snapshot) => {
                const ridesData = snapshot.val() || {};
                const ridesList = Object.values(ridesData) as Ride[];
                // We only need completed rides for the heatmap
                setAllRides(ridesList.filter(ride => ride.status === RideStatus.COMPLETED));
            });
        }
        
        const requestsRef = ref(database, 'ride-requests');
        const unsubscribeRequests = onValue(requestsRef, snapshot => {
            const requestsData = snapshot.val() || {};
            const requestsList = Object.values(requestsData) as Ride[];
            
            const now = new Date();
            const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

            const filteredRequests = requestsList.filter(r => {
                if (r.status !== RideStatus.PENDING) return false;
                if (r.bookingType === 'ASAP') return true;
                if (r.bookingType === 'Scheduled' && r.scheduledTime) {
                    const scheduledDateTime = new Date(r.scheduledTime);
                    return scheduledDateTime <= thirtyMinutesFromNow && scheduledDateTime >= now;
                }
                return false;
            });
            
            setRideRequests(filteredRequests);
        });

        return () => {
            if (unsubscribeUser) unsubscribeUser();
            unsubscribeRequests();
            if (unsubscribeAllRides) unsubscribeAllRides();
        };
    }, [authUser]);

    // Effect for tracking active ride
    useEffect(() => {
        let unsubscribeRide: () => void;
        let unsubscribeDriverForRide: () => void;
        
        const rideId = student?.activeRideId || driver?.currentRideId;

        if (rideId) {
            const rideRef = ref(database, `rides/${rideId}`);
            unsubscribeRide = onValue(rideRef, snapshot => {
                const rideData = snapshot.val() as Ride;
                if(rideData && (rideData.status === RideStatus.ACTIVE || rideData.status === RideStatus.PENDING || rideData.status === RideStatus.CONFIRMED)){
                    setActiveRide(rideData);
                    if (rideData.driverId) {
                        const driverForRideRef = ref(database, `drivers/${rideData.driverId}`);
                        unsubscribeDriverForRide = onValue(driverForRideRef, driverSnapshot => {
                            setDriverForRide(driverSnapshot.val());
                        });
                    } else {
                        setDriverForRide(null);
                    }
                } else {
                     setActiveRide(null);
                     setDriverForRide(null);
                }
            });
        } else {
            setActiveRide(null);
            setDriverForRide(null);
        }
        
        return () => {
            if (unsubscribeRide) unsubscribeRide();
            if (unsubscribeDriverForRide) unsubscribeDriverForRide();
        };
    }, [student?.activeRideId, driver?.currentRideId]);

    // Effect for fetching recent rides
    useEffect(() => {
        if (student?.recentRides) {
            const rideIds = Object.keys(student.recentRides);
            const listeners: (() => void)[] = [];
            const newRecentRides: Ride[] = [];
    
            rideIds.forEach(id => {
                const rideRef = ref(database, `rides/${id}`);
                const listener = onValue(rideRef, (snapshot) => {
                    const rideData = snapshot.val() as Ride;
                    if (rideData) {
                        const index = newRecentRides.findIndex(r => r.id === id);
                        if (index > -1) {
                            newRecentRides[index] = rideData;
                        } else {
                            newRecentRides.push(rideData);
                        }
                        setRecentRides([...newRecentRides].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    }
                });
                listeners.push(listener);
            });
    
            return () => listeners.forEach(unsubscribe => unsubscribe());
        }
    }, [student?.recentRides]);


    const bookRide = async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;

        const rideRequestRef = ref(database, 'ride-requests');
        
        const newRequestNode = push(rideRequestRef);
        const newRideId = newRequestNode.key!;
        
        const newRide: Ride = {
            ...details,
            id: newRideId,
            studentId: authUser.uid,
            date: new Date().toISOString(), // Booking creation date
            status: RideStatus.PENDING,
        };
        
        const updates: { [key: string]: any } = {};
        updates[`/ride-requests/${newRideId}`] = newRide;
        updates[`/rides/${newRideId}`] = newRide; // Also create in main rides list
        updates[`/students/${authUser.uid}/activeRideId`] = newRideId;

        await update(ref(database), updates);
    };
    
    const cancelRide = () => {
        if (!student?.activeRideId || !authUser) return;
        const rideId = student.activeRideId;
        const updates: { [key: string]: any } = {};
        updates[`/rides/${rideId}/status`] = RideStatus.CANCELLED;
        updates[`/students/${authUser.uid}/activeRideId`] = null;
        if(activeRide?.driverId) {
             updates[`/drivers/${activeRide.driverId}/currentRideId`] = null;
        }
        remove(ref(database, `ride-requests/${rideId}`));
        update(ref(database), updates);
    };
    
    const toggleDriverStatus = () => {
        if (!driver || !authUser || authUser.role !== UserRole.DRIVER) return;
        update(ref(database, `drivers/${authUser.uid}`), { isOnline: !driver.isOnline });
    };

    const handleRideRequest = (rideId: string, accepted: boolean) => {
        if (!authUser || authUser.role !== UserRole.DRIVER || driver?.currentRideId) return;

        remove(ref(database, `ride-requests/${rideId}`));
        
        if (accepted) {
            get(ref(database, `rides/${rideId}`)).then(snapshot => {
                if(snapshot.exists()) {
                    const rideData = snapshot.val() as Ride;
                    const updates: { [key: string]: any } = {};
                    updates[`/rides/${rideId}/status`] = RideStatus.ACTIVE;
                    updates[`/rides/${rideId}/driverId`] = authUser.uid;
                    updates[`/drivers/${authUser.uid}/currentRideId`] = rideId;
                    update(ref(database), updates);
                }
            });
        }
    };
    
    const completeRide = async () => {
        if(!driver?.currentRideId || !activeRide || !authUser || !driverForRide) return;
        
        const rideId = driver.currentRideId;
        
        // AI ENGINE CALL: Calculate driver bonus
        const { bonus, co2Savings } = calculateDriverBonus(activeRide, driverForRide);

        const updates: { [key: string]: any } = {};
        updates[`/rides/${rideId}/status`] = RideStatus.COMPLETED;
        updates[`/rides/${rideId}/co2Savings`] = co2Savings;
        
        // Update student data
        const studentSnapshot = await get(ref(database, `students/${activeRide.studentId}`));
        const studentData = studentSnapshot.val() as Student;
        const newStudentCo2 = (studentData.totalCo2Savings || 0) + co2Savings;

        updates[`/students/${activeRide.studentId}/activeRideId`] = null;
        updates[`/students/${activeRide.studentId}/recentRides/${rideId}`] = true;
        updates[`/students/${activeRide.studentId}/totalCo2Savings`] = newStudentCo2;
        
        // Update driver data
        const newDriverCo2 = (driver.totalCo2Savings || 0) + co2Savings;
        updates[`/drivers/${authUser.uid}/currentRideId`] = null;
        updates[`/drivers/${authUser.uid}/earnings`] = driver.earnings + activeRide.fare + bonus;
        updates[`/drivers/${authUser.uid}/totalRides`] = driver.totalRides + 1;
        updates[`/drivers/${authUser.uid}/totalCo2Savings`] = newDriverCo2;

        await update(ref(database), updates);
    }
    
    const submitRating = async (rideId: string, driverId: string, rating: number, feedback: string) => {
        try {
            const driverRef = ref(database, `drivers/${driverId}`);
            const driverSnapshot = await get(driverRef);
    
            if (!driverSnapshot.exists()) {
                console.error("Driver not found for rating.");
                return;
            }
    
            const driverData = driverSnapshot.val() as Driver;
            const currentRating = driverData.rating || 0;
            const ratingCount = driverData.ratingCount || 0;
    
            const newRatingCount = ratingCount + 1;
            const newAverageRating = ((currentRating * ratingCount) + rating) / newRatingCount;
    
            const updates: { [key: string]: any } = {};
            updates[`/drivers/${driverId}/rating`] = parseFloat(newAverageRating.toFixed(2));
            updates[`/drivers/${driverId}/ratingCount`] = newRatingCount;
            updates[`/rides/${rideId}/rating`] = rating;
            if (feedback) {
                updates[`/rides/${rideId}/feedback`] = feedback;
            }
    
            await update(ref(database), updates);
    
        } catch (error) {
            console.error("Error submitting rating:", error);
        }
    };

    const logout = () => {
        auth.signOut();
    };

    const value = {
        authUser,
        student,
        driver,
        activeRide,
        driverForRide,
        rideRequests,
        recentRides,
        allRides,
        loading,
        bookRide,
        cancelRide,
        toggleDriverStatus,
        handleRideRequest,
        completeRide,
        submitRating,
        logout,
    };

    return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
};

export const useFirebase = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
};