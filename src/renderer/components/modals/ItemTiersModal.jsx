import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Edit2, Save, X } from 'lucide-react';

export default function ItemTiersModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal } = useStore();
  const { item } = data;
  const isMinimized = modal?.isMinimized;
  
  const [tiers, setTiers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTiers(item.price_tiers || []);
  }, [item]);

  const handleEdit = (tier) => {
    setEditingId(tier.id);
    setEditForm({
      quantity: tier.quantity,
      unit_price: tier.unit_price,
      currency: tier.currency,
      conversion_rate: tier.conversion_rate || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (tierId) => {
    setSaving(true);
    try {
      const payload = {
        quantity: Number(editForm.quantity),
        unit_price: Number(editForm.unit_price),
        currency: editForm.currency,
        conversion_rate: editForm.currency === 'USD' ? Number(editForm.conversion_rate) : null
      };

      const res = await window.kadal.items.updateTier(tierId, payload);
      // Depending on the backend response, it might be {success: true} or just a boolean
      if (res && (res.success || res === true)) {
        addToast('success', 'Stock info updated successfully');
        setTiers(tiers.map(t => t.id === tierId ? { ...t, ...payload } : t));
        setEditingId(null);
        if (onSaved) onSaved(); // refresh parent
      } else {
        addToast('error', 'Failed to update stock info');
      }
    } catch (e) {
      addToast('error', e.message);
    }
    setSaving(false);
  };

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal modal-lg ${isMinimized ? 'minimized' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Stock-In Info: {item.name}</h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal} title="Close">✕</button>
          </div>
        </div>
        <div className="modal-body">
          <p className="text-muted mb-3" style={{ fontSize: 13 }}>
            Below are the distinct stock additions (price tiers) for this item. Editing these will directly affect the inventory valuation and stock amounts.
          </p>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Currency</th>
                  <th>Conversion Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted">No stock-in history found.</td></tr>
                ) : tiers.map(tier => (
                  <tr key={tier.id || Math.random()}>
                    {editingId === tier.id ? (
                      <>
                        <td>
                          <input type="number" className="form-input" value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: e.target.value})} style={{ padding: '4px 8px', width: '100%' }} />
                        </td>
                        <td>
                          <input type="number" className="form-input" value={editForm.unit_price} onChange={e => setEditForm({...editForm, unit_price: e.target.value})} style={{ padding: '4px 8px', width: '100%' }} />
                        </td>
                        <td>
                          <select className="form-select" value={editForm.currency} onChange={e => setEditForm({...editForm, currency: e.target.value})} style={{ padding: '4px 8px', width: '100%' }}>
                            <option value="BDT">BDT</option>
                            <option value="USD">USD</option>
                          </select>
                        </td>
                        <td>
                          {editForm.currency === 'USD' ? (
                            <input type="number" className="form-input" value={editForm.conversion_rate} onChange={e => setEditForm({...editForm, conversion_rate: e.target.value})} style={{ padding: '4px 8px', width: '100%' }} />
                          ) : '-'}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleSave(tier.id)} disabled={saving}><Save size={15} color="var(--success)" /></button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={handleCancelEdit} disabled={saving}><X size={15} color="var(--danger)" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-mono">{tier.quantity} {item.unit}</td>
                        <td className="text-mono">{tier.currency === 'USD' ? '$' : '৳'}{Number(tier.unit_price).toFixed(2)}</td>
                        <td>{tier.currency}</td>
                        <td className="text-mono">{tier.currency === 'USD' && tier.conversion_rate ? `৳${Number(tier.conversion_rate).toFixed(2)}` : '-'}</td>
                        <td>
                          <div className="table-actions">
                            {tier.id ? (
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEdit(tier)}><Edit2 size={15} /></button>
                            ) : null}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
