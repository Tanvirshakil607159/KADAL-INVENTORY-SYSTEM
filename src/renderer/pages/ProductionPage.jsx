import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import { 
  Factory, History, BarChart3, Search, Calendar, 
  Trash2, Plus, Package, Hammer, AlertTriangle, 
  CheckCircle2, Info, Loader2, ArrowRight,
  FileSpreadsheet, FileText
} from 'lucide-react';

export default function ProductionPage() {
  const [activeTab, setActiveTab] = useState('entry');
  const { addToast, user } = useStore();

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <Factory size={28} color="var(--accent)" /> Factory Production
          </h2>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Inventory finished products and reconcile raw materials issued to factories
          </p>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: 20, paddingBottom: 1 }}>
        <button 
          className={`tab-btn ${activeTab === 'entry' ? 'active' : ''}`} 
          onClick={() => setActiveTab('entry')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'entry' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'entry' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s'
          }}
        >
          <Hammer size={16} /> Log Production
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} 
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s'
          }}
        >
          <History size={16} /> Production History
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} 
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reports' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'reports' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s'
          }}
        >
          <BarChart3 size={16} /> Production Report
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'entry' && <ProductionEntryTab addToast={addToast} user={user} />}
        {activeTab === 'history' && <ProductionHistoryTab addToast={addToast} user={user} />}
        {activeTab === 'reports' && <ProductionReportsTab addToast={addToast} />}
      </div>
    </div>
  );
}

// ==================== LOG PRODUCTION TAB ====================
function ProductionEntryTab({ addToast, user }) {
  const { showConfirm } = useStore();
  const [factoryIssues, setFactoryIssues] = useState([]);
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueItems, setIssueItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [producedProducts, setProducedProducts] = useState([]);
  const [entryMode, setEntryMode] = useState('fractional'); // 'fractional' or 'reconciliation'
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      // 1. Load active factory issues
      const res = await window.kadal.issues.getAll({ issueType: 'FACTORY' });
      if (res?.success) {
        // Filter out returned issues
        const active = res.data.filter(iss => iss.status !== 'RETURNED');
        setFactoryIssues(active);
      }
      
      // 2. Load inventory items for produced product selection
      const itemRes = await window.kadal.items.getAll({});
      if (itemRes?.success) {
        setAllItems(itemRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle selecting an issue
  const handleIssueChange = async (issueId) => {
    setSelectedIssueId(issueId);
    if (!issueId) {
      setSelectedIssue(null);
      setIssueItems([]);
      setProducedProducts([]);
      return;
    }

    try {
      // Fetch full details including items
      const res = await window.kadal.issues.getById(Number(issueId));
      if (res?.success) {
        setSelectedIssue(res.data);
        
        // Calculate remaining quantities for each raw material in the issue
        const formattedItems = (res.data.items || []).map(item => {
          const remaining = item.quantity - (item.returned_quantity || 0) - (item.damage_quantity || 0) - (item.rejected_quantity || 0) - (item.consumed_quantity || 0);
          return {
            ...item,
            remaining,
            consumedQty: remaining,
            wastageQty: 0
          };
        }).filter(item => item.remaining > 0);
        setIssueItems(formattedItems);

        // ---- Robustly gather ALL linked target product IDs ----
        let prodIds = [];

        // Source 1: Backend already populated produced_items array
        if (res.data.produced_items && res.data.produced_items.length > 0) {
          prodIds = res.data.produced_items.map(p => Number(p.id)).filter(Boolean);
        }

        // Source 2: produced_item_ids field (JSON array string or array)
        if (prodIds.length === 0 && res.data.produced_item_ids) {
          try {
            const parsed = typeof res.data.produced_item_ids === 'string'
              ? JSON.parse(res.data.produced_item_ids)
              : res.data.produced_item_ids;
            if (Array.isArray(parsed)) {
              prodIds = parsed.map(Number).filter(Boolean);
            }
          } catch (e) { /* ignore parse error */ }
        }

        // Source 3: Remarks tag [PRODUCED_ITEM_IDS:1,2,3] — check both cleaned and raw remarks
        if (prodIds.length === 0) {
          const remarksToCheck = res.data._raw_remarks || res.data.remarks || '';
          const match = String(remarksToCheck).match(/\[PRODUCED_ITEM_IDS:([0-9,]+)\]/);
          if (match && match[1]) {
            prodIds = match[1].split(',').map(Number).filter(Boolean);
          }
        }

        // Source 4: Single produced_item_id fallback
        if (prodIds.length === 0 && res.data.produced_item_id) {
          prodIds = [Number(res.data.produced_item_id)];
        }

        // Source 5: produced_item object fallback
        if (prodIds.length === 0 && res.data.produced_item?.id) {
          prodIds = [Number(res.data.produced_item.id)];
        }

        // De-duplicate
        prodIds = [...new Set(prodIds)];

        console.log('[Production] Issue', issueId, '→ extracted prodIds:', prodIds, '| produced_items:', res.data.produced_items?.length, '| produced_item_ids:', res.data.produced_item_ids, '| produced_item_id:', res.data.produced_item_id);

        // Build the linked items list with full details
        let linkedItems = [];
        if (prodIds.length > 0) {
          // If backend already gave us produced_items, use those enriched with allItems
          const backendMap = {};
          (res.data.produced_items || []).forEach(p => { backendMap[String(p.id)] = p; });

          for (const pid of prodIds) {
            const backendItem = backendMap[String(pid)];
            const localItem = allItems.find(it => String(it.id) === String(pid));
            
            if (backendItem || localItem) {
              const base = backendItem || {};
              const full = localItem || {};
              linkedItems.push({
                ...base,
                ...full,
                id: pid,
                prodQty: '',
                wastQty: '',
                current_stock: full.current_stock ?? base.current_stock ?? 0,
                unit: full.unit || base.unit || 'Pcs'
              });
            } else {
              // Neither backend nor local cache has this item — fetch it directly
              try {
                const itemFetch = await window.kadal.items.getById(pid);
                if (itemFetch?.success && itemFetch.data) {
                  linkedItems.push({ ...itemFetch.data, prodQty: '', wastQty: '' });
                }
              } catch (fetchErr) {
                console.warn('[Production] Could not fetch item', pid, fetchErr);
              }
            }
          }
        }

        console.log('[Production] Final linkedItems:', linkedItems.length, linkedItems.map(i => i.name));
        setProducedProducts(linkedItems);
      }
    } catch (e) {
      console.error('[Production] handleIssueChange error:', e);
      addToast('error', 'Failed to load issue details');
    }
  };

  const handleConsumedQtyChange = (idx, val) => {
    const updated = [...issueItems];
    updated[idx].consumedQty = val === '' ? '' : Number(val);
    setIssueItems(updated);
  };

  const handleWastageQtyChange = (idx, val) => {
    const updated = [...issueItems];
    updated[idx].wastageQty = val === '' ? '' : Number(val);
    setIssueItems(updated);
  };
  const handleProductChange = (idx, field, value) => {
    const updated = [...producedProducts];
    updated[idx][field] = value;
    setProducedProducts(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIssueId) return addToast('error', 'Select a Factory Issue');
    if (producedProducts.length === 0) return addToast('error', 'No target finished products were linked to this issue. You cannot log production.');
    
    const validProducts = producedProducts.filter(p => Number(p.prodQty) > 0 || Number(p.wastQty) > 0);
    if (validProducts.length === 0) {
      return addToast('error', 'Enter production or wastage quantity for at least one target product');
    }

    // Validate consumed and wastage quantities
    const consumptionList = [];
    if (entryMode === 'reconciliation') {
      for (const item of issueItems) {
        const cQty = item.consumedQty === '' ? 0 : Number(item.consumedQty);
        const wQty = item.wastageQty === '' ? 0 : Number(item.wastageQty);
        
        if (cQty < 0) {
          return addToast('error', `Consumption quantity cannot be negative for ${item.item_name}`);
        }
        if (wQty < 0) {
          return addToast('error', `Wastage quantity cannot be negative for ${item.item_name}`);
        }
        if (cQty + wQty > item.remaining) {
          return addToast('error', `Sum of consume (${cQty}) and wastage (${wQty}) cannot exceed remaining outstanding (${item.remaining}) for ${item.item_name}`);
        }
        
        const returnQty = Math.max(0, item.remaining - (cQty + wQty));
        if (cQty > 0 || wQty > 0 || returnQty > 0) {
          consumptionList.push({
            issueItemId: item.id,
            consumedQty: cQty,
            wastageQty: wQty,
            returnQty: returnQty
          });
        }
      }

      if (consumptionList.length === 0) {
        const ok = await showConfirm({
          title: 'Zero Raw Materials Consumed',
          message: 'You have logged 0 raw material consumption for this production. Are you sure you want to proceed?',
          confirmText: 'Yes, Proceed',
          danger: false
        });
        if (!ok) return;
      }
    }

    setSubmitting(true);
    try {
      const res = await window.kadal.production.createBatch({
        issueId: Number(selectedIssueId),
        producedProducts: validProducts.map(p => ({
          productItemId: p.id,
          productName: p.name,
          productionQuantity: Number(p.prodQty || 0),
          wastageQuantity: Number(p.wastQty || 0)
        })),
        items: consumptionList,
        remarks: remarks || `Produced finished products from issue #${selectedIssue?.issue_id}`,
        createdBy: user?.id
      });

      if (res?.success) {
        addToast('success', `Production batch successfully logged!`);
        // Reset form
        setSelectedIssueId('');
        setSelectedIssue(null);
        setIssueItems([]);
        setProducedProducts([]);
        setRemarks('');
        loadInitialData();
      } else {
        addToast('error', res?.error || 'Failed to log production');
      }
    } catch (err) {
      addToast('error', err.message || 'Error executing production logging');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mode Selector */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: 20, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Entry Mode:</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="entryMode" 
              value="fractional" 
              checked={entryMode === 'fractional'} 
              onChange={() => setEntryMode('fractional')} 
            />
            <strong>Fractional (Output Only)</strong>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="entryMode" 
              value="reconciliation" 
              checked={entryMode === 'reconciliation'} 
              onChange={() => setEntryMode('reconciliation')} 
            />
            <strong>Final Reconciliation (Consume Materials)</strong>
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* LEFT: Select Issue and consumption */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={18} color="var(--accent)" /> 1. Select Factory & Raw Materials
        </h3>
        
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Active Factory Issue *</label>
          <select 
            className="form-input" 
            value={selectedIssueId} 
            onChange={e => handleIssueChange(e.target.value)}
          >
            <option value="">-- Select Active Issue --</option>
            {factoryIssues.map(iss => (
              <option key={iss.id} value={iss.id}>
                {iss.issue_id} — {iss.recipient_name} ({new Date(iss.issue_date).toLocaleDateString('en-GB')})
              </option>
            ))}
          </select>
        </div>

        {selectedIssue && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 20, fontSize: 13, background: 'var(--bg-muted)', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div><strong>Recipient:</strong> {selectedIssue.recipient_name}</div>
              <div><strong>Issue Date:</strong> {new Date(selectedIssue.issue_date).toLocaleDateString('en-GB')}</div>
              <div><strong>Remarks:</strong> {selectedIssue.remarks || 'None'}</div>
            </div>

            {entryMode === 'reconciliation' ? (
              <>
                <h4 style={{ margin: '0 0 10px 0' }}>Raw Materials Issued</h4>
                <div className="table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Raw Material</th>
                        <th style={{ textAlign: 'right' }}>Issued</th>
                        <th style={{ textAlign: 'right' }}>Remaining</th>
                        <th style={{ width: 100, textAlign: 'right' }}>Consume Qty</th>
                        <th style={{ width: 100, textAlign: 'right' }}>Wastage Qty</th>
                        <th style={{ width: 100, textAlign: 'right' }}>Return Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issueItems.length === 0 ? (
                        <tr><td colSpan="6" className="text-center">No raw material items in this issue</td></tr>
                      ) : (
                        issueItems.map((item, idx) => (
                           <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Code: {item.item_code || '-'}
                                {item.order_quantity != null && item.order_quantity > 0 ? ` | Order Qty: ${item.order_quantity}` : ''}
                                {item.style_no ? ` | Style: ${item.style_no}` : ''}
                              </div>
                            </td>
                            <td className="text-right text-mono">{item.quantity} {item.unit}</td>
                            <td className="text-right text-mono fw-bold" style={{ color: 'var(--accent)' }}>
                              {item.remaining} {item.unit}
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-right text-mono"
                                style={{ padding: '4px 8px', fontSize: 13 }}
                                value={item.consumedQty}
                                min={0}
                                max={item.remaining}
                                onChange={e => handleConsumedQtyChange(idx, e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-right text-mono"
                                style={{ padding: '4px 8px', fontSize: 13 }}
                                value={item.wastageQty}
                                min={0}
                                max={item.remaining}
                                onChange={e => handleWastageQtyChange(idx, e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-input text-right text-mono"
                                style={{ padding: '4px 8px', fontSize: 13, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                                value={Math.max(0, item.remaining - ((item.consumedQty || 0) + (item.wastageQty || 0)))}
                                readOnly
                                disabled
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ padding: 16, background: 'rgba(100, 150, 255, 0.1)', color: 'var(--text-muted)', borderRadius: 6, fontSize: 13, marginTop: 20 }}>
                <Info size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
                Raw material consumption is hidden in Fractional mode. Use this mode to log daily finished goods. Switch to Final Reconciliation when the order is complete.
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Select produced finished product and quantities */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} color="var(--accent)" /> 2. Finished Product Stocking
        </h3>

        <form onSubmit={handleSubmit}>
          {producedProducts.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
                Enter production quantities for the linked target finished products:
              </div>
              <div className="table-wrapper" style={{ overflow: 'visible' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Finished Product</th>
                      <th style={{ width: 140 }}>Production Quantity *</th>
                      <th style={{ width: 140 }}>Wastage Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {producedProducts.map((pItem, pIdx) => (
                      <tr key={pItem.id || pIdx}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--success)' }}>{pItem.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Code: {pItem.item_code || '-'} | Stock: {pItem.current_stock ?? 0} {pItem.unit || 'Pcs'}
                            {pItem.order_quantity != null && pItem.order_quantity > 0 ? ` | Order Qty: ${pItem.order_quantity}` : ''}
                            {pItem.style_name || pItem.style_no ? ` | Style: ${pItem.style_name || pItem.style_no}` : ''}
                          </div>
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="form-input text-mono" 
                            style={{ padding: '6px 8px', fontSize: 13 }}
                            placeholder="0"
                            value={pItem.prodQty}
                            min={0}
                            onChange={e => handleProductChange(pIdx, 'prodQty', e.target.value)}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="form-input text-mono" 
                            style={{ padding: '6px 8px', fontSize: 13 }}
                            placeholder="0"
                            value={pItem.wastQty}
                            min={0}
                            onChange={e => handleProductChange(pIdx, 'wastQty', e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : selectedIssue ? (
            <div style={{ marginBottom: 16, padding: 14, border: '1px solid var(--danger)', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 2 }}>
                  No Linked Target Products
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No target finished products were linked to this issue. You cannot log production.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-muted)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              <Info size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, color: 'var(--accent)' }} />
              Select an active factory issue to view target products.
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Production Remarks</label>
            <textarea 
              className="form-input" 
              placeholder="Enter details about this production batch..."
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
              disabled={submitting || !selectedIssueId || producedProducts.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spinner" /> Logging Production...
                </>
              ) : (
                <>
                  <Package size={16} /> Log Batch Production & Stock In <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}

// ==================== PRODUCTION HISTORY TAB ====================
function ProductionHistoryTab({ addToast, user }) {
  const { showConfirm } = useStore();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const isSuperAdmin = user?.role_name === 'Super Admin';

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.kadal.production.getAll({});
      if (res?.success) {
        setHistory(res.data);
      }
    } catch (e) {
      addToast('error', 'Failed to load history');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (item) => {
    const ok = await showConfirm({
      title: 'Delete Production Run',
      message: `Are you sure you want to delete this production run? This will REDUCE the finished product stock for "${item.product_name}" by ${item.production_quantity} and REVERT raw material consumption. This cannot be undone.`,
      confirmText: 'Delete Run',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await window.kadal.production.delete(item.id);
      if (res?.success) {
        addToast('success', 'Production run successfully deleted and inventory reversed.');
        loadHistory();
      } else {
        addToast('error', res?.error || 'Failed to delete record');
      }
    } catch (e) {
      addToast('error', e.message);
    }
  };

  const exportExcel = async () => {
    const res = await window.kadal.reports.exportExcel('factoryProductionReport', history);
    if (res?.success) addToast('success', 'Excel exported successfully');
    else addToast('error', 'Export failed');
  };

  const exportPdf = async () => {
    const res = await window.kadal.reports.exportPdf('factoryProductionReport', history);
    if (res?.success) addToast('success', 'PDF exported successfully');
    else addToast('error', 'Export failed');
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Recent Factory Production Batches</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={history.length === 0}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportPdf} disabled={history.length === 0}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spinner" style={{margin:'0 auto'}} /><p style={{marginTop:8}}>Loading production logs...</p></div>
      ) : history.length === 0 ? (
        <div className="empty-state"><h3>No production batches logged yet</h3><p>Use the "Log Production" tab to get started.</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Date</th>
                <th>Production ID</th>
                <th>Issue ID</th>
                <th>Factory</th>
                <th>Produced Item</th>
                <th>Style / Purchase / Order</th>
                <th>Size / Color</th>
                <th>Buyer</th>
                <th style={{ textAlign: 'right' }}>Produced Qty</th>
                <th style={{ textAlign: 'right' }}>Wastage</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id}>
                  <td style={{ fontSize: 13 }}>{new Date(item.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="text-mono fw-bold" style={{ color: 'var(--accent)', fontSize: 12 }}>PRD-{item.id}</td>
                  <td className="text-mono" style={{ fontSize: 12 }}>{item.issue_id}</td>
                  <td>{item.recipient_name}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                    {item.product_code && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.product_code}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{item.style_name || '-'}</div>
                    <div className="text-muted" style={{ fontSize: 10 }}>{item.purchase_no || '-'} / {item.order_number || '-'}</div>
                  </td>
                  <td>{[item.size, item.color].filter(Boolean).join(' / ') || '-'}</td>
                  <td>{item.buyer_name || '-'}</td>
                  <td className="text-right text-mono fw-bold text-success">+{item.production_quantity}</td>
                  <td className="text-right text-mono text-danger">{item.wastage_quantity || 0}</td>
                  <td>{item.unit || 'pcs'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isSuperAdmin && (
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        onClick={() => handleDelete(item)}
                        title="Delete Batch & Reverse Inventory"
                      >
                        <Trash2 size={14} color="var(--danger)" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== PRODUCTION REPORTS TAB ====================
function ProductionReportsTab({ addToast }) {
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterRecipient, setFilterRecipient] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.kadal.production.getAll({});
      if (res?.success) {
        setHistory(res.data);
        setFiltered(res.data);
      }
    } catch (e) {
      addToast('error', 'Failed to load report data');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle filtering
  useEffect(() => {
    let result = [...history];

    if (filterRecipient) {
      result = result.filter(r => r.recipient_name.toLowerCase().includes(filterRecipient.toLowerCase()));
    }

    if (filterProduct) {
      result = result.filter(r => r.product_name.toLowerCase().includes(filterProduct.toLowerCase()) || (r.product_code && r.product_code.toLowerCase().includes(filterProduct.toLowerCase())));
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(r => new Date(r.created_at) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59.999Z');
      result = result.filter(r => new Date(r.created_at) <= to);
    }

    setFiltered(result);
  }, [history, filterRecipient, filterProduct, dateFrom, dateTo]);

  // Aggregate statistics
  const totalProduction = filtered.reduce((sum, r) => sum + r.production_quantity, 0);
  const totalWastage = filtered.reduce((sum, r) => sum + (r.wastage_quantity || 0), 0);
  const distinctProducts = new Set(filtered.map(r => r.product_name)).size;

  const exportExcel = async () => {
    const res = await window.kadal.reports.exportExcel('factoryProductionReport', filtered);
    if (res?.success) addToast('success', 'Excel exported successfully');
    else addToast('error', 'Export failed');
  };

  const exportPdf = async () => {
    const res = await window.kadal.reports.exportPdf('factoryProductionReport', filtered);
    if (res?.success) addToast('success', 'PDF exported successfully');
    else addToast('error', 'Export failed');
  };

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 20 }}>
      {/* TOP: Filtering Controls */}
      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ margin: '0 0 16px 0' }}>Report Filter Controls</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label className="form-label">Factory Recipient</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Filter by factory..." 
              value={filterRecipient}
              onChange={e => setFilterRecipient(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Produced Item</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Filter by product name..." 
              value={filterProduct}
              onChange={e => setFilterProduct(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">From Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">To Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* MIDDLE: Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Total Production Volume</h4>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{totalProduction.toLocaleString()} pcs</span>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Total Raw Material Wastage</h4>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{totalWastage.toLocaleString()} pcs</span>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Finished Product Items</h4>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{distinctProducts} Types</span>
        </div>
      </div>

      {/* BOTTOM: Report Data Table */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Batch Production Report</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={filtered.length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button className="btn btn-outline btn-sm" onClick={exportPdf} disabled={filtered.length === 0}>
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spinner" style={{margin:'0 auto'}} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><h3>No production matches found</h3><p>Adjust your filter criteria and try again.</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch Date</th>
                  <th>Production ID</th>
                  <th>Issue ID</th>
                  <th>Factory</th>
                  <th>Produced Item</th>
                  <th>Style / Purchase / Order</th>
                  <th>Size / Color</th>
                  <th>Buyer</th>
                  <th style={{ textAlign: 'right' }}>Produced Qty</th>
                  <th style={{ textAlign: 'right' }}>Wastage Qty</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleDateString('en-GB')}</td>
                    <td className="text-mono fw-bold" style={{ color: 'var(--accent)' }}>PRD-{item.id}</td>
                    <td className="text-mono">{item.issue_id}</td>
                    <td>{item.recipient_name}</td>
                    <td><strong>{item.product_name}</strong> {item.product_code && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({item.product_code})</span>}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{item.style_name || '-'}</div>
                      <div className="text-muted" style={{ fontSize: 10 }}>{item.purchase_no || '-'} / {item.order_number || '-'}</div>
                    </td>
                    <td>{[item.size, item.color].filter(Boolean).join(' / ') || '-'}</td>
                    <td>{item.buyer_name || '-'}</td>
                    <td className="text-right text-mono text-success">+{item.production_quantity}</td>
                    <td className="text-right text-mono text-danger">{item.wastage_quantity || 0}</td>
                    <td>{item.unit || 'pcs'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
