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
import ApprovalsPage from './pages/ApprovalsPage';
import GatePassPage from './pages/GatePassPage';
import NotificationManager from './components/common/NotificationManager';

export default function App() {
  const { currentPage, isLoggedIn, setUser } = useStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await window.kadal.auth.getCurrentUser();
        if (res.success && res.data) {
          setUser(res.data);
        }
      } catch (err) {}
    };
    checkAuth();
  }, [setUser]);

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
        <div className="page-content">{renderPage()}</div>
      </div>
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}

