
import React, { lazy, Suspense } from 'react';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import Header from './components/Header';
import TyndallEffect from './components/TyndallEffect';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationToast from './components/NotificationToast';
import OfflineIndicator from './components/OfflineIndicator';
import { ThemeProvider } from './contexts/ThemeContext';
import LoadingSkeleton from './components/LoadingSkeleton';

// --- Lazy-loaded Views ---
const AuthScreen = lazy(() => import('./views/AuthScreen').then(module => ({ default: module.AuthScreen })));
const StudentDashboard = lazy(() => import('./views/StudentDashboard'));
const DriverDashboard = lazy(() => import('./views/DriverDashboard'));
const DriverOnboarding = lazy(() => import('./views/DriverOnboarding'));
const ProfileScreen = lazy(() => import('./views/ProfileScreen'));
const PaymentScreen = lazy(() => import('./views/PaymentScreen'));
const SchedulerScreen = lazy(() => import('./views/SchedulerScreen'));
const HeatmapView = lazy(() => import('./views/HeatmapView'));


const AppContent: React.FC = () => {
  const { authUser, student, driver, loading, view } = useFirebase();

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!authUser) {
    return <Suspense fallback={<LoadingSkeleton />}><AuthScreen /></Suspense>;
  }

  const role = authUser.role;
  const userLoaded = (role === 'student' && student) || (role === 'driver' && driver);

  // Driver onboarding check
  if (role === 'driver' && driver && !driver.hasCompletedOnboarding) {
    return <Suspense fallback={<LoadingSkeleton />}><DriverOnboarding /></Suspense>;
  }

  const renderView = () => {
    switch(view) {
      case 'profile':
        return <ProfileScreen />;
      case 'wallet':
        return <PaymentScreen />;
      case 'scheduler':
        return <SchedulerScreen />;
      case 'heatmap':
        return <HeatmapView />;
      case 'dashboard':
      default:
        if (userLoaded) {
          return role === 'student' ? <StudentDashboard /> : <DriverDashboard />;
        }
        return <LoadingSkeleton />;
    }
  };

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="container">
          <Suspense fallback={<LoadingSkeleton />}>
            {renderView()}
          </Suspense>
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
