import React, { useEffect } from 'react';
import useStore from '../../store/useStore';
import { PAGE_TITLES } from '../../utils/moduleNavigation';
import { RotateCw, Home, PanelLeft, Pause, Play, Sun, Moon } from 'lucide-react';

export default function TopBar() {
  const { currentPage, user, setShowLanding, sidebarOpen, setSidebarOpen,
    motionEnabled, setMotionEnabled, theme, setTheme, refreshTab } = useStore();

  const currentTitle = PAGE_TITLES[currentPage] || 'KADAL';

  useEffect(() => {
    document.title = `KADAL Inventory — ${currentTitle}`;
  }, [currentTitle]);

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button id="navigation-toggle" className="btn-icon btn-ghost mobile-toggle"
          aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="app-sidebar"
          onClick={() => setSidebarOpen(!sidebarOpen)}><PanelLeft size={19} /></button>
        <div>
          <span className="workspace-eyebrow">KADAL / WORKSPACE</span>
          <h2 className="topbar-title">{currentTitle}</h2>
        </div>
      </div>
      <div className="topbar-tools">
        <button className="btn-icon motion-toggle" onClick={() => setMotionEnabled(!motionEnabled)}
          aria-label={motionEnabled ? 'Pause animations' : 'Enable animations'}
          title={motionEnabled ? 'Pause animations' : 'Enable animations'} aria-pressed={!motionEnabled}>
          {motionEnabled ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="appearance-segments" role="group" aria-label="Appearance">
          <button type="button" aria-label="Switch to Light Mode" title="Switch to Light Mode" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={14} /><span>Light</span></button>
          <button type="button" aria-label="Switch to Dark Mode" title="Switch to Dark Mode" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={14} /><span>Dark</span></button>
        </div>
        <button className="btn-icon topbar-home" onClick={() => setShowLanding(true)}
          title="Home / Showcase" aria-label="Home / Showcase"><Home size={17} /></button>
        <button className="btn-icon topbar-refresh" onClick={(e) => e.shiftKey ? window.location.reload() : refreshTab()}
          title="Refresh Current Tab (Shift+Click for full reload)" aria-label="Refresh Current Tab"><RotateCw size={17} /></button>
        <div className="topbar-user">
          <div className="topbar-user-avatar" aria-hidden="true">{user?.fullName?.charAt(0) || 'U'}</div>
          <div className="user-info"><strong>{user?.fullName}</strong><span>{user?.roleName}</span></div>
        </div>
      </div>
    </header>
  );
}
