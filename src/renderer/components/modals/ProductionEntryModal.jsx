import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function ProductionEntryModal({ data, onSaved }) {
  const { closeModal, addToast } = useStore();
  const { issue } = data;

  const [formData, setFormData] = useState({
    productName: '',
    productionQuantity: 0,
    wastageQuantity: 0,
    balanceQuantity: 0,
    notes: ''
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.productName) { addToast('error', 'Product name is required'); return; }
    if (formData.productionQuantity <= 0) { addToast('error', 'Production quantity must be greater than 0'); return; }

    setSaving(true);
    try {
      const res = await window.kadal.issues.addProduction(issue.id, formData);
      if (res.success) {
        addToast('success', 'Production record added');
        if (onSaved) onSaved();
        closeModal();
      } else {
        addToast('error', res.error || 'Failed to save');
      }
    } catch (e) {
      addToast('error', e.message);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Production Reconciliation - {issue.issue_id}</h3>
          <button className="btn-close" onClick={closeModal}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Produced Product Name *</label>
            <input className="form-input" value={formData.productName} onChange={e => setFormData({ ...formData, productName: e.target.value })} placeholder="e.g. Finished Shirt" />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Production Quantity *</label>
              <input type="number" className="form-input" value={formData.productionQuantity} onChange={e => setFormData({ ...formData, productionQuantity: Number(e.target.value) })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Wastage Quantity</label>
              <input type="number" className="form-input" value={formData.wastageQuantity} onChange={e => setFormData({ ...formData, wastageQuantity: Number(e.target.value) })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Balance/Leftover Qty</label>
              <input type="number" className="form-input" value={formData.balanceQuantity} onChange={e => setFormData({ ...formData, balanceQuantity: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2}></textarea>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
