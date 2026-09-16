import SearchableSelect from '../components/ui/SearchableSelect';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useStore from '../store/useStore';
import { 
  Factory, History, BarChart3, Search, Calendar, 
  Trash2, Plus, Package, Hammer, AlertTriangle, 
  CheckCircle2, Info, Loader2, ArrowRight,
  FileSpreadsheet, FileText, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCcw, Filter, X
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
                size: full.size || base.size || '',
                color: full.color || base.color || '',
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
                                {item.size ? ` | Size: ${item.size}` : ''}
                                {item.color ? ` | Color: ${item.color}` : ''}
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
                            Code: {pItem.item_code || '-'}
                            {pItem.size ? ` | Size: ${pItem.size}` : ''}
                            {pItem.color ? ` | Color: ${pItem.color}` : ''}
                            {` | Stock: ${pItem.current_stock ?? 0} ${pItem.unit || 'Pcs'}`}
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
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const isSuperAdmin = user?.role_name === 'Super Admin' || user?.roleName === 'Super Admin';

  // Filters
  const [search, setSearch] = useState('');
  const [filterRecipient, setFilterRecipient] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterBuyer, setFilterBuyer] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterOrder, setFilterOrder] = useState('');
  const [filterPurchase, setFilterPurchase] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // Load categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await window.kadal.categories.getAll();
        if (res?.success) setCategoriesList(res.data);
        else if (Array.isArray(res)) setCategoriesList(res);
      } catch (e) {}
    };
    fetchCats();
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.kadal.production.getAll({});
      if (res?.success) {
        setHistory(res.data);
        setFiltered(res.data);
      }
    } catch (e) {
      addToast('error', 'Failed to load history');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Distinct values for dropdown filters
  const distinctRecipients = useMemo(() => {
    return [...new Set(history.map(r => r.recipient_name).filter(Boolean))].sort();
  }, [history]);

  const distinctProducts = useMemo(() => {
    return [...new Set(history.map(r => r.product_name).filter(Boolean))].sort();
  }, [history]);

  const distinctBuyers = useMemo(() => {
    return [...new Set(history.map(r => r.buyer_name).filter(Boolean))].sort();
  }, [history]);

  const distinctStyles = useMemo(() => {
    return [...new Set(history.map(r => r.style_name).filter(Boolean))].sort();
  }, [history]);

  const distinctOrders = useMemo(() => {
    return [...new Set(history.map(r => r.order_number).filter(Boolean))].sort();
  }, [history]);

  const distinctPurchases = useMemo(() => {
    return [...new Set(history.map(r => r.purchase_no).filter(Boolean))].sort();
  }, [history]);

  // Quick date presets
  const setFilterToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
  };

  const setFilterThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    setDateFrom(`${y}-${m}-01`);
    setDateTo(`${y}-${m}-${lastDay}`);
  };

  const setFilterThisYear = () => {
    const y = new Date().getFullYear();
    setDateFrom(`${y}-01-01`);
    setDateTo(`${y}-12-31`);
  };

  const handleMonthSelect = (e) => {
    const val = e.target.value;
    if (!val) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const [y, m] = val.split('-');
    const lastDay = new Date(y, m, 0).getDate();
    setDateFrom(`${y}-${m}-01`);
    setDateTo(`${y}-${m}-${lastDay}`);
  };

  const resetAllFilters = () => {
    setSearch('');
    setFilterRecipient('');
    setFilterProduct('');
    setFilterBuyer('');
    setFilterCategory('');
    setFilterStyle('');
    setFilterOrder('');
    setFilterPurchase('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = Boolean(
    search || filterRecipient || filterProduct || filterBuyer ||
    filterCategory || filterStyle || filterOrder || filterPurchase ||
    dateFrom || dateTo
  );

  // Apply filters
  useEffect(() => {
    let result = [...history];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r => {
        const prodId = `prd-${r.id}`.toLowerCase();
        const rawId = String(r.id || '');
        const issueId = String(r.issue_id || '').toLowerCase();
        const recipient = String(r.recipient_name || '').toLowerCase();
        const prodName = String(r.product_name || '').toLowerCase();
        const prodCode = String(r.product_code || '').toLowerCase();
        const style = String(r.style_name || '').toLowerCase();
        const order = String(r.order_number || '').toLowerCase();
        const purchase = String(r.purchase_no || '').toLowerCase();
        const buyer = String(r.buyer_name || '').toLowerCase();
        const size = String(r.size || '').toLowerCase();
        const color = String(r.color || '').toLowerCase();
        const remarks = String(r.remarks || '').toLowerCase();

        return (
          prodId.includes(q) || rawId.includes(q) || issueId.includes(q) ||
          recipient.includes(q) || prodName.includes(q) || prodCode.includes(q) ||
          style.includes(q) || order.includes(q) || purchase.includes(q) ||
          buyer.includes(q) || size.includes(q) || color.includes(q) ||
          remarks.includes(q)
        );
      });
    }

    if (filterRecipient) {
      result = result.filter(r => r.recipient_name === filterRecipient);
    }

    if (filterProduct) {
      result = result.filter(r => r.product_name === filterProduct);
    }

    if (filterBuyer) {
      result = result.filter(r => r.buyer_name === filterBuyer);
    }

    if (filterCategory) {
      result = result.filter(r => String(r.category_id) === String(filterCategory) || r.category_name === filterCategory);
    }

    if (filterStyle) {
      result = result.filter(r => r.style_name === filterStyle);
    }

    if (filterOrder) {
      result = result.filter(r => r.order_number === filterOrder);
    }

    if (filterPurchase) {
      result = result.filter(r => r.purchase_no === filterPurchase);
    }

    if (dateFrom || dateTo) {
      result = result.filter(r => {
        if (!r.created_at) return true;
        const itemDateStr = new Date(r.created_at).toLocaleDateString('en-CA');
        if (dateFrom && itemDateStr < dateFrom) return false;
        if (dateTo && itemDateStr > dateTo) return false;
        return true;
      });
    }

    setFiltered(result);
  }, [
    history, search, filterRecipient, filterProduct, filterBuyer,
    filterCategory, filterStyle, filterOrder, filterPurchase, dateFrom, dateTo
  ]);

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (['production_quantity', 'wastage_quantity', 'id'].includes(sortConfig.key)) {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortConfig.key === 'created_at') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  const SortHeader = ({ label, field, className = "", style = {} }) => (
    <th 
      className={`sortable ${className}`} 
      onClick={() => handleSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span>{label}</span>
        <span className={`sort-icon-container ${sortConfig.key === field ? 'active' : ''}`} style={{ display: 'inline-flex', opacity: sortConfig.key === field ? 1 : 0.35 }}>
          {sortConfig.key !== field ? <ArrowUpDown size={12} /> : 
           sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </span>
      </div>
    </th>
  );

  // Metrics
  const totalProducedQty = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (Number(r.production_quantity) || 0), 0);
  }, [filtered]);

  const totalWastageQty = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (Number(r.wastage_quantity) || 0), 0);
  }, [filtered]);

  const uniqueProductsCount = useMemo(() => {
    return new Set(filtered.map(r => r.product_name).filter(Boolean)).size;
  }, [filtered]);

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
    const res = await window.kadal.reports.exportExcel('factoryProductionReport', sortedData);
    if (res?.success) addToast('success', 'Excel exported successfully');
    else addToast('error', 'Export failed');
  };

  const exportPdf = async () => {
    const res = await window.kadal.reports.exportPdf('factoryProductionReport', sortedData);
    if (res?.success) addToast('success', 'PDF exported successfully');
    else addToast('error', 'Export failed');
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* HEADER WITH TITLE & EXPORT BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={20} color="var(--accent)" /> Factory Production History
          </h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            View and filter all recorded production batches and stock additions
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={sortedData.length === 0}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportPdf} disabled={sortedData.length === 0}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div style={{
        background: 'var(--bg-glass)',
        padding: 16,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        marginBottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        {/* ROW 1: Search & Date Presets & Date Range */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: 280 }}>
            <div className="search-bar" style={{ minWidth: 240, maxWidth: 360, flex: 1 }}>
              <Search size={16} />
              <input 
                className="form-input" 
                placeholder="Search batches, items, factories, styles..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>

            <div className="filter-group" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                type="button"
                className={`btn btn-sm ${!dateFrom && !dateTo ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                All Time
              </button>
              <button 
                type="button"
                className="btn btn-outline btn-sm" 
                onClick={setFilterToday}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                Today
              </button>
              <button 
                type="button"
                className="btn btn-outline btn-sm" 
                onClick={setFilterThisMonth}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                This Month
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span className="text-muted" style={{ fontSize: 11, fontWeight: 500 }}>Month:</span>
                <input 
                  type="month" 
                  className="form-input" 
                  onChange={handleMonthSelect} 
                  style={{ width: 120, padding: '2px 4px', fontSize: 12, height: 26, border: 'none', background: 'transparent' }} 
                  title="Select Specific Month" 
                />
              </div>
              <button 
                type="button"
                className="btn btn-outline btn-sm" 
                onClick={setFilterThisYear}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                This Year
              </button>
            </div>
          </div>

          {/* Date range inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={14} className="text-muted" />
              <input 
                type="date" 
                className="form-input" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)} 
                style={{ width: 130, padding: '5px 8px', fontSize: 12 }} 
                title="Date From"
              />
              <span className="text-muted" style={{ fontSize: 12 }}>to</span>
              <input 
                type="date" 
                className="form-input" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)} 
                style={{ width: 130, padding: '5px 8px', fontSize: 12 }} 
                title="Date To"
              />
            </div>
          </div>
        </div>

        {/* ROW 2: Dropdown Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Factory */}
          <div style={{ minWidth: 150, flex: 1 }}>
            <SearchableSelect 
              className="form-select" 
              value={filterRecipient} 
              onValueChange={val => setFilterRecipient(val)}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value="">All Factories ({distinctRecipients.length})</option>
              {distinctRecipients.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </SearchableSelect>
          </div>

          {/* Produced Item */}
          <div style={{ minWidth: 160, flex: 1 }}>
            <SearchableSelect 
              className="form-select" 
              value={filterProduct} 
              onValueChange={val => setFilterProduct(val)}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value="">All Products ({distinctProducts.length})</option>
              {distinctProducts.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </SearchableSelect>
          </div>

          {/* Buyer */}
          <div style={{ minWidth: 140, flex: 1 }}>
            <SearchableSelect 
              className="form-select" 
              value={filterBuyer} 
              onValueChange={val => setFilterBuyer(val)}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value="">All Buyers ({distinctBuyers.length})</option>
              {distinctBuyers.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </SearchableSelect>
          </div>

          {/* Category */}
          <div style={{ minWidth: 140, flex: 1 }}>
            <SearchableSelect 
              className="form-select" 
              value={filterCategory} 
              onValueChange={val => setFilterCategory(val)}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value="">All Categories</option>
              {categoriesList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SearchableSelect>
          </div>

          {/* Style */}
          <div style={{ minWidth: 130, flex: 1 }}>
            <SearchableSelect 
              className="form-select" 
              value={filterStyle} 
              onValueChange={val => setFilterStyle(val)}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value="">All Styles ({distinctStyles.length})</option>
              {distinctStyles.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </SearchableSelect>
          </div>

          {/* Order No */}
          <div style={{ minWidth: 130, flex: 1 }}>
            <SearchableSelect 
              className="form-select" 
              value={filterOrder} 
              onValueChange={val => setFilterOrder(val)}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value="">All Orders ({distinctOrders.length})</option>
              {distinctOrders.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </SearchableSelect>
          </div>

          {/* Purchase No */}
          <div style={{ minWidth: 130, flex: 1 }}>
            <SearchableSelect 
              className="form-select" 
              value={filterPurchase} 
              onValueChange={val => setFilterPurchase(val)}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value="">All Purchase Nos ({distinctPurchases.length})</option>
              {distinctPurchases.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </SearchableSelect>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button 
              type="button"
              className="btn btn-ghost btn-sm text-danger" 
              onClick={resetAllFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '4px 10px', fontSize: 12 }}
              title="Reset all filters"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY STATS STRIP */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 14,
        padding: '8px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <span className="text-muted">
            Batches: <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> {history.length !== filtered.length && <span style={{ fontSize: 11 }}>(of {history.length})</span>}
          </span>
          <span className="text-muted">
            Total Produced: <strong className="text-success text-mono">+{totalProducedQty.toLocaleString()} pcs</strong>
          </span>
          <span className="text-muted">
            Total Wastage: <strong className="text-danger text-mono">{totalWastageQty.toLocaleString()} pcs</strong>
          </span>
          <span className="text-muted">
            Products: <strong style={{ color: 'var(--accent)' }}>{uniqueProductsCount}</strong>
          </span>
        </div>

        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span className="badge badge-info">
              Active Filters Applied ({filtered.length} results)
            </span>
          </div>
        )}
      </div>

      {/* TABLE */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 8 }}>Loading production logs...</p>
        </div>
      ) : sortedData.length === 0 ? (
        <div className="empty-state">
          <h3>{history.length === 0 ? 'No production batches logged yet' : 'No matching production batches found'}</h3>
          <p>{history.length === 0 ? 'Use the "Log Production" tab to get started.' : 'Try adjusting or clearing your filters.'}</p>
          {hasActiveFilters && (
            <button className="btn btn-outline btn-sm" onClick={resetAllFilters} style={{ marginTop: 12 }}>
              <RotateCcw size={14} /> Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Batch Date" field="created_at" />
                <SortHeader label="Production ID" field="id" />
                <SortHeader label="Issue ID" field="issue_id" />
                <SortHeader label="Factory" field="recipient_name" />
                <SortHeader label="Produced Item" field="product_name" />
                <SortHeader label="Style / Purchase / Order" field="style_name" />
                <SortHeader label="Size / Color" field="size" />
                <SortHeader label="Buyer" field="buyer_name" />
                <SortHeader label="Produced Qty" field="production_quantity" className="text-right" style={{ textAlign: 'right' }} />
                <SortHeader label="Wastage" field="wastage_quantity" className="text-right" style={{ textAlign: 'right' }} />
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => (
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
                    <div className="text-muted" style={{ fontSize: 10 }}>{[item.purchase_no, item.order_number].filter(Boolean).join(' / ') || '-'}</div>
                  </td>
                  <td>{[item.size?.trim(), item.color?.trim()].filter(Boolean).join(' / ') || '-'}</td>
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
  const [filterCategory, setFilterCategory] = useState('');
  const [categoriesList, setCategoriesList] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await window.kadal.categories.getAll();
        if (res?.success) setCategoriesList(res.data);
        else if (Array.isArray(res)) setCategoriesList(res);
      } catch (e) {}
    };
    fetchCats();
  }, []);

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

    if (filterCategory) {
      result = result.filter(r => String(r.category_id) === String(filterCategory) || r.category_name === filterCategory);
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
  }, [history, filterRecipient, filterProduct, filterCategory, dateFrom, dateTo]);

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
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
            <label className="form-label">Category</label>
            <SearchableSelect
              className="form-select"
              value={filterCategory}
              onValueChange={value => setFilterCategory(value)}
            >
              <option value="">All Categories</option>
              {categoriesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SearchableSelect>
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
                      <div className="text-muted" style={{ fontSize: 10 }}>{[item.purchase_no, item.order_number].filter(Boolean).join(' / ') || '-'}</div>
                    </td>
                    <td>{[item.size?.trim(), item.color?.trim()].filter(Boolean).join(' / ') || '-'}</td>
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
