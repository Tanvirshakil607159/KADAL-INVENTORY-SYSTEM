import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import useStore from '../store/useStore';
import { getVisibleNavItems } from '../utils/moduleNavigation';

export default function NewTabPage() {
  const { user, setPage, openTab } = useStore();
  const [settings, setSettings] = useState({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    window.kadal?.settings?.getAll?.()
      .then((res) => { if (res?.success) setSettings(res.data || {}); })
      .catch(() => {});
  }, []);

  const items = useMemo(() => {
    const visible = getVisibleNavItems(user, settings);
    if (!query.trim()) return visible;
    const q = query.trim().toLowerCase();
    return visible.filter((item) =>
      item.label.toLowerCase().includes(q) || item.title.toLowerCase().includes(q)
    );
  }, [user, settings, query]);

  return (
    <div className="newtab-page">
      <div className="newtab-hero">
        <h2>Open a Module in This Tab</h2>
        <p>Choose any module below, or select one from the sidebar.</p>
        <div className="newtab-search">
          <Search size={16} />
          <input
            type="text"
            className="form-input"
            placeholder="Search modules (e.g. Inventory, Finance, Challan)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="newtab-grid">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const tone = ['violet', 'mint', 'peach', 'rose'][idx % 4];
          return (
            <button
              key={item.id}
              type="button"
              className="newtab-card"
              data-tone={tone}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  openTab(item.id);
                  return;
                }
                setPage(item.id);
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  openTab(item.id);
                }
              }}
            >
              <span className="newtab-card-icon"><Icon size={20} /></span>
              <span className="newtab-card-text">
                <strong>{item.label}</strong>
                <small>{item.title}</small>
              </span>
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="newtab-empty">No modules match "{query}".</div>
        )}
      </div>
    </div>
  );
}
