import React from 'react';
import { useFirebase } from '../contexts/FirebaseContext';

const Header: React.FC = () => {
    const { authUser, student, driver, logout } = useFirebase();

    const userInitial = authUser?.email ? authUser.email.charAt(0).toUpperCase() : '?';

    return (
        <header className="header">
            <div className="logo">
                <i className="fas fa-bus me-2"></i>
                <span>Campus Shuttle</span>
            </div>
            
            {student && (
                 <div className="wallet-balance d-none d-md-block">
                    <span>Wallet Balance:</span>
                    <h3>₹ {student.walletBalance.toFixed(2)}</h3>
                </div>
            )}

            {driver && (
                <div className="wallet-balance d-none d-md-block">
                    <span>Welcome, {driver.name}</span>
                </div>
            )}
            
            <div className="user-menu">
                <button 
                    onClick={logout} 
                    className="btn-action"
                    style={{padding: '0.25rem 0.75rem', marginTop: '0'}}
                >
                    Logout
                </button>
                <div className="user-avatar">
                    <span>{userInitial}</span>
                </div>
            </div>
        </header>
    );
};

export default Header;