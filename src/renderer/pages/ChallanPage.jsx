import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Plus, Trash2, Search, Eye, FileText } from 'lucide-react';

export default function ChallanPage() {
  const { addToast, setPage } = useStore();
  const [challanNumber, setChallanNumber] = useState('');
  const [form, setForm] = useState({ receiverName: '', receiverContact: '', receiverAddress: '', notes: '' });
  const [challanItems, setChallanItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [suggestions, setSuggestions] = useState({ receiverName: [], receiverContact: [], receiverAddress: [] });
  const [settings, setSettings] = useState({});
  const [allItems, setAllItems] = useState([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [itemFilters, setItemFilters] = useState({ search: '', style: '', order: '', purchase: '' });
  const [distinctValues, setDistinctValues] = useState({ styles: [], orders: [], purchases: [] });

  const fetchSuggestions = async (field, value) => {
    try {
      const res = await window.kadal.challans.getFieldSuggestions(field, value || '');
      if (res.success) {
        setSuggestions(prev => ({ ...prev, [field]: res.data }));
      }
    } catch (e) {
      console.error('Failed to fetch suggestions', e);
    }
  };

  useEffect(() => {
    window.kadal.settings.getAll().then(res => { if (res.success) setSettings(res.data); });
    window.kadal.challans.getNextNumber().then(res => { if (res.success) setChallanNumber(res.data); });
    window.kadal.items.getAll().then(res => { if (res.success) setAllItems(res.data); });
    window.kadal.items.getDistinctValues().then(res => { if (res.success) setDistinctValues(res.data); });
  }, []);

  const filteredItems = allItems.filter(i => {
    const s = itemFilters.search.toLowerCase();
    const matchesSearch = !s || i.name.toLowerCase().includes(s) || i.item_code.toLowerCase().includes(s);
    const matchesStyle = !itemFilters.style || i.style_name === itemFilters.style;
    const matchesOrder = !itemFilters.order || i.order_number === itemFilters.order;
    const matchesPurchase = !itemFilters.purchase || i.purchase_no === itemFilters.purchase;
    const notSelected = !challanItems.find(ci => ci.itemId === i.id);
    return matchesSearch && matchesStyle && matchesOrder && matchesPurchase && notSelected;
  });

  const addItem = async (item) => {
    let totalDelivered = 0;
    try {
      const res = await window.kadal.challans.getTotalDelivered(item.id);
      if (res.success) totalDelivered = res.data;
    } catch (e) {}

    setChallanItems(prev => [...prev, {
      itemId: item.id, itemName: item.name, itemCode: item.item_code,
      size: item.size, color: item.color, unit: item.unit, available: item.current_stock,
      buyerName: item.buyer_name || '', styleName: item.style_name || '', purchaseNo: item.purchase_no || '',
      orderNumber: item.order_number || '', orderQuantity: item.order_quantity || 0,
      totalDelivered: totalDelivered,
      quantity: 1, notes: '',
    }]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateItemQty = (idx, qty) => {
    setChallanItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(qty) } : it));
  };

  const removeItem = (idx) => {
    setChallanItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.receiverName.trim()) { addToast('error', 'Receiver name is required'); return; }
    if (challanItems.length === 0) { addToast('error', 'Add at least one item'); return; }
    for (const item of challanItems) {
      if (item.quantity <= 0) { addToast('error', `Invalid quantity for ${item.itemName}`); return; }
    }
    setSaving(true);
    try {
      const res = await window.kadal.challans.create({
        ...form,
        items: challanItems.map(i => ({ itemId: i.itemId, name: i.itemName, quantity: i.quantity, unit: i.unit, notes: i.notes })),
      });
      if (res.success && res.data?.success) {
        if (res.data.pendingApproval) {
          addToast('success', 'Request submitted for Admin approval');
          setPage('dashboard');
        } else {
          addToast('success', `Challan ${res.data.challanNumber} created!`);
          // Ask to export PDF
          try { await window.kadal.challans.exportPdf(res.data.id); } catch (e) {}
          setPage('challan-history');
        }
      } else { addToast('error', res.data?.error || res.error || 'Failed'); }
    } catch (e) { addToast('error', e.message); }
    setSaving(false);
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  if (preview) {
    return (
      <div>
        <button className="btn btn-outline mb-4" onClick={() => setPreview(false)}>← Back to Edit</button>
        <div className="challan-preview">
          <div className="challan-preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {settings.company_logo ? (
                <img src={settings.company_logo} alt="Company Logo" style={{ maxHeight: 180, maxWidth: 350, objectFit: 'contain', marginBottom: 8 }} />
              ) : (
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{settings.company_name || 'KA Design Accessories LTD'}</h2>
              )}
              {settings.company_address && <p style={{ fontSize: 12, fontWeight: 'bold' }}>{settings.company_address}</p>}
              {settings.company_phone && <p style={{ fontSize: 12, fontWeight: 'bold' }}>Phone: {settings.company_phone}</p>}
              {settings.company_email && <p style={{ fontSize: 12, fontWeight: 'bold' }}>Email: {settings.company_email}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ color: '#6366f1', fontSize: 16 }}>DELIVERY CHALLAN</h3>
              <p>No: {challanNumber}</p>
              <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p><strong>To:</strong> {form.receiverName}</p>
            {form.receiverContact && <p>Contact: {form.receiverContact}</p>}
            {form.receiverAddress && <p>Address: {form.receiverAddress}</p>}
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Code</th>
                <th>Size/Color</th>
                <th>Buyer</th>
                <th>Order No</th>
                <th style={{ textAlign: 'right' }}>Order Qty</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {challanItems.map((item, idx) => {
                const totalAfter = (item.totalDelivered || 0) + item.quantity;
                const balance = item.orderQuantity ? (item.orderQuantity - totalAfter) : null;
                return (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{item.itemName}</td>
                    <td>{item.itemCode}</td>
                    <td>{[item.size, item.color].filter(Boolean).join(' / ') || '-'}</td>
                    <td>{item.buyerName || '-'}</td>
                    <td>{item.orderNumber || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{item.orderQuantity || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: balance < 0 ? 'var(--danger)' : 'inherit' }}>
                      {balance !== null ? balance : '-'}
                    </td>
                    <td>{item.unit}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: '#f0f0ff' }}>
                <td colSpan={7}>Total</td>
                <td style={{ textAlign: 'right' }}>{challanItems.reduce((s, i) => s + i.quantity, 0)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
          {form.notes && <p style={{ marginTop: 16, fontStyle: 'italic', color: '#666' }}>Notes: {form.notes}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
          <button className="btn btn-outline" onClick={() => setPreview(false)}>Edit</button>
          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save & Generate PDF'}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header"><h3 className="card-title">Challan: {challanNumber}</h3></div>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Receiver Name *</label>
            <input className="form-input" list="receiverName-list" value={form.receiverName} onChange={e => { set('receiverName', e.target.value); fetchSuggestions('receiverName', e.target.value); }} onFocus={() => fetchSuggestions('receiverName', form.receiverName)} placeholder="Company / Person name" autoComplete="off" />
            <datalist id="receiverName-list">{suggestions.receiverName.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Contact</label>
            <input className="form-input" list="receiverContact-list" value={form.receiverContact} onChange={e => { set('receiverContact', e.target.value); fetchSuggestions('receiverContact', e.target.value); }} onFocus={() => fetchSuggestions('receiverContact', form.receiverContact)} placeholder="Phone / Email" autoComplete="off" />
            <datalist id="receiverContact-list">{suggestions.receiverContact.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" list="receiverAddress-list" value={form.receiverAddress} onChange={e => { set('receiverAddress', e.target.value); fetchSuggestions('receiverAddress', e.target.value); }} onFocus={() => fetchSuggestions('receiverAddress', form.receiverAddress)} placeholder="Delivery address" autoComplete="off" />
            <datalist id="receiverAddress-list">{suggestions.receiverAddress.map((s, i) => <option key={i} value={s} />)}</datalist>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any special instructions..." /></div>
      </div>

      <div className="card mb-4">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Challan Items</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowBrowser(true)}>
            <Plus size={14} /> Add Items
          </button>
        </div>

        {showBrowser && (
          <div className="modal-overlay">
            <div className="modal modal-lg">
              <div className="modal-header">
                <h3 className="modal-title">Select Items from Inventory</h3>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowBrowser(false)}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>
              <div className="modal-body">
                <div className="toolbar mb-4" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <input className="form-input" placeholder="Search name/code..." value={itemFilters.search} onChange={e => setItemFilters({ ...itemFilters, search: e.target.value })} style={{ width: 180 }} />
                  <select className="form-select" value={itemFilters.style} onChange={e => setItemFilters({ ...itemFilters, style: e.target.value })} style={{ width: 140 }}>
                    <option value="">All Styles</option>
                    {distinctValues.styles.map((v, i) => <option key={i} value={v}>{v}</option>)}
                  </select>
                  <select className="form-select" value={itemFilters.order} onChange={e => setItemFilters({ ...itemFilters, order: e.target.value })} style={{ width: 140 }}>
                    <option value="">All Orders</option>
                    {distinctValues.orders.map((v, i) => <option key={i} value={v}>{v}</option>)}
                  </select>
                  <select className="form-select" value={itemFilters.purchase} onChange={e => setItemFilters({ ...itemFilters, purchase: e.target.value })} style={{ width: 140 }}>
                    <option value="">All Purchase No</option>
                    {distinctValues.purchases.map((v, i) => <option key={i} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="table-wrapper" style={{ maxHeight: 400 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item Description</th>
                        <th>Style</th>
                        <th>Order No</th>
                        <th style={{ textAlign: 'right' }}>Stock</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map(item => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.item_code} | {item.size} {item.color}</div>
                          </td>
                          <td>{item.style_name || '-'}</td>
                          <td>{item.order_number || '-'}</td>
                          <td className="text-right text-mono">{item.current_stock} {item.unit}</td>
                          <td>
                            <button className="btn btn-outline btn-sm" onClick={() => addItem(item)}>
                              <Plus size={14} /> Add
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredItems.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 40 }}>No matching items found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={() => setShowBrowser(false)}>Done</button>
              </div>
            </div>
          </div>
        )}

        {challanItems.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Order No</th><th>Order Qty</th><th>Delivered</th><th>Balance</th><th>Quantity</th><th>Unit</th><th></th></tr></thead>
              <tbody>
                {challanItems.map((item, idx) => {
                  const totalAfter = (item.totalDelivered || 0) + item.quantity;
                  const balance = item.orderQuantity ? (item.orderQuantity - totalAfter) : null;
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>
                        {item.itemName}
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.itemCode} | {item.size} {item.color}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{item.orderNumber || '-'}</td>
                      <td className="text-mono">{item.orderQuantity || '-'}</td>
                      <td className="text-mono">{totalAfter}</td>
                      <td className="text-mono" style={{ fontWeight: 700, color: balance < 0 ? 'var(--danger)' : 'var(--primary)' }}>
                        {balance !== null ? balance : '-'}
                      </td>
                      <td><input className="form-input" type="number" min="1" max={item.available} value={item.quantity} onChange={e => updateItemQty(idx, e.target.value)} style={{ width: 80, padding: '6px 10px' }} /></td>
                      <td className="text-muted">{item.unit}</td>
                      <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(idx)}><Trash2 size={15} color="var(--danger)" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-outline" onClick={() => setPreview(true)} disabled={challanItems.length === 0}><Eye size={16} /> Preview</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || challanItems.length === 0}><FileText size={16} /> {saving ? 'Saving...' : 'Save Challan'}</button>
      </div>
    </div>
  );
}
