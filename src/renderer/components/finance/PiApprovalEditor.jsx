import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, X, PackageCheck, FileText, Search } from 'lucide-react';
import useStore from '../../store/useStore';
import { CURRENCY_SYMBOLS, calcTotals, formatPoStyle } from './piApprovalUtils';
import { stripColorFromDescription } from '../../../shared/pi-item-sync.mjs';
import PiOrderLoaderModal from './PiOrderLoaderModal';
import PiItemPickerModal from './PiItemPickerModal';

const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 };
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 };
const sectionTitle = {
  fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
  color: 'var(--text-secondary)', margin: '18px 0 10px', paddingBottom: 6,
  borderBottom: '1px solid var(--border)'
};
const cellInput = { width: '100%', minWidth: 0, padding: '6px 8px', fontSize: 12 };

const DEFAULT_NOTICE = 'Editing this Proforma Invoice. Changes apply to the pending request and are used when it is approved.';

/**
 * Full-PI editor used by admins inside the approval review modal
 * and for editing existing PIs from the Finance page.
 * `form` is produced by toEditForm(); onSave receives the edited form.
 * Optional: `notice` overrides the banner text, `onFormChange` reports live edits.
 */
export default function PiApprovalEditor({
  initialForm,
  saving,
  onSave,
  onCancel,
  notice = DEFAULT_NOTICE,
  onFormChange,
  orderNumbers,
  purchaseNumbers
}) {
  const { addToast } = useStore();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderModalMode, setOrderModalMode] = useState('order');
  const [itemPickerIndex, setItemPickerIndex] = useState(null);

  useEffect(() => {
    if (onFormChange) onFormChange(form);
  }, [form, onFormChange]);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const setCurrency = (curr) => {
    setForm(prev => ({
      ...prev,
      currency: curr,
      currencySymbol: CURRENCY_SYMBOLS[curr] || curr
    }));
  };

  const setItem = (idx, field, val) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, [field]: val } : it))
    }));
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        itemId: null, itemCode: '', itemDescription: '', purchaseNo: prev.purchaseNumber || '',
        poStyleNo: '', quantity: '', unit: 'PCS', unitPrice: ''
      }]
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const existingItemIds = useMemo(
    () => new Set((form.items || []).map(it => it.itemId).filter(Boolean)),
    [form.items]
  );

  const handleAddFromOrderModal = (chosenItems, { mode, activeVal, selectedPurchaseNo }) => {
    const mapped = chosenItems.map(it => {
      const rate = Number(it.unit_price) || 0;
      const qty = Number(it.order_quantity) || Number(it.current_stock) || 1000;
      const itPurch = it.purchase_no || it.purchaseNo || (mode === 'purchase' ? selectedPurchaseNo : '') || form.purchaseNumber || '';
      return {
        itemId: it.id,
        itemCode: it.item_code || '',
        itemDescription: stripColorFromDescription(it.name),
        purchaseNo: itPurch,
        poStyleNo: formatPoStyle(it),
        quantity: qty,
        unit: (it.unit || 'PCS').toUpperCase(),
        unitPrice: rate
      };
    });

    let addedCount = 0;
    setForm(prev => {
      const existingIds = new Set(prev.items.map(it => it.itemId).filter(Boolean));
      const toAdd = mapped.filter(it => !existingIds.has(it.itemId));
      addedCount = toAdd.length;
      const nextPurchaseNumber = prev.purchaseNumber
        || (mode === 'purchase' ? selectedPurchaseNo : '')
        || chosenItems.find(it => it.purchase_no)?.purchase_no
        || '';
      return {
        ...prev,
        purchaseNumber: nextPurchaseNumber,
        items: [...prev.items, ...toAdd]
      };
    });

    if (addedCount > 0) {
      addToast('success', `Linked & added ${addedCount} item(s) from ${mode === 'order' ? 'Order' : 'Purchase Order'} ${activeVal} to PI`);
    } else if (mapped.length > 0) {
      addToast('info', 'Selected item(s) are already linked in this PI');
    }
  };

  const handleSelectInventoryItem = (index, it) => {
    if (!it) return;
    const itPurch = it.purchase_no || it.purchaseNo || it.purchase_number || it.purchaseNumber || form.purchaseNumber || '';
    setForm(prev => ({
      ...prev,
      purchaseNumber: prev.purchaseNumber || itPurch || '',
      items: prev.items.map((item, idx) => {
        if (idx !== index) return item;
        const rate = Number(it.unit_price) || 0;
        const qty = Number(item.quantity) || Number(it.order_quantity) || 1000;
        return {
          ...item,
          itemId: it.id,
          itemCode: it.item_code || '',
          itemDescription: it.name ? stripColorFromDescription(it.name) : stripColorFromDescription(item.itemDescription),
          purchaseNo: itPurch || item.purchaseNo || '',
          poStyleNo: formatPoStyle(it) || item.poStyleNo || '',
          unit: (it.unit || 'PCS').toUpperCase(),
          quantity: qty,
          unitPrice: rate
        };
      })
    }));
    setItemPickerIndex(null);
  };

  const handleClearItemLink = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, itemId: null, itemCode: '' } : item))
    }));
  };

  const totals = useMemo(() => calcTotals(form.items, form.currency), [form.items, form.currency]);
  const sym = form.currencySymbol || '$';

  const handleSave = () => {
    if (!form.piNumber.trim()) return setError('PI Number is required');
    if (!form.applicantName.trim()) return setError('Applicant Name is required');
    if (form.items.length === 0) return setError('Add at least one item');
    const badIdx = form.items.findIndex(it => !String(it.itemDescription).trim() || !(Number(it.quantity) > 0));
    if (badIdx >= 0) return setError(`Row ${badIdx + 1}: description and quantity (> 0) are required`);
    setError('');
    onSave(form);
  };

  const currencyOptions = ['USD', 'BDT', 'EUR'];
  if (form.currency && !currencyOptions.includes(form.currency)) currencyOptions.push(form.currency);

  return (
    <div id="pi-approval-editor">
      <div style={{
        background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 8,
        padding: '8px 12px', fontSize: 12, color: 'var(--accent)', marginBottom: 4
      }}>
        {notice}
      </div>

      <div style={sectionTitle}>Invoice</div>
      <div style={grid3}>
        <div className="form-group">
          <label className="form-label">PI Number *</label>
          <input id="pi-edit-number" className="form-input" value={form.piNumber} onChange={e => set('piNumber', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">PI Date</label>
          <input id="pi-edit-date" type="date" className="form-input" value={form.piDate} onChange={e => set('piDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Currency</label>
          <select id="pi-edit-currency" className="form-select" value={form.currency} onChange={e => setCurrency(e.target.value)}>
            {currencyOptions.map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c] || c})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Buyer</label>
          <input className="form-input" value={form.buyer} onChange={e => set('buyer', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Purchase No</label>
          <input className="form-input" value={form.purchaseNumber} onChange={e => set('purchaseNumber', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      <div style={sectionTitle}>Applicant (Bill To)</div>
      <div style={grid2}>
        <div className="form-group">
          <label className="form-label">Applicant Name *</label>
          <input id="pi-edit-applicant" className="form-input" value={form.applicantName} onChange={e => set('applicantName', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Applicant Address</label>
          <textarea className="form-textarea" rows={2} value={form.applicantAddress} onChange={e => set('applicantAddress', e.target.value)} />
        </div>
      </div>

      <div style={sectionTitle}>Beneficiary &amp; Bank</div>
      <div style={grid2}>
        <div className="form-group">
          <label className="form-label">Beneficiary Name</label>
          <input className="form-input" value={form.beneficiaryName} onChange={e => set('beneficiaryName', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Beneficiary BIN</label>
          <input className="form-input" value={form.beneficiaryBin} onChange={e => set('beneficiaryBin', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Beneficiary Address</label>
          <textarea className="form-textarea" rows={3} value={form.beneficiaryAddress} onChange={e => set('beneficiaryAddress', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Bank Details</label>
          <textarea className="form-textarea" rows={3} value={form.bankDetails} onChange={e => set('bankDetails', e.target.value)} />
        </div>
      </div>

      <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span>Items ({form.items.length})</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setOrderModalMode('order'); setOrderModalOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            <PackageCheck size={14} /> Load from Order
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setOrderModalMode('purchase'); setOrderModalOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            <FileText size={14} /> Load from Purchase Order
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table className="data-table table-sm" style={{ minWidth: 960, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th style={{ width: 120 }}>Inventory Link</th>
              <th style={{ width: '21%' }}>Description</th>
              <th style={{ width: '13%' }}>Purchase No</th>
              <th style={{ width: '17%' }}>PO / Style</th>
              <th style={{ width: 78 }}>Qty</th>
              <th style={{ width: 65 }}>Unit</th>
              <th style={{ width: 85 }}>Rate</th>
              <th style={{ width: 95, textAlign: 'right' }}>Total</th>
              <th style={{ width: 38 }}></th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((it, idx) => {
              const lineTotal = Number(((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toFixed(2));
              return (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    {it.itemId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            whiteSpace: 'nowrap',
                            maxWidth: 88,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={it.itemCode || `Linked (#${it.itemId})`}
                        >
                          {it.itemCode || 'Linked'}
                        </span>
                        <button
                          type="button"
                          title="Unlink inventory item"
                          onClick={() => handleClearItemLink(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 3px',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            lineHeight: 1
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setItemPickerIndex(idx)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 4,
                          color: 'var(--text-muted)',
                          border: '1px dashed var(--border)'
                        }}
                      >
                        <Search size={10} /> Link Item
                      </button>
                    )}
                  </td>
                  <td><input className="form-input" style={cellInput} value={it.itemDescription} onChange={e => setItem(idx, 'itemDescription', e.target.value)} /></td>
                  <td><input className="form-input" style={cellInput} value={it.purchaseNo} onChange={e => setItem(idx, 'purchaseNo', e.target.value)} /></td>
                  <td><input className="form-input" style={cellInput} value={it.poStyleNo} onChange={e => setItem(idx, 'poStyleNo', e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" className="form-input" style={cellInput} value={it.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)} /></td>
                  <td><input className="form-input" style={cellInput} value={it.unit} onChange={e => setItem(idx, 'unit', e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" className="form-input" style={cellInput} value={it.unitPrice} onChange={e => setItem(idx, 'unitPrice', e.target.value)} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{sym}{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" title="Remove row" onClick={() => removeItem(idx)} style={{ color: 'var(--danger)', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {form.items.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>No items. Click “Load from Order”, “Load from Purchase Order”, or “Add Item”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        marginTop: 10, padding: '10px 12px', background: 'var(--bg-secondary, rgba(128,128,128,0.08))',
        borderRadius: 8, fontSize: 13
      }}>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{totals.amountInWords}</div>
        <div style={{ display: 'flex', gap: 18, fontWeight: 700 }}>
          <span>Total Qty: {totals.totalQuantity.toLocaleString()}</span>
          <span>Total: {sym}{totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div style={sectionTitle}>Shipping &amp; Terms</div>
      <div style={grid2}>
        <div className="form-group">
          <label className="form-label">Net Weight</label>
          <input className="form-input" value={form.netWeight} onChange={e => set('netWeight', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Gross Weight</label>
          <input className="form-input" value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Terms &amp; Conditions</label>
        <textarea className="form-textarea" rows={4} value={form.termsConditions} onChange={e => set('termsConditions', e.target.value)} />
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginTop: 6 }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>
          <X size={14} /> Cancel
        </button>
        <button id="pi-edit-save" type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <PiOrderLoaderModal
        isOpen={orderModalOpen}
        mode={orderModalMode}
        onModeChange={setOrderModalMode}
        orderNumbers={orderNumbers}
        purchaseNumbers={purchaseNumbers}
        existingItemIds={existingItemIds}
        totalPiItemsCount={form.items.length}
        onAddItems={handleAddFromOrderModal}
        onClose={() => setOrderModalOpen(false)}
        zIndex={1350}
      />

      <PiItemPickerModal
        lineIndex={itemPickerIndex}
        onSelectItem={handleSelectInventoryItem}
        onClose={() => setItemPickerIndex(null)}
        zIndex={1350}
      />
    </div>
  );
}
