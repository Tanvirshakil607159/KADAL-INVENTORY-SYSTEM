import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { CURRENCY_SYMBOLS, calcTotals } from './piApprovalUtils';

const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 };
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 };
const sectionTitle = {
  fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
  color: 'var(--text-secondary)', margin: '18px 0 10px', paddingBottom: 6,
  borderBottom: '1px solid var(--border)'
};
const cellInput = { width: '100%', minWidth: 0, padding: '6px 8px', fontSize: 12 };

/**
 * Full-PI editor used by admins inside the approval review modal.
 * `form` is produced by toEditForm(); onSave receives the edited form.
 */
export default function PiApprovalEditor({ initialForm, saving, onSave, onCancel }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

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
        itemId: null, itemDescription: '', purchaseNo: prev.purchaseNumber || '',
        poStyleNo: '', quantity: '', unit: 'PCS', unitPrice: ''
      }]
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
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
        Editing this Proforma Invoice. Changes apply to the pending request and are used when it is approved.
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

      <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Items ({form.items.length})</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}><Plus size={14} /> Add Item</button>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table className="data-table table-sm" style={{ minWidth: 860, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th style={{ width: '24%' }}>Description</th>
              <th style={{ width: '14%' }}>Purchase No</th>
              <th style={{ width: '18%' }}>PO / Style</th>
              <th style={{ width: 80 }}>Qty</th>
              <th style={{ width: 70 }}>Unit</th>
              <th style={{ width: 90 }}>Rate</th>
              <th style={{ width: 100, textAlign: 'right' }}>Total</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((it, idx) => {
              const lineTotal = Number(((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toFixed(2));
              return (
                <tr key={idx}>
                  <td>{idx + 1}</td>
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
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>No items. Click “Add Item”.</td></tr>
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
    </div>
  );
}
