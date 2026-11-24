import React from 'react';
import useStore from '../../store/useStore';
import { getVisibleNavItems } from '../../utils/moduleNavigation';
import { Home, PackageOpen, LogOut, ChevronRight, X, Plus } from 'lucide-react';

export default function Sidebar() {
  const { currentPage, setPage, openTab, user, logout, addToast, notificationDots, clearNotificationDot, setShowLanding, sidebarOpen, setSidebarOpen } = useStore();
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
        <div className="nav-section-label">Workspace</div>
        {getVisibleNavItems(user, settings).map((item, index) => {
          const Icon = item.icon;
          const hasDot = notificationDots[item.id];
          const openTabLabel = `Open ${item.label} in new tab`;
          return (
            <div key={item.id} className={`sidebar-nav-row ${currentPage === item.id ? 'active' : ''}`}>
              <button
                className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    openTab(item.id);
                    return;
                  }
                  handleNavClick(item.id);
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    openTab(item.id);
                  }
                }}
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
              <button
                type="button"
                className="sidebar-nav-newtab"
                onClick={(e) => {
                  e.stopPropagation();
                  openTab(item.id);
                }}
                title={openTabLabel}
                aria-label={openTabLabel}
              >
                <Plus size={13} />
              </button>
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-nav-item" onClick={handleLogout} style={{ color: 'var(--logout-color)' }}>
          <span className="nav-icon"><LogOut size={17} /></span> <span>Logout</span>
        </button>
        <div className="app-version">KADAL Inventory <span>v{version}</span></div>
      </div>
    </aside>
    </>
  );
}
