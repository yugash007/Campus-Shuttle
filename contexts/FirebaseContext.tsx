import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth, database, storage } from '../firebase';
import { ref, onValue, set, get, update, remove, push, serverTimestamp, query, orderByChild } from 'firebase/database';
import { User, Student, Driver, Ride, RideStatus, UserRole, Transaction, ScheduledEvent, RidePlan } from '../types';
import { calculateDriverBonus } from '../ai/EcoNudgeEngine';
import { useNotification } from './NotificationContext';

type ViewType = 'dashboard' | 'profile' | 'wallet' | 'scheduler';

interface WaitlistItem {
    studentId: string;
    timestamp: number;
    rideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>
}

interface FirebaseContextState {
    authUser: User | null;
    student: Student | null;
    driver: Driver | null;
    activeRide: Ride | null;
    driverForRide: Driver | null;
    rideRequests: Ride[];
    recentRides: Ride[];
    allRides: Ride[];
    waitlist: WaitlistItem[];
    transactionHistory: Transaction[];
    weeklySchedule: ScheduledEvent[];
    ridePlans: RidePlan[];
    loading: boolean;
    isOnline: boolean;
    view: ViewType;
    setView: (view: ViewType) => void;
    bookRide: (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => void;
    joinWaitlist: (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => void;
    leaveWaitlist: () => void;
    addFundsToWallet: (amount: number) => Promise<void>;
    updateWeeklySchedule: (events: ScheduledEvent[]) => Promise<void>;
    acceptRidePlan: (plan: Omit<RidePlan, 'id'>) => Promise<void>;
    removeRidePlan: (planId: string) => Promise<void>;
    cancelRide: () => void;
    toggleDriverStatus: () => void;
    handleRideRequest: (rideId: string, accepted: boolean) => void;
    completeRide: () => void;
    submitRating: (rideId: string, driverId: string, rating: number, feedback: string) => void;
    completeDriverOnboarding: (vehicleDetails: { make: string; model: string; licensePlate: string; }) => Promise<void>;
    uploadProfilePicture: (file: File, userId: string) => Promise<string>;
    updateUserProfile: (newData: Partial<Student> | Partial<Driver>, newProfilePicFile?: File | null) => Promise<void>;
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
    const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
    const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
    const [weeklySchedule, setWeeklySchedule] = useState<ScheduledEvent[]>([]);
    const [ridePlans, setRidePlans] = useState<RidePlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [view, setView] = useState<ViewType>('dashboard');
    const { showNotification } = useNotification();

     const _executeBookRide = async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>, studentId: string) => {
        const rideRequestRef = ref(database, 'ride-requests');
        const newRequestNode = push(rideRequestRef);
        const newRideId = newRequestNode.key!;
        
        const newRide: Ride = {
            ...details,
            id: newRideId,
            studentId: studentId,
            date: new Date().toISOString(),
            status: RideStatus.PENDING,
        };
        
        const updates: { [key: string]: any } = {};
        updates[`/ride-requests/${newRideId}`] = newRide;
        updates[`/rides/${newRideId}`] = newRide;
        updates[`/students/${studentId}/activeRideId`] = newRideId;

        await update(ref(database), updates);
    };

    const processBookingQueue = useCallback(async () => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        const queuedBookingsRaw = localStorage.getItem('bookingQueue');
        if (!queuedBookingsRaw) return;

        const queuedBookings: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>[] = JSON.parse(queuedBookingsRaw);
        if (queuedBookings.length === 0) return;

        showNotification('Back Online!', `Booking your ${queuedBookings.length} queued ride(s)...`);

        try {
            for (const rideDetails of queuedBookings) {
                await _executeBookRide(rideDetails, authUser.uid);
            }
            localStorage.removeItem('bookingQueue');
            showNotification('Success!', 'Your queued ride has been booked.');
        } catch (error) {
            console.error("Error processing booking queue:", error);
            showNotification('Error', 'Failed to book a queued ride. Please try again.');
        }
    }, [authUser, showNotification]);

    // Effect for handling online/offline status
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            processBookingQueue();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [processBookingQueue]);

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
    
    const fetchLinkedData = useCallback(async (path: string, ids: { [key: string]: boolean } | undefined) => {
        if (!ids) return [];
        const dataIds = Object.keys(ids);
        const dataPromises = dataIds.map(id => get(ref(database, `${path}/${id}`)));
        const snapshots = await Promise.all(dataPromises);
        return snapshots.map(snap => snap.val()).filter(Boolean);
    }, []);

    // Effect for listening to user-specific data updates and caching
    useEffect(() => {
        if (!authUser) return;

        let unsubscribeUser: () => void;
        let unsubscribeAllRides: (() => void) | null = null;
        
        if (authUser.role === UserRole.STUDENT) {
            // Load initial ride history from cache
            const cachedHistoryRaw = localStorage.getItem(`rideHistoryCache_${authUser.uid}`);
            if (cachedHistoryRaw) {
                setRecentRides(JSON.parse(cachedHistoryRaw));
            }

            const studentRef = ref(database, `students/${authUser.uid}`);
            unsubscribeUser = onValue(studentRef, async (snapshot) => {
                const studentData = snapshot.val();
                setStudent(studentData);
    
                const [transactions, schedule, plans] = await Promise.all([
                    fetchLinkedData('transactions', studentData?.transactionHistory),
                    fetchLinkedData('scheduled-events', studentData?.weeklySchedule),
                    fetchLinkedData('ride-plans', studentData?.ridePlans)
                ]);
    
                setTransactionHistory(transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                setWeeklySchedule(schedule);
                setRidePlans(plans);
            });


            const ridesRef = ref(database, 'rides');
            unsubscribeAllRides = onValue(ridesRef, (snapshot) => {
                const ridesData = snapshot.val() || {};
                const ridesList: Ride[] = Object.values(ridesData);
                const history = ridesList
                    .filter(ride => 
                        ride.studentId === authUser.uid && 
                        (ride.status === RideStatus.COMPLETED || ride.status === RideStatus.CANCELLED)
                    )
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setRecentRides(history);
                // Cache the fresh data
                localStorage.setItem(`rideHistoryCache_${authUser.uid}`, JSON.stringify(history));
            });
        } else if (authUser.role === UserRole.DRIVER) {
            const driverRef = ref(database, `drivers/${authUser.uid}`);
            unsubscribeUser = onValue(driverRef, snapshot => setDriver(snapshot.val()));

            // Add listener for all rides for the driver's heatmap
            const allRidesRef = ref(database, 'rides');
            unsubscribeAllRides = onValue(allRidesRef, (snapshot) => {
                const ridesData = snapshot.val() || {};
                const ridesList = Object.values(ridesData) as Ride[];
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

        const waitlistRef = query(ref(database, 'waitlist'), orderByChild('timestamp'));
        const unsubscribeWaitlist = onValue(waitlistRef, (snapshot) => {
            const waitlistData = snapshot.val() || {};
            const waitlistArray = Object.keys(waitlistData).map(key => ({
                studentId: key,
                ...waitlistData[key]
            }));
            setWaitlist(waitlistArray);
        });

        return () => {
            if (unsubscribeUser) unsubscribeUser();
            unsubscribeRequests();
            unsubscribeWaitlist();
            if (unsubscribeAllRides) unsubscribeAllRides();
        };
    }, [authUser, fetchLinkedData]);

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

    const bookRide = useCallback(async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;

        if (!isOnline) {
            const queuedBookingsRaw = localStorage.getItem('bookingQueue');
            const queue = queuedBookingsRaw ? JSON.parse(queuedBookingsRaw) : [];
            queue.push(details);
            localStorage.setItem('bookingQueue', JSON.stringify(queue));
            showNotification('You are offline', 'Ride booking queued. It will be sent upon reconnection.');
            return;
        }

        await _executeBookRide(details, authUser.uid);
    }, [authUser, isOnline, showNotification]);
    
    const joinWaitlist = useCallback(async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        
        const waitlistEntry = {
            rideDetails: details,
            timestamp: serverTimestamp()
        };
        
        const updates: { [key: string]: any } = {};
        updates[`/waitlist/${authUser.uid}`] = waitlistEntry;
        updates[`/students/${authUser.uid}/isOnWaitlist`] = true;
        
        await update(ref(database), updates);
        showNotification('Added to Waitlist', 'We will find a driver for you shortly!');
    }, [authUser, showNotification]);

    const leaveWaitlist = useCallback(async () => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        
        const updates: { [key: string]: any } = {};
        updates[`/waitlist/${authUser.uid}`] = null;
        updates[`/students/${authUser.uid}/isOnWaitlist`] = false;
        
        await update(ref(database), updates);
        showNotification('Removed from Waitlist', 'You have left the waitlist.');
    }, [authUser, showNotification]);

    const addFundsToWallet = async (amount: number) => {
        if (!authUser || !student) {
            throw new Error("User not authenticated or not a student.");
        }

        const newTransactionRef = push(ref(database, 'transactions'));
        const transactionId = newTransactionRef.key;

        if (!transactionId) {
            throw new Error("Could not generate transaction ID.");
        }

        const newTransaction: Transaction = {
            id: transactionId,
            type: 'credit',
            amount: amount,
            date: new Date().toISOString(),
            description: 'Funds added to wallet'
        };

        const updates: { [key: string]: any } = {};
        updates[`/transactions/${transactionId}`] = newTransaction;
        updates[`/students/${authUser.uid}/walletBalance`] = student.walletBalance + amount;
        updates[`/students/${authUser.uid}/transactionHistory/${transactionId}`] = true;

        await update(ref(database), updates);
    };
    
    const updateWeeklySchedule = async (events: ScheduledEvent[]) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
    
        const updates: { [key: string]: any } = {};
        const newScheduleLinks: { [key: string]: boolean } = {};
    
        for (const event of events) {
            let eventId = event.id;
            if (!eventId) {
                eventId = push(ref(database, 'scheduled-events')).key!;
            }
            updates[`/scheduled-events/${eventId}`] = { ...event, id: eventId };
            newScheduleLinks[eventId] = true;
        }
    
        // To remove deleted events, we overwrite the links
        updates[`/students/${authUser.uid}/weeklySchedule`] = newScheduleLinks;
    
        await update(ref(database), updates);
        showNotification('Schedule Saved', 'Your weekly schedule has been updated.');
    };
    
    const acceptRidePlan = async (plan: Omit<RidePlan, 'id'>) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        const newPlanRef = push(ref(database, 'ride-plans'));
        const planId = newPlanRef.key!;
        
        const newPlan: RidePlan = { ...plan, id: planId };

        const updates: { [key: string]: any } = {};
        updates[`/ride-plans/${planId}`] = newPlan;
        updates[`/students/${authUser.uid}/ridePlans/${planId}`] = true;
        
        await update(ref(database), updates);
        showNotification('Plan Saved', `Recurring ride for ${plan.forEvent} has been saved.`);
    };

    const removeRidePlan = async (planId: string) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        
        const updates: { [key: string]: any } = {};
        updates[`/ride-plans/${planId}`] = null;
        updates[`/students/${authUser.uid}/ridePlans/${planId}`] = null;
        
        await update(ref(database), updates);
        showNotification('Plan Removed', 'The recurring ride plan has been deleted.');
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
    
    const toggleDriverStatus = async () => {
        if (!driver || !authUser || authUser.role !== UserRole.DRIVER) return;
        const newStatus = !driver.isOnline;
        await update(ref(database, `drivers/${authUser.uid}`), { isOnline: newStatus });

        // If driver is coming online and has no active ride, check the waitlist.
        if (newStatus && !driver.currentRideId) {
            const waitlistQuery = query(ref(database, 'waitlist'), orderByChild('timestamp'));
            const snapshot = await get(waitlistQuery);
            if (snapshot.exists()) {
                const waitlistData = snapshot.val();
                const firstWaitlistKey = Object.keys(waitlistData)[0];
                const firstWaitlistEntry = waitlistData[firstWaitlistKey];
                
                showNotification('Ride Matched!', 'You have been matched with a student from the waitlist.');

                // Create a ride for the matched student and driver
                const { studentId, rideDetails } = firstWaitlistEntry;
                const newRideId = push(ref(database, 'rides')).key!;
                
                const newRide: Ride = {
                    ...rideDetails,
                    id: newRideId,
                    studentId: studentId,
                    date: new Date().toISOString(),
                    status: RideStatus.ACTIVE,
                    driverId: authUser.uid,
                };
                
                const updates: { [key: string]: any } = {};
                updates[`/waitlist/${studentId}`] = null;
                updates[`/rides/${newRideId}`] = newRide;
                updates[`/students/${studentId}/isOnWaitlist`] = false;
                updates[`/students/${studentId}/activeRideId`] = newRideId;
                updates[`/drivers/${authUser.uid}/currentRideId`] = newRideId;

                await update(ref(database), updates);
            }
        }
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
        if (!driver?.currentRideId || !activeRide || !authUser || !driverForRide) return;
    
        const rideId = driver.currentRideId;
        const completionTime = new Date();
    
        const { bonus: regularBonus, co2Savings } = calculateDriverBonus(activeRide, driverForRide, completionTime);
    
        let totalBonus = regularBonus;
        let newOnboardingBonusAwarded = driver.onboardingBonusAwarded || false;
    
        if (!driver.onboardingBonusAwarded && (driver.totalRides + 1) >= 10) {
            totalBonus += 250.00;
            newOnboardingBonusAwarded = true;
            showNotification('Bonus Unlocked!', 'You earned a ₹250 sign-up bonus!');
        }
    
        const updates: { [key: string]: any } = {};
        updates[`/rides/${rideId}/status`] = RideStatus.COMPLETED;
        updates[`/rides/${rideId}/completionDate`] = completionTime.toISOString();
        updates[`/rides/${rideId}/co2Savings`] = co2Savings;
        updates[`/rides/${rideId}/bonus`] = totalBonus;
    
        const studentSnapshot = await get(ref(database, `students/${activeRide.studentId}`));
        if (studentSnapshot.exists()) {
            const studentData = studentSnapshot.val() as Student;

            // Create a debit transaction
            const newTransactionRef = push(ref(database, 'transactions'));
            const transactionId = newTransactionRef.key!;
            const debitTransaction: Transaction = {
                id: transactionId,
                type: 'debit',
                amount: activeRide.fare,
                date: completionTime.toISOString(),
                description: `Ride to ${activeRide.destination}`
            };

            const newStudentCo2 = (studentData.totalCo2Savings || 0) + co2Savings;
            updates[`/transactions/${transactionId}`] = debitTransaction;
            updates[`/students/${activeRide.studentId}/activeRideId`] = null;
            updates[`/students/${activeRide.studentId}/recentRides/${rideId}`] = true;
            updates[`/students/${activeRide.studentId}/totalCo2Savings`] = newStudentCo2;
            updates[`/students/${activeRide.studentId}/walletBalance`] = studentData.walletBalance - activeRide.fare;
            updates[`/students/${activeRide.studentId}/transactionHistory/${transactionId}`] = true;
        }
    
        const newDriverCo2 = (driver.totalCo2Savings || 0) + co2Savings;
        updates[`/drivers/${authUser.uid}/currentRideId`] = null;
        updates[`/drivers/${authUser.uid}/earnings`] = driver.earnings + activeRide.fare + totalBonus;
        updates[`/drivers/${authUser.uid}/totalRides`] = driver.totalRides + 1;
        updates[`/drivers/${authUser.uid}/totalCo2Savings`] = newDriverCo2;
        if (newOnboardingBonusAwarded) {
            updates[`/drivers/${authUser.uid}/onboardingBonusAwarded`] = true;
        }
    
        await update(ref(database), updates);
    };
    
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

    const completeDriverOnboarding = async (vehicleDetails: { make: string; model: string; licensePlate: string; }) => {
        if (!authUser || authUser.role !== UserRole.DRIVER) return;
        const updates: { [key: string]: any } = {};
        updates[`/drivers/${authUser.uid}/hasCompletedOnboarding`] = true;
        updates[`/drivers/${authUser.uid}/vehicleDetails`] = vehicleDetails;
        updates[`/drivers/${authUser.uid}/isVerified`] = true;
        await update(ref(database), updates);
    };

    const uploadProfilePicture = async (file: File, userId: string): Promise<string> => {
        const filePath = `profile-pictures/${userId}/${file.name}-${Date.now()}`;
        const fileRef = storage.ref(filePath);
        await fileRef.put(file);
        const url = await fileRef.getDownloadURL();
        return url;
    };

    const updateUserProfile = async (newData: Partial<Student> | Partial<Driver>, newProfilePicFile?: File | null) => {
        if (!authUser) {
            throw new Error('You must be logged in to update your profile.');
        }
    
        const dataToUpdate = { ...newData };
    
        try {
            if (newProfilePicFile) {
                const newPhotoURL = await uploadProfilePicture(newProfilePicFile, authUser.uid);
                dataToUpdate.photoURL = newPhotoURL;
            }
    
            const path = `${authUser.role}s/${authUser.uid}`;
            await update(ref(database, path), dataToUpdate);
            showNotification('Success', 'Profile updated successfully!');
    
        } catch (error) {
            showNotification('Error', 'Failed to update profile.');
            console.error("Profile update error:", error);
            throw error;
        }
    };

    const logout = () => {
        auth.signOut().then(() => {
            setView('dashboard');
            setTransactionHistory([]);
        });
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
        waitlist,
        transactionHistory,
        weeklySchedule,
        ridePlans,
        loading,
        isOnline,
        view,
        setView,
        bookRide,
        joinWaitlist,
        leaveWaitlist,
        addFundsToWallet,
        updateWeeklySchedule,
        acceptRidePlan,
        removeRidePlan,
        cancelRide,
        toggleDriverStatus,
        handleRideRequest,
        completeRide,
        submitRating,
        completeDriverOnboarding,
        uploadProfilePicture,
        updateUserProfile,
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