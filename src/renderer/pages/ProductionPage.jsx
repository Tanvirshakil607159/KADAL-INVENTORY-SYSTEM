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
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [productionQty, setProductionQty] = useState('');
  const [wastageQty, setWastageQty] = useState('');
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
      setSelectedProduct(null);
      setSearchItemQuery('');
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

        // Auto-select the expected produced finished product linked in the issue!
        if (res.data.produced_item_id) {
          const matchedProd = allItems.find(it => it.id === res.data.produced_item_id);
          if (matchedProd) {
            setSelectedProduct(matchedProd);
            setSearchItemQuery(matchedProd.name);
          } else {
            const itemFetch = await window.kadal.items.getById(res.data.produced_item_id);
            if (itemFetch?.success) {
              setSelectedProduct(itemFetch.data);
              setSearchItemQuery(itemFetch.data.name);
            }
          }
        } else {
          setSelectedProduct(null);
          setSearchItemQuery('');
        }
      }
    } catch (e) {
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

  // Filter items for searchable dropdown
  const filteredProducts = allItems.filter(item => 
    item.name.toLowerCase().includes(searchItemQuery.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchItemQuery.toLowerCase())
  ).slice(0, 15);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIssueId) return addToast('error', 'Select a Factory Issue');
    if (!selectedProduct) return addToast('error', 'Select a produced finished product');
    if (!productionQty || Number(productionQty) <= 0) return addToast('error', 'Enter a valid production quantity');

    // Validate consumed and wastage quantities
    const consumptionList = [];
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

    setSubmitting(true);
    try {
      const res = await window.kadal.production.create({
        issueId: Number(selectedIssueId),
        productItemId: selectedProduct.id,
        productName: selectedProduct.name,
        productionQuantity: Number(productionQty),
        wastageQuantity: Number(wastageQty || 0),
        items: consumptionList,
        remarks: remarks || `Produced finished product from issue #${selectedIssue?.issue_id}`,
        createdBy: user?.id
      });

      if (res?.success) {
        addToast('success', `Production run successfully logged! Stock updated for "${selectedProduct.name}" (+${productionQty}).`);
        // Reset form
        setSelectedIssueId('');
        setSelectedIssue(null);
        setIssueItems([]);
        setSelectedProduct(null);
        setSearchItemQuery('');
        setProductionQty('');
        setWastageQty('');
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
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.item_code}</div>
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
          </div>
        )}
      </div>

      {/* RIGHT: Select produced finished product and quantities */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} color="var(--accent)" /> 2. Finished Product Stocking
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label className="form-label">Search & Select Produced Item *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Type item name or code to search..."
                value={searchItemQuery}
                onChange={e => setSearchItemQuery(e.target.value)}
              />
              {selectedProduct && (
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => { setSelectedProduct(null); setSearchItemQuery(''); }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {selectedProduct ? (
              <div style={{ marginTop: 8, padding: 12, border: '1px solid var(--success)', background: 'rgba(var(--success-rgb), 0.1)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--success)' }}>{selectedProduct.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Code: {selectedProduct.item_code} | Current Stock: {selectedProduct.current_stock} {selectedProduct.unit}</div>
                </div>
                <div style={{ fontSize: 11 }} className="badge badge-success">Selected</div>
              </div>
            ) : searchItemQuery.trim() !== '' && (
              <div style={{ 
                position: 'absolute', zIndex: 10, width: '100%', 
                background: 'var(--bg-card)', border: '1px solid var(--border)', 
                borderRadius: 6, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>No matching items found</div>
                ) : (
                  filteredProducts.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setSelectedProduct(item);
                        setSearchItemQuery(item.name);
                      }}
                      style={{ 
                        padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', fontSize: 13,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div>
                        <strong>{item.name}</strong> 
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>({item.item_code})</span>
                      </div>
                      <span style={{ color: 'var(--accent)' }}>{item.current_stock} {item.unit}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label className="form-label">Production Quantity *</label>
              <input 
                type="number" 
                className="form-input text-mono" 
                placeholder="e.g. 500"
                value={productionQty}
                min={1}
                required
                onChange={e => setProductionQty(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Wastage Quantity</label>
              <input 
                type="number" 
                className="form-input text-mono" 
                placeholder="e.g. 15"
                value={wastageQty}
                min={0}
                onChange={e => setWastageQty(e.target.value)}
              />
            </div>
          </div>

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
              disabled={submitting || !selectedIssueId || !selectedProduct}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spinner" /> Logging Production...
                </>
              ) : (
                <>
                  <Package size={16} /> Log Production & Stock In <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
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
