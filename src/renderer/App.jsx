import React, { useEffect } from 'react';
import useStore from './store/useStore';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import ChallanPage from './pages/ChallanPage';
import ChallanHistoryPage from './pages/ChallanHistoryPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import BackupPage from './pages/BackupPage';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import ToastContainer from './components/common/ToastContainer';
import ConfirmDialog from './components/common/ConfirmDialog';
import LoginPage from './pages/LoginPage';
import CloudSetupPage from './pages/CloudSetupPage';
import ApprovalsPage from './pages/ApprovalsPage';
import GatePassPage from './pages/GatePassPage';
import IssuePage from './pages/IssuePage';
import NotificationManager from './components/common/NotificationManager';
import UpdateProgress from './components/common/UpdateProgress';
import GlobalModalManager from './components/modals/GlobalModalManager';

export default function App() {
  const { currentPage, isLoggedIn, setUser } = useStore();
  const [hasCloudConfig, setHasCloudConfig] = React.useState(null);

  useEffect(() => {
    const checkCloud = async () => {
      const res = await window.kadal.settings.getAll();
      if (res.success && res.data.supabase_url && res.data.supabase_key) {
        setHasCloudConfig(true);
      } else {
        setHasCloudConfig(false);
      }
    };
    checkCloud();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to get backend user
        const res = await window.kadal.auth.getCurrentUser();
        if (res.success && res.data) {
          setUser(res.data);
        } else {
          // If backend has no user, check localStorage and sync to backend
          const localUser = localStorage.getItem('kadal_user');
          if (localUser) {
            const userObj = JSON.parse(localUser);
            await window.kadal.auth.syncSession(userObj);
            setUser(userObj);
          }
        }
      } catch (err) {
        console.error('Auth sync failed:', err);
      }
    };
    checkAuth();
  }, [setUser]);

  if (hasCloudConfig === null) return <div className="loading"><div className="spinner"></div></div>;

  if (!hasCloudConfig) {
    return (
      <>
        <CloudSetupPage onComplete={() => setHasCloudConfig(true)} />
        <ToastContainer />
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'inventory': return <InventoryPage />;
      case 'challan': return <ChallanPage />;
      case 'challan-history': return <ChallanHistoryPage />;
      case 'reports': return <ReportsPage />;
      case 'approvals': return <ApprovalsPage />;
      case 'gate-pass': return <GatePassPage />;
      case 'issue': return <IssuePage />;
      case 'settings': return <SettingsPage />;
      case 'backup': return <BackupPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <NotificationManager />
        <UpdateProgress />
        <div className="page-content">{renderPage()}</div>
      </div>
      <ToastContainer />
      <ConfirmDialog />
      <GlobalModalManager />
    </div>
  );
}

