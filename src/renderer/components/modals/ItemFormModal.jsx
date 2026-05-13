import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

export default function ItemFormModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal, categories, suppliers, units } = useStore();
  const { item, buyers, distinctValues } = data;
  const isMinimized = modal?.isMinimized;
  
  const dv = distinctValues || { names: [], colors: [], sizes: [], styles: [], purchases: [], orders: [] };
  const [form, setForm] = useState({
    itemCode: item?.itemCode || item?.item_code || '', 
    name: item?.name || '', 
    categoryId: item?.categoryId || item?.category_id || '',
    size: item?.size || '', 
    color: item?.color || '', 
    unit: item?.unit || 'pcs',
    supplierId: item?.supplierId || item?.supplier_id || '', 
    openingStock: item?.openingStock || item?.opening_stock || 0,
    minStockLevel: item?.minStockLevel || item?.min_stock_level || 0, 
    notes: item?.notes || '',
    buyerName: item?.buyerName || item?.buyer_name || '', 
    styleName: item?.styleName || item?.style_name || '', 
    purchaseNo: item?.purchaseNo || item?.purchase_no || '',
    orderNumber: item?.orderNumber || item?.order_number || '', 
    orderQuantity: item?.orderQuantity || item?.order_quantity || 0,
    unitPrice: item?.unitPrice || item?.unit_price || 0, 
    currency: item?.currency || 'BDT',
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
      if (data.overrideSave) {
        await data.overrideSave(form);
        setSaving(false);
        return;
      }
      const res = item
        ? await window.kadal.items.update(item.id, form)
        : await window.kadal.items.create(form);
      if (res.success && (res.data?.success !== false)) {
        if (res.data?.pendingApproval) {
          addToast('success', 'Changes submitted for Admin approval');
        } else {
          addToast('success', item ? 'Item updated' : 'Item created');
        }
        if (onSaved) onSaved();
        closeModal();
      } else {
        addToast('error', res.data?.error || res.error || 'Failed to save');
      }
    } catch (e) { addToast('error', e.message); }
    setSaving(false);
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal modal-lg ${isMinimized ? 'minimized' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{item ? 'Edit Item' : 'Add New Item'}</h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal} title="Close">✕</button>
          </div>
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
                {buyers?.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
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
          {(!item || data.isNewItem) && (
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
          <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (item ? 'Update' : 'Create Item')}</button>
        </div>
      </div>
    </div>
  );
}
