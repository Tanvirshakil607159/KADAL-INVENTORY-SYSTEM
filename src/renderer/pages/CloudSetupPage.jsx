import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Cloud, Save, ArrowRight, ShieldCheck } from 'lucide-react';

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
        
        // If already has data, we might want to skip but let's show it first time
        // Actually the App logic will handle showing this or not
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
    <div className="login-container" style={{ background: 'var(--bg-primary)' }}>
      <div className="login-card" style={{ maxWidth: 500, width: '100%' }}>
        <div className="login-header">
          <div className="login-logo">
            <Cloud size={32} color="var(--accent)" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '16px 0 8px' }}>Cloud Native Sync</h2>
          <p className="text-muted" style={{ fontSize: 14 }}>Connect to your Supabase project to synchronize data across all your devices.</p>
        </div>

        <div className="login-form">
          <div className="form-group">
            <label className="form-label">Supabase Project URL</label>
            <input 
              className="form-input" 
              placeholder="https://xxxxxxxxxxxx.supabase.co" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Supabase Anon API Key</label>
            <input 
              className="form-input" 
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
              value={key} 
              onChange={e => setKey(e.target.value)} 
            />
          </div>

          <div style={{ background: 'rgba(99,102,241,0.05)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--accent-dim)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <ShieldCheck size={20} color="var(--accent)" style={{ marginTop: 2 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Why Cloud Sync?</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                  Cloud sync enables multiple PCs to share the same inventory data in real-time. Without this, your data stays only on this computer.
                </p>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: 16 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Continue'} <ArrowRight size={18} style={{ marginLeft: 8 }} />
          </button>

        </div>
      </div>
      
      <div style={{ position: 'absolute', bottom: 24, fontSize: 12, color: 'var(--text-muted)' }}>
        KADAL Inventory v1.1.0 • Built for KA Design Accessories LTD
      </div>
    </div>
  );
}
