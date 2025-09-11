import React from 'react';
import StudentDashboard from './views/StudentDashboard';
import DriverDashboard from './views/DriverDashboard';
import { AuthScreen } from './views/AuthScreen';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import Header from './components/Header';
import TyndallEffect from './components/TyndallEffect';

const AppContent: React.FC = () => {
  const { authUser, student, driver, loading } = useFirebase();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <p className="text-white">Loading App...</p>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  const role = authUser.role;
  const userLoaded = (role === 'student' && student) || (role === 'driver' && driver);

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="container">
          {userLoaded ? (
            role === 'student' ? <StudentDashboard /> : <DriverDashboard />
          ) : (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
              <p className="text-white">Loading Dashboard...</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

const App: React.FC = () => {
  return (
    <FirebaseProvider>
      <TyndallEffect streakColor="rgba(255, 255, 255, 0.4)">
        <AppContent />
      </TyndallEffect>
    </FirebaseProvider>
  );
};

export default App;