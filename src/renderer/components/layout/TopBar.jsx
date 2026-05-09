import React from 'react';
import useStore from '../../store/useStore';

const pageTitles = {
  dashboard: 'Dashboard',
  inventory: 'Inventory Management',
  challan: 'Create Delivery Challan',
  'challan-history': 'Challan History',
  reports: 'Reports',
  settings: 'Settings',
  backup: 'Backup & Restore',
};

export default function TopBar() {
  const { currentPage, user } = useStore();

  return (
    <header className="topbar">
      <h2 className="topbar-title">{pageTitles[currentPage] || 'KADAL'}</h2>
      <div className="topbar-actions">
        <div className="topbar-user">
          <div className="topbar-user-avatar">{user?.fullName?.charAt(0) || 'U'}</div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{user?.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.roleName}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
