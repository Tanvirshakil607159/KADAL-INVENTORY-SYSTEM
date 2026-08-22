import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function ZoneFormModal({ isOpen, onClose, warehouseId }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('STORAGE');
  const { setLoading, addToast } = useStore();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return addToast('error', 'Zone name is required');
    try {
      setLoading(true);
      const res = await window.kadal.warehouseZones.create({ warehouse_id: warehouseId, name, type });
      if (res.success) {
        addToast('success', 'Zone created successfully');
        onClose();
      } else {
        addToast('error', res.error);
      }
    } catch (err) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>Create Storage Zone</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Zone Name (e.g. Aisle A, Cold Room)</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Zone Type</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
              <option value="STORAGE">Storage</option>
              <option value="RECEIVING">Receiving / Putaway</option>
              <option value="DISPATCH">Dispatch / Shipping</option>
            </select>
          </div>
          <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Zone</button>
          </div>
        </form>
      </div>
    </div>
  );
}
