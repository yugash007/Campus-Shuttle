export enum UserRole {
  STUDENT = 'student',
  DRIVER = 'driver',
}

export interface User {
  uid: string;
  email: string | null;
  role: UserRole;
}

export enum RideType {
  SOLO = 'Solo',
  SHARED = 'Shared',
}

export enum RideStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  ACTIVE = 'Active',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Ride {
  id: string;
  pickup: string;
  destination: string;
  type: RideType;
  fare: number;
  date: string; // This will now be the booking date
  status: RideStatus;
  groupSize?: number;
  driverId?: string | null;
  studentId: string;
  pickupCoords: Coordinates;
  destinationCoords: Coordinates;
  bookingType: 'ASAP' | 'Scheduled';
  scheduledTime?: string; // ISO string for scheduled rides
  co2Savings?: number; // in kg
  rating?: number;
  feedback?: string;
}

export interface Student {
  name: string;
  role: UserRole.STUDENT;
  walletBalance: number;
  totalRides: number;
  sharedRides: number;
  savings: number;
  rating: number;
  activeRideId: string | null;
  recentRides?: { [rideId: string]: boolean };
  totalCo2Savings?: number; // in kg
}

export interface Driver {
  name: string;
  role: UserRole.DRIVER;
  isOnline: boolean;
  totalRides: number;
  earnings: number;
  onlineTime: string;
  rating: number;
  ratingCount?: number;
  currentRideId: string | null;
  location: Coordinates;
  weeklyEarnings: { day: string; earnings: number }[];
  isEV?: boolean;
  totalCo2Savings?: number; // in kg
}