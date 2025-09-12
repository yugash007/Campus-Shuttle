
import React from 'react';
import StudentDashboard from './views/StudentDashboard';
import DriverDashboard from './views/DriverDashboard';
import DriverOnboarding from './views/DriverOnboarding';
import { AuthScreen } from './views/AuthScreen';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import Header from './components/Header';
import TyndallEffect from './components/TyndallEffect';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationToast from './components/NotificationToast';
import ProfileScreen from './views/ProfileScreen';
import OfflineIndicator from './components/OfflineIndicator';
import PaymentScreen from './views/PaymentScreen';
import SchedulerScreen from './views/SchedulerScreen';
import { ThemeProvider } from './contexts/ThemeContext';

const AppContent: React.FC = () => {
  const { authUser, student, driver, loading, view } = useFirebase();

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

  // Driver onboarding check
  if (role === 'driver' && driver && !driver.hasCompletedOnboarding) {
    return <DriverOnboarding />;
  }

  const renderView = () => {
    switch(view) {
      case 'profile':
        return <ProfileScreen />;
      case 'wallet':
        return <PaymentScreen />;
      case 'scheduler':
        return <SchedulerScreen />;
      case 'dashboard':
      default:
        if (userLoaded) {
          return role === 'student' ? <StudentDashboard /> : <DriverDashboard />;
        }
        return (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
            <p className="text-white">Loading Dashboard...</p>
          </div>
        );
    }
  };

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="container">
          {renderView()}
        </div>
      </main>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <FirebaseProvider>
          <TyndallEffect streakColor="rgba(255, 255, 255, 0.4)">
            <OfflineIndicator />
            <AppContent />
            <NotificationToast />
          </TyndallEffect>
        </FirebaseProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;