// FIX: Cast style object to React.CSSProperties to allow for custom properties.
import React from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import EcoAnalytics from '../components/EcoAnalytics';
import StudentHeatmap from '../components/StudentHeatmap';

const DriverDashboard: React.FC = () => {
    const { driver, activeRide, rideRequests, toggleDriverStatus, handleRideRequest, completeRide, allRides } = useFirebase();

    if (!driver) {
        return <div className="d-flex justify-content-center align-items-center vh-100"><p className="text-white">Loading Driver Dashboard...</p></div>;
    }

    return (
        <>
            <div className="welcome-card">
                 <div className="row align-items-center">
                    <div className="col-md-7">
                        <div className="welcome-text">
                            <h2 style={{ color: 'aliceblue' }}>Welcome, {driver.name}!</h2>
                            <p style={{ color: 'antiquewhite' }}>{driver.isOnline ? "You are online and ready for rides." : "You are offline."}</p>
                        </div>
                    </div>
                    <div className="col-md-5 text-md-end">
                        <label htmlFor="online-toggle" className="d-flex align-items-center justify-content-end" style={{ cursor: 'pointer' }}>
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
             <div className="row mb-4">
                <div className="col-lg-8">
                    <div className="row">
                        <div className="col-md-4 col-6"><div className="stats-card"><div className="stats-icon"><i className="fas fa-road"></i></div><div className="stats-number">{driver.totalRides}</div><div className="stats-label">Today's Rides</div></div></div>
                        <div className="col-md-4 col-6"><div className="stats-card"><div className="stats-icon"><i className="fas fa-wallet"></i></div><div className="stats-number">₹{driver.earnings.toFixed(2)}</div><div className="stats-label">Today's Earnings</div></div></div>
                        <div className="col-md-4 col-12"><div className="stats-card"><div className="stats-icon"><i className="fas fa-star"></i></div><div className="stats-number">{driver.rating}</div><div className="stats-label">Avg Rating</div></div></div>
                    </div>
                </div>
                <div className="col-lg-4">
                    <EcoAnalytics co2Savings={driver.totalCo2Savings || 0} />
                </div>
            </div>

            <div className="row">
                <div className="col-lg-4">
                     {activeRide ? (
                         <div className="active-ride">
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
                         <div className="booking-widget">
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
                 <div className="col-lg-8">
                     <div className="recent-rides">
                         <div className="section-title mb-3">Student Activity Hotspots</div>
                         <p className="small text-muted mb-3" style={{marginTop: '-0.5rem'}}>Busiest times based on completed rides.</p>
                         <StudentHeatmap rides={allRides} />
                     </div>
                 </div>
            </div>
        </>
    );
};

export default DriverDashboard;