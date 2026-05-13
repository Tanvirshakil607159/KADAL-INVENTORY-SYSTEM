import React from 'react';
import useStore from '../../store/useStore';
import { LayoutDashboard, Package, FileText, History, BarChart3, Settings, HardDrive, LogOut, CheckCircle, Send } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'challan', label: 'Create Challan', icon: FileText },
  { id: 'approvals', label: 'Approvals', icon: CheckCircle },
  { id: 'gate-pass', label: 'Gate Pass', icon: FileText },
  { id: 'issue', label: 'Issue', icon: Send },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'backup', label: 'Backup & Restore', icon: HardDrive },
];

export default function Sidebar() {
  const { currentPage, setPage, user, logout, addToast, notificationDots, clearNotificationDot } = useStore();

  const handleLogout = async () => {
    try {
      await window.kadal.auth.logout();
    } catch (e) {}
    logout();
    addToast('info', 'Logged out successfully');
  };

  const handleNavClick = (itemId) => {
    setPage(itemId);
    // Clear the red dot when user clicks the module
    if (notificationDots[itemId]) {
      clearNotificationDot(itemId);
      // Also clear from localStorage
      const unseenDots = JSON.parse(localStorage.getItem('unseen_dots') || '{}');
      // Map sidebar items to their dot key
      if (itemId === 'challan') {
        delete unseenDots['challan'];
        clearNotificationDot('challan');
      } else if (itemId === 'inventory') {
        delete unseenDots['inventory'];
      } else if (itemId === 'gate-pass') {
        delete unseenDots['gate-pass'];
      }
      localStorage.setItem('unseen_dots', JSON.stringify(unseenDots));
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>KADAL</h1>
        <p>KA Design Accessories</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          // Hide tabs based on roles
          if (user?.roleName === 'Inventory') {
            if (!['dashboard', 'inventory', 'reports', 'approvals'].includes(item.id)) return null;
          }
          if (user?.roleName === 'Challan') {
            if (!['dashboard', 'challan', 'gate-pass', 'reports', 'approvals'].includes(item.id)) return null;
          }
          if ((item.id === 'settings' || item.id === 'backup') && user?.roleName === 'Operator') return null;
          
          // Hide Backup/Restore if no maintenance permission
          if (item.id === 'backup') {
            const perms = typeof user?.permissions === 'string' ? JSON.parse(user.permissions) : (user?.permissions || {});
            if (user?.roleName !== 'Super Admin' && perms.maintenance !== 'rw') return null;
          }
          const hasDot = notificationDots[item.id];
          return (
            <div
              key={item.id}
              className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              style={{ position: 'relative' }}
            >
              <Icon /> {item.label}
              {hasDot && (
                <span className="nav-dot" />
              )}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-nav-item" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
          <LogOut /> Logout
        </div>
      </div>
    </aside>
  );
}
