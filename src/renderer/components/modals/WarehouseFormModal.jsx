import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import useStore from '../../store/useStore';

export default function WarehouseFormModal({ isOpen, onClose, warehouse = null }) {
  const { addToast, setLoading } = useStore();
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    location: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (warehouse && warehouse.id) {
      setFormData({
        code: warehouse.code || '',
        name: warehouse.name || '',
        location: warehouse.location || '',
        description: warehouse.description || '',
        isActive: warehouse.is_active ?? true,
      });
    } else if (isOpen) {
      window.kadal.warehouses.getNextCode()
        .then(res => {
          if (res.success) {
            setFormData(f => ({ ...f, code: res.data }));
          } else {
            console.error('[WMS] Failed to get next code:', res.error);
          }
        })
        .catch(err => {
          console.error('[WMS] IPC error getting next code:', err);
        });
    }
  }, [warehouse, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      addToast('error', 'Warehouse Name is required');
      return;
    }

    try {
      setLoading(true);
      const dataToSave = {
        code: formData.code || '',
        name: formData.name,
        location: formData.location,
        description: formData.description,
        is_active: formData.isActive
      };

      let res;
      if (warehouse && warehouse.id) {
        res = await window.kadal.warehouses.update(warehouse.id, dataToSave);
      } else {
        res = await window.kadal.warehouses.create(dataToSave);
      }

      if (res.success || res.id) {
        addToast('success', (warehouse && warehouse.id) ? 'Warehouse updated' : 'Warehouse created');
        onClose();
      } else {
        addToast('error', res.error || 'Failed to save warehouse');
      }
    } catch (err) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {(warehouse && warehouse.id) ? 'Edit Warehouse' : 'Add Warehouse'}
          </h2>
          <button onClick={onClose} className="btn-control btn-close" title="Close">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Warehouse Code</label>
              <input
                type="text"
                value={formData.code}
                className="form-input"
                placeholder="Generating..."
                disabled
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Warehouse Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="e.g. Main Warehouse"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="form-input"
                placeholder="e.g. Building A, Floor 1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="form-textarea"
                rows={3}
                placeholder="Optional description"
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <label htmlFor="isActive" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Active Warehouse
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Save Warehouse
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
