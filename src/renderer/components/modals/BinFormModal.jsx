import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function BinFormModal({ isOpen, onClose, zones }) {
  const [zoneId, setZoneId] = useState(zones[0]?.id || '');
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [capacity, setCapacity] = useState('');
  const { setLoading, addToast } = useStore();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return addToast('error', 'Bin name is required');
    if (!zoneId) return addToast('error', 'Zone is required');
    
    try {
      setLoading(true);
      const res = await window.kadal.warehouseBins.create({ 
        zone_id: zoneId, 
        name, 
        barcode: barcode.trim() || null, 
        capacity: Number(capacity) || 0 
      });
      if (res.success) {
        addToast('success', 'Bin created successfully');
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
          <h2>Create Storage Bin</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Zone</label>
            <select className="form-input" value={zoneId} onChange={e => setZoneId(e.target.value)}>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name} ({z.type})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Bin Name (e.g. Rack 1 - Shelf A)</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Barcode / QR (Optional)</label>
            <input type="text" className="form-input" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Leave blank to auto-generate or type custom code" />
          </div>
          <div className="form-group">
            <label>Capacity Limit (Optional)</label>
            <input type="number" className="form-input" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="0 for unlimited" min="0" />
          </div>
          <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Bin</button>
          </div>
        </form>
      </div>
    </div>
  );
}
