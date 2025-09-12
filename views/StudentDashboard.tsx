
declare namespace google {
    namespace maps {
        interface LatLngLiteral {
            lat: number;
            lng: number;
        }
    }
}

import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { Ride, RideType, RideStatus, Driver, FareBreakdownDetails, Coordinates } from '../types';
import GoogleMap from '../components/GoogleMap';
import MapPlaceholder from '../components/MapPlaceholder';
import { getStudentNudge, Nudge } from '../ai/EcoNudgeEngine';
import EcoAnalytics from '../components/EcoAnalytics';
import { useNotification } from '../contexts/NotificationContext';
import { calculateFare } from '../ai/FareCalculator';
import FareBreakdownModal from '../components/FareBreakdownModal';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';

const MOCK_PICKUP_COORDS = { lat: 13.6288, lng: 79.4192 };
const MOCK_DESTINATION_COORDS = { lat: 13.6330, lng: 79.4137 };

// Helper function to calculate distance between two lat/lng points (Haversine formula)
const getDistanceInKm = (p1: Coordinates, p2: Coordinates): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};


const StudentDashboard: React.FC = () => {
    const { 
        authUser, student, activeRide, driverForRide, recentRides, 
        cancelRide, bookRide, loading, submitRating,
        joinWaitlist, leaveWaitlist, waitlist, setView
    } = useFirebase();
    const { showNotification } = useNotification();
    
    // State for booking form
    const [rideType, setRideType] = useState<RideType>(RideType.SOLO);
    const [bookingType, setBookingType] = useState<'ASAP' | 'Scheduled'>('ASAP');
    const [pickup, setPickup] = useState("MBU Main Gate");
    const [destination, setDestination] = useState("Tirupati Railway Station");
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [ecoNudge, setEcoNudge] = useState<Nudge | null>(null);
    const [noDriversAvailable, setNoDriversAvailable] = useState(false);
    
    // State for map
    const [mapsApiLoaded, setMapsApiLoaded] = useState((window as any).googleMapsApiLoaded || false);
    const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);

    // State for rating modal
    const [rideToRate, setRideToRate] = useState<{ride: Ride, driver: Driver | null} | null>(null);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const prevRecentRidesLength = useRef(recentRides.length);

    // State for fare calculation
    const [fareDetails, setFareDetails] = useState<FareBreakdownDetails | null>(null);
    const [showFareModal, setShowFareModal] = useState(false);
    const [showSosModal, setShowSosModal] = useState(false);

    useEffect(() => {
        // Simulate driver availability for shared rides
        setNoDriversAvailable(rideType === RideType.SHARED && Math.random() > 0.5);
    }, [rideType]);

    useEffect(() => {
        const partialRideDetails = {
            pickup,
            destination,
            type: rideType,
            bookingType,
            scheduledTime: bookingType === 'Scheduled' && scheduledDate && scheduledTime
                ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
                : new Date().toISOString()
        };
        const details = calculateFare(partialRideDetails);
        setFareDetails(details);
    }, [pickup, destination, rideType, bookingType, scheduledDate, scheduledTime]);


    useEffect(() => {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ lat: latitude, lng: longitude });
            },
            (error) => {
                console.error("Error getting user location:", error.message);
                showNotification('Location Error', 'Could not access your location. Using a default starting point.');
                setUserLocation({ lat: 13.6288, lng: 79.4192 }); 
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [showNotification]);

    // Check for completed rides to show rating modal
    useEffect(() => {
        // When a new ride is added to history, check if it needs rating.
        if (recentRides.length > prevRecentRidesLength.current) {
            const lastRide = recentRides[0]; // Assuming sorted by date desc

            // Check if it's a completed ride and doesn't have a rating yet
            if (lastRide && lastRide.status === RideStatus.COMPLETED && lastRide.rating === undefined) {
                
                const fetchDriver = async (driverId: string) => {
                    try {
                        const driverSnapshot = await get(ref(database, `drivers/${driverId}`));
                        if (driverSnapshot.exists()) {
                            return driverSnapshot.val() as Driver;
                        }
                    } catch (error) {
                        console.error("Error fetching driver for rating modal:", error);
                    }
                    return null;
                };

                if (lastRide.driverId) {
                    fetchDriver(lastRide.driverId).then(driver => {
                        setRideToRate({ ride: lastRide, driver });
                    });
                }
            }
        }
        prevRecentRidesLength.current = recentRides.length;
    }, [recentRides]);

    const handleBookingAction = () => {
        if (!fareDetails) {
            showNotification('Error', 'Fare could not be calculated.');
            return;
        }

        let rideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'> = {
            pickup: pickup,
            destination: destination,
            type: rideType,
            fare: fareDetails.totalFare,
            pickupCoords: userLocation || MOCK_PICKUP_COORDS,
            destinationCoords: MOCK_DESTINATION_COORDS,
            bookingType: bookingType,
            ...(rideType === RideType.SHARED && { groupSize: 1 })
        };

        if (bookingType === 'Scheduled') {
            if (scheduledDate && scheduledTime) {
                rideDetails.scheduledTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            } else {
                alert("Please select a date and time for your scheduled ride.");
                return;
            }
        }
        
        if (noDriversAvailable) {
            joinWaitlist(rideDetails);
            return;
        }

        const nudge = getStudentNudge(rideDetails);
        if (nudge) {
            setEcoNudge(nudge);
        } else {
            bookRide(rideDetails);
        }
    };

    const handleNudgeResponse = (accepted: boolean) => {
        if (accepted && ecoNudge) {
            bookRide(ecoNudge.modifiedRideDetails);
        } else {
             if (!fareDetails) return;
             let originalRideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'> = {
                pickup: pickup,
                destination: destination,
                type: rideType,
                fare: fareDetails.totalFare,
                pickupCoords: userLocation || MOCK_PICKUP_COORDS,
                destinationCoords: MOCK_DESTINATION_COORDS,
                bookingType: bookingType,
            };
            bookRide(originalRideDetails);
        }
        setEcoNudge(null);
    };

    const handleRatingSubmit = () => {
        if (rideToRate && rideToRate.ride.driverId) {
            submitRating(rideToRate.ride.id, rideToRate.ride.driverId, rating, feedback);
            setRideToRate(null);
            setRating(0);
            setFeedback('');
        }
    };
    
    if (!student) {
        return <div className="d-flex justify-content-center align-items-center vh-100"><p className="text-white">Loading Student Dashboard...</p></div>;
    }

    const rideProgressPercentage = (() => {
        if (!activeRide || !driverForRide?.location || !activeRide.pickupCoords || !activeRide.destinationCoords) {
            return 60; // fallback to original mock value
        }
        const totalDist = getDistanceInKm(activeRide.pickupCoords, activeRide.destinationCoords);
        const remainingDist = getDistanceInKm(driverForRide.location, activeRide.destinationCoords);
    
        if (totalDist <= 0) return 100;
        
        // Progress can sometimes be > 100 if driver overshoots or takes a different route, cap it.
        const progress = Math.min(100, Math.max(0, ((totalDist - remainingDist) / totalDist) * 100));
        return progress;
    })();

    const handleSosConfirm = () => {
        setShowSosModal(false);
        
        // Notify user that action is being taken
        showNotification('SOS Activated', 'Notifying security and contacting your emergency contact...');

        if (student?.emergencyContact?.phone) {
            const emergencyNumber = student.emergencyContact.phone;
            // Simple check for mobile user agents
            const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

            if (isMobile) {
                // On mobile devices, attempt to open the native dialer.
                window.location.href = `tel:${emergencyNumber}`;
            } else {
                // On desktops/laptops, attempt to open a WhatsApp chat in a new tab.
                // WhatsApp URLs require numbers without any special characters.
                const cleanNumber = emergencyNumber.replace(/\D/g, '');
                window.open(`https://wa.me/${cleanNumber}`, '_blank');
            }
        }
    };

    const hasEmergencyContact = !!(student?.emergencyContact?.name && student.emergencyContact.phone);

    return (
        <>
            <div className="row gy-4">
                <div className="col-12">
                    <div className="app-card">
                        <div className="welcome-text">
                            <h2>Welcome, {student.name}!</h2>
                            <p>Ready to book your next ride?</p>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="row g-4">
                        <div className="col-lg-12">
                            <div className="row g-4">
                                <div className="col-6 col-md-4 col-lg-2"><div className="app-card stats-card"><div className="stats-icon"><i className="fas fa-road"></i></div><div className="stats-number">{student.totalRides}</div><div className="stats-label">Total Rides</div></div></div>
                                <div className="col-6 col-md-4 col-lg-2"><div className="app-card stats-card"><div className="stats-icon"><i className="fas fa-users"></i></div><div className="stats-number">{student.sharedRides}</div><div className="stats-label">Shared Rides</div></div></div>
                                <div className="col-6 col-md-4 col-lg-2"><div className="app-card stats-card"><div className="stats-icon"><i className="fas fa-wallet"></i></div><div className="stats-number">₹{student.savings.toFixed(2)}</div><div className="stats-label">Money Saved</div></div></div>
                                <div className="col-6 col-md-4 col-lg-2"><div className="app-card stats-card"><div className="stats-icon"><i className="fas fa-star"></i></div><div className="stats-number">{student.rating.toFixed(1)}</div><div className="stats-label">Avg Rating</div></div></div>
                                <div className="col-12 col-md-4 col-lg-4">
                                     <EcoAnalytics co2Savings={student.totalCo2Savings || 0} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                     <div className="row g-4">
                        <div className="col-lg-5">
                            {activeRide ? (
                                <div className="app-card">
                                    {/* --- TOP PART --- */}
                                    <div>
                                        <div className="section-header">
                                            <div className="section-title">Your Active Ride</div>
                                            <span className="badge bg-success">{activeRide.status}</span>
                                        </div>
                                        
                                        {driverForRide && (
                                            <div className="d-flex align-items-center mt-3">
                                                <div className="driver-avatar d-flex align-items-center justify-content-center me-3" style={{width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden'}}>
                                                    {driverForRide.photoURL ? <img src={driverForRide.photoURL} alt={driverForRide.name} /> : driverForRide.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h6 className="mb-0">{driverForRide.name} {driverForRide.isVerified && <span className="badge bg-success ms-1" style={{fontSize: '0.7em'}}><i className="fas fa-check-circle me-1"></i>Verified</span>}</h6>
                                                    <p className="small text-muted mb-0">{driverForRide.vehicleDetails?.make} {driverForRide.vehicleDetails?.model} - <strong>{driverForRide.vehicleDetails?.licensePlate}</strong></p>
                                                    <p className="small text-muted mb-0">
                                                        <i className="fas fa-star text-warning me-1"></i> {driverForRide.rating} 
                                                        {driverForRide.mobileNumber && <span className="ms-2"><i className="fas fa-phone-alt me-1"></i> {driverForRide.mobileNumber}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* --- MIDDLE (MAP) PART --- */}
                                    <div className="my-3" style={{ flex: '1 1 auto', minHeight: '250px' }}>
                                        {mapsApiLoaded ? <GoogleMap driverLocation={driverForRide?.location || null} userLocation={userLocation} /> : <MapPlaceholder />}
                                    </div>
                                    
                                    {/* --- BOTTOM PART --- */}
                                    <div>
                                        <div className="ride-progress">
                                            <div className="progress-bar" style={{ width: `${rideProgressPercentage}%` }}></div>
                                        </div>
                                        <span className="progress-label">En route to {activeRide.destination}</span>

                                        <div className="mt-3 text-center">
                                            <div className="ride-actions-grid">
                                                <button
                                                    className="btn-action call"
                                                    onClick={() => {
                                                        if (driverForRide?.mobileNumber) {
                                                            window.location.href = `tel:${driverForRide.mobileNumber}`;
                                                        }
                                                    }}
                                                    disabled={!driverForRide?.mobileNumber}
                                                    title={driverForRide?.mobileNumber ? `Call ${driverForRide.name}` : 'Driver phone number not available'}
                                                >
                                                    <i className="fas fa-phone"></i> Call Driver
                                                </button>
                                                <button className="btn-action cancel" onClick={cancelRide}>
                                                    <i className="fas fa-times"></i> Cancel Ride
                                                </button>
                                            </div>
                                            <button className="btn-sos-main" onClick={() => setShowSosModal(true)}>
                                                <i className="fas fa-exclamation-triangle"></i> EMERGENCY SOS
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : student.isOnWaitlist ? (
                                <div key="waitlist-widget" className="app-card text-center">
                                    <i className="fas fa-clock fa-3x mb-3" style={{color: 'var(--accent)'}}></i>
                                    <h4 className="booking-title mb-2">You are on the Waitlist!</h4>
                                    <p className="text-muted">We are finding a shared ride for you.</p>
                                    <div className="my-4">
                                        <div className="display-4 fw-bold">{waitlist.findIndex(item => item.studentId === authUser?.uid) + 1}</div>
                                        <div className="text-muted">Your position in queue</div>
                                    </div>
                                    <button onClick={leaveWaitlist} className="btn-book">Leave Waitlist</button>
                                </div>
                            ) : (
                                <div key="booking-widget" className="app-card booking-widget">
                                    <h3 className="booking-title mb-4">Book a Ride</h3>
                                    
                                    <div className="ride-option mb-3" role="group" aria-label="Select ride type">
                                        <button type="button" onClick={() => setRideType(RideType.SOLO)} className={`ride-option-btn ${rideType === RideType.SOLO ? 'active' : ''}`} aria-pressed={rideType === RideType.SOLO}>
                                            <i className="fas fa-user me-2"></i>Solo
                                        </button>
                                        <button type="button" onClick={() => setRideType(RideType.SHARED)} className={`ride-option-btn ${rideType === RideType.SHARED ? 'active' : ''}`} aria-pressed={rideType === RideType.SHARED}>
                                            <i className="fas fa-users me-2"></i>Shared
                                        </button>
                                    </div>

                                    <div className="form-group-floating mb-3">
                                        <i className="fas fa-map-marker-alt form-group-icon"></i>
                                        <input type="text" id="pickup-location" className="form-control" placeholder="Pickup Location" value={pickup} onChange={(e) => setPickup(e.target.value)} />
                                        <label htmlFor="pickup-location">Pickup</label>
                                    </div>
                                    <div className="destination-chips" style={{ marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                                        {["MBU Main Gate", "Hostel Block C", "Library"].map(loc => (
                                            <button type="button" key={loc} className="destination-chip" onClick={() => setPickup(loc)}>{loc}</button>
                                        ))}
                                    </div>
                                    
                                    <div className="form-group-floating mb-3">
                                        <i className="fas fa-flag-checkered form-group-icon"></i>
                                        <input type="text" id="destination-location" className="form-control" placeholder="Destination Location" value={destination} onChange={(e) => setDestination(e.target.value)} />
                                        <label htmlFor="destination-location">Destination</label>
                                    </div>
                                    <div className="destination-chips" style={{ marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                                        {["Tirupati Railway Station", "Central Mall", "City Bus Stand"].map(loc => (
                                            <button type="button" key={loc} className="destination-chip" onClick={() => setDestination(loc)}>{loc}</button>
                                        ))}
                                    </div>

                                     <div className="ride-option mb-3" role="group" aria-label="Select booking time">
                                        <button type="button" onClick={() => setBookingType('ASAP')} className={`ride-option-btn ${bookingType === 'ASAP' ? 'active' : ''}`} aria-pressed={bookingType === 'ASAP'}>
                                            ASAP
                                        </button>
                                        <button type="button" onClick={() => setBookingType('Scheduled')} className={`ride-option-btn ${bookingType === 'Scheduled' ? 'active' : ''}`} aria-pressed={bookingType === 'Scheduled'}>
                                            Plan Ahead
                                        </button>
                                    </div>

                                    {bookingType === 'Scheduled' && (
                                        <div className="row">
                                            <div className="col-6"><input type="date" className="form-control" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} /></div>
                                            <div className="col-6"><input type="time" className="form-control" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} /></div>
                                        </div>
                                    )}

                                    <div className="d-flex justify-content-between align-items-center my-3">
                                        <div>
                                            <span className="text-muted">Estimated Fare</span>
                                            <div className="fare-amount">₹{fareDetails?.totalFare.toFixed(2) || '...'}</div>
                                        </div>
                                        <button onClick={() => setShowFareModal(true)} className="btn-action">View Details</button>
                                    </div>
                                    
                                    <button onClick={handleBookingAction} disabled={loading} className="btn-book">
                                        {loading ? 'Booking...' : (noDriversAvailable ? 'Join Waitlist' : 'Book Now')}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="col-lg-7">
                            <div className="d-flex flex-column gap-4">
                                <div className="app-card">
                                    <div className="section-header">
                                        <h3 className="section-title">Ride History</h3>
                                    </div>
                                    {recentRides.length > 0 ? recentRides.map(ride => (
                                        <div key={ride.id} className="ride-item">
                                            <div className="ride-destination">
                                                <i className="fas fa-map-marker-alt me-2 text-primary"></i>
                                                {ride.destination}
                                                <span className={`badge ms-2 ${ride.status === RideStatus.COMPLETED ? 'bg-success' : 'bg-danger'}`}>{ride.status}</span>
                                            </div>
                                            <div className="ride-date">{new Date(ride.date).toLocaleDateString()}</div>
                                            <div className="ride-fare">₹{ride.fare.toFixed(2)}</div>
                                        </div>
                                    )) : <p>No completed rides yet.</p>}
                                </div>

                                <div className="app-card accent-card">
                                    <div className="d-flex align-items-center">
                                        <div className="stats-icon me-3 flex-shrink-0" style={{background: 'rgba(203, 161, 53, 0.2)', color: 'var(--accent)', width: '60px', height: '60px'}}>
                                            <i className="fas fa-brain fa-2x"></i>
                                        </div>
                                        <div>
                                            <h4 className="booking-title mb-1" style={{color: 'var(--accent)'}}>New! AI Ride Scheduler</h4>
                                            <p className="text-muted mb-2">Have a busy week? Let our AI plan your recurring rides for you!</p>
                                            <button onClick={() => setView('scheduler')} className="btn-outline-primary" style={{padding: '0.5rem 1rem'}}>Plan My Week</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {rideToRate && (
                 <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}} role="dialog" aria-modal="true" aria-labelledby="rating-modal-title">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="rating-modal-title">Rate your ride with {rideToRate.driver?.name}</h5>
                                <button type="button" className="btn-close" onClick={() => setRideToRate(null)} aria-label="Close"></button>
                            </div>
                            <div className="modal-body text-center">
                                <p>How was your trip to {rideToRate.ride.destination}?</p>
                                <div className="fs-1 my-3">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} type="button" className="rating-star-btn" onClick={() => setRating(star)} aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}>
                                            <i className={`fas fa-star ${rating >= star ? 'text-warning' : 'text-secondary'}`}></i>
                                        </button>
                                    ))}
                                </div>
                                <textarea className="form-control" rows={3} placeholder="Add a comment... (optional)" value={feedback} onChange={e => setFeedback(e.target.value)}></textarea>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-action" onClick={() => setRideToRate(null)}>Skip</button>
                                <button type="button" className="btn-book" style={{width: 'auto', padding: '0.8rem 1.5rem'}} onClick={handleRatingSubmit}>Submit Rating</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {ecoNudge && (
                <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}} role="dialog" aria-modal="true" aria-labelledby="nudge-modal-title">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="nudge-modal-title"><i className="fas fa-leaf me-2 text-success"></i>Go Green & Save!</h5>
                            </div>
                            <div className="modal-body">
                                <p>{ecoNudge.message}</p>
                                <div className="d-flex justify-content-around">
                                    <div className="text-center">
                                        <div className="fare-amount">₹{ecoNudge.modifiedRideDetails.fare.toFixed(2)}</div>
                                        <span className="text-muted">New Shared Fare</span>
                                    </div>
                                    <div className="text-center">
                                        <div className="fare-amount text-success">{ecoNudge.modifiedRideDetails.co2Savings?.toFixed(1)}kg</div>
                                        <span className="text-muted">CO2 Saved</span>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-action" onClick={() => handleNudgeResponse(false)}>No, Thanks</button>
                                <button type="button" className="btn-book" style={{width: 'auto', padding: '0.8rem 1.5rem'}} onClick={() => handleNudgeResponse(true)}>Accept & Book Shared</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showFareModal && fareDetails && (
                <FareBreakdownModal show={showFareModal} onClose={() => setShowFareModal(false)} details={fareDetails} />
            )}

            {showSosModal && (
                <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}} role="dialog" aria-modal="true" aria-labelledby="sos-modal-title">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-danger">
                            <div className="modal-header">
                                <h5 className="modal-title text-danger" id="sos-modal-title">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    {hasEmergencyContact ? 'Confirm SOS Activation' : 'Emergency Contact Not Set'}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowSosModal(false)} aria-label="Close"></button>
                            </div>
                            {hasEmergencyContact && student.emergencyContact ? (
                                <>
                                    <div className="modal-body">
                                        <p>This will immediately alert campus security and attempt to call your emergency contact:</p>
                                        <div className="text-center my-3 p-2 rounded" style={{background: 'rgba(255,255,255,0.1)'}}>
                                            <strong className="d-block">{student.emergencyContact.name}</strong>
                                            <span className="text-muted">{student.emergencyContact.phone}</span>
                                        </div>
                                        <p>Are you sure you want to proceed?</p>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn-action" onClick={() => setShowSosModal(false)}>Cancel</button>
                                        <button type="button" className="btn btn-danger" onClick={handleSosConfirm}>
                                            Yes, I Need Help
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="modal-body">
                                        <p>To use the SOS feature, you must first set an emergency contact in your profile.</p>
                                        <p>This contact will be called automatically in an emergency.</p>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn-action" onClick={() => setShowSosModal(false)}>Cancel</button>
                                        <button type="button" className="btn-book" style={{width: 'auto', padding: '0.8rem 1.5rem'}} onClick={() => {
                                            setShowSosModal(false);
                                            setView('profile');
                                        }}>
                                            Go to Profile
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default StudentDashboard;