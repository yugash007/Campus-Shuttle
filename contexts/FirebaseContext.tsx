import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Student, Driver, Ride, RideStatus, UserRole, Transaction, ScheduledEvent, RidePlan, RideType, Coordinates } from '../types';
import { calculateDriverBonus } from '../ai/EcoNudgeEngine';
import { useNotification } from './NotificationContext';

// --- MOCK DATA ---
const MOCK_STUDENT_ID = 'student1';
export const MOCK_DRIVER_ID = 'driver1';

const MOCK_PICKUP_COORDS: Coordinates = { lat: 13.6288, lng: 79.4192 };
const MOCK_DESTINATION_COORDS: Coordinates = { lat: 13.6330, lng: 79.4137 };

const initialMockStudents: { [uid: string]: Student } = {
  [MOCK_STUDENT_ID]: {
    name: 'Alex Taylor',
    role: UserRole.STUDENT,
    walletBalance: 450.50,
    totalRides: 23,
    sharedRides: 15,
    savings: 350.00,
    rating: 4.8,
    activeRideId: null,
    totalCo2Savings: 18.5,
    photoURL: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?q=80&w=2592&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    emergencyContact: { name: 'Jane Doe', phone: '123-456-7890' },
    isOnWaitlist: false,
    age: '21',
    gender: 'Female',
    mobileNumber: '9876543210',
    transactionHistory: { 'tx1': true, 'tx2': true },
    weeklySchedule: {},
    ridePlans: {},
    recentRides: { 'ride3': true, 'ride4': true }
  }
};

const initialMockDrivers: { [uid: string]: Driver } = {
  [MOCK_DRIVER_ID]: {
    name: 'Ben Carter',
    role: UserRole.DRIVER,
    isOnline: true,
    totalRides: 8,
    earnings: 2350.00,
    onlineTime: '4h 30m',
    rating: 4.9,
    ratingCount: 150,
    currentRideId: null,
    location: { lat: 13.6298, lng: 79.4182 },
    weeklyEarnings: [
        { day: 'Mon', earnings: 300 }, { day: 'Tue', earnings: 450 }, { day: 'Wed', earnings: 500 },
        { day: 'Thu', earnings: 400 }, { day: 'Fri', earnings: 700 }, { day: 'Sat', earnings: 0 }, { day: 'Sun', earnings: 0 }
    ],
    isEV: true,
    totalCo2Savings: 35.2,
    hasCompletedOnboarding: true,
    isVerified: true,
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    vehicleDetails: { make: 'TATA', model: 'Nexon EV', licensePlate: 'AP03 EV 4567' },
    age: '34',
    gender: 'Male',
    mobileNumber: '8765432109'
  }
};

const initialMockRides: { [rideId: string]: Ride } = {
  'ride2': { id: 'ride2', pickup: 'Hostel Block C', destination: 'Central Mall', type: RideType.SHARED, fare: 85, date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), status: RideStatus.PENDING, studentId: 'student2', driverId: null, pickupCoords: MOCK_PICKUP_COORDS, destinationCoords: MOCK_DESTINATION_COORDS, bookingType: 'ASAP' },
  'ride3': { id: 'ride3', pickup: 'Library', destination: 'City Bus Stand', type: RideType.SHARED, fare: 90, date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), status: RideStatus.COMPLETED, studentId: MOCK_STUDENT_ID, driverId: MOCK_DRIVER_ID, pickupCoords: MOCK_PICKUP_COORDS, destinationCoords: MOCK_DESTINATION_COORDS, bookingType: 'ASAP' },
  'ride4': { id: 'ride4', pickup: 'MBU Main Gate', destination: 'PVR Cinemas', type: RideType.SOLO, fare: 150, date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: RideStatus.COMPLETED, studentId: MOCK_STUDENT_ID, driverId: MOCK_DRIVER_ID, pickupCoords: MOCK_PICKUP_COORDS, destinationCoords: MOCK_DESTINATION_COORDS, bookingType: 'ASAP' }
};

const initialMockTransactions: { [txId: string]: Transaction } = {
    'tx1': { id: 'tx1', type: 'credit', amount: 500, date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), description: 'Funds added to wallet' },
    'tx2': { id: 'tx2', type: 'debit', amount: 150, date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), description: 'Ride to PVR Cinemas' }
};
// --- END MOCK DATA ---


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
    login: (uid: string, role: UserRole) => void;
    logout: () => void;
    getDriverById: (driverId: string) => Promise<Driver | null>;
}

const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- LOCAL STATE AS MOCK DB ---
    const [students, setStudents] = useState(initialMockStudents);
    const [drivers, setDrivers] = useState(initialMockDrivers);
    const [rides, setRides] = useState(initialMockRides);
    const [transactions, setTransactions] = useState(initialMockTransactions);
    const [scheduledEvents, setScheduledEvents] = useState<{ [id: string]: ScheduledEvent }>({});
    const [ridePlansState, setRidePlansState] = useState<{ [id: string]: RidePlan }>({});

    // --- APP STATE ---
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

    const _executeBookRide = useCallback(async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>, studentId: string) => {
        const newRideId = `ride-${Date.now()}`;
        const newRide: Ride = { ...details, id: newRideId, studentId, date: new Date().toISOString(), status: RideStatus.PENDING };
        setRides(prev => ({ ...prev, [newRideId]: newRide }));
        setStudents(prev => ({ ...prev, [studentId]: { ...prev[studentId], activeRideId: newRideId } }));
    }, []);

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
        } catch (error) { showNotification('Error', 'Failed to book a queued ride. Please try again.'); }
    }, [authUser, showNotification, _executeBookRide]);

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); processBookingQueue(); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, [processBookingQueue]);
    
    // Check for logged in user in localStorage
    useEffect(() => {
        try {
            const session = localStorage.getItem('userSession');
            if (session) {
                const { uid, role } = JSON.parse(session);
                setAuthUser({ uid, email: `${role}@test.com`, role });
            }
        } catch (error) { console.error("Could not parse user session", error); }
        setLoading(false);
    }, []);

    // Effect to derive state from mock DB
    useEffect(() => {
        if (!authUser) {
            setStudent(null); setDriver(null);
            return;
        }
        if (authUser.role === UserRole.STUDENT) {
            const currentStudent = students[authUser.uid];
            setStudent(currentStudent);
            setDriver(null);
            if (currentStudent) {
                const history = Object.values(rides).filter(r => r.studentId === authUser.uid && (r.status === RideStatus.COMPLETED || r.status === RideStatus.CANCELLED)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setRecentRides(history);
                const txHistory = Object.values(transactions).filter(tx => currentStudent.transactionHistory?.[tx.id]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setTransactionHistory(txHistory);
                setWeeklySchedule(Object.values(scheduledEvents).filter(e => currentStudent.weeklySchedule?.[e.id]));
                setRidePlans(Object.values(ridePlansState).filter(p => currentStudent.ridePlans?.[p.id]));
            }
        } else if (authUser.role === UserRole.DRIVER) {
            setDriver(drivers[authUser.uid]);
            setStudent(null);
            setAllRides(Object.values(rides).filter(r => r.status === RideStatus.COMPLETED));
        }
        
        const allRidesList = Object.values(rides);
        const rideId = students[authUser.uid]?.activeRideId || drivers[authUser.uid]?.currentRideId;
        const currentActiveRide = rideId ? rides[rideId] : null;

        if (currentActiveRide && (currentActiveRide.status === RideStatus.ACTIVE || currentActiveRide.status === RideStatus.CONFIRMED)) {
            setActiveRide(currentActiveRide);
            setDriverForRide(currentActiveRide.driverId ? drivers[currentActiveRide.driverId] : null);
        } else {
            setActiveRide(null); setDriverForRide(null);
        }
        setRideRequests(allRidesList.filter(r => r.status === RideStatus.PENDING));

    }, [authUser, students, drivers, rides, transactions, scheduledEvents, ridePlansState]);

    const login = (uid: string, role: UserRole) => {
        const session = JSON.stringify({ uid, role });
        localStorage.setItem('userSession', session);
        setAuthUser({ uid, email: `${role}@test.com`, role });
    };

    const logout = () => {
        localStorage.removeItem('userSession');
        setAuthUser(null);
        setView('dashboard');
    };
    
    const bookRide = async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => {
        if (!authUser) return;
        if (!isOnline) {
             const queue = JSON.parse(localStorage.getItem('bookingQueue') || '[]');
             queue.push(details);
             localStorage.setItem('bookingQueue', JSON.stringify(queue));
             showNotification('You are offline', 'Ride booking queued.');
             return;
        }
        _executeBookRide(details, authUser.uid);
    };

    const joinWaitlist = async (details: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => {
        if (!authUser) return;
        setWaitlist(prev => [...prev, { studentId: authUser.uid, timestamp: Date.now(), rideDetails: details }]);
        setStudents(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], isOnWaitlist: true }}));
        showNotification('Added to Waitlist', 'We will find a driver for you shortly!');
    };

    const leaveWaitlist = async () => {
        if (!authUser) return;
        setWaitlist(prev => prev.filter(item => item.studentId !== authUser.uid));
        setStudents(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], isOnWaitlist: false }}));
        showNotification('Removed from Waitlist', 'You have left the waitlist.');
    };

    const cancelRide = () => {
        if (!student?.activeRideId || !authUser) return;
        const rideId = student.activeRideId;
        const ride = rides[rideId];
        setRides(prev => ({...prev, [rideId]: {...prev[rideId], status: RideStatus.CANCELLED}}));
        setStudents(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], activeRideId: null}}));
        if (ride?.driverId) {
            setDrivers(prev => ({...prev, [ride.driverId!]: {...prev[ride.driverId!], currentRideId: null}}));
        }
    };
    
    const toggleDriverStatus = async () => {
        if (!driver || !authUser) return;
        const newStatus = !driver.isOnline;
        setDrivers(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], isOnline: newStatus}}));
    };

    const handleRideRequest = (rideId: string, accepted: boolean) => {
        if (!authUser || driver?.currentRideId) return;
        const ride = rides[rideId];
        if (!ride) return;
        
        if (accepted) {
            setRides(prev => ({...prev, [rideId]: {...ride, status: RideStatus.ACTIVE, driverId: authUser.uid }}));
            setDrivers(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], currentRideId: rideId}}));
            setStudents(prev => ({...prev, [ride.studentId]: {...prev[ride.studentId], activeRideId: rideId}}));
        } else {
             setRides(prev => ({...prev, [rideId]: {...ride, status: RideStatus.PENDING }})); // Effectively just removes from driver's view for now
        }
    };
    
    const completeRide = async () => {
        if (!driver?.currentRideId || !activeRide || !authUser || !driverForRide) return;
        const rideId = driver.currentRideId;
        const studentId = activeRide.studentId;
        const { bonus, co2Savings } = calculateDriverBonus(activeRide, driverForRide);
        
        // Update ride
        setRides(prev => ({...prev, [rideId]: {...prev[rideId], status: RideStatus.COMPLETED, co2Savings, bonus}}));
        
        // Update student
        const studentUpdate = {
            ...students[studentId],
            activeRideId: null,
            totalRides: (students[studentId].totalRides || 0) + 1,
            sharedRides: activeRide.type === RideType.SHARED ? (students[studentId].sharedRides || 0) + 1 : students[studentId].sharedRides,
            totalCo2Savings: (students[studentId].totalCo2Savings || 0) + co2Savings,
            walletBalance: students[studentId].walletBalance - activeRide.fare,
        };
        setStudents(prev => ({...prev, [studentId]: studentUpdate}));

        // Update driver
        const driverUpdate = {
            ...drivers[authUser.uid],
            currentRideId: null,
            earnings: drivers[authUser.uid].earnings + activeRide.fare + bonus,
            totalRides: (drivers[authUser.uid].totalRides || 0) + 1,
            totalCo2Savings: (drivers[authUser.uid].totalCo2Savings || 0) + co2Savings,
        };
        setDrivers(prev => ({...prev, [authUser.uid]: driverUpdate}));
    };
    
    const submitRating = async (rideId: string, driverId: string, rating: number, feedback: string) => {
        setRides(prev => ({...prev, [rideId]: {...prev[rideId], rating, feedback}}));
        const targetDriver = drivers[driverId];
        if(targetDriver) {
            const currentRating = targetDriver.rating || 0;
            const ratingCount = targetDriver.ratingCount || 0;
            const newRatingCount = ratingCount + 1;
            const newAverageRating = ((currentRating * ratingCount) + rating) / newRatingCount;
            setDrivers(prev => ({...prev, [driverId]: {...targetDriver, rating: parseFloat(newAverageRating.toFixed(2)), ratingCount: newRatingCount}}));
        }
        showNotification('Feedback Received', 'Thank you for rating your ride!');
    };
    
    const completeDriverOnboarding = async (vehicleDetails: { make: string; model: string; licensePlate: string; }) => {
        if (!authUser) return;
        setDrivers(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], hasCompletedOnboarding: true, vehicleDetails, isVerified: true}}));
    };

    const updateUserProfile = async (newData: Partial<Student> | Partial<Driver>, newProfilePicFile?: File | null) => {
        if (!authUser) return;
        const userRef = authUser.role === 'student' ? students[authUser.uid] : drivers[authUser.uid];
        let updatedData = {...userRef, ...newData};
        
        if (newProfilePicFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updatedData.photoURL = reader.result as string;
                if(authUser.role === 'student') setStudents(prev => ({...prev, [authUser.uid]: updatedData as Student}));
                else setDrivers(prev => ({...prev, [authUser.uid]: updatedData as Driver}));
            };
            reader.readAsDataURL(newProfilePicFile);
        } else {
            if(authUser.role === 'student') setStudents(prev => ({...prev, [authUser.uid]: updatedData as Student}));
            else setDrivers(prev => ({...prev, [authUser.uid]: updatedData as Driver}));
        }
        showNotification('Success', 'Profile updated successfully!');
    };
    
    const getDriverById = async (driverId: string): Promise<Driver | null> => {
        return drivers[driverId] || null;
    }
    
    const addFundsToWallet = async (amount: number) => {
        if (!authUser || !student) return;
        const txId = `tx-${Date.now()}`;
        setTransactions(prev => ({...prev, [txId]: {id: txId, type: 'credit', amount, date: new Date().toISOString(), description: 'Funds added to wallet'}}));
        setStudents(prev => ({...prev, [authUser.uid]: {...student, walletBalance: student.walletBalance + amount, transactionHistory: {...student.transactionHistory, [txId]: true}}}));
    };

    const updateWeeklySchedule = async (events: ScheduledEvent[]) => {
        if(!authUser) return;
        const newScheduleLinks: { [key:string]: boolean} = {};
        const newEventsState: {[key:string]: ScheduledEvent} = {};
        events.forEach(e => {
            newScheduleLinks[e.id] = true;
            newEventsState[e.id] = e;
        });
        setScheduledEvents(newEventsState);
        setStudents(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], weeklySchedule: newScheduleLinks}}));
        showNotification('Schedule Saved', 'Your weekly schedule has been updated.');
    };
    const acceptRidePlan = async (plan: Omit<RidePlan, 'id'>) => {
        if(!authUser) return;
        const planId = `plan-${Date.now()}`;
        const newPlan = {...plan, id: planId};
        setRidePlansState(prev => ({...prev, [planId]: newPlan}));
        setStudents(prev => ({...prev, [authUser.uid]: {...prev[authUser.uid], ridePlans: {...prev[authUser.uid].ridePlans, [planId]: true}}}));
        showNotification('Plan Saved', `Recurring ride for ${plan.forEvent} has been saved.`);
    };
    const removeRidePlan = async (planId: string) => {
        if(!authUser) return;
        setRidePlansState(prev => {
            const next = {...prev}; delete next[planId]; return next;
        });
        showNotification('Plan Removed', 'The recurring ride plan has been deleted.');
    };

    const value: FirebaseContextState = {
        authUser, student, driver, activeRide, driverForRide, rideRequests, recentRides, allRides, waitlist,
        transactionHistory, weeklySchedule, ridePlans, loading, isOnline, view, setView,
        bookRide, joinWaitlist, leaveWaitlist, cancelRide, toggleDriverStatus, handleRideRequest, completeRide,
        submitRating, completeDriverOnboarding, updateUserProfile, login, logout, getDriverById, addFundsToWallet,
        updateWeeklySchedule, acceptRidePlan, removeRidePlan,
        // This is a mocked version of uploadProfilePicture, it doesn't actually upload.
        uploadProfilePicture: (file: File) => new Promise((resolve) => resolve(URL.createObjectURL(file))),
    };

    return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
};

export const useFirebase = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) { throw new Error('useFirebase must be used within a FirebaseProvider'); }
    return context;
};
