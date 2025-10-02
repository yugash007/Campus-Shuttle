import React, { useState } from 'react';
import { UserRole } from '../types';
import { useFirebase } from '../contexts/FirebaseContext';

// Mock user credentials
const MOCK_USERS: { [email: string]: { uid: string; role: UserRole } } = {
    'student@test.com': { uid: 'student1', role: UserRole.STUDENT },
    'driver@test.com': { uid: 'driver1', role: UserRole.DRIVER },
};
const MOCK_PASS = 'password';

export const AuthScreen: React.FC = () => {
    const { login } = useFirebase();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // Simulate network delay
        await new Promise(res => setTimeout(res, 500));

        const user = MOCK_USERS[email];
        if (user && password === MOCK_PASS) {
            login(user.uid, user.role);
        } else {
            setError('Invalid credentials. Please use the demo accounts provided.');
        }

        setLoading(false);
    };
    
    return (
        <div className="d-flex flex-column justify-content-center align-items-center vh-100 p-3">
             <div className="text-center mb-4">
                <i className="fas fa-bus fa-3x text-white"></i>
                <h1 className="text-white mt-2" style={{ fontSize: '2.5rem' }}>Campus Shuttle</h1>
                <p className="text-white-50">Your ride, your way.</p>
            </div>
            <div className="app-card w-100" style={{ maxWidth: '400px' }}>
                <h3 className="booking-title mb-4">Login</h3>
                
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
                 <p className="text-center small mt-3 mb-0 text-muted">
                    This is a demo. Please use the accounts below. Sign-up is disabled.
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
