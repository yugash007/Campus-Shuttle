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
import { Ride, RideType, RideStatus, Driver } from '../types';
import GoogleMap from '../components/GoogleMap';
import MapPlaceholder from '../components/MapPlaceholder';
import { getStudentNudge, Nudge } from '../ai/EcoNudgeEngine';
import EcoAnalytics from '../components/EcoAnalytics';

const MOCK_PICKUP_COORDS = { lat: 13.6288, lng: 79.4192 };
const MOCK_DESTINATION_COORDS = { lat: 13.6330, lng: 79.4137 };

const StudentDashboard: React.FC = () => {
    const { student, activeRide, driverForRide, recentRides, cancelRide, bookRide, loading, submitRating } = useFirebase();
    
    // State for booking form
    const [rideType, setRideType] = useState<RideType>(RideType.SOLO);
    const [bookingType, setBookingType] = useState<'ASAP' | 'Scheduled'>('ASAP');
    const [destination, setDestination] = useState("Tirupati Railway Station");
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [ecoNudge, setEcoNudge] = useState<Nudge | null>(null);
    
    // State for map
    const [mapsApiLoaded, setMapsApiLoaded] = useState((window as any).googleMapsApiLoaded || false);
    const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);

    // State for rating modal
    const [rideToRate, setRideToRate] = useState<{ride: Ride, driver: Driver | null} | null>(null);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const completedRideRef = useRef<{ride: Ride, driver: Driver | null} | null>(null);


    // Dynamic fare estimation
    const fare = rideType === RideType.SOLO ? "₹120.00" : "₹85.00";

    useEffect(() => {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ lat: latitude, lng: longitude });
            },
            (error) => {
                console.error("Error getting user location:", error);
                setUserLocation({ lat: 13.6288, lng: 79.4192 }); 
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const handleBookNow = () => {
        let rideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'> = {
            pickup: "MBU Main Gate",
            destination: destination,
            type: rideType,
            fare: rideType === RideType.SOLO ? 120 : 85,
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
        
        // AI ENGINE CALL: Check for a nudge before booking
        const nudge = getStudentNudge(rideDetails);
        if (nudge) {
            setEcoNudge(nudge);
            return; // Don't book yet, wait for user's decision
        }

        bookRide(rideDetails);
    };

    const handleNudgeDecision = (accept: boolean) => {
        if (accept && ecoNudge) {
            // User accepted, book the modified ride
            bookRide(ecoNudge.modifiedRideDetails);
        } else {
            // User declined, book the original ride
            const originalRideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'> = {
                pickup: "MBU Main Gate", destination, type: rideType,
                fare: rideType === RideType.SOLO ? 120 : 85,
                pickupCoords: userLocation || MOCK_PICKUP_COORDS,
                destinationCoords: MOCK_DESTINATION_COORDS,
                bookingType: bookingType,
                ...(rideType === RideType.SHARED && { groupSize: 1 })
            };
            if (bookingType === 'Scheduled' && scheduledDate && scheduledTime) {
                originalRideDetails.scheduledTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            }
            bookRide(originalRideDetails);
        }
        setEcoNudge(null); // Close the nudge modal
    };
    
    useEffect(() => {
        if (mapsApiLoaded) return;
        const interval = setInterval(() => {
            if ((window as any).googleMapsApiLoaded) {
                setMapsApiLoaded(true);
                clearInterval(interval);
            }
        }, 200);
        return () => clearInterval(interval);
    }, [mapsApiLoaded]);

    useEffect(() => {
        if (!activeRide && completedRideRef.current) {
            const recentRide = recentRides.find(r => r.id === completedRideRef.current!.ride.id);
            if (recentRide && recentRide.status === RideStatus.COMPLETED && recentRide.rating === undefined) {
                setRideToRate(completedRideRef.current);
            }
            completedRideRef.current = null;
        }
        
        if (activeRide) {
            completedRideRef.current = { ride: activeRide, driver: driverForRide };
        }
    }, [activeRide, recentRides, driverForRide]);

    const handleSubmitRating = () => {
        if (rideToRate && rideToRate.ride.driverId && rating > 0) {
            submitRating(rideToRate.ride.id, rideToRate.ride.driverId, rating, feedback);
            setRideToRate(null);
            setRating(0);
            setFeedback('');
        }
    };

    const popularDestinations = ["Tirupati Railway Station", "City Bus Stand", "Central Mall", "PVR Cinemas"];
    
    if (loading || !student) {
        return <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}><p>Loading Student Data...</p></div>;
    }

    return (
        <>
            {rideToRate && (
                <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Rate your ride with {rideToRate.driver?.name || 'your driver'}</h5>
                                <button type="button" className="btn-close" onClick={() => setRideToRate(null)} aria-label="Close"></button>
                            </div>
                            <div className="modal-body">
                                <p className="text-center text-muted">How was your experience?</p>
                                <div className="rating-stars text-center mb-3">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <i
                                            key={star}
                                            className={`fas fa-star ${rating >= star ? 'text-warning' : 'text-secondary'}`}
                                            onClick={() => setRating(star)}
                                            style={{ cursor: 'pointer', fontSize: '2.5rem', margin: '0 0.25rem' }}
                                            aria-label={`Rate ${star} stars`}
                                            role="button"
                                        />
                                    ))}
                                </div>
                                <div className="form-group">
                                    <textarea
                                        className="form-control"
                                        rows={3}
                                        placeholder="Add a comment (optional)..."
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setRideToRate(null)}>Skip</button>
                                <button type="button" className="btn btn-primary" style={{background: 'var(--accent)', borderColor: 'var(--accent)'}} disabled={rating === 0} onClick={handleSubmitRating}>Submit Rating</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {ecoNudge && (
                <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content" style={{background: 'var(--dark)', border: '1px solid var(--accent)'}}>
                            <div className="modal-header">
                                <h5 className="modal-title" style={{color: 'var(--accent)'}}><i className="fas fa-leaf me-2"></i>Eco-Friendly Option Available!</h5>
                            </div>
                            <div className="modal-body">
                                <p>{ecoNudge.message}</p>
                                <ul>
                                    <li><b>New Fare:</b> <span className="text-success fw-bold">₹{ecoNudge.modifiedRideDetails.fare.toFixed(2)}</span></li>
                                    <li><b>CO2 Saved:</b> <span className="text-success fw-bold">{ecoNudge.modifiedRideDetails.co2Savings} kg</span></li>
                                </ul>
                                <p>Would you like to switch to this greener ride?</p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => handleNudgeDecision(false)}>No, Thanks</button>
                                <button type="button" className="btn btn-success" onClick={() => handleNudgeDecision(true)}>Yes, Go Green!</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="welcome-card">
                 <div className="row align-items-center">
                    <div className="col-md-7">
                        <div className="welcome-text">
                            <h2 style={{ color: 'aliceblue' }}>Good morning, {student.name}!</h2>
                            <p style={{ color: 'antiquewhite' }}>
                                Ready to book your next ride? Let's get you on your way.
                            </p>
                        </div>
                    </div>
                    <div className="col-md-5 text-md-end">
                       <EcoAnalytics co2Savings={student.totalCo2Savings || 0} />
                    </div>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-md-3 col-6"><div className="stats-card"><div className="stats-icon"><i className="fas fa-road"></i></div><div className="stats-number">{student.totalRides}</div><div className="stats-label">Total Rides</div></div></div>
                <div className="col-md-3 col-6"><div className="stats-card"><div className="stats-icon"><i className="fas fa-users"></i></div><div className="stats-number">{student.sharedRides}</div><div className="stats-label">Shared Rides</div></div></div>
                <div className="col-md-3 col-6"><div className="stats-card"><div className="stats-icon"><i className="fas fa-money-bill-wave"></i></div><div className="stats-number">₹{student.savings.toFixed(2)}</div><div className="stats-label">Total Saved</div></div></div>
                <div className="col-md-3 col-6"><div className="stats-card"><div className="stats-icon"><i className="fas fa-star"></i></div><div className="stats-number">{student.rating}</div><div className="stats-label">Avg Rating</div></div></div>
            </div>
            
            <div className="row">
                {/* Left Column: Map and Recent Rides */}
                <div className="col-lg-8">
                    <div className="active-ride" style={{ height: '50vh' }}>
                        {mapsApiLoaded ? (
                            <GoogleMap 
                                driverLocation={driverForRide?.location || null} 
                                userLocation={userLocation}
                            />
                        ) : (
                            <MapPlaceholder className="w-100 h-100" />
                        )}
                    </div>

                    <div className="recent-rides mt-4">
                       <div className="section-header">
                            <div className="section-title">Recent Rides</div>
                        </div>
                        {recentRides.length > 0 ? recentRides.map(ride => (
                            <div className="ride-item" key={ride.id}>
                                <div className="ride-destination">
                                    <div className="fw-bold">{ride.destination}</div>
                                    <div className="small text-muted">{ride.type} ride</div>
                                </div>
                                <div className="ride-date">{new Date(ride.date).toLocaleDateString()}</div>
                                <div className="ride-fare">₹{ride.fare.toFixed(2)}</div>
                            </div>
                        )) : <p>No recent rides.</p>}
                    </div>
                </div>

                {/* Right Column: Active Ride/Booking and Safety */}
                <div className="col-lg-4">
                    {activeRide ? (
                        <div className="active-ride">
                            <div className="d-flex justify-content-between align-items-center">
                                <div className="section-title">Active Ride</div>
                                <div className={`badge ${activeRide.status === RideStatus.PENDING ? 'bg-warning' : 'bg-success'}`}>
                                    {activeRide.status === RideStatus.PENDING ? 'Waiting for Driver' : 'On the Way • 5 min ETA'}
                                </div>
                            </div>
                            
                            {driverForRide && (
                                <div className="d-flex align-items-center mt-3">
                                    <div className="driver-avatar rounded-circle d-flex align-items-center justify-content-center me-3" style={{width: '50px', height: '50px'}}>
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <div>
                                        <h5>{driverForRide.name}</h5>
                                        <p className="mb-0 small">
                                            Auto #AP03TX1234 • {driverForRide.rating} ★ ({driverForRide.totalRides} rides)
                                        </p>
                                    </div>
                                </div>
                            )}

                             <div className="ride-details mt-3">
                                <p className="small mb-0 text-muted">Trip:</p>
                                <p className="fw-bold">{activeRide.pickup} <i className="fas fa-arrow-right mx-2"></i> {activeRide.destination}</p>
                            </div>
                            
                             {activeRide.bookingType === 'Scheduled' && activeRide.scheduledTime &&
                                <p className="text-center small mt-2">
                                    Scheduled for: {new Date(activeRide.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                             }

                            <div className="ride-progress mt-3">
                                <div className="progress-bar" style={{ width: activeRide.status === RideStatus.ACTIVE ? '45%' : '5%' }}></div>
                            </div>
                            <div className="progress-label text-center">
                                {activeRide.status === RideStatus.ACTIVE ? 'En route to destination' : 'Driver is on the way'}
                            </div>

                            <div className="d-flex justify-content-between align-items-center mt-3 p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
                                <div>
                                    <p className="small mb-0">Ride Type</p>
                                    <p className="fw-bold mb-0">{activeRide.type}</p>
                                </div>
                                <div className="text-end">
                                    <p className="small mb-0">Fare</p>
                                    <p className="fw-bold mb-0 fare-amount" style={{fontSize: '1.2rem'}}>₹{activeRide.fare.toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="ride-actions d-flex justify-content-around mt-3">
                                <button className="btn-action call"><i className="fas fa-phone-alt me-2"></i>Call</button>
                                <button className="btn-action cancel" onClick={cancelRide}><i className="fas fa-times me-2"></i>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="booking-widget">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div className="booking-title">Book a Ride</div>
                                <span className="badge bg-success">25 autos nearby</span>
                            </div>

                            <div className="mb-4">
                                <label className="form-label">Choose Booking Type</label>
                                <div className="ride-option">
                                    <button onClick={() => setBookingType('ASAP')} className={`ride-option-btn ${bookingType === 'ASAP' ? 'active' : ''}`}>⚡ Ride Now</button>
                                    <button onClick={() => setBookingType('Scheduled')} className={`ride-option-btn ${bookingType === 'Scheduled' ? 'active' : ''}`}>🕒 Plan Ahead</button>
                                </div>
                            </div>
                            
                            <div className="mb-4">
                                <label className="form-label">Ride Type</label>
                                <div className="ride-option">
                                    <button onClick={() => setRideType(RideType.SOLO)} className={`ride-option-btn ${rideType === RideType.SOLO ? 'active' : ''}`}>Solo Ride</button>
                                    <button onClick={() => setRideType(RideType.SHARED)} className={`ride-option-btn ${rideType === RideType.SHARED ? 'active' : ''}`}>Shared Ride</button>
                                </div>
                            </div>

                            {bookingType === 'ASAP' ? (
                                <div>
                                    <div className="mb-3"><label className="form-label">Destination</label><div className="input-group"><span className="input-group-text"><i className="fas fa-flag"></i></span><input type="text" className="form-control" placeholder="Where to?" value={destination} onChange={e => setDestination(e.target.value)} /></div></div>
                                    <div className="mb-3">
                                        <label className="form-label">Popular Destinations</label>
                                        <div className="destination-chips">
                                            {popularDestinations.map(d => <div key={d} onClick={() => setDestination(d)} className="destination-chip">{d}</div>)}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                     <div className="mb-3"><label className="form-label">Destination</label><div className="input-group"><span className="input-group-text"><i className="fas fa-flag"></i></span><input type="text" className="form-control" placeholder="Where to?" value={destination} onChange={e => setDestination(e.target.value)} /></div></div>
                                    <div className="row mb-3">
                                        <div className="col-md-6"><label className="form-label">Date</label><input type="date" className="form-control" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} /></div>
                                        <div className="col-md-6"><label className="form-label">Time</label><input type="time" className="form-control" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} /></div>
                                    </div>
                                </div>
                            )}
                            <div className="fare-display mt-3">
                                <div className="text-muted">Estimated Fare</div>
                                <div className="fare-amount">{fare}</div>
                            </div>
                            <button className="btn-book mt-4" onClick={handleBookNow}>
                                <i className="fas fa-arrow-right me-2"></i>
                                {bookingType === 'ASAP' ? 'Book Now' : 'Schedule Ride'}
                            </button>
                        </div>
                    )}
                    
                    <div className="active-ride mt-4">
                        <div className="section-header">
                            <div className="section-title">Safety Features</div>
                        </div>
                        <div className="d-grid gap-2">
                            <button className="btn-outline-primary" onClick={() => console.log('Share Ride Details clicked!')}><i className="fas fa-share-alt me-2"></i>Share Ride Details</button>
                            <button className="btn-outline-primary" onClick={() => console.log('Emergency Contact clicked!')}><i className="fas fa-user-shield me-2"></i>Emergency Contact</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StudentDashboard;