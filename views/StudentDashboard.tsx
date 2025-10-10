// FIX: Added ambient type declarations for the Google Maps API to resolve 'Cannot find name 'google'' errors.
declare namespace google {
    namespace maps {
        class DirectionsService {}
    }
}

import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { Ride, RideType, RideStatus, Driver, FareBreakdownDetails, Coordinates } from '../types';
import { getStudentNudge, Nudge } from '../ai/EcoNudgeEngine';
import EcoAnalytics from '../components/EcoAnalytics';
import { useNotification } from '../contexts/NotificationContext';
import { calculateFare } from '../ai/FareCalculator';
import FareBreakdownModal from '../components/FareBreakdownModal';
import { database } from '../firebase';

import BookingWidget from '../components/BookingWidget';
import ActiveRideCard from '../components/ActiveRideCard';

const MOCK_PICKUP_COORDS = { lat: 13.6288, lng: 79.4192 };
const MOCK_DESTINATION_COORDS = { lat: 13.6330, lng: 79.4137 };

const StudentDashboard: React.FC = () => {
    const { 
        authUser, student, activeRide, driverForRide, recentRides, 
        cancelRide, bookRide, loading, submitRating,
        joinWaitlist, leaveWaitlist, waitlist, setView
    } = useFirebase();
    const { showNotification } = useNotification();
    
    const [rideType, setRideType] = useState<RideType>(RideType.SOLO);
    const [bookingType, setBookingType] = useState<'ASAP' | 'Scheduled'>('ASAP');
    const [pickup, setPickup] = useState("MBU Main Gate");
    const [destination, setDestination] = useState("Tirupati Railway Station");
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [ecoNudge, setEcoNudge] = useState<Nudge | null>(null);
    const [noDriversAvailable, setNoDriversAvailable] = useState(false);
    
    const [mapsApiLoaded, setMapsApiLoaded] = useState((window as any).googleMapsApiLoaded || false);
    const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

    const [rideToRate, setRideToRate] = useState<{ride: Ride, driver: Driver | null} | null>(null);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const prevRecentRidesLength = useRef(recentRides.length);

    const [currentPage, setCurrentPage] = useState(1);
    const RIDES_PER_PAGE = 5;

    const [fareDetails, setFareDetails] = useState<FareBreakdownDetails | null>(null);
    const [showFareModal, setShowFareModal] = useState(false);
    const [showSosModal, setShowSosModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');


    useEffect(() => {
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
                if (document.visibilityState === 'visible') {
                    showNotification('Location Error', 'Using default location.');
                }
                setUserLocation({ lat: 13.6288, lng: 79.4192 }); 
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [showNotification]);
    
    useEffect(() => {
        // With the script loading order fixed in index.html, this polling is no longer necessary.
        // We can reliably assume the API is loaded.
        setMapsApiLoaded(true);
    }, []);

    useEffect(() => {
        if (recentRides.length > prevRecentRidesLength.current) {
            const lastRide = recentRides[0];
            if (lastRide && lastRide.status === RideStatus.COMPLETED && lastRide.rating === undefined) {
                const fetchDriver = async (driverId: string) => {
                    try {
                        const driverSnapshot = await database.ref(`drivers/${driverId}`).get();
                        if (driverSnapshot.exists()) return driverSnapshot.val() as Driver;
                    } catch (error) { console.error("Error fetching driver for rating modal:", error); }
                    return null;
                };
                if (lastRide.driverId) fetchDriver(lastRide.driverId).then(driver => setRideToRate({ ride: lastRide, driver }));
            }
        }
        prevRecentRidesLength.current = recentRides.length;
    }, [recentRides]);

    const handleBookingAction = () => {
        if (!fareDetails) { showNotification('Error', 'Fare could not be calculated.'); return; }
        let rideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'> = {
            pickup, destination, type: rideType, fare: fareDetails.totalFare,
            pickupCoords: userLocation || MOCK_PICKUP_COORDS,
            destinationCoords: MOCK_DESTINATION_COORDS,
            bookingType, ...(rideType === RideType.SHARED && { groupSize: 1 })
        };
        if (bookingType === 'Scheduled') {
            if (scheduledDate && scheduledTime) rideDetails.scheduledTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            else { alert("Please select a date and time."); return; }
        }
        if (noDriversAvailable) { joinWaitlist(rideDetails); return; }
        const nudge = getStudentNudge(rideDetails);
        if (nudge) setEcoNudge(nudge);
        else bookRide(rideDetails);
    };

    const handleNudgeResponse = (accepted: boolean) => {
        if (accepted && ecoNudge) bookRide(ecoNudge.modifiedRideDetails);
        else {
             if (!fareDetails) return;
             let originalRideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'> = {
                pickup, destination, type: rideType, fare: fareDetails.totalFare,
                pickupCoords: userLocation || MOCK_PICKUP_COORDS,
                destinationCoords: MOCK_DESTINATION_COORDS, bookingType,
            };
            bookRide(originalRideDetails);
        }
        setEcoNudge(null);
    };

    const handleRatingSubmit = () => {
        if (rideToRate && rideToRate.ride.driverId) {
            submitRating(rideToRate.ride.id, rideToRate.ride.driverId, rating, feedback);
            setRideToRate(null); setRating(0); setFeedback('');
        }
    };

    const handleConfirmCancellation = () => {
        if (!cancellationReason) { showNotification('Reason Required', 'Please select a reason.'); return; }
        cancelRide(cancellationReason); setShowCancelModal(false); setCancellationReason('');
    };
    
    if (!student) return null; // Or a loading skeleton

    const handleSosConfirm = () => {
        setShowSosModal(false);
        showNotification('SOS Activated', 'Notifying security and emergency contact...');
        if (student?.emergencyContact?.phone) {
            const emergencyNumber = student.emergencyContact.phone;
            const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
            if (isMobile) window.location.href = `tel:${emergencyNumber}`;
            else window.open(`https://wa.me/${emergencyNumber.replace(/\D/g, '')}`, '_blank');
        }
    };

    const hasEmergencyContact = !!(student?.emergencyContact?.name && student.emergencyContact.phone);

    const indexOfLastRide = currentPage * RIDES_PER_PAGE;
    const indexOfFirstRide = indexOfLastRide - RIDES_PER_PAGE;
    const currentRides = recentRides.slice(indexOfFirstRide, indexOfLastRide);
    const totalPages = Math.ceil(recentRides.length / RIDES_PER_PAGE);

    return (
        <>
            <div className="row gy-4">
                <div className="col-12">
                    <div className="app-card" style={{padding: '2rem'}}>
                        <div className="welcome-text">
                            <h2>Welcome back, {student.name.split(' ')[0]}!</h2>
                            <p>Ready for your next campus adventure?</p>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="row g-3">
                        <div className="col-6 col-md-3"><div className="app-card stats-card text-center"><div className="stats-number">{student.totalRides}</div><div className="stats-label">Total Rides</div></div></div>
                        <div className="col-6 col-md-3"><div className="app-card stats-card text-center"><div className="stats-number">{student.sharedRides}</div><div className="stats-label">Shared Rides</div></div></div>
                        <div className="col-6 col-md-3"><div className="app-card stats-card text-center"><div className="stats-number">₹{student.savings.toFixed(0)}</div><div className="stats-label">Saved</div></div></div>
                        <div className="col-6 col-md-3"><div className="app-card stats-card text-center"><div className="stats-number">{student.rating.toFixed(1)} <i className="fas fa-star fa-xs"></i></div><div className="stats-label">Avg Rating</div></div></div>
                    </div>
                </div>

                <div className="col-lg-5">
                    <div className="view-transition-wrapper">
                        {activeRide ? (
                            <ActiveRideCard 
                                key="active-ride"
                                activeRide={activeRide}
                                driverForRide={driverForRide}
                                userLocation={userLocation}
                                mapsApiLoaded={mapsApiLoaded}
                                onCancelClick={() => setShowCancelModal(true)}
                                onSosClick={() => setShowSosModal(true)}
                            />
                        ) : student.isOnWaitlist ? (
                            <div key="waitlist-widget" className="app-card text-center">
                                <i className="fas fa-clock fa-3x mb-3" style={{color: 'var(--accent)'}}></i>
                                <h4 className="booking-title mb-2">You're on the Waitlist!</h4>
                                <p className="text-muted">We're finding a shared ride for you.</p>
                                <div className="my-4">
                                    <div className="display-4 fw-bold">{waitlist.findIndex(item => item.studentId === authUser?.uid) + 1}</div>
                                    <div className="text-muted">Your position in queue</div>
                                </div>
                                <button onClick={leaveWaitlist} className="btn-book">Leave Waitlist</button>
                            </div>
                        ) : (
                           <BookingWidget
                                key="booking-widget"
                                rideType={rideType}
                                setRideType={setRideType}
                                bookingType={bookingType}
                                setBookingType={setBookingType}
                                pickup={pickup}
                                setPickup={setPickup}
                                destination={destination}
                                setDestination={setDestination}
                                scheduledDate={scheduledDate}
                                setScheduledDate={setScheduledDate}
                                scheduledTime={scheduledTime}
                                setScheduledTime={setScheduledTime}
                                fareDetails={fareDetails}
                                onShowFareDetails={() => setShowFareModal(true)}
                                onBook={handleBookingAction}
                                loading={loading}
                                noDriversAvailable={noDriversAvailable}
                           />
                        )}
                    </div>
                </div>
                <div className="col-lg-7">
                    <div className="d-flex flex-column gap-4">
                        <div className="app-card" style={{background: 'var(--accent-bg-translucent)', border: '1px solid var(--accent)'}}>
                            <div className="d-flex align-items-center">
                                <div className="stats-icon me-3 flex-shrink-0"><i className="fas fa-brain fa-lg"></i></div>
                                <div>
                                    <h4 className="booking-title mb-1" style={{color: 'var(--accent)'}}>AI Ride Scheduler</h4>
                                    <p className="text-muted mb-2">Let our AI plan your recurring campus rides for you!</p>
                                    <button onClick={() => setView('scheduler')} className="btn-action" style={{padding: '0.5rem 1rem', background: 'var(--accent)', color: 'white'}}>Plan My Week</button>
                                </div>
                            </div>
                        </div>
                         
                        <div className="app-card">
                            <div className="section-header"><h3 className="section-title">Recent Rides</h3></div>
                             {recentRides.length > 0 ? (
                                <>
                                {currentRides.map(ride => (<div key={ride.id} className="ride-item"><div className="ride-destination"><i className={`fas ${ride.status === RideStatus.COMPLETED ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} me-2`}></i>{ride.destination}</div><div className="ride-date">{new Date(ride.date).toLocaleDateString()}</div><div className="ride-fare">₹{ride.fare.toFixed(2)}</div></div>))}
                                {totalPages > 1 && (<div className="d-flex justify-content-center align-items-center mt-4 pagination-controls">{Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (<button key={page} onClick={() => setCurrentPage(page)} className={`btn-action ${currentPage === page ? 'active' : ''}`}>{page}</button>))}</div>)}
                                </>
                             ) : (
                                <div className="empty-state">
                                    <i className="fas fa-history"></i>
                                    <p>Your past rides will appear here.</p>
                                </div>
                             )}
                        </div>
                        
                        <EcoAnalytics co2Savings={student.totalCo2Savings || 0} />
                    </div>
                </div>
            </div>

            {/* Modals */}
            {rideToRate && (<div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Rate ride with {rideToRate.driver?.name}</h5><button type="button" className="btn-close" onClick={() => setRideToRate(null)}></button></div><div className="modal-body text-center"><p>How was your trip to {rideToRate.ride.destination}?</p><div className="fs-1 my-3">{[1, 2, 3, 4, 5].map(star => (<button key={star} type="button" className="rating-star-btn" onClick={() => setRating(star)}><i className={`fas fa-star ${rating >= star ? 'text-warning' : 'text-secondary'}`}></i></button>))}</div><textarea className="form-control" rows={3} placeholder="Add a comment... (optional)" value={feedback} onChange={e => setFeedback(e.target.value)}></textarea></div><div className="modal-footer"><button type="button" className="btn-action" onClick={() => setRideToRate(null)}>Skip</button><button type="button" className="btn-book" style={{width: 'auto', padding: '0.8rem 1.5rem'}} onClick={handleRatingSubmit}>Submit</button></div></div></div></div>)}
            {ecoNudge && (<div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h5 className="modal-title"><i className="fas fa-leaf me-2 text-success"></i>Go Green & Save!</h5></div><div className="modal-body"><p>{ecoNudge.message}</p><div className="d-flex justify-content-around"><div className="text-center"><div className="fare-amount">₹{ecoNudge.modifiedRideDetails.fare.toFixed(2)}</div><span className="text-muted">New Fare</span></div><div className="text-center"><div className="fare-amount text-success">{ecoNudge.modifiedRideDetails.co2Savings?.toFixed(1)}kg</div><span className="text-muted">CO2 Saved</span></div></div></div><div className="modal-footer"><button type="button" className="btn-action" onClick={() => handleNudgeResponse(false)}>No, Thanks</button><button type="button" className="btn-book" style={{width: 'auto', padding: '0.8rem 1.5rem'}} onClick={() => handleNudgeResponse(true)}>Accept</button></div></div></div></div>)}
            {showFareModal && fareDetails && <FareBreakdownModal show={showFareModal} onClose={() => setShowFareModal(false)} details={fareDetails} />}
            {showSosModal && (<div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content border-danger"><div className="modal-header"><h5 className="modal-title text-danger"><i className="fas fa-exclamation-triangle me-2"></i>{hasEmergencyContact ? 'Confirm SOS' : 'No Emergency Contact'}</h5><button type="button" className="btn-close" onClick={() => setShowSosModal(false)}></button></div>{hasEmergencyContact && student.emergencyContact ? (<><div className="modal-body"><p>This will alert security and attempt to call:</p><div className="text-center my-3 p-2 rounded" style={{background: 'rgba(255,255,255,0.1)'}}><strong className="d-block">{student.emergencyContact.name}</strong><span className="text-muted">{student.emergencyContact.phone}</span></div><p>Are you sure?</p></div><div className="modal-footer"><button type="button" className="btn-action" onClick={() => setShowSosModal(false)}>Cancel</button><button type="button" className="btn btn-danger" onClick={handleSosConfirm}>Yes, I Need Help</button></div></>) : (<><div className="modal-body"><p>To use SOS, please set an emergency contact in your profile.</p></div><div className="modal-footer"><button type="button" className="btn-action" onClick={() => setShowSosModal(false)}>Cancel</button><button type="button" className="btn-book" style={{width: 'auto'}} onClick={() => { setShowSosModal(false); setView('profile'); }}>Go to Profile</button></div></>)}</div></div></div>)}
            {showCancelModal && (<div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.7)'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Cancel Ride</h5><button type="button" className="btn-close" onClick={() => setShowCancelModal(false)}></button></div><div className="modal-body"><p>Please select a reason for cancellation.</p><select className="form-control" value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)}><option value="" disabled>-- Select a reason --</option><option value="Changed my mind">Changed my mind</option><option value="No longer needed">No longer needed</option><option value="Driver unavailable">Driver was unavailable</option><option value="Waited too long">Waited too long</option><option value="Other">Other</option></select></div><div className="modal-footer"><button type="button" className="btn-action" onClick={() => setShowCancelModal(false)}>Nevermind</button><button type="button" className="btn btn-danger" onClick={handleConfirmCancellation} disabled={!cancellationReason}>Confirm</button></div></div></div></div>)}
        </>
    );
};

export default StudentDashboard;