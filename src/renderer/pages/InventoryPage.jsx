import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';
import { Plus, Search, Edit2, Trash2, ArrowDownCircle, ArrowUpCircle, Package } from 'lucide-react';

export default function InventoryPage() {
  const { addToast, showConfirm, categories, suppliers, units, setCategories, setSuppliers, setUnits, user } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [purchaseFilter, setPurchaseFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showStock, setShowStock] = useState(null);
  const [stockType, setStockType] = useState('IN');

  const [buyers, setBuyers] = useState([]);
  const [distinctValues, setDistinctValues] = useState({ names: [], colors: [], sizes: [], styles: [], purchases: [] });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes, suppRes, buyersRes, unitsRes, dvRes] = await Promise.all([
        window.kadal.items.getAll({ search, categoryId: catFilter || undefined, styleName: styleFilter || undefined, orderNumber: orderFilter || undefined, purchaseNo: purchaseFilter || undefined }),
        window.kadal.categories.getAll(),
        window.kadal.suppliers.getAll(),
        window.kadal.buyers.getAll(),
        window.kadal.units.getAll(),
        window.kadal.items.getDistinctValues(),
      ]);
      if (itemsRes.success) setItems(itemsRes.data);
      if (catsRes.success) setCategories(catsRes.data);
      if (suppRes.success) setSuppliers(suppRes.data);
      if (buyersRes.success) setBuyers(buyersRes.data);
      if (unitsRes.success) setUnits(unitsRes.data);
      if (dvRes.success) setDistinctValues(dvRes.data);
    } catch (e) { addToast('error', 'Failed to load data'); }
    setLoading(false);
  }, [search, catFilter, styleFilter, orderFilter, purchaseFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (item) => {
    const confirmed = await showConfirm({ title: 'Delete Item', message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`, type: 'danger', confirmText: 'Delete' });
    if (!confirmed) return;
    const res = await window.kadal.items.delete(item.id);
    if (res.success) { addToast('success', 'Item deleted'); loadData(); }
    else addToast('error', res.error);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar">
            <Search />
            <input className="form-input" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 'auto', minWidth: 150, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Categories</option>
            {categories.filter(c=>c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-select" value={styleFilter} onChange={e => setStyleFilter(e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Styles</option>
            {distinctValues.styles.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>
          <select className="form-select" value={orderFilter} onChange={e => setOrderFilter(e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Orders</option>
            {distinctValues.orders?.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>
          <select className="form-select" value={purchaseFilter} onChange={e => setPurchaseFilter(e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '8px 32px 8px 12px', fontSize: 13 }}>
            <option value="">All Purchase No</option>
            {distinctValues.purchases.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}><Plus size={16} /> Add Item</button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : items.length === 0 ? (
        <div className="empty-state"><Package size={48} /><h3>No items found</h3><p>Add your first inventory item to get started</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Item Name</th><th>Order No</th><th>Category</th><th>Size</th><th>Color</th><th style={{textAlign:'right'}}>Order Qty</th><th style={{textAlign:'right'}}>Stock</th><th style={{textAlign:'right'}}>Total Value</th><th>Unit</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{item.item_code}</td>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ fontSize: 13 }}>{item.order_number || '-'}</td>
                  <td><span className="badge badge-info">{item.category_name || '-'}</span></td>
                  <td>{item.size || '-'}</td>
                  <td>{item.color || '-'}</td>
                  <td className="text-right text-mono">{item.order_quantity || '-'}</td>
                  <td className="text-right text-mono fw-bold" style={{ color: item.current_stock <= item.min_stock_level && item.min_stock_level > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {item.current_stock}
                  </td>
                  <td className="text-right text-mono">{item.currency === 'USD' ? '$' : '৳'}{Number((item.current_stock * (item.unit_price || 0))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Stock IN" onClick={() => { setShowStock(item); setStockType('IN'); }}><ArrowDownCircle size={15} color="var(--success)" /></button>
                      {user?.roleName !== 'Inventory' && (
                        <button className="btn btn-ghost btn-icon btn-sm" title="Stock OUT" onClick={() => { setShowStock(item); setStockType('OUT'); }}><ArrowUpCircle size={15} color="var(--warning)" /></button>
                      )}
                      <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => { setEditItem(item); setShowForm(true); }}><Edit2 size={15} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Delete" onClick={() => handleDelete(item)}><Trash2 size={15} color="var(--danger)" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ItemFormModal item={editItem} categories={categories} suppliers={suppliers} buyers={buyers} units={units} distinctValues={distinctValues} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadData(); }} />}
      {showStock && <StockMovementModal item={showStock} type={stockType} onClose={() => setShowStock(null)} onSaved={() => { setShowStock(null); loadData(); }} />}
    </div>
  );
}

function ItemFormModal({ item, categories, suppliers, buyers, units, distinctValues, onClose, onSaved }) {
  const { addToast } = useStore();
  const dv = distinctValues || { names: [], colors: [], sizes: [], styles: [], purchases: [], orders: [] };
  const [form, setForm] = useState({
    itemCode: item?.item_code || '', name: item?.name || '', categoryId: item?.category_id || '',
    size: item?.size || '', color: item?.color || '', unit: item?.unit || 'pcs',
    supplierId: item?.supplier_id || '', openingStock: item?.opening_stock || 0,
    minStockLevel: item?.min_stock_level || 0, notes: item?.notes || '',
    buyerName: item?.buyer_name || '', styleName: item?.style_name || '', purchaseNo: item?.purchase_no || '',
    orderNumber: item?.order_number || '', orderQuantity: item?.order_quantity || 0,
    unitPrice: item?.unit_price || 0, currency: item?.currency || 'BDT',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) {
      window.kadal.items.getNextCode().then(res => {
        if (res.success) setForm(f => ({ ...f, itemCode: res.data }));
      });
    }
  }, [item]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = item
        ? await window.kadal.items.update(item.id, form)
        : await window.kadal.items.create(form);
      if (res.success && (res.data?.success !== false)) {
        if (res.data?.pendingApproval) {
          addToast('success', 'Changes submitted for Admin approval');
        } else {
          addToast('success', item ? 'Item updated' : 'Item created');
        }
        onSaved();
      } else {
        addToast('error', res.data?.error || res.error || 'Failed to save');
      }
    } catch (e) { addToast('error', e.message); }
    setSaving(false);
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{item ? 'Edit Item' : 'Add New Item'}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <datalist id="dl-names">{dv.names.map((v,i) => <option key={i} value={v} />)}</datalist>
          <datalist id="dl-colors">{dv.colors.map((v,i) => <option key={i} value={v} />)}</datalist>
          <datalist id="dl-sizes">{dv.sizes.map((v,i) => <option key={i} value={v} />)}</datalist>
          <datalist id="dl-styles">{dv.styles.map((v,i) => <option key={i} value={v} />)}</datalist>
          <datalist id="dl-purchases">{dv.purchases.map((v,i) => <option key={i} value={v} />)}</datalist>
          <datalist id="dl-orders">{dv.orders?.map((v,i) => <option key={i} value={v} />)}</datalist>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Item Code</label>
              <input className="form-input" value={form.itemCode} disabled placeholder="Generating..." />
            </div>
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input className={`form-input ${errors.name ? 'error' : ''}`} list="dl-names" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Metal Button 20mm" />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">Select...</option>
                {categories.filter(c=>c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Size</label>
              <input className="form-input" list="dl-sizes" value={form.size} onChange={e => set('size', e.target.value)} placeholder="e.g. 20mm" />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input className="form-input" list="dl-colors" value={form.color} onChange={e => set('color', e.target.value)} placeholder="e.g. Gold" />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Buyer Name</label>
              <select className="form-select" value={form.buyerName} onChange={e => set('buyerName', e.target.value)}>
                <option value="">Select...</option>
                {buyers.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Style Name</label>
              <input className="form-input" list="dl-styles" value={form.styleName} onChange={e => set('styleName', e.target.value)} placeholder="Style Name" />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase No</label>
              <input className="form-input" list="dl-purchases" value={form.purchaseNo} onChange={e => set('purchaseNo', e.target.value)} placeholder="Purchase No" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Order Number</label>
              <input className="form-input" list="dl-orders" value={form.orderNumber} onChange={e => set('orderNumber', e.target.value)} placeholder="Order Number" />
            </div>
            <div className="form-group">
              <label className="form-label">Order Quantity</label>
              <input className="form-input" type="number" min="0" value={form.orderQuantity} onChange={e => set('orderQuantity', Number(e.target.value))} placeholder="0" />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="pcs">pcs</option>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-select" value={form.supplierId} onChange={e => set('supplierId', e.target.value)}>
                <option value="">Select...</option>
                {suppliers.filter(s=>s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Min Stock Level</label>
              <input className="form-input" type="number" min="0" value={form.minStockLevel} onChange={e => set('minStockLevel', Number(e.target.value))} />
            </div>
          </div>
          {!item && (
            <div className="form-group">
              <label className="form-label">Opening Stock</label>
              <input className="form-input" type="number" min="0" value={form.openingStock} onChange={e => set('openingStock', Number(e.target.value))} />
            </div>
          )}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Unit Price</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-select" value={form.currency} onChange={e => set('currency', e.target.value)} style={{ width: 80 }}>
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
                <input className="form-input" type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => set('unitPrice', Number(e.target.value))} placeholder="0.00" style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." rows={2}></textarea>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (item ? 'Update' : 'Create Item')}</button>
        </div>
      </div>
    </div>
  );
}

function StockMovementModal({ item, type, onClose, onSaved }) {
  const { addToast } = useStore();
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState({ reference: [], notes: [] });

  const fetchSuggestions = async (field, value) => {
    try {
      const res = await window.kadal.stock.getFieldSuggestions(field, value || '');
      if (res.success) setSuggestions(prev => ({ ...prev, [field]: res.data }));
    } catch (e) {}
  };

  const handleSave = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { addToast('error', 'Enter a valid quantity'); return; }
    setSaving(true);
    try {
      const res = await window.kadal.stock.addMovement({ itemId: item.id, itemName: item.name, type, quantity: qty, reference, notes });
      if (res.success && res.data?.success) {
        if (res.data.pendingApproval) {
          addToast('success', 'Stock movement submitted for Admin approval');
        } else {
          addToast('success', `Stock ${type === 'IN' ? 'added' : 'deducted'}: ${qty} ${item.unit}`);
        }
        onSaved();
      } else { addToast('error', res.data?.error || res.error || 'Failed'); }
    } catch (e) { addToast('error', e.message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ color: type === 'IN' ? 'var(--success)' : 'var(--warning)' }}>
            Stock {type} — {item.name}
          </h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg-tertiary)', padding: 14, borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">Current Stock:</span>
            <span className="text-mono fw-bold">{item.current_stock} {item.unit}</span>
          </div>
          <div className="form-group">
            <label className="form-label">Quantity *</label>
            <input className="form-input" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} autoFocus placeholder="Enter quantity" />
          </div>
          <div className="form-group">
            <label className="form-label">Reference</label>
            <input className="form-input" list="stock-reference-list" value={reference} onChange={e => { setReference(e.target.value); fetchSuggestions('reference', e.target.value); }} onFocus={() => fetchSuggestions('reference', reference)} placeholder="e.g. PO-12345, Manual adjustment" autoComplete="off" />
            <datalist id="stock-reference-list">{suggestions.reference.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" list="stock-notes-list" value={notes} onChange={e => { setNotes(e.target.value); fetchSuggestions('notes', e.target.value); }} onFocus={() => fetchSuggestions('notes', notes)} placeholder="Optional notes..." autoComplete="off" />
            <datalist id="stock-notes-list">{suggestions.notes.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className={`btn btn-${type === 'IN' ? 'success' : 'danger'}`} onClick={handleSave} disabled={saving}>
            {saving ? 'Processing...' : `Confirm Stock ${type}`}
          </button>
        </div>
      </div>
    </div>
  );
}
