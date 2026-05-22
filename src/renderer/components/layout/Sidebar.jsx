import React from 'react';
import useStore from '../../store/useStore';
import { LayoutDashboard, Package, FileText, History, BarChart3, Settings, HardDrive, LogOut, CheckCircle, Send, Factory } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'warehouses', label: 'Warehouses', icon: Package }, // Or MapPin if preferred, Package used for simplicity
  { id: 'challan', label: 'Create Challan', icon: FileText },
  { id: 'approvals', label: 'Approvals', icon: CheckCircle },
  { id: 'gate-pass', label: 'Gate Pass', icon: FileText },
  { id: 'issue', label: 'Issue', icon: Send },
  { id: 'production', label: 'Production', icon: Factory },
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

  const [version, setVersion] = React.useState('');
  const [settings, setSettings] = React.useState({});
  
  React.useEffect(() => {
    window.kadal.system.getVersion().then(res => {
      if (res.success) setVersion(res.data);
    });
    window.kadal.settings.getAll().then(res => {
      if (res.success) setSettings(res.data);
    });
  }, [currentPage]);

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
            const allowed = ['dashboard', 'inventory', 'warehouses', 'reports', 'approvals', 'settings'];
            if (settings.allow_inventory_to_produce === 'true') {
              allowed.push('production');
            }
            if (!allowed.includes(item.id)) return null;
          }
          if (user?.roleName === 'Challan') {
            const allowed = ['dashboard', 'challan', 'gate-pass', 'reports', 'approvals', 'settings'];
            if (settings.allow_challan_to_issue === 'true') {
              allowed.push('issue');
            }
            if (!allowed.includes(item.id)) return null;
          }
          if (item.id === 'production' && !['Admin', 'Super Admin'].includes(user?.roleName)) {
            if (!(user?.roleName === 'Inventory' && settings.allow_inventory_to_produce === 'true')) {
              return null;
            }
          }
          if (item.id === 'backup' && user?.roleName === 'Operator') return null;
          
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
        <div className="app-version">v{version}</div>
      </div>
    </aside>
  );
}
