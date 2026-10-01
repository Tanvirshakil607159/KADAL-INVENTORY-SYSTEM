import React from 'react';
import useStore from '../../store/useStore';
import { Home, LayoutDashboard, Package, PackageOpen, Warehouse, ClipboardList, Truck, BarChart3, Settings, HardDrive, LogOut, CheckCircle, Send, Factory, ChevronRight, ArrowDownUp, Landmark, PackageCheck, Hourglass, X } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'stock-in-out', label: 'Stock In & Out', icon: ArrowDownUp },
  { id: 'pending-items', label: 'Pending Items', icon: Hourglass },
  { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
  { id: 'challan', label: 'Create Challan', icon: ClipboardList },
  { id: 'challan-receipt', label: 'Challan Receipt', icon: PackageCheck },
  { id: 'finance', label: 'Finance', icon: Landmark },
  { id: 'approvals', label: 'Approvals', icon: CheckCircle },
  { id: 'gate-pass', label: 'Gate Pass', icon: Truck },
  { id: 'requisition', label: 'Requisition', icon: Send },
  { id: 'issue', label: 'Issue', icon: PackageOpen },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'backup', label: 'Backup & Restore', icon: HardDrive },
];

export default function Sidebar() {
  const { currentPage, setPage, user, logout, addToast, notificationDots, clearNotificationDot, setShowLanding, sidebarOpen, setSidebarOpen } = useStore();
  const sidebarRef = React.useRef(null);
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia('(max-width: 768px)').matches);
  const closeNavigation = () => {
    setSidebarOpen(false);
    document.getElementById('navigation-toggle')?.focus();
  };

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const onChange = () => { setIsMobile(media.matches); setSidebarOpen(false); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [setSidebarOpen]);

  React.useEffect(() => {
    if (!sidebarOpen || !isMobile) return;
    sidebarRef.current?.querySelector('button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        document.getElementById('navigation-toggle')?.focus();
      }
      if (event.key === 'Tab') {
        const buttons = [...sidebarRef.current.querySelectorAll('button')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, isMobile, setSidebarOpen]);

  const handleLogout = async () => {
    try {
      await window.kadal.auth.logout();
    } catch (e) {}
    logout();
    addToast('info', 'Logged out successfully');
  };

  const handleNavClick = (itemId) => {
    setPage(itemId);
    if (isMobile) document.getElementById('navigation-toggle')?.focus();
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
    <>
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={closeNavigation} />}
    <aside id="app-sidebar" ref={sidebarRef} className={`sidebar ${sidebarOpen ? 'active' : ''}`} inert={isMobile && !sidebarOpen} aria-label="Main navigation">
      <div className="sidebar-brand">
        <button className="brand-link" onClick={() => setShowLanding(true)} title="Go to Home / Showcase">
          <span className="brand-mark"><PackageOpen size={25} /></span>
          <span><strong>KADAL<span className="brand-dot">.</span></strong><small>KA Design Accessories</small></span>
        </button>
        <button className="btn-icon sidebar-close" aria-label="Close navigation" onClick={closeNavigation}><X size={18} /></button>
      </div>
      <nav className="sidebar-nav" aria-label="Inventory modules">
        <button
          className="sidebar-nav-item sidebar-home-item"
          onClick={() => setShowLanding(true)}
          title="Go to Home / Landing Slideshow (keeps you logged in)"
        >
          <span className="nav-icon"><Home size={17} /></span>
          <span style={{ flex: 1 }}>Home / Showcase</span>
          <ChevronRight size={12} style={{ opacity: 0.6 }} />
        </button>
        <div className="nav-section-label">LET’S GET THINGS MOVING</div>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const permsObj = typeof user?.permissions === 'string' ? JSON.parse(user.permissions) : (user?.permissions || {});
          const hasExplicitPerm = permsObj && Object.prototype.hasOwnProperty.call(permsObj, item.id);
          
          if (hasExplicitPerm) {
            if (permsObj[item.id] !== 'rw' && permsObj[item.id] !== true) return null;
          } else {
            // Hide tabs based on roles (fallback logic)
            if (user?.roleName === 'Merchandiser') {
              const allowed = ['dashboard', 'inventory', 'stock-in-out', 'warehouses', 'requisition', 'reports', 'settings'];
              if (!allowed.includes(item.id)) return null;
            }
            if (user?.roleName === 'Inventory') {
              const allowed = ['dashboard', 'inventory', 'stock-in-out', 'pending-items', 'warehouses', 'challan-receipt', 'requisition', 'reports', 'approvals', 'settings'];
              if (settings.allow_inventory_to_produce === 'true') {
                allowed.push('production');
              }
              if (!allowed.includes(item.id)) return null;
            }
            if (user?.roleName === 'Challan') {
              const allowed = ['dashboard', 'challan', 'challan-receipt', 'finance', 'gate-pass', 'reports', 'approvals', 'settings'];
              if (settings.allow_challan_to_issue === 'true') {
                allowed.push('issue');
              }
              if (!allowed.includes(item.id)) return null;
            }
            if (item.id === 'requisition') {
              if (permsObj.requisition === 'none' && !['Admin', 'Super Admin'].includes(user?.roleName)) return null;
            }
            if (item.id === 'production' && !['Admin', 'Super Admin'].includes(user?.roleName)) {
              if (!(user?.roleName === 'Inventory' && settings.allow_inventory_to_produce === 'true')) {
                return null;
              }
            }
            if (item.id === 'backup' && user?.roleName === 'Operator') return null;
            
            // Hide Backup/Restore if no maintenance permission
            if (item.id === 'backup') {
              if (user?.roleName !== 'Super Admin' && permsObj.maintenance !== 'rw' && permsObj.backup !== 'rw') return null;
            }
          }
          const hasDot = notificationDots[item.id];
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              aria-current={currentPage === item.id ? 'page' : undefined}
              style={{ '--icon-delay': `${index * -0.47}s` }}
              data-tone={['violet', 'mint', 'peach', 'rose'][index % 4]}
            >
              <span className="nav-icon"><Icon size={17} /></span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {hasDot && (
                <span className="nav-dot" aria-label="New activity" />
              )}
              <ChevronRight size={12} style={{ opacity: 0.4 }} />
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-nav-item" onClick={handleLogout} style={{ color: 'var(--logout-color)' }}>
          <span className="nav-icon"><LogOut size={17} /></span> <span>Logout</span>
        </button>
        <div className="app-version">Made for your everyday <span>v{version}</span></div>
      </div>
    </aside>
    </>
  );
}
