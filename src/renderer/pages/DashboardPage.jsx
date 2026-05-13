import React, { useEffect, useState } from 'react';
import { Package, BarChart3, AlertTriangle, FileText, TrendingDown, CircleDollarSign, RotateCcw, Clock, ShieldAlert } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const res = await window.kadal.dashboard.getStats();
      if (res.success) setStats(res.data);
    } catch (e) {}
    setLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card" style={{ '--stat-color': '#6366f1' }}>
          <div className="stat-card-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><Package size={20} /></div>
          <div className="stat-card-value">{stats?.totalItems || 0}</div>
          <div className="stat-card-label">Total Items</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#10b981' }}>
          <div className="stat-card-icon" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}><BarChart3 size={20} /></div>
          <div className="stat-card-value text-mono">{Math.round(stats?.totalStock || 0).toLocaleString()}</div>
          <div className="stat-card-label">Total Stock</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#0ea5e9' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}><CircleDollarSign size={20} /></div>
          <div className="stat-card-value text-mono">{Number(stats?.totalValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div className="stat-card-label">Total Value</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#f59e0b' }}>
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}><AlertTriangle size={20} /></div>
          <div className="stat-card-value">{stats?.lowStockCount || 0}</div>
          <div className="stat-card-label">Low Stock Alerts</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#8b5cf6' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}><FileText size={20} /></div>
          <div className="stat-card-value">{stats?.todayChallans || 0}</div>
          <div className="stat-card-label">Today's Challans</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#ec4899' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}><RotateCcw size={20} /></div>
          <div className="stat-card-value">{stats?.pendingReturns || 0}</div>
          <div className="stat-card-label">Pending Returns</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#ef4444' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><Clock size={20} /></div>
          <div className="stat-card-value">{stats?.overdueReturns || 0}</div>
          <div className="stat-card-label">Overdue Returns</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#f97316' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}><ShieldAlert size={20} /></div>
          <div className="stat-card-value">{stats?.totalDamaged || 0}</div>
          <div className="stat-card-label">Damaged/Rejected</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Challans */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Challans</h3>
          </div>
          {stats?.recentChallans?.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Challan No</th><th>Receiver</th><th>Items</th><th>Status</th></tr></thead>
                <tbody>
                  {stats.recentChallans.map(c => (
                    <tr key={c.id}>
                      <td className="text-mono" style={{ fontSize: 12 }}>{c.challan_number}</td>
                      <td>{c.receiver_name}</td>
                      <td className="text-center">{c.item_count}</td>
                      <td><span className={`badge badge-${c.status === 'ACTIVE' ? 'success' : 'danger'}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-muted" style={{ fontSize: 13 }}>No challans yet</p>}
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ color: 'var(--warning)' }}>
              <TrendingDown size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Low Stock Alerts
            </h3>
          </div>
          {stats?.lowStockItems?.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Item</th><th>Current</th><th>Min Level</th></tr></thead>
                <tbody>
                  {stats.lowStockItems.slice(0, 8).map(item => (
                    <tr key={item.id}>
                      <td><div style={{ fontWeight: 600 }}>{item.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.item_code}</div></td>
                      <td className="text-mono text-danger fw-bold">{item.current_stock} {item.unit}</td>
                      <td className="text-mono">{item.min_stock_level} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-muted" style={{ fontSize: 13 }}>All stock levels are healthy 🎉</p>}
        </div>
      </div>
    </div>
  );
}
