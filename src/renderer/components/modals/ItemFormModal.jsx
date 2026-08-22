import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import SuggestionInput from '../ui/SuggestionInput';

export default function ItemFormModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal, categories, suppliers, units, user } = useStore();
  const { item, buyers, distinctValues } = data;
  const isMinimized = modal?.isMinimized;
  
  const [buyersList, setBuyersList] = useState(buyers || []);
  const [dvList, setDvList] = useState(distinctValues || { names: [], colors: [], sizes: [], styles: [], purchases: [], orders: [], notes: [] });
  const [form, setForm] = useState({
    itemCode: item?.itemCode || item?.item_code || '', 
    name: item?.name || '', 
    categoryId: item?.categoryId || item?.category_id || '',
    size: item?.size || '', 
    color: item?.color || '', 
    unit: item?.unit || '',
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
    currency: item?.currency || '',
    sourceType: item?.source_type || item?.sourceType || 'SOURCE',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) {
      window.kadal.items.getNextCode().then(res => {
        if (res.success) setForm(f => ({ ...f, itemCode: res.data }));
      });
    }
    if (!buyers) {
      window.kadal.buyers.getAll().then(res => {
        if (res.success) setBuyersList(res.data);
      });
    }
    if (!distinctValues) {
      window.kadal.items.getDistinctValues().then(res => {
        if (res.success) setDvList(res.data);
      });
    }
  }, [item, buyers, distinctValues]);

  const isFilled = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'number') return val > 0;
    return !!val;
  };

  const validate = () => {
    const e = {};
    const requiredFields = [
      'name', 'categoryId', 'size', 'color', 'unit', 'supplierId', 
      'minStockLevel', 'buyerName', 'styleName', 'purchaseNo', 
      'orderNumber', 'orderQuantity', 'unitPrice', 'currency'
    ];
    
    // Only require openingStock for new items that are SOURCE type
    if ((!item || data.isNewItem) && form.sourceType !== 'PRODUCTION' && user?.roleName !== 'Merchandiser') {
      requiredFields.push('openingStock');
    }

    requiredFields.forEach(f => {
      const val = form[f];
      // Special case: minStockLevel and orderQuantity are allowed to be 0
      const isAllowedZero = (f === 'minStockLevel' || f === 'orderQuantity');
      const filled = (typeof val === 'number' && val === 0) ? isAllowedZero : isFilled(val);
      
      if (!filled) e[f] = 'Required';
    });

    setErrors(e);
    if (Object.keys(e).length > 0) {
      addToast('error', 'Please fill in all fields');
    }
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const finalForm = {
        ...form,
        openingStock: form.sourceType === 'PRODUCTION' ? 0 : form.openingStock
      };
      if (data.overrideSave) {
        await data.overrideSave(finalForm);
        setSaving(false);
        return;
      }
      const res = item
        ? await window.kadal.items.update(item.id, finalForm)
        : await window.kadal.items.create(finalForm);
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
          {/* SOURCE vs PRODUCTION SELECTOR */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Item Origin / Nature *</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                type="button" 
                className={`btn ${form.sourceType === 'SOURCE' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', fontWeight: 550 }}
                onClick={() => set('sourceType', 'SOURCE')}
              >
                <span style={{ fontSize: 16 }}>📦</span> Source (Imported / Sourced)
              </button>
              <button 
                type="button" 
                className={`btn ${form.sourceType === 'PRODUCTION' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', fontWeight: 550 }}
                onClick={() => set('sourceType', 'PRODUCTION')}
              >
                <span style={{ fontSize: 16 }}>🏭</span> Production (Factory Produced)
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Item Code</label>
              <input className="form-input" value={form.itemCode} disabled placeholder="Generating..." />
            </div>
            <SuggestionInput
              label="Item Name"
              value={form.name}
              onChange={v => set('name', v)}
              suggestions={dvList.names}
              placeholder="e.g. Metal Button 20mm"
              error={errors.name}
              required
            />
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className={`form-select ${errors.categoryId ? 'error' : (isFilled(form.categoryId) ? 'filled' : '')}`} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">Select Category...</option>
                {categories.filter(c=>c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <SuggestionInput
              label="Size"
              value={form.size}
              onChange={v => set('size', v)}
              suggestions={dvList.sizes}
              placeholder="e.g. 20mm"
              error={errors.size}
              required
            />
            <SuggestionInput
              label="Color"
              value={form.color}
              onChange={v => set('color', v)}
              suggestions={dvList.colors}
              placeholder="e.g. Gold"
              error={errors.color}
              required
            />
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Buyer Name *</label>
              <select className={`form-select ${errors.buyerName ? 'error' : (isFilled(form.buyerName) ? 'filled' : '')}`} value={form.buyerName} onChange={e => set('buyerName', e.target.value)}>
                <option value="">Select Buyer...</option>
                {buyersList?.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <SuggestionInput
              label="Style Name"
              value={form.styleName}
              onChange={v => set('styleName', v)}
              suggestions={dvList.styles}
              placeholder="Style Name"
              error={errors.styleName}
              required
            />
            <SuggestionInput
              label="Purchase No"
              value={form.purchaseNo}
              onChange={v => set('purchaseNo', v)}
              suggestions={dvList.purchases}
              placeholder="Purchase No"
              error={errors.purchaseNo}
              required
            />
          </div>
          <div className="form-row">
            <SuggestionInput
              label="Order Number"
              value={form.orderNumber}
              onChange={v => set('orderNumber', v)}
              suggestions={dvList.orders}
              placeholder="Order Number"
              error={errors.orderNumber}
              required
            />
            <div className="form-group">
              <label className="form-label">Order Quantity *</label>
              <input 
                className={`form-input ${errors.orderQuantity ? 'error' : (isFilled(form.orderQuantity) ? 'filled' : '')}`} 
                type="number" 
                min="0" 
                value={form.orderQuantity} 
                onChange={e => set('orderQuantity', Number(e.target.value))} 
                onWheel={(e) => e.target.blur()}
                placeholder="0" 
              />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className={`form-select ${errors.unit ? 'error' : (isFilled(form.unit) ? 'filled' : '')}`} value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="">Select...</option>
                <option value="pcs">pcs</option>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{form.sourceType === 'PRODUCTION' ? 'Factory *' : 'Supplier *'}</label>
              <select className={`form-select ${errors.supplierId ? 'error' : (isFilled(form.supplierId) ? 'filled' : '')}`} value={form.supplierId} onChange={e => set('supplierId', e.target.value)}>
                <option value="">Select...</option>
                {suppliers.filter(s=>s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Min Stock Level</label>
              <input 
                className={`form-input ${errors.minStockLevel ? 'error' : (isFilled(form.minStockLevel) ? 'filled' : '')}`} 
                type="number" 
                min="0" 
                value={form.minStockLevel} 
                onChange={e => set('minStockLevel', Number(e.target.value))} 
                onWheel={(e) => e.target.blur()}
              />
            </div>
          </div>
          {form.sourceType !== 'PRODUCTION' && (!item || data.isNewItem) && user?.roleName !== 'Merchandiser' && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Opening Stock *</label>
              <input 
                className={`form-input ${errors.openingStock ? 'error' : (isFilled(form.openingStock) ? 'filled' : '')}`} 
                type="number" 
                min="0" 
                value={form.openingStock} 
                onChange={e => set('openingStock', Number(e.target.value))} 
                onWheel={(e) => e.target.blur()}
              />
            </div>
          )}
          {user?.roleName === 'Merchandiser' && (!item || data.isNewItem) && (
             <div className="form-group" style={{ marginBottom: 16 }}>
               <label className="form-label">Opening Stock</label>
               <input className="form-input" disabled value="Updated by Inventory" />
             </div>
          )}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Unit Price</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className={`form-select ${errors.currency ? 'error' : (isFilled(form.currency) ? 'filled' : '')}`} value={form.currency} onChange={e => set('currency', e.target.value)} style={{ width: 100 }}>
                  <option value="">Select...</option>
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
                <input 
                  className={`form-input ${errors.unitPrice ? 'error' : (isFilled(form.unitPrice) ? 'filled' : '')}`} 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={form.unitPrice} 
                  onChange={e => set('unitPrice', Number(e.target.value))} 
                  onWheel={(e) => e.target.blur()}
                  placeholder="0.00" 
                  style={{ flex: 1 }} 
                />
              </div>
            </div>
            <SuggestionInput
              label="Notes"
              value={form.notes}
              onChange={v => set('notes', v)}
              suggestions={dvList.notes}
              placeholder="Optional notes..."
              error={errors.notes}
            />
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
