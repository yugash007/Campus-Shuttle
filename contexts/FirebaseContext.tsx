
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import { auth, database, storage } from '../firebase';
// FIX: The modular imports are not available in the compat library.
// All database calls have been updated to use the v8 compat syntax (e.g., database.ref()).
import { User, Student, Driver, Ride, RideStatus, UserRole, Transaction, ScheduledEvent, RidePlan, RideType, WaitlistItem } from '../types';
import { calculateDriverBonus } from '../ai/EcoNudgeEngine';
import { useNotification } from './NotificationContext';
import { achievementsList } from '../data/achievements';

type ViewType = 'dashboard' | 'profile' | 'wallet' | 'scheduler' | 'heatmap';

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
    acceptWaitlistedRide: (waitlistItem: WaitlistItem) => void;
    addFundsToWallet: (amount: number) => Promise<void>;
    updateWeeklySchedule: (events: ScheduledEvent[]) => Promise<void>;
    acceptRidePlan: (plan: Omit<RidePlan, 'id'>) => Promise<void>;
    removeRidePlan: (planId: string) => Promise<void>;
    cancelRide: (reason: string) => void;
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
        const rideRequestRef = database.ref('ride-requests');
        const newRequestNode = rideRequestRef.push();
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

        await database.ref().update(updates);
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
                let snapshot = await database.ref(`students/${firebaseUser.uid}`).get();
                if (snapshot.exists()) {
                    const studentData = snapshot.val() as Student;
                    setAuthUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: UserRole.STUDENT });
                    setStudent(studentData);
                    setDriver(null); // Clear driver data
                } else {
                    // Check if user is a driver
                    snapshot = await database.ref(`drivers/${firebaseUser.uid}`).get();
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
        const dataPromises = dataIds.map(id => database.ref(`${path}/${id}`).get());
        const snapshots = await Promise.all(dataPromises);
        return snapshots.map(snap => snap.val()).filter(Boolean);
    }, []);

    // Effect for listening to user-specific data updates and caching
    useEffect(() => {
        if (!authUser) return;

        const unsubscribes: (() => void)[] = [];
        
        if (authUser.role === UserRole.STUDENT) {
            // Load initial ride history from cache
            const cachedHistoryRaw = localStorage.getItem(`rideHistoryCache_${authUser.uid}`);
            if (cachedHistoryRaw) {
                setRecentRides(JSON.parse(cachedHistoryRaw));
            }

            const studentRef = database.ref(`students/${authUser.uid}`);
            const studentCallback = async (snapshot: firebase.database.DataSnapshot) => {
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
            };
            studentRef.on('value', studentCallback);
            unsubscribes.push(() => studentRef.off('value', studentCallback));


            const ridesRef = database.ref('rides');
            const ridesCallback = (snapshot: firebase.database.DataSnapshot) => {
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
            };
            ridesRef.on('value', ridesCallback);
            unsubscribes.push(() => ridesRef.off('value', ridesCallback));

        } else if (authUser.role === UserRole.DRIVER) {
            const driverRef = database.ref(`drivers/${authUser.uid}`);
            const driverCallback = (snapshot: firebase.database.DataSnapshot) => setDriver(snapshot.val());
            driverRef.on('value', driverCallback);
            unsubscribes.push(() => driverRef.off('value', driverCallback));

            // Add listener for all rides for the driver's heatmap
            const allRidesRef = database.ref('rides');
            const allRidesCallback = (snapshot: firebase.database.DataSnapshot) => {
                const ridesData = snapshot.val() || {};
                const ridesList = Object.values(ridesData) as Ride[];
                setAllRides(ridesList.filter(ride => ride.status === RideStatus.COMPLETED));
            };
            allRidesRef.on('value', allRidesCallback);
            unsubscribes.push(() => allRidesRef.off('value', allRidesCallback));
        }
        
        const requestsRef = database.ref('ride-requests');
        const requestsCallback = (snapshot: firebase.database.DataSnapshot) => {
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
        };
        requestsRef.on('value', requestsCallback);
        unsubscribes.push(() => requestsRef.off('value', requestsCallback));


        const waitlistRef = database.ref('waitlist').orderByChild('timestamp');
        const waitlistCallback = (snapshot: firebase.database.DataSnapshot) => {
            const waitlistData = snapshot.val() || {};
            const waitlistArray = Object.keys(waitlistData).map(key => ({
                studentId: key,
                ...waitlistData[key]
            }));
            setWaitlist(waitlistArray);
        };
        waitlistRef.on('value', waitlistCallback);
        unsubscribes.push(() => waitlistRef.off('value', waitlistCallback));

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [authUser, fetchLinkedData]);

    // Effect for tracking active ride
    useEffect(() => {
        const rideId = student?.activeRideId || driver?.currentRideId;
        
        if (!rideId) {
            setActiveRide(null);
            setDriverForRide(null);
            return;
        }

        let unsubscribeDriverForRide: (() => void) | null = null;
        
        const rideRef = database.ref(`rides/${rideId}`);
        const rideCallback = (snapshot: firebase.database.DataSnapshot) => {
            const rideData = snapshot.val() as Ride;
            if (rideData && (rideData.status === RideStatus.ACTIVE || rideData.status === RideStatus.PENDING || rideData.status === RideStatus.CONFIRMED)) {
                setActiveRide(rideData);

                // Clean up previous driver listener to prevent leaks
                if (unsubscribeDriverForRide) {
                    unsubscribeDriverForRide();
                    unsubscribeDriverForRide = null;
                }

                if (rideData.driverId) {
                    const driverForRideRef = database.ref(`drivers/${rideData.driverId}`);
                    const driverCallback = (driverSnapshot: firebase.database.DataSnapshot) => {
                        setDriverForRide(driverSnapshot.val());
                    };
                    driverForRideRef.on('value', driverCallback);
                    unsubscribeDriverForRide = () => driverForRideRef.off('value', driverCallback);
                } else {
                    setDriverForRide(null);
                }
            } else {
                setActiveRide(null);
                setDriverForRide(null);
            }
        };

        rideRef.on('value', rideCallback);

        return () => {
            rideRef.off('value', rideCallback);
            if (unsubscribeDriverForRide) {
                unsubscribeDriverForRide();
            }
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
    }, [authUser, isOnline, showNotification, _executeBookRide]);
    
    const joinWaitlist = useCallback(async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        
        const waitlistEntry = {
            rideDetails: details,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        const updates: { [key: string]: any } = {};
        updates[`/waitlist/${authUser.uid}`] = waitlistEntry;
        updates[`/students/${authUser.uid}/isOnWaitlist`] = true;
        
        await database.ref().update(updates);
        showNotification('Added to Waitlist', 'We will find a driver for you shortly!');
    }, [authUser, showNotification]);

    const leaveWaitlist = useCallback(async () => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        
        const updates: { [key: string]: any } = {};
        updates[`/waitlist/${authUser.uid}`] = null;
        updates[`/students/${authUser.uid}/isOnWaitlist`] = false;
        
        await database.ref().update(updates);
        showNotification('Removed from Waitlist', 'You have left the waitlist.');
    }, [authUser, showNotification]);

    const acceptWaitlistedRide = async (waitlistItem: WaitlistItem) => {
        if (!authUser || authUser.role !== UserRole.DRIVER || driver?.currentRideId) {
            showNotification('Error', 'Cannot accept ride now.');
            return;
        }
    
        const { studentId, rideDetails } = waitlistItem;
        const newRideId = database.ref('rides').push().key!;
    
        const newRide: Ride = {
            ...rideDetails,
            id: newRideId,
            studentId: studentId,
            date: new Date().toISOString(),
            status: RideStatus.ACTIVE, // Start ride immediately
            driverId: authUser.uid,
        };
    
        const updates: { [key: string]: any } = {};
        updates[`/waitlist/${studentId}`] = null; // Remove from waitlist
        updates[`/rides/${newRideId}`] = newRide;
        updates[`/students/${studentId}/isOnWaitlist`] = false;
        updates[`/students/${studentId}/activeRideId`] = newRideId;
        updates[`/drivers/${authUser.uid}/currentRideId`] = newRideId;
    
        await database.ref().update(updates);
        showNotification('Ride Started', `You have accepted the ride for the waitlisted student.`);
    };

    const addFundsToWallet = async (amount: number) => {
        if (!authUser || !student) {
            throw new Error("User not authenticated or not a student.");
        }

        const newTransactionRef = database.ref('transactions').push();
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

        await database.ref().update(updates);
    };
    
    const updateWeeklySchedule = async (events: ScheduledEvent[]) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
    
        const updates: { [key: string]: any } = {};
        const newScheduleLinks: { [key: string]: boolean } = {};
    
        for (const event of events) {
            let eventId = event.id;
            if (!eventId || !eventId.startsWith('event-')) {
                eventId = database.ref('scheduled-events').push().key!;
            }
            updates[`/scheduled-events/${eventId}`] = { ...event, id: eventId };
            newScheduleLinks[eventId] = true;
        }
    
        // To remove deleted events, we overwrite the links
        updates[`/students/${authUser.uid}/weeklySchedule`] = newScheduleLinks;
    
        await database.ref().update(updates);
        showNotification('Schedule Saved', 'Your weekly schedule has been updated.');
    };
    
    const acceptRidePlan = async (plan: Omit<RidePlan, 'id'>) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        const newPlanRef = database.ref('ride-plans').push();
        const planId = newPlanRef.key!;
        
        const newPlan: RidePlan = { ...plan, id: planId };

        const updates: { [key: string]: any } = {};
        updates[`/ride-plans/${planId}`] = newPlan;
        updates[`/students/${authUser.uid}/ridePlans/${planId}`] = true;
        
        await database.ref().update(updates);
        showNotification('Plan Saved', `Recurring ride for ${plan.forEvent} has been saved.`);
    };

    const removeRidePlan = async (planId: string) => {
        if (!authUser || authUser.role !== UserRole.STUDENT) return;
        
        const updates: { [key: string]: any } = {};
        updates[`/ride-plans/${planId}`] = null;
        updates[`/students/${authUser.uid}/ridePlans/${planId}`] = null;
        
        await database.ref().update(updates);
        showNotification('Plan Removed', 'The recurring ride plan has been deleted.');
    };


    const cancelRide = (reason: string) => {
        if (!student?.activeRideId || !authUser) return;
        const rideId = student.activeRideId;
        const updates: { [key: string]: any } = {};
        updates[`/rides/${rideId}/status`] = RideStatus.CANCELLED;
        updates[`/rides/${rideId}/cancellationReason`] = reason;
        updates[`/students/${authUser.uid}/activeRideId`] = null;
        if(activeRide?.driverId) {
             updates[`/drivers/${activeRide.driverId}/currentRideId`] = null;
        }
        database.ref(`ride-requests/${rideId}`).remove();
        database.ref().update(updates);
    };
    
    const toggleDriverStatus = async () => {
        if (!driver || !authUser || authUser.role !== UserRole.DRIVER) return;
        const newStatus = !driver.isOnline;
        await database.ref(`drivers/${authUser.uid}`).update({ isOnline: newStatus });
    };

    const handleRideRequest = (rideId: string, accepted: boolean) => {
        if (!authUser || authUser.role !== UserRole.DRIVER || driver?.currentRideId) return;

        database.ref(`ride-requests/${rideId}`).remove();
        
        if (accepted) {
            database.ref(`rides/${rideId}`).get().then(snapshot => {
                if(snapshot.exists()) {
                    const rideData = snapshot.val() as Ride;
                    const updates: { [key: string]: any } = {};
                    updates[`/rides/${rideId}/status`] = RideStatus.ACTIVE;
                    updates[`/rides/${rideId}/driverId`] = authUser.uid;
                    updates[`/drivers/${authUser.uid}/currentRideId`] = rideId;
                    database.ref().update(updates);
                }
            });
        }
    };
    
    const _checkAndAwardAchievements = async (studentId: string, completedRide: Ride) => {
        const studentSnapshot = await database.ref(`students/${studentId}`).get();
        if (!studentSnapshot.exists()) return;
        const studentData = studentSnapshot.val() as Student;
        
        const studentAchievements = studentData.achievements || {};
        const updates: { [key: string]: any } = {};

        // 1. First Ride Achievement
        if (!studentAchievements['first-ride']) {
            const achievement = achievementsList.find(a => a.id === 'first-ride')!;
            updates[`/students/${studentId}/achievements/first-ride`] = true;
            showNotification('Achievement Unlocked!', achievement.name);
        }

        // 2. Ten Rides Achievement
        if (!studentAchievements['ten-rides'] && (studentData.totalRides + 1) >= 10) {
            const achievement = achievementsList.find(a => a.id === 'ten-rides')!;
            updates[`/students/${studentId}/achievements/ten-rides`] = true;
            showNotification('Achievement Unlocked!', achievement.name);
        }

        // 3. Five Shared Rides Achievement
        if (!studentAchievements['five-shared'] && completedRide.type === RideType.SHARED) {
            const newSharedRidesCount = (studentData.sharedRides || 0) + 1;
            if (newSharedRidesCount >= 5) {
                const achievement = achievementsList.find(a => a.id === 'five-shared')!;
                updates[`/students/${studentId}/achievements/five-shared`] = true;
                showNotification('Achievement Unlocked!', achievement.name);
            }
        }
        
        // 4. Night Owl Achievement
        const rideHour = new Date(completedRide.date).getHours();
        if (!studentAchievements['night-ride'] && (rideHour >= 22 || rideHour < 5)) {
             const achievement = achievementsList.find(a => a.id === 'night-ride')!;
             updates[`/students/${studentId}/achievements/night-ride`] = true;
             showNotification('Achievement Unlocked!', achievement.name);
        }
        
        if (Object.keys(updates).length > 0) {
            await database.ref().update(updates);
        }
    };

    const completeRide = async () => {
        if (!driver?.currentRideId || !activeRide || !authUser || !driverForRide) return;
    
        const rideId = driver.currentRideId;
        const completionTime = new Date();
    
        const { bonus: regularBonus, co2Savings } = calculateDriverBonus(activeRide, driverForRide, completionTime);
    
        let totalBonus = regularBonus;
        let newOnboardingBonusAwarded = driver.onboardingBonusAwarded || false;
    
        // Check for onboarding bonus eligibility
        if (!driver.onboardingBonusAwarded && (driver.totalRides + 1) >= 10) {
            totalBonus += 250.00;
            newOnboardingBonusAwarded = true;
            showNotification('Bonus Unlocked!', 'You earned a ₹250 sign-up bonus!');
        }
    
        const updates: { [key: string]: any } = {};

        // Update ride object
        updates[`/rides/${rideId}/status`] = RideStatus.COMPLETED;
        updates[`/rides/${rideId}/completionDate`] = completionTime.toISOString();
        updates[`/rides/${rideId}/co2Savings`] = co2Savings;
        updates[`/rides/${rideId}/bonus`] = totalBonus;
    
        // Create a debit transaction for student
        const newTransactionRef = database.ref('transactions').push();
        const transactionId = newTransactionRef.key!;
        const debitTransaction: Transaction = {
            id: transactionId,
            type: 'debit',
            amount: activeRide.fare,
            date: completionTime.toISOString(),
            description: `Ride to ${activeRide.destination}`
        };
        updates[`/transactions/${transactionId}`] = debitTransaction;
        
        // Update student object
        const studentId = activeRide.studentId;
        updates[`/students/${studentId}/activeRideId`] = null;
        updates[`/students/${studentId}/recentRides/${rideId}`] = true;
        updates[`/students/${studentId}/transactionHistory/${transactionId}`] = true;
        
        // Use atomic increments for student stats
        updates[`/students/${studentId}/totalRides`] = firebase.database.ServerValue.increment(1);
        if (activeRide.type === RideType.SHARED) {
            updates[`/students/${studentId}/sharedRides`] = firebase.database.ServerValue.increment(1);
        }
        updates[`/students/${studentId}/totalCo2Savings`] = firebase.database.ServerValue.increment(co2Savings);
        updates[`/students/${studentId}/walletBalance`] = firebase.database.ServerValue.increment(-activeRide.fare);
        
        // Update driver object
        updates[`/drivers/${authUser.uid}/currentRideId`] = null;
        if (newOnboardingBonusAwarded) {
            updates[`/drivers/${authUser.uid}/onboardingBonusAwarded`] = true;
        }

        // Use atomic increments for driver stats
        updates[`/drivers/${authUser.uid}/earnings`] = firebase.database.ServerValue.increment(activeRide.fare + totalBonus);
        updates[`/drivers/${authUser.uid}/totalRides`] = firebase.database.ServerValue.increment(1);
        updates[`/drivers/${authUser.uid}/totalCo2Savings`] = firebase.database.ServerValue.increment(co2Savings);
    
        await database.ref().update(updates);
        await _checkAndAwardAchievements(studentId, activeRide);
    };
    
    const submitRating = async (rideId: string, driverId: string, rating: number, feedback: string) => {
        // Check if the user is a student before proceeding
        if (!authUser || authUser.role !== UserRole.STUDENT) {
            showNotification('Error', 'Only students can rate rides.');
            return;
        }
    
        try {
            const driverRef = database.ref(`drivers/${driverId}`);
            const driverSnapshot = await driverRef.get();
    
            if (!driverSnapshot.exists()) {
                console.error("Driver not found for rating.");
                showNotification('Error', 'Could not find driver details to submit rating.');
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
    
            await database.ref().update(updates);
            showNotification('Feedback Received', 'Thank you for rating your ride!');
    
        } catch (error) {
            console.error("Error submitting rating:", error);
            showNotification('Error', 'Failed to submit rating. Please try again.');
        }
    };

    const completeDriverOnboarding = async (vehicleDetails: { make: string; model: string; licensePlate: string; }) => {
        if (!authUser || authUser.role !== UserRole.DRIVER) return;
        const updates: { [key: string]: any } = {};
        updates[`/drivers/${authUser.uid}/hasCompletedOnboarding`] = true;
        updates[`/drivers/${authUser.uid}/vehicleDetails`] = vehicleDetails;
        updates[`/drivers/${authUser.uid}/isVerified`] = true;
        await database.ref().update(updates);
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
            await database.ref(path).update(dataToUpdate);
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
        acceptWaitlistedRide,
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