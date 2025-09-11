// FIX: Refactored the entire hook to align with the types defined in `types.ts`.
// This resolves multiple errors related to incorrect data structures and properties.
import { useState, useCallback } from 'react';
// FIX: Import UserRole to be used in mock data.
import { Student, Driver, Ride, RideStatus, RideType, Coordinates, UserRole } from '../types';

const MOCK_COORDS_1: Coordinates = { lat: 13.6288, lng: 79.4192 };
const MOCK_COORDS_2: Coordinates = { lat: 13.6330, lng: 79.4137 };

const allMockRides: { [id: string]: Ride } = {
  'ride123': {
    id: 'ride123',
    pickup: 'MBU Main Gate',
    destination: 'Tirupati Railway Station',
    type: RideType.SHARED,
    fare: 120,
    date: 'Today',
    status: RideStatus.ACTIVE,
    groupSize: 2,
    driverId: 'auto1',
    studentId: 'student1',
    pickupCoords: MOCK_COORDS_1,
    destinationCoords: MOCK_COORDS_2,
    // FIX: Added missing 'bookingType' property to conform to the Ride type.
    bookingType: 'ASAP',
  },
  'ride122': {
    id: 'ride122', pickup: 'Library', destination: 'Hostel Block C', type: RideType.SOLO, fare: 50, date: 'Yesterday', status: RideStatus.COMPLETED, studentId: 'student1', driverId: 'auto1',
    pickupCoords: MOCK_COORDS_1, destinationCoords: MOCK_COORDS_2,
    // FIX: Added missing 'bookingType' property to conform to the Ride type.
    bookingType: 'ASAP',
  },
  'ride121': {
    id: 'ride121', pickup: 'MBU Main Gate', destination: 'Sports Complex', type: RideType.SHARED, fare: 40, date: '2 days ago', status: RideStatus.COMPLETED, studentId: 'student1', driverId: 'auto1',
    pickupCoords: MOCK_COORDS_1, destinationCoords: MOCK_COORDS_2,
    // FIX: Added missing 'bookingType' property to conform to the Ride type.
    bookingType: 'ASAP',
  },
  'rideReq1': {
    id: 'rideReq1', pickup: 'Admin Block', destination: 'Central Perk Cafe', type: RideType.SOLO, fare: 60, date: 'Now', status: RideStatus.PENDING, studentId: 'student2',
    pickupCoords: MOCK_COORDS_1, destinationCoords: MOCK_COORDS_2, driverId: null,
    // FIX: Added missing 'bookingType' property to conform to the Ride type.
    bookingType: 'ASAP',
  },
  'rideReq2': {
    id: 'rideReq2', pickup: 'Engineering Dept', destination: 'MBU Main Gate', type: RideType.SHARED, groupSize: 3, fare: 150, date: 'Now', status: RideStatus.PENDING, studentId: 'student3',
    pickupCoords: MOCK_COORDS_1, destinationCoords: MOCK_COORDS_2, driverId: null,
    // FIX: Added missing 'bookingType' property to conform to the Ride type.
    bookingType: 'ASAP',
  }
};


const initialStudentData: Student = {
  name: 'Alex',
  // FIX: Added missing 'role' property to conform to the Student type.
  role: UserRole.STUDENT,
  walletBalance: 250.50,
  totalRides: 42,
  sharedRides: 18,
  savings: 350.00,
  rating: 4.8,
  activeRideId: 'ride123',
  recentRides: {
    'ride122': true,
    'ride121': true,
  },
};

const initialDriverData: Driver = {
  name: 'Ravi',
  // FIX: Added missing 'role' property to conform to the Driver type.
  role: UserRole.DRIVER,
  isOnline: true,
  totalRides: 15,
  earnings: 1250,
  onlineTime: '4h 30m',
  rating: 4.9,
  currentRideId: null,
  location: { lat: 13.629, lng: 79.415 },
  weeklyEarnings: [
    { day: 'Mon', earnings: 1200 },
    { day: 'Tue', earnings: 1500 },
    { day: 'Wed', earnings: 1300 },
    { day: 'Thu', earnings: 1800 },
    { day: 'Fri', earnings: 2100 },
    { day: 'Sat', earnings: 2500 },
    { day: 'Sun', earnings: 1600 },
  ],
};


export const useMockData = () => {
  const [studentData, setStudentData] = useState<Student>(initialStudentData);
  const [driverData, setDriverData] = useState<Driver>(initialDriverData);
  const [rides, setRides] = useState<{ [id: string]: Ride }>(allMockRides);
  const [rideRequests, setRideRequests] = useState<Ride[]>(() => Object.values(allMockRides).filter(r => r.status === RideStatus.PENDING));

  const toggleDriverStatus = useCallback(() => {
    setDriverData(prev => ({ ...prev, isOnline: !prev.isOnline }));
  }, []);

  const handleRideRequest = useCallback((rideId: string, accepted: boolean) => {
    const request = rideRequests.find(r => r.id === rideId);
    if (!request) return;
    
    setRideRequests(prev => prev.filter(r => r.id !== rideId));

    if (accepted && !driverData.currentRideId) {
      setDriverData(prev => ({...prev, currentRideId: rideId}));
      setRides(prev => ({ ...prev, [rideId]: { ...request, status: RideStatus.ACTIVE, driverId: 'driver1' }}));
    }
  }, [rideRequests, driverData.currentRideId]);
  
  const completeRide = useCallback(() => {
    if(!driverData.currentRideId) return;
    const rideId = driverData.currentRideId;
    const completedRide = rides[rideId];
    if(!completedRide) return;

    const rideFare = completedRide.fare;
    const isNightRide = new Date().getHours() >= 21; // Check for post-9 PM
    const bonus = isNightRide ? 20 : 0;
    
    setDriverData(prev => ({
        ...prev,
        currentRideId: null,
        totalRides: prev.totalRides + 1,
        earnings: prev.earnings + rideFare + bonus
    }));

    setRides(prev => ({ ...prev, [rideId]: { ...completedRide, status: RideStatus.COMPLETED }}));
    
    if (studentData.activeRideId === rideId) {
      setStudentData(prev => ({
        ...prev,
        activeRideId: null,
        recentRides: { ...prev.recentRides, [rideId]: true }
      }));
    }

  }, [driverData.currentRideId, rides, studentData.activeRideId]);

  const cancelRide = useCallback(() => {
    if (!studentData.activeRideId) return;
    const rideId = studentData.activeRideId;
    const rideToCancel = rides[rideId];
    
    setStudentData(prev => ({ ...prev, activeRideId: null }));
    
    if (rideToCancel) {
      setRides(prev => ({ ...prev, [rideId]: { ...rideToCancel, status: RideStatus.CANCELLED }}));
    }

    if (driverData.currentRideId === rideId) {
      setDriverData(prev => ({...prev, currentRideId: null}));
    }
  }, [studentData.activeRideId, driverData.currentRideId, rides]);

  const bookRide = useCallback((rideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>) => {
    const newRideId = `ride-${Date.now()}`;
    const newActiveRide: Ride = {
      id: newRideId,
      studentId: 'student1',
      date: new Date().toISOString(),
      status: RideStatus.PENDING,
      driverId: null,
      ...rideDetails,
    };
    setRides(prev => ({...prev, [newRideId]: newActiveRide }));
    setRideRequests(prev => [...prev, newActiveRide]);
    setStudentData(prev => ({ ...prev, activeRideId: newActiveRide.id }));
  }, []);

  return { studentData, driverData, toggleDriverStatus, handleRideRequest, completeRide, cancelRide, bookRide };
};