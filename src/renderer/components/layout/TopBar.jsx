import React from 'react';
import useStore from '../../store/useStore';
import { RotateCw } from 'lucide-react';

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
};

export default function TopBar() {
  const { currentPage, user } = useStore();

  const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.toggle('active');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button 
          className="btn-icon btn-ghost mobile-toggle" 
          onClick={toggleSidebar}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <h2 className="topbar-title">{pageTitles[currentPage] || 'KADAL'}</h2>
      </div>
      <div className="topbar-actions">
        <button 
          className="btn-icon btn-ghost" 
          onClick={handleRefresh} 
          title="Refresh Application"
          style={{ marginRight: 8, color: 'var(--text-muted)' }}
        >
          <RotateCw size={18} />
        </button>
        <div className="topbar-user">
          <div className="topbar-user-avatar">{user?.fullName?.charAt(0) || 'U'}</div>
          <div className="user-info">
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{user?.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.roleName}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
