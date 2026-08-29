import React from 'react';
import useStore from '../../store/useStore';
import { RotateCw, Home } from 'lucide-react';

const pageTitles = {
  dashboard: 'Dashboard',
  inventory: 'Inventory Management',
  challan: 'Create Delivery Challan',
  'challan-history': 'Challan History',
  reports: 'Reports',
  settings: 'Settings',
  backup: 'Backup & Restore',
  approvals: 'Approvals',
  'gate-pass': 'Gate Pass Management',
  issue: 'Inventory Issue',
  production: 'Production',
  requisition: 'Requisition',
  'pending-items': 'Pending Items',
  warehouses: 'Warehouses',
};

export default function TopBar() {
  const { currentPage, user, setShowLanding } = useStore();

  const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.toggle('active');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button 
          className="btn-icon btn-ghost mobile-toggle" 
          onClick={toggleSidebar}
          style={{ color: '#ffffff', border: 'none' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div className="topbar-user" style={{ padding: 0, gap: 6 }}>
          <div className="topbar-user-avatar">{user?.fullName?.charAt(0) || 'U'}</div>
          <div className="user-info">
            <div style={{ fontWeight: 600, color: '#ffffff', fontSize: 11 }}>{user?.fullName}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>{user?.roleName}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button 
          className="btn-icon" 
          onClick={() => setShowLanding(true)} 
          title="Home / Landing Showcase"
          style={{ 
            color: '#e8c97a', 
            border: '1px solid rgba(212, 168, 85, 0.4)', 
            background: 'rgba(212, 168, 85, 0.15)',
            borderRadius: '6px',
            cursor: 'pointer',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Home size={14} />
        </button>
        <button 
          className="btn-icon" 
          onClick={handleRefresh} 
          title="Refresh Application"
          style={{ 
            color: 'rgba(255,255,255,0.75)', 
            border: 'none', 
            background: 'transparent',
            cursor: 'pointer',
            width: 28,
            height: 28,
          }}
        >
          <RotateCw size={14} />
        </button>
        <h2 className="topbar-title">{pageTitles[currentPage] || 'KADAL'}</h2>
      </div>
    </header>
  );
}
