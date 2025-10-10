import React, { useState } from 'react';
import { auth, database } from '../firebase';
import { UserRole } from '../types';
import ThemeToggle from '../components/ThemeToggle';

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
                    await database.ref(`students/${user.uid}`).set({
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
                        achievements: {},
                    });
                } else {
                    await database.ref(`drivers/${user.uid}`).set({
                        name,
                        role: UserRole.DRIVER,
                        isOnline: false,
                        totalRides: 0,
                        earnings: 0,
                        onlineTime: '0h 0m',
                        rating: 5.0,
                        ratingCount: 0,
                        currentRideId: null,
                        location: { lat: 13.6288, lng: 79.4192 },
                        weeklyEarnings: [],
                        isEV: Math.random() < 0.3,
                        totalCo2Savings: 0,
                        hasCompletedOnboarding: false,
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
        <div className="auth-container">
            <div className="auth-graphic-section">
                <div>
                    <i className="fas fa-bus fa-4x text-primary mb-4"></i>
                    <h1 className="display-5 fw-bold">AutoMate</h1>
                    <p className="fs-5 mt-2" style={{color: 'var(--text-muted-color)'}}>Your ride, your way. Smarter, faster, and always on time.</p>
                </div>
            </div>
            <div className="auth-form-section" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                    <ThemeToggle />
                </div>
                <div className="w-100" style={{ maxWidth: '400px' }}>
                     <div className="text-center mb-5 d-lg-none">
                        <i className="fas fa-bus fa-3x" style={{color: 'var(--accent)'}}></i>
                        <h1 className="mt-2" style={{ fontSize: '2.5rem' }}>AutoMate</h1>
                    </div>

                    <h3 className="booking-title mb-4">{isLoginView ? 'Welcome Back' : 'Create Your Account'}</h3>
                    
                    {isLoginView ? (
                        <form onSubmit={handleLogin}>
                            <div className="mb-3 form-group-floating">
                                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required className="form-control" />
                                <label htmlFor="email">Email Address</label>
                            </div>
                            <div className="mb-3 form-group-floating">
                                 <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="form-control" />
                                 <label htmlFor="password">Password</label>
                            </div>
                            {error && <p className="text-danger small">{error}</p>}
                            <button type="submit" disabled={loading} className="btn-book w-100 mt-3">
                                {loading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignUp}>
                             <div className="mb-3 form-group-floating">
                                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required className="form-control" />
                                <label htmlFor="name">Full Name</label>
                            </div>
                            <div className="mb-3 form-group-floating">
                                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required className="form-control" />
                                <label htmlFor="email">Email Address</label>
                            </div>
                            <div className="mb-3 form-group-floating">
                                 <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ characters)" required className="form-control" />
                                 <label htmlFor="password">Password</label>
                            </div>
                            <div className="mb-4">
                                <label className="form-label small text-muted">I am a...</label>
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
                     <p className="text-center small mt-4 mb-0 text-muted">
                        {isLoginView ? "Don't have an account?" : "Already have an account?"}
                        <a href="#" onClick={toggleView} className="fw-bold ms-1" style={{color: 'var(--accent)'}}>
                             {isLoginView ? "Sign Up" : "Login"}
                        </a>
                    </p>
                    <div className="mt-4 p-3 rounded text-center w-100" style={{background: 'var(--accent-bg-translucent)'}}>
                        <p className="mb-1 small"><strong>Use Demo Accounts</strong></p>
                        <p className="mb-0 small text-muted">Student: student@test.com | Driver: driver@test.com (pw: password)</p>
                    </div>
                </div>
            </div>
        </div>
    );
};