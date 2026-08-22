import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function RecipientFormModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal } = useStore();
  const { initialForm, editingRecipient } = data;
  const isMinimized = modal?.isMinimized;

  const [form, setForm] = useState(initialForm || { name: '', type: 'EMPLOYEE', contactInfo: '', address: '' });

  const save = async () => {
    if (!form.name.trim()) { addToast('error','Name required'); return; }
    
    let res;
    if (editingRecipient) {
      res = await window.kadal.recipients.update(editingRecipient.id, form);
    } else {
      res = await window.kadal.recipients.create(form);
    }

    if (res.success) {
      addToast('success', editingRecipient ? 'Receiver updated' : 'Receiver added');
      if (onSaved) onSaved();
      closeModal();
    } else addToast('error', res.error);
  };

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal ${isMinimized ? 'minimized' : ''}`} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editingRecipient ? 'Edit Receiver' : 'Add Receiver'}</h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Type</label>
              <select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option value="EMPLOYEE">Employee</option>
                <option value="FACTORY">Factory</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Contact Info / Phone</label>
            <input className="form-input" value={form.contactInfo} onChange={e=>setForm(f=>({...f,contactInfo:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Address</label>
            <textarea className="form-textarea" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} rows={2}></textarea>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={closeModal}>Cancel</button><button className="btn btn-primary" onClick={save}>{editingRecipient ? 'Update' : 'Save'}</button></div>
      </div>
    </div>
  );
}
