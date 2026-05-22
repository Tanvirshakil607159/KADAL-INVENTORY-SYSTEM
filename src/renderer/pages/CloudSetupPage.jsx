import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import logo from '../assets/logo.png';
import { Cloud, Save, ArrowRight, ShieldCheck, Link, Server, Globe } from 'lucide-react';

export default function CloudSetupPage({ onComplete }) {
  const { addToast } = useStore();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.kadal.settings.getAll().then(r => {
      if (r.success) {
        setUrl(r.data.supabase_url || '');
        setKey(r.data.supabase_key || '');
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!url.trim() || !key.trim()) {
      addToast('error', 'Please provide both Supabase URL and Anon Key');
      return;
    }
    setSaving(true);
    try {
      const res = await window.kadal.settings.setBulk({
        supabase_url: url.trim(),
        supabase_key: key.trim()
      });
      if (res.success) {
        addToast('success', 'Cloud configuration saved successfully');
        if (onComplete) onComplete();
      } else {
        addToast('error', 'Failed to save configuration');
      }
    } catch (e) {
      addToast('error', e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div className="login-wrapper">
      <div className="login-bg-elements">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      <div className="login-card-container">
        <div className="login-card-glass">
          <div className="login-header">
            <div className="brand-icon-wrapper">
              <img src={logo} alt="KADAL Logo" className="brand-icon" />
            </div>
            <div className="brand-text">
              <h1> KADAL </h1>
              <span>Inventory Management</span>
            </div>
          </div>

          <div className="login-welcome">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cloud size={24} className="text-accent" /> 
              Cloud Native Sync
            </h2>
            <p>Connect to your Supabase project to enable multi-device synchronization and secure cloud storage.</p>
          </div>

          <div className="login-form-modern">
            <div className="input-group-modern">
              <label>Supabase Project URL</label>
              <div className="input-wrapper-modern">
                <Globe size={18} className="input-icon" />
                <input 
                  type="text"
                  placeholder="https://xxxxxxxxxxxx.supabase.co" 
                  value={url} 
                  onChange={e => setUrl(e.target.value)} 
                />
              </div>
            </div>

            <div className="input-group-modern">
              <label>Supabase Anon API Key</label>
              <div className="input-wrapper-modern">
                <Server size={18} className="input-icon" />
                <input 
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
                  value={key} 
                  onChange={e => setKey(e.target.value)} 
                />
              </div>
            </div>

            <div style={{ 
              background: 'rgba(99,102,241,0.05)', 
              padding: '16px', 
              borderRadius: '16px', 
              border: '1px solid rgba(99,102,241,0.1)', 
              marginBottom: '8px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <ShieldCheck size={20} className="text-accent" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                  <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Secure Real-time Data</strong>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    Cloud sync allows your entire team to work on the same inventory data simultaneously across different locations.
                  </p>
                </div>
              </div>
            </div>

            <button className="login-submit-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Connecting...' : 'Save & Initialize Cloud'} 
              {!saving && <ArrowRight size={20} />}
            </button>
          </div>

          <div className="login-footer-modern">
            <div className="footer-line"></div>
            <p>© 2026 KA Design Accessories LTD • Built for Productivity</p>
          </div>
        </div>
      </div>
    </div>
  );
}
