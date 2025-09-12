
// FIX: Cast style object to React.CSSProperties to allow for custom properties.
import React, { useEffect, useRef } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useNotification } from '../contexts/NotificationContext';
import EcoAnalytics from '../components/EcoAnalytics';
import StudentHeatmap from '../components/StudentHeatmap';

const DriverDashboard: React.FC = () => {
    const { driver, activeRide, rideRequests, toggleDriverStatus, handleRideRequest, completeRide, allRides, waitlist } = useFirebase();
    const { showNotification } = useNotification();
    const prevRideRequestIds = useRef<Set<string>>(new Set());

    // Effect to watch for new ride requests
    useEffect(() => {
        const currentRideRequestIds = new Set(rideRequests.map(r => r.id));

        // Find new requests by comparing current IDs with previous IDs
        const newRequests = rideRequests.filter(r => !prevRideRequestIds.current.has(r.id));

        if (newRequests.length > 0) {
            newRequests.forEach(request => {
                showNotification(
                    'New Ride Request!',
                    `From ${request.pickup} to ${request.destination} (₹${request.fare})`
                );
            });
        }
        
        // Update the ref for the next render
        prevRideRequestIds.current = currentRideRequestIds;
    }, [rideRequests, showNotification]);

    if (!driver) {
        return <div className="d-flex justify-content-center align-items-center vh-100"><p className="text-white">Loading Driver Dashboard...</p></div>;
    }

    return (
        <div className="row gy-4">
            <div className="col-12">
                <div className="app-card">
                     <div className="row align-items-center">
                        <div className="col-md-7 text-center text-md-start mb-3 mb-md-0">
                            <div className="welcome-text">
                                <h2>
                                    Welcome, {driver.name}!
                                    {driver.isVerified && <span className="badge bg-success ms-2"><i className="fas fa-check-circle me-1"></i>Verified</span>}
                                </h2>
                                <p className="mb-0">{driver.isOnline ? "You are online and ready for rides." : "You are offline."}</p>
                            </div>
                        </div>
                        <div className="col-md-5 text-center text-md-end">
                            <label htmlFor="online-toggle" className="d-flex align-items-center justify-content-center justify-content-md-end" style={{ cursor: 'pointer' }}>
                                <div className="form-check form-switch me-3">
                                   <input 
                                     className="form-check-input" 
                                     type="checkbox" 
                                     role="switch" 
                                     id="online-toggle" 
                                     checked={driver.isOnline} 
                                     onChange={toggleDriverStatus} 
                                     style={{width: '3.5em', height: '1.75em'}}
                                    />
                                   <label className="form-check-label ms-2" htmlFor="online-toggle">{driver.isOnline ? 'Online' : 'Offline'}</label>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-12">
                <div className="row g-4">
                    <div className="col-12">
                        <div className="row g-4">
                            <div className="col-6 col-md-3"><div className="app-card stats-card"><div className="stats-icon"><i className="fas fa-road"></i></div><div className="stats-number">{driver.totalRides}</div><div className="stats-label">Today's Rides</div></div></div>
                            <div className="col-6 col-md-3"><div className="app-card stats-card"><div className="stats-icon"><i className="fas fa-wallet"></i></div><div className="stats-number">₹{driver.earnings.toFixed(2)}</div><div className="stats-label">Today's Earnings</div></div></div>
                            <div className="col-6 col-md-3"><div className="app-card stats-card"><div className="stats-icon"><i className="fas fa-star"></i></div><div className="stats-number">{driver.rating}</div><div className="stats-label">Avg Rating</div></div></div>
                            <div className="col-6 col-md-3">
                                <EcoAnalytics co2Savings={driver.totalCo2Savings || 0} />
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
                                <div className="section-title mb-3">Current Ride</div>
                                <h5>{activeRide.pickup}</h5>
                                <p className="small">to</p>
                                <h5>{activeRide.destination}</h5>
                                 <div className="d-flex justify-content-between align-items-center my-3 p-3 rounded" style={{ background: 'rgba(var(--bs-success-rgb), 0.1)' }}>
                                    <span>Fare</span>
                                    <span className="fare-amount" style={{ fontSize: '1.5rem' }}>₹{activeRide.fare}</span>
                                </div>
                                <button onClick={completeRide} className="btn-book">Complete Ride</button>
                            </div>
                        ) : (
                             <div className="app-card">
                                 {waitlist.length > 0 && (
                                    <div className="p-3 mb-4 rounded text-center accent-card">
                                        <h5 className="mb-1" style={{color: 'var(--accent)'}}><i className="fas fa-users me-2"></i>High Demand!</h5>
                                        <p className="mb-0"><strong>{waitlist.length} student{waitlist.length > 1 ? 's are' : ' is'}</strong> on the waitlist for a shared ride. Go online to be matched!</p>
                                    </div>
                                 )}
                                 <div className="section-title mb-3">Ride Requests</div>
                                 {rideRequests.length > 0 ? (
                                    <div className="d-flex flex-column gap-3">
                                    {rideRequests.map(ride => (
                                        <div key={ride.id} className="p-3 rounded" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                                            {ride.bookingType === 'Scheduled' && ride.scheduledTime && (
                                                <div className="badge mb-2 fw-bold" style={{ background: 'var(--accent)', color: 'var(--dark)', fontSize: '0.8rem'}}>
                                                    <i className="fas fa-clock me-1"></i>
                                                    SCHEDULED: {new Date(ride.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                            <p className="fw-bold mb-1">{ride.pickup} to {ride.destination}</p>
                                            <p className="small mb-2">{ride.type} {ride.groupSize ? `(${ride.groupSize} people)` : ''}</p>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <span className="fare-amount" style={{fontSize: '1.2rem'}}>₹{ride.fare}</span>
                                                <div className="d-flex gap-2">
                                                    <button onClick={() => handleRideRequest(ride.id, false)} className="btn-decline"><i className="fas fa-times"></i> Decline</button>
                                                    <button onClick={() => handleRideRequest(ride.id, true)} className="btn-accept"><i className="fas fa-check"></i> Accept</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                 ) : (
                                    <p className="text-center">No new ride requests.</p>
                                 )}
                             </div>
                        )}
                    </div>
                     <div className="col-lg-7">
                         <div className="app-card">
                             <div className="section-title mb-3">Student Activity Hotspots</div>
                             <p className="small text-muted mb-3" style={{marginTop: '-0.5rem'}}>Busiest times based on completed rides.</p>
                             <StudentHeatmap rides={allRides} />
                         </div>
                     </div>
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;