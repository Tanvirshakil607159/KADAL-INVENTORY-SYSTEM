import React, { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { getModuleMeta } from '../../utils/moduleNavigation';

export default function TabBar() {
  const { tabs, activeTabId, switchTab, openTab, closeTab } = useStore();
  const listRef = useRef(null);

  // Scroll active tab into view when tabs are added or switched
  useEffect(() => {
    const activeEl = listRef.current?.querySelector('.browser-tab.active');
    activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

  // Browser shortcuts: Ctrl+T opens a new tab, Ctrl+W closes the active tab (if > 1 tab)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const key = (e.key || '').toLowerCase();
      if (key === 't') {
        e.preventDefault();
        openTab('new-tab');
      } else if (key === 'w' && tabs.length > 1) {
        e.preventDefault();
        closeTab(activeTabId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openTab, closeTab, activeTabId, tabs.length]);

  return (
    <div className="browser-tabbar no-print" role="tablist" aria-label="Workspace tabs">
      <div className="browser-tablist" ref={listRef}>
        {tabs.map((tab) => {
          const meta = getModuleMeta(tab.moduleId);
          const Icon = meta.icon;
          const isActive = tab.id === activeTabId;
          const canClose = tabs.length > 1;
          return (
            <div
              key={tab.id}
              className={`browser-tab ${isActive ? 'active' : ''}`}
              role="tab"
              aria-selected={isActive}
              title={meta.title || meta.label}
              onMouseDown={(e) => {
                if (e.button === 1 && canClose) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
            >
              <button
                type="button"
                className="browser-tab-trigger"
                onClick={() => switchTab(tab.id)}
              >
                <span className="browser-tab-icon"><Icon size={13} /></span>
                <span className="browser-tab-label">{meta.label}</span>
              </button>
              {canClose && (
                <button
                  type="button"
                  className="browser-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  title={`Close ${meta.label} tab`}
                  aria-label={`Close ${meta.label} tab`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="browser-tab-add"
          onClick={() => openTab('new-tab')}
          title="New Tab (Ctrl+T)"
          aria-label="Open new tab"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
