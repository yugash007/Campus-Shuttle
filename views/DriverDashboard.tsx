
import React, { useEffect, useRef } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useNotification } from '../contexts/NotificationContext';
import EarningsChart from '../components/EarningsChart';

const DriverDashboard: React.FC = () => {
    const { driver, authUser, activeRide, rideRequests, toggleDriverStatus, handleRideRequest, completeRide, allRides, waitlist, acceptWaitlistedRide, setView } = useFirebase();
    const { showNotification } = useNotification();
    const prevRideRequestIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        const currentRideRequestIds = new Set(rideRequests.map(r => r.id));
        const newRequests = rideRequests.filter(r => !prevRideRequestIds.current.has(r.id));

        if (newRequests.length > 0) {
            newRequests.forEach(request => {
                showNotification('New Ride Request!', `From ${request.pickup} to ${request.destination} (₹${request.fare})`);
            });
        }
        
        prevRideRequestIds.current = currentRideRequestIds;
    }, [rideRequests, showNotification]);

    if (!driver || !authUser) {
        return null;
    }

    return (
        <div className="row gy-4">
            <div className="col-12">
                <div className="app-card">
                     <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div className="welcome-text">
                            <h2>
                                Welcome, {driver.name.split(' ')[0]}!
                                {driver.isVerified && <i className="fas fa-check-circle text-success ms-2" title="Verified Driver"></i>}
                            </h2>
                            <p className="mb-0">{driver.isOnline ? "You're online and ready for rides." : "You're currently offline."}</p>
                        </div>
                        <div className="form-check form-switch p-0 d-flex align-items-center flex-shrink-0">
                            <label className="form-check-label me-3" htmlFor="online-toggle">{driver.isOnline ? 'Online' : 'Offline'}</label>
                           <input 
                             className="form-check-input" 
                             type="checkbox" 
                             role="switch" 
                             id="online-toggle" 
                             checked={driver.isOnline} 
                             onChange={toggleDriverStatus} 
                             style={{width: '3.5em', height: '1.75em', cursor: 'pointer'}}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="col-lg-8">
                 {activeRide ? (
                     <div className="app-card d-flex flex-column h-100">
                        <h3 className="section-title mb-4">Active Ride</h3>
                        
                        <div className="d-flex align-items-center mb-3">
                            <div className="stats-icon me-3 flex-shrink-0" style={{background: 'var(--accent-bg-translucent)', color: 'var(--accent)'}}><i className="fas fa-map-marker-alt"></i></div>
                            <div>
                                <p className="small text-muted mb-0">Pickup</p>
                                <h6 className="fw-bold mb-0">{activeRide.pickup}</h6>
                            </div>
                        </div>

                        <div className="ps-3 my-2">
                             <div style={{borderLeft: '2px dashed var(--accent)', height: '2rem'}}></div>
                        </div>

                        <div className="d-flex align-items-center mb-4">
                            <div className="stats-icon me-3 flex-shrink-0" style={{background: 'var(--accent-bg-translucent)', color: 'var(--accent)'}}><i className="fas fa-flag-checkered"></i></div>
                            <div>
                                <p className="small text-muted mb-0">Destination</p>
                                <h6 className="fw-bold mb-0">{activeRide.destination}</h6>
                            </div>
                        </div>

                        <hr className="my-3" style={{borderColor: 'var(--card-border-color)'}}/>

                        <div className="row g-3">
                             <div className="col-6">
                                <div className="p-3 rounded h-100" style={{ background: 'var(--accent-bg-translucent)' }}>
                                    <p className="small text-muted mb-0">Fare</p>
                                    <span className="fare-amount" style={{ fontSize: '1.8rem', color: 'var(--accent)' }}>₹{activeRide.fare}</span>
                                </div>
                             </div>
                             <div className="col-6">
                                <div className="p-3 rounded h-100" style={{ background: 'var(--accent-bg-translucent)' }}>
                                    <p className="small text-muted mb-0">Student</p>
                                    <h6 className="fw-bold mb-0">Jane Doe</h6> {/* Placeholder name */}
                                </div>
                             </div>
                        </div>

                        <button onClick={completeRide} className="btn-book mt-auto w-100">Mark as Complete</button>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-4">
                        <div className="app-card">
                            <h3 className="section-title mb-3">Incoming Requests</h3>
                            {rideRequests.length > 0 ? (
                                <div className="d-flex flex-column gap-3">
                                    {rideRequests.map(ride => (
                                        <div key={ride.id} className="app-card" style={{padding: '1rem'}}>
                                            <div className="row g-3">
                                                <div className="col">
                                                     {ride.bookingType === 'Scheduled' && ride.scheduledTime && (
                                                        <div className="badge mb-2 fw-bold" style={{ background: 'var(--accent)', color: 'var(--body-bg)', fontSize: '0.8rem'}}>
                                                            <i className="fas fa-clock me-1"></i> SCHEDULED: {new Date(ride.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                    <p className="fw-bold mb-1">{ride.pickup} <i className="fas fa-long-arrow-alt-right mx-2"></i> {ride.destination}</p>
                                                    <p className="small text-muted mb-0">{ride.type} {ride.groupSize ? `(${ride.groupSize})` : ''}</p>
                                                </div>
                                                <div className="col-auto d-flex flex-column justify-content-center align-items-end">
                                                    <span className="fare-amount mb-2" style={{fontSize: '1.5rem'}}>₹{ride.fare}</span>
                                                    <div className="d-flex gap-2">
                                                        <button onClick={() => handleRideRequest(ride.id, false)} className="btn-decline"><i className="fas fa-times"></i></button>
                                                        <button onClick={() => handleRideRequest(ride.id, true)} className="btn-accept"><i className="fas fa-check"></i> Accept</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div className="empty-state">
                                    <i className="fas fa-bed"></i>
                                    <p>{driver.isOnline ? "Waiting for new requests..." : "Go online to see requests"}</p>
                                </div>
                             )}
                        </div>
                    </div>
                )}
            </div>

            <div className="col-lg-4">
                <div className="d-flex flex-column gap-4">
                    <div className="app-card">
                        <h3 className="section-title mb-3">Weekly Earnings</h3>
                        <EarningsChart data={driver.weeklyEarnings} />
                    </div>

                    {driver.isOnline && waitlist.length > 0 && (
                        <div className="app-card">
                            <h3 className="section-title mb-3" style={{color: 'var(--accent)'}}>Waitlist</h3>
                            <div className="d-flex flex-column gap-3">
                                {waitlist.map(item => (
                                    <div key={item.studentId} className="p-3 rounded" style={{ border: '1px solid var(--accent)' }}>
                                        <p className="fw-bold mb-1">{item.rideDetails.pickup} <i className="fas fa-long-arrow-alt-right mx-2"></i> {item.rideDetails.destination}</p>
                                        <p className="small text-muted mb-2">{item.rideDetails.type}</p>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <span className="fare-amount" style={{fontSize: '1.2rem'}}>₹{item.rideDetails.fare.toFixed(2)}</span>
                                            <button onClick={() => acceptWaitlistedRide(item)} className="btn-accept">Accept Waitlisted</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;
