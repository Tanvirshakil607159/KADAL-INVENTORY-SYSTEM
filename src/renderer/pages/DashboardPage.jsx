import React, { useEffect, useState } from 'react';
import { Package, Boxes, AlertTriangle, FileText, TrendingDown, CircleDollarSign, RotateCcw, Clock, ShieldAlert, Sparkles, ArrowUpRight, Check, RefreshCw } from 'lucide-react';
import useStore from '../store/useStore';

const number = (value) => Number(value || 0).toLocaleString();
const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MetricCard({ icon: Icon, label, value, tone, index }) {
  return (
    <div className="overview-metric" data-tone={tone} style={{ '--icon-delay': `${index * -1.3}s` }}>
      <div className="metric-top"><span className="metric-icon"><Icon size={22} /></span><span className="metric-decoration" aria-hidden="true">•••</span></div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useStore(state => state.user);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.kadal.dashboard.getStats();
      if (!res.success || !res.data) throw new Error('Unable to load overview');
      setStats(res.data);
      setUpdatedAt(new Date());
    } catch {
      setError('We couldn’t refresh your overview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activity = [
    { label: 'Low stock alerts', value: stats?.lowStockCount, icon: AlertTriangle, tone: 'peach' },
    { label: 'Today’s challans', value: stats?.todayChallans, icon: FileText, tone: 'violet' },
    { label: 'Waiting for gate pass', value: stats?.waitingForGatePass, icon: Clock, tone: 'mint' },
    { label: 'Pending returns', value: stats?.pendingReturns, icon: RotateCcw, tone: 'violet' },
    { label: 'Overdue returns', value: stats?.overdueReturns, icon: Clock, tone: 'rose' },
    { label: 'Damaged / rejected', value: stats?.totalDamaged, icon: ShieldAlert, tone: 'peach' },
  ];

  return (
    <div className="dashboard-page" aria-busy={loading}>
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="welcome-kicker"><Sparkles size={14} /> A LITTLE CLARITY. A LOT OF POSSIBILITIES.</span>
          <h1>Good to see you{user?.fullName ? `, ${user.fullName.trim().split(/\s+/)[0]}` : ''}<span className="welcome-period">.</span></h1>
          <p>Big picture. Small details. Everything in its place.</p>
          <div className="welcome-bottom"><span className="welcome-tag"><Boxes size={15} /> Your inventory, at a glance</span><span className="welcome-date">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}</span></div>
        </div>
        <div className="package-scene" aria-hidden="true">
          <div className="scene-orbit" />
          <span className="scene-spark spark-one"><Sparkles size={26} /></span>
          <span className="scene-spark spark-two"><Sparkles size={16} /></span>
          <div className="parcel parcel-small"><span className="parcel-tape" /></div>
          <div className="parcel parcel-main"><span className="parcel-tape" /><span className="parcel-eyes"><i /><i /></span><span className="parcel-smile" /><span className="parcel-cheek" /></div>
          <div className="scene-stamp"><Check size={20} /></div>
          <div className="scene-label"><ArrowUpRight size={14} /> Keep good things moving</div>
        </div>
      </section>

      <div className="dashboard-section-heading">
        <div><h2>Your stock story</h2><p>The numbers behind your day.</p></div>
        <button className="btn btn-secondary overview-refresh" onClick={loadStats} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'is-refreshing' : ''} /> {loading ? 'Refreshing…' : 'Refresh overview'}
        </button>
      </div>
      {error && <div className="overview-error" role="alert"><AlertTriangle size={18} /><span>{error}{stats && ' Showing the last loaded figures.'}</span></div>}
      {loading && !stats && <div className="overview-loading" role="status"><Package size={26} /><span>Gathering your inventory story…</span></div>}
      {stats && <>
        <div className="overview-grid">
          <MetricCard icon={Package} label="Total items" value={number(stats.totalItems)} tone="violet" index={0} />
          <MetricCard icon={Boxes} label="Current stock" value={number(Math.round(stats.totalStock || 0))} tone="mint" index={1} />
          <MetricCard icon={CircleDollarSign} label="Stock value · BDT" value={`৳ ${money(stats.totalValue?.BDT)}`} tone="peach" index={2} />
          <MetricCard icon={CircleDollarSign} label="Stock value · USD" value={`$ ${money(stats.totalValue?.USD)}`} tone="rose" index={3} />
        </div>
        <section className="activity-panel">
          <div className="activity-heading"><span className="section-icon" data-tone="mint"><Sparkles size={18} /></span><div><h2>Keep things moving</h2><p>Your daily activity and things to watch.</p></div></div>
          <div className="activity-grid">
            {activity.map(({ label, value, icon: Icon, tone }, index) => <div className="activity-item" key={label} data-tone={tone} style={{ '--icon-delay': `${index * -1.1}s` }}>
              <span className="activity-icon"><Icon size={18} /></span><div><strong>{number(value)}</strong><span>{label}</span></div>
            </div>)}
          </div>
        </section>
        <div className="dashboard-tables">
          <section className="card dashboard-table-card">
            <div className="card-header"><div className="table-heading"><span className="section-icon" data-tone="violet"><FileText size={19} /></span><div><h3 className="card-title">On the move</h3><p>Recent challans</p></div></div><span className="section-tag">Latest activity</span></div>
            {stats.recentChallans?.length > 0 ? (
              <div className="table-wrapper"><table className="data-table">
                <thead><tr><th>Challan No</th><th>Receiver</th><th>Items</th><th>Status</th></tr></thead>
                <tbody>{stats.recentChallans.map(c => <tr key={c.id}>
                  <td className="text-mono">{c.challan_number}</td><td>{c.receiver_name}</td><td className="text-center">{c.item_count}</td>
                  <td><span className={`badge badge-${c.status === 'ACTIVE' ? 'success' : 'danger'}`}>{c.status}</span></td>
                </tr>)}</tbody>
              </table></div>
            ) : <div className="dashboard-empty"><FileText size={28} /><strong>A fresh page</strong><p>Your recent challans will appear here.</p></div>}
          </section>
          <section className="card dashboard-table-card">
            <div className="card-header"><div className="table-heading"><span className="section-icon" data-tone="peach"><TrendingDown size={19} /></span><div><h3 className="card-title">A little attention</h3><p>Low stock alerts</p></div></div><span className="section-tag">Stock watch</span></div>
            {stats.lowStockItems?.length > 0 ? (
              <div className="table-wrapper"><table className="data-table">
                <thead><tr><th>Item</th><th>Current</th><th>Min Level</th></tr></thead>
                <tbody>{stats.lowStockItems.slice(0, 8).map(item => <tr key={item.id}>
                  <td><div className="fw-bold">{item.name}</div><div className="text-muted">{item.item_code}</div></td>
                  <td className="text-mono text-danger fw-bold">{item.current_stock} {item.unit}</td><td className="text-mono">{item.min_stock_level} {item.unit}</td>
                </tr>)}</tbody>
              </table></div>
            ) : <div className="dashboard-empty" data-tone="mint"><Package size={28} /><strong>Looking well stocked!</strong><p>No low stock alerts right now.</p></div>}
          </section>
        </div>
        <p className="overview-updated" role="status">Last refreshed {updatedAt?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
      </>}
    </div>
  );
}
