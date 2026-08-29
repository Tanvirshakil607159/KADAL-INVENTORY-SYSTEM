import React, { useEffect, useState } from 'react';
import useStore from './store/useStore';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import PendingItemsPage from './pages/PendingItemsPage';
import WarehousePage from './pages/WarehousePage';
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
import ProductionPage from './pages/ProductionPage';
import RequisitionPage from './pages/RequisitionPage';
import StockInOutPage from './pages/StockInOutPage';
import NotificationManager from './components/common/NotificationManager';
import UpdateProgress from './components/common/UpdateProgress';
import GlobalModalManager from './components/modals/GlobalModalManager';
import ChallanVerificationPage from './pages/ChallanVerificationPage';
import LandingPage from './pages/LandingPage';

// Show the landing page by default for both web and electron
export default function App() {
  const { currentPage, isLoggedIn, setUser, showLanding, setShowLanding } = useStore();
  const [hasCloudConfig, setHasCloudConfig] = React.useState(null);

  // Parse verification challan number from path or hash
  const getVerificationChallanNumber = () => {
    const hash = window.location.hash || '';
    const pathname = window.location.pathname || '';
    
    const matchPath = pathname.match(/\/challan\/([A-Za-z0-9-]+)/);
    if (matchPath) return matchPath[1];
    
    const matchHash = hash.match(/\/challan\/([A-Za-z0-9-]+)/);
    if (matchHash) return matchHash[1];
    
    return null;
  };

  const verificationChallanNumber = getVerificationChallanNumber();

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
        const res = await window.kadal.auth.getCurrentUser();
        if (res.success && res.data) {
          setUser(res.data);
        } else if (isLoggedIn && user) {
          // Sync renderer session to main process (e.g. after refresh/restart)
          console.log('[Auth] Syncing session to main process...');
          const syncRes = await window.kadal.auth.syncSession(user);
          if (!syncRes.success) {
            console.error('[Auth] Session sync failed, logging out');
            handleLogout();
          }
        } else {
          // No user found in main and no user in renderer
          setUser(null);
        }
      } catch (err) {
        console.error('Auth sync failed:', err);
      }
    };
    checkAuth();
  }, [setUser]);

  const handleLogout = React.useCallback(() => {
    window.kadal.auth.logout().catch(() => {});
    sessionStorage.removeItem('kadal_user');
    setUser(null);
    window.location.reload(); 
  }, [setUser]);

  // Inactivity Timeout (30 minutes)
  useEffect(() => {
    if (!isLoggedIn) return;

    let timeoutId;
    const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_LIMIT);
    };

    // Events that count as "working"
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer(); // Start timer on login

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [isLoggedIn, setUser]);

  // Update Notifications
  useEffect(() => {
    const unsubAvailable = window.kadal.update.onUpdateAvailable((info) => {
      // We don't show a toast for 'available' because the progress bar will appear
      console.log('[Update] New version available:', info.version);
    });

    const unsubError = window.kadal.update.onUpdateError((err) => {
      // Only show toast if it's a critical error (not just 'no update')
      if (!err.includes('no update') && !err.includes('Up to date')) {
        console.error('[Update] Error:', err);
        // Toast is handled by UpdateProgress or manually if needed
      }
    });

    return () => {
      unsubAvailable();
      unsubError();
    };
  }, []);

  if (verificationChallanNumber) {
    return (
      <>
        <ChallanVerificationPage challanNumber={verificationChallanNumber} />
        <ToastContainer />
      </>
    );
  }

  // Show landing page for web visitors
  if (showLanding) {
    return <LandingPage onEnterApp={() => setShowLanding(false)} />;
  }

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
      case 'stock-in-out': return <StockInOutPage />;
      case 'pending-items': return <PendingItemsPage />;
      case 'warehouses': return <WarehousePage />;
      case 'challan': return <ChallanPage />;
      case 'challan-history': return <ChallanHistoryPage />;
      case 'reports': return <ReportsPage />;
      case 'approvals': return <ApprovalsPage />;
      case 'gate-pass': return <GatePassPage />;
      case 'issue': return <IssuePage />;
      case 'production': return <ProductionPage />;
      case 'requisition': return <RequisitionPage />;
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
      <GlobalModalManager />
      <ConfirmDialog />
    </div>
  );
}
