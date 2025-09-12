
import React, { useState } from 'react';
import { auth, database } from '../firebase';
import { ref, set } from 'firebase/database';
import { UserRole } from '../types';

export const AuthScreen: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err: any) {
            setError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            if (user) {
                if (role === UserRole.STUDENT) {
                    await set(ref(database, `students/${user.uid}`), {
                        name,
                        role: UserRole.STUDENT,
                        walletBalance: 0,
                        totalRides: 0,
                        sharedRides: 0,
                        savings: 0,
                        rating: 5.0,
                        activeRideId: null,
                        transactionHistory: {},
                        totalCo2Savings: 0,
                        age: '',
                        gender: '',
                        mobileNumber: '',
                        photoURL: '',
                        emergencyContact: { name: '', phone: '' },
                        isOnWaitlist: false,
                        weeklySchedule: {},
                        ridePlans: {},
                    });
                } else {
                    await set(ref(database, `drivers/${user.uid}`), {
                        name,
                        role: UserRole.DRIVER,
                        isOnline: false,
                        totalRides: 0,
                        earnings: 0,
                        onlineTime: '0h 0m',
                        rating: 5.0,
                        ratingCount: 0,
                        currentRideId: null,
                        location: { lat: 13.6288, lng: 79.4192 }, // Default location
                        weeklyEarnings: [],
                        isEV: Math.random() < 0.3, // 30% chance of being EV
                        totalCo2Savings: 0,
                        hasCompletedOnboarding: false, // New driver onboarding flag
                        onboardingBonusAwarded: false,
                        isVerified: false,
                        age: '',
                        gender: '',
                        mobileNumber: '',
                        photoURL: '',
                    });
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sign up. The email might already be in use.');
        } finally {
            setLoading(false);
        }
    };
    
    const toggleView = (e: React.MouseEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoginView(!isLoginView);
    };

    return (
        <div className="d-flex flex-column justify-content-center align-items-center vh-100 p-3">
             <div className="text-center mb-4">
                <i className="fas fa-bus fa-3x text-white"></i>
                <h1 className="text-white mt-2" style={{ fontSize: '2.5rem' }}>Campus Shuttle</h1>
                <p className="text-white-50">Your ride, your way.</p>
            </div>
            <div className="app-card w-100" style={{ maxWidth: '400px' }}>
                <h3 className="booking-title mb-4">{isLoginView ? 'Login' : 'Create Account'}</h3>
                
                {isLoginView ? (
                    <form onSubmit={handleLogin}>
                        <div className="mb-3">
                            <label htmlFor="email" className="form-label">Email Address</label>
                            <input
                                id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com" required className="form-control"
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="password"  className="form-label">Password</label>
                             <input
                                id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••" required className="form-control"
                            />
                        </div>
                        {error && <p className="text-danger small">{error}</p>}
                        <button type="submit" disabled={loading} className="btn-book w-100 mt-3">
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSignUp}>
                         <div className="mb-3">
                            <label htmlFor="name" className="form-label">Full Name</label>
                            <input
                                id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="Alex Doe" required className="form-control"
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="email" className="form-label">Email Address</label>
                            <input
                                id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com" required className="form-control"
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="password"  className="form-label">Password</label>
                             <input
                                id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                placeholder="6+ characters" required className="form-control"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="form-label">I am a...</label>
                            <div className="ride-option">
                                <button type="button" onClick={() => setRole(UserRole.STUDENT)} className={`ride-option-btn ${role === UserRole.STUDENT ? 'active' : ''}`}>
                                    <i className="fas fa-user-graduate me-2"></i>Student
                                </button>
                                <button type="button" onClick={() => setRole(UserRole.DRIVER)} className={`ride-option-btn ${role === UserRole.DRIVER ? 'active' : ''}`}>
                                    <i className="fas fa-car-side me-2"></i>Driver
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-danger small">{error}</p>}
                        <button type="submit" disabled={loading} className="btn-book w-100 mt-3">
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </form>
                )}
                 <p className="text-center small mt-3 mb-0">
                    {isLoginView ? "Don't have an account?" : "Already have an account?"}
                    <a href="#" onClick={toggleView} className="fw-bold ms-1" style={{color: 'var(--accent)'}}>
                         {isLoginView ? "Sign Up" : "Login"}
                    </a>
                </p>
            </div>
             <div className="mt-4 p-3 rounded text-center w-100 demo-accounts" style={{ maxWidth: '400px' }}>
                <h4 className="text-white fw-bold">Demo Accounts</h4>
                <p className="mb-0"><strong>Student:</strong> student@test.com</p>
                <p className="mb-0"><strong>Driver:</strong> driver@test.com</p>
                <p className="mb-0">Password for both is: <strong>password</strong></p>
            </div>
        </div>
    );
};