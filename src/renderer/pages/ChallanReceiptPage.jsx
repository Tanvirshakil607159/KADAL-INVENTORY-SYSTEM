import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useStore from '../store/useStore';
import { 
  PackageCheck, Search, Filter, RefreshCw, CheckCircle, AlertTriangle, 
  Clock, Truck, Check, X, Printer, Eye, FileText, ChevronRight, Layers,
  Calendar, Building, User, Info, ArrowRight, ShieldCheck, Hash
} from 'lucide-react';

export default function ChallanReceiptPage() {
  const { addToast, user } = useStore();
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState([]);
  const [statusTab, setStatusTab] = useState('PENDING'); // 'ALL', 'PENDING', 'RECEIVED', 'PARTIAL'
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Receive Modal state
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [receivingItems, setReceivingItems] = useState([]);
  const [receiverName, setReceiverName] = useState('');
  const [receivingDate, setReceivingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // View Receipt Slip state
  const [viewingSlipChallan, setViewingSlipChallan] = useState(null);

  const loadChallans = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { status: 'ACTIVE', onlyWithPi: true };
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (search.trim()) filters.search = search.trim();

      const res = await window.kadal.challans.getAll(filters);
      const data = res?.success ? res.data : (Array.isArray(res) ? res : []);
      // STRICT FILTER: Remove all challans which are not linked with a PI
      const piLinkedOnly = (data || []).filter(c => c.pi_id != null);
      setChallans(piLinkedOnly);
    } catch (e) {
      console.error('Failed to load challans for receipt:', e);
      addToast('error', 'Failed to load challans');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search, addToast]);

  useEffect(() => {
    loadChallans();
  }, [loadChallans]);

  // Filtered by status tab (Strictly PI-linked only)
  const filteredChallans = useMemo(() => {
    return challans.filter(c => {
      if (!c.pi_id) return false;
      const recStatus = (c.received_status || 'PENDING').toUpperCase();
      if (statusTab === 'PENDING') return recStatus === 'PENDING';
      if (statusTab === 'RECEIVED') return recStatus === 'RECEIVED';
      if (statusTab === 'PARTIAL') return recStatus === 'PARTIAL';
      return true; // 'ALL'
    });
  }, [challans, statusTab]);

  // Statistics (PI-linked only)
  const stats = useMemo(() => {
    let pendingCount = 0;
    let receivedCount = 0;
    let partialCount = 0;
    let totalDispatched = 0;

    challans.filter(c => c.pi_id != null).forEach(c => {
      totalDispatched++;
      const st = (c.received_status || 'PENDING').toUpperCase();
      if (st === 'RECEIVED') receivedCount++;
      else if (st === 'PARTIAL') partialCount++;
      else pendingCount++;
    });

    return { totalDispatched, pendingCount, receivedCount, partialCount };
  }, [challans]);

  // Open Receive Modal
  const handleOpenReceive = async (challan) => {
    try {
      const res = await window.kadal.challans.getById(challan.id);
      const full = res?.success ? res.data : challan;
      setSelectedChallan(full);
      setReceiverName(user?.fullName || user?.username || 'Receiving Officer');
      setReceivingDate(new Date().toISOString().split('T')[0]);
      setReceiptNotes('');

      // Populate items with default received qty = quantity
      const items = (full.items || []).map(it => {
        const defaultQty = it.received_quantity !== undefined && Number(it.received_quantity) > 0 
          ? Number(it.received_quantity) 
          : Number(it.quantity || 0);
        return {
          id: it.id,
          itemName: it.item_name || it.name,
          itemCode: it.item_code,
          size: it.size,
          color: it.color,
          styleName: it.style_name || it.po_style_no || '-',
          orderNumber: it.order_number || '-',
          unit: it.unit || 'PCS',
          quantity: Number(it.quantity || 0),
          receivedQuantity: defaultQty,
          rejectionQuantity: Math.max(0, Number(it.quantity || 0) - defaultQty),
          notes: it.notes || ''
        };
      });
      setReceivingItems(items);
    } catch (e) {
      addToast('error', 'Failed to fetch challan details');
    }
  };

  const handleUpdateItemReceivedQty = (idx, val) => {
    const num = Math.max(0, Number(val) || 0);
    setReceivingItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const rej = Math.max(0, item.quantity - num);
      return {
        ...item,
        receivedQuantity: num,
        rejectionQuantity: rej
      };
    }));
  };

  const handleReceiveAll = () => {
    setReceivingItems(prev => prev.map(item => ({
      ...item,
      receivedQuantity: item.quantity,
      rejectionQuantity: 0
    })));
  };

  const handleSubmitReceive = async () => {
    if (!receiverName.trim()) {
      addToast('error', 'Please enter Receiver Name / Officer Name');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        receivedBy: receiverName.trim(),
        receivedAt: receivingDate ? new Date(receivingDate).toISOString() : new Date().toISOString(),
        receivedNotes: receiptNotes.trim(),
        items: receivingItems.map(it => ({
          id: it.id,
          receivedQuantity: it.receivedQuantity,
          rejectionQuantity: it.rejectionQuantity
        }))
      };

      const res = await window.kadal.challans.receive(selectedChallan.id, payload);
      if (res?.success) {
        addToast('success', `Challan ${selectedChallan.challan_number} marked as ${res.receivedStatus}!`);
        setSelectedChallan(null);
        await loadChallans();
      } else {
        addToast('error', res?.error || 'Failed to update challan receipt');
      }
    } catch (e) {
      addToast('error', e.message || 'Error acknowledging receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewSlip = async (challan) => {
    try {
      const res = await window.kadal.challans.getById(challan.id);
      setViewingSlipChallan(res?.success ? res.data : challan);
    } catch (e) {
      setViewingSlipChallan(challan);
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px 32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            <PackageCheck size={28} color="var(--primary)" />
            Challan Receipt (Recipient Portal)
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Verify, inspect, and acknowledge delivery challans received from production/dispatch.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={loadChallans} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="metric-card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
            <span>Awaiting Receipt</span>
            <Clock size={18} color="var(--warning, #f59e0b)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warning, #f59e0b)' }}>{stats.pendingCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Dispatched challans pending receiver confirmation</div>
        </div>

        <div className="metric-card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
            <span>Fully Received</span>
            <CheckCircle size={18} color="var(--success, #10b981)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success, #10b981)' }}>{stats.receivedCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>100% quantities matched and accepted</div>
        </div>

        <div className="metric-card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
            <span>Shortages / Discrepancies</span>
            <AlertTriangle size={18} color="var(--danger, #ef4444)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger, #ef4444)' }}>{stats.partialCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Received with quantity shortage or damage</div>
        </div>

        <div className="metric-card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
            <span>Total Dispatched</span>
            <Truck size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{stats.totalDispatched}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Active delivery challans in cycle</div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-base, rgba(0,0,0,0.05))', padding: 4, borderRadius: 8 }}>
            {[
              { id: 'PENDING', label: `Pending Receipt (${stats.pendingCount})` },
              { id: 'RECEIVED', label: `Fully Received (${stats.receivedCount})` },
              { id: 'PARTIAL', label: `Shortage (${stats.partialCount})` },
              { id: 'ALL', label: `All (${stats.totalDispatched})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: statusTab === tab.id ? 600 : 500,
                  cursor: 'pointer',
                  background: statusTab === tab.id ? 'var(--primary)' : 'transparent',
                  color: statusTab === tab.id ? '#ffffff' : 'var(--text)',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: '1 1 320px', maxWidth: 450 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search Challan #, Receiver, PI #, Style..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  fontSize: 13
                }}
              />
            </div>
            {search && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Challans List Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-base, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
              <th style={{ padding: '12px 16px' }}>CHALLAN NO</th>
              <th style={{ padding: '12px 16px' }}>DATE</th>
              <th style={{ padding: '12px 16px' }}>RECIPIENT / FACTORY</th>
              <th style={{ padding: '12px 16px' }}>LINKED PI</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>ITEMS</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>SHIPPED QTY</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>RECEIVED QTY</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>RECEIPT STATUS</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredChallans.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <PackageCheck size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No PI-linked challans found in this category.</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>Only delivery challans dispatched against a Proforma Invoice (PI) appear in this receipt module.</p>
                </td>
              </tr>
            ) : (
              filteredChallans.map(ch => {
                const recStatus = (ch.received_status || 'PENDING').toUpperCase();
                const isPending = recStatus === 'PENDING';
                const isPartial = recStatus === 'PARTIAL';
                const isReceived = recStatus === 'RECEIVED';

                return (
                  <tr key={ch.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                      {ch.challan_number}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {ch.challan_date ? new Date(ch.challan_date).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{ch.receiver_name}</div>
                      {ch.receiver_address && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ch.receiver_address}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', 
                        color: '#6366f1', fontWeight: 700, fontSize: 11 
                      }}>
                        {ch.pi_number || `PI #${ch.pi_id}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>
                      {ch.item_count || 1}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                      {Number(ch.total_quantity || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: isReceived ? 'var(--success, #10b981)' : (isPartial ? 'var(--danger, #ef4444)' : 'var(--text-muted)') }}>
                      {Number(ch.total_received_quantity || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {isPending && (
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', 
                          borderRadius: 12, background: 'rgba(245,158,11,0.12)', color: '#d97706', fontSize: 11, fontWeight: 600 
                        }}>
                          <Clock size={12} /> Pending Receipt
                        </span>
                      )}
                      {isReceived && (
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', 
                          borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#059669', fontSize: 11, fontWeight: 600 
                        }}>
                          <CheckCircle size={12} /> Received
                        </span>
                      )}
                      {isPartial && (
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', 
                          borderRadius: 12, background: 'rgba(239,68,68,0.12)', color: '#dc2626', fontSize: 11, fontWeight: 600 
                        }}>
                          <AlertTriangle size={12} /> Shortage
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className={`btn ${isPending || isPartial ? 'btn-primary' : 'btn-outline'} btn-sm`}
                          onClick={() => handleOpenReceive(ch)}
                          title={isPending ? "Confirm and receive goods" : "Re-inspect / Update received quantities"}
                        >
                          <PackageCheck size={14} style={{ marginRight: 4 }} />
                          {isPending ? 'Receive Goods' : 'Update Qty'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleViewSlip(ch)}
                          title="View Receipt Slip"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* RECEIVE CHALLAN MODAL */}
      {selectedChallan && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 
        }}>
          <div style={{ 
            background: 'var(--bg-card, #ffffff)', borderRadius: 12, width: '100%', maxWidth: 850, 
            maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' 
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PackageCheck color="var(--primary)" size={22} />
                  Receive Goods for Challan #{selectedChallan.challan_number}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Dispatched Date: {new Date(selectedChallan.challan_date).toLocaleDateString('en-GB')} | To: {selectedChallan.receiver_name}
                  {selectedChallan.pi_number && ` | Linked to PI: ${selectedChallan.pi_number}`}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedChallan(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Quick action bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Verify Received Quantities Item-by-Item:</span>
              <button className="btn btn-outline btn-sm" onClick={handleReceiveAll} style={{ fontSize: 12 }}>
                <Check size={14} style={{ marginRight: 4 }} /> Set All Received = Shipped Qty
              </button>
            </div>

            {/* Items Table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-base, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px' }}>#</th>
                    <th style={{ padding: '10px 12px' }}>ITEM & DETAILS</th>
                    <th style={{ padding: '10px 12px' }}>STYLE / PO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>SHIPPED QTY</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', width: 140 }}>RECEIVED QTY</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>SHORTAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {receivingItems.map((item, idx) => {
                    const isShort = item.receivedQuantity < item.quantity;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{item.itemName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {[item.size, item.color].filter(Boolean).join(' / ') || item.itemCode}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {item.styleName || item.orderNumber || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {item.quantity} {item.unit}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity * 2}
                            value={item.receivedQuantity}
                            onChange={e => handleUpdateItemReceivedQty(idx, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              textAlign: 'right',
                              borderRadius: 4,
                              border: isShort ? '1px solid var(--danger, #ef4444)' : '1px solid var(--border)',
                              background: isShort ? 'rgba(239,68,68,0.05)' : 'var(--bg-card)',
                              fontWeight: 600
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: isShort ? 'var(--danger, #ef4444)' : 'var(--text-muted)' }}>
                          {item.rejectionQuantity > 0 ? `-${item.rejectionQuantity}` : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Receiver Info Form */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Received By (Receiver Name / Officer) *
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={e => setReceiverName(e.target.value)}
                  placeholder="e.g. Md. Kabir (Store In-Charge)"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Receiving Date *
                </label>
                <input
                  type="date"
                  value={receivingDate}
                  onChange={e => setReceivingDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Receiver Remarks / Discrepancy Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={receiptNotes}
                  onChange={e => setReceiptNotes(e.target.value)}
                  placeholder="e.g. Inspected on arrival. 5 pcs torn carton packaging; remainder intact."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setSelectedChallan(null)} disabled={submitting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmitReceive} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={16} /> {submitting ? 'Saving...' : 'Confirm Receipt & Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW RECEIPT SLIP MODAL */}
      {viewingSlipChallan && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 
        }}>
          <div style={{ 
            background: 'var(--bg-card, #ffffff)', borderRadius: 12, width: '100%', maxWidth: 700, 
            padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Delivery Receipt Slip - {viewingSlipChallan.challan_number}
              </h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewingSlipChallan(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, marginBottom: 16, background: 'var(--bg-base, rgba(0,0,0,0.02))', padding: 12, borderRadius: 8 }}>
              <div><strong>Delivered To:</strong> {viewingSlipChallan.receiver_name}</div>
              <div><strong>Challan Date:</strong> {new Date(viewingSlipChallan.challan_date).toLocaleDateString('en-GB')}</div>
              <div><strong>Received By:</strong> {viewingSlipChallan.received_by || 'Pending'}</div>
              <div><strong>Received At:</strong> {viewingSlipChallan.received_at ? new Date(viewingSlipChallan.received_at).toLocaleString('en-GB') : '-'}</div>
              {viewingSlipChallan.pi_number && <div><strong>PI Number:</strong> {viewingSlipChallan.pi_number}</div>}
              {viewingSlipChallan.received_notes && <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {viewingSlipChallan.received_notes}</div>}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px' }}>Item</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Shipped Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Received Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSlipChallan.items || []).map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px' }}>{it.item_name || it.name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{it.quantity} {it.unit}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{it.received_quantity || it.quantity} {it.unit}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {Number(it.received_quantity || it.quantity) >= Number(it.quantity) ? (
                          <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>Accepted</span>
                        ) : (
                          <span style={{ color: 'var(--danger, #ef4444)', fontWeight: 600 }}>Shortage: {Number(it.quantity) - Number(it.received_quantity || 0)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                <Printer size={14} style={{ marginRight: 4 }} /> Print Slip
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setViewingSlipChallan(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
