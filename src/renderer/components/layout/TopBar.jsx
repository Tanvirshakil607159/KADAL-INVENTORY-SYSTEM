import React from 'react';
import useStore from '../../store/useStore';
import { RotateCw, Home, Menu, Pause, Play } from 'lucide-react';
import ThemeToggle from '../common/ThemeToggle';

const pageTitles = {
  dashboard: 'Dashboard', inventory: 'Inventory Management',
  'stock-in-out': 'Stock In & Out', challan: 'Create Delivery Challan',
  'challan-history': 'Challan History', 'challan-receipt': 'Challan Receipt',
  finance: 'Finance', reports: 'Reports', settings: 'Settings',
  backup: 'Backup & Restore', approvals: 'Approvals',
  'gate-pass': 'Gate Pass Management', issue: 'Inventory Issue',
  production: 'Production', requisition: 'Requisition',
  'pending-items': 'Pending Items', warehouses: 'Warehouses',
};

export default function TopBar() {
  const { currentPage, user, setShowLanding, sidebarOpen, setSidebarOpen,
    motionEnabled, setMotionEnabled } = useStore();

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button id="navigation-toggle" className="btn-icon btn-ghost mobile-toggle"
          aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="app-sidebar"
          onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={20} /></button>
        <div>
          <span className="workspace-eyebrow">YOUR WORKSPACE</span>
          <h2 className="topbar-title">{pageTitles[currentPage] || 'KADAL'}</h2>
        </div>
      </div>
      <div className="topbar-tools">
        <button className="btn-icon motion-toggle" onClick={() => setMotionEnabled(!motionEnabled)}
          aria-label={motionEnabled ? 'Pause animations' : 'Enable animations'}
          title={motionEnabled ? 'Pause animations' : 'Enable animations'} aria-pressed={!motionEnabled}>
          {motionEnabled ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <ThemeToggle />
        <button className="btn-icon topbar-home" onClick={() => setShowLanding(true)}
          title="Home / Showcase" aria-label="Home / Showcase"><Home size={17} /></button>
        <button className="btn-icon topbar-refresh" onClick={() => window.location.reload()}
          title="Refresh Application" aria-label="Refresh Application"><RotateCw size={17} /></button>
        <div className="topbar-user">
          <div className="topbar-user-avatar" aria-hidden="true">{user?.fullName?.charAt(0) || 'U'}</div>
          <div className="user-info"><strong>{user?.fullName}</strong><span>{user?.roleName}</span></div>
        </div>
      </div>
    </header>
  );
}
