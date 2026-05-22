import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function SupplierFormModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal } = useStore();
  const { initialForm, editingSupplier } = data;
  const isMinimized = modal?.isMinimized;

  const [form, setForm] = useState(initialForm);
  const [suggestions, setSuggestions] = useState({ name: [], contactPerson: [], phone: [], email: [] });

  const fetchSuggestions = async (field, value) => {
    try {
      const res = await window.kadal.suppliers.getFieldSuggestions(field, value || '');
      if (res.success) setSuggestions(prev => ({ ...prev, [field]: res.data }));
    } catch (e) {}
  };

  const save = async () => {
    if (!form.name.trim()) { addToast('error','Name required'); return; }
    
    let res;
    if (editingSupplier) {
      res = await window.kadal.suppliers.update(editingSupplier.id, form);
    } else {
      res = await window.kadal.suppliers.create(form);
    }

    if (res.success) {
      addToast('success', editingSupplier ? 'Supplier updated' : 'Supplier added');
      if (onSaved) onSaved();
      closeModal();
    } else addToast('error', res.error);
  };

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal ${isMinimized ? 'minimized' : ''}`} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input className="form-input" list="supp-name-list" value={form.name} onChange={e=>{setForm(f=>({...f,name:e.target.value})); fetchSuggestions('name', e.target.value);}} onFocus={()=>fetchSuggestions('name', form.name)} autoComplete="off" />
            <datalist id="supp-name-list">{suggestions.name.map((s,i) => <option key={i} value={s} />)}</datalist>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input className="form-input" list="supp-contact-list" value={form.contactPerson} onChange={e=>{setForm(f=>({...f,contactPerson:e.target.value})); fetchSuggestions('contactPerson', e.target.value);}} onFocus={()=>fetchSuggestions('contactPerson', form.contactPerson)} autoComplete="off" />
              <datalist id="supp-contact-list">{suggestions.contactPerson.map((s,i) => <option key={i} value={s} />)}</datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" list="supp-phone-list" value={form.phone} onChange={e=>{setForm(f=>({...f,phone:e.target.value})); fetchSuggestions('phone', e.target.value);}} onFocus={()=>fetchSuggestions('phone', form.phone)} autoComplete="off" />
              <datalist id="supp-phone-list">{suggestions.phone.map((s,i) => <option key={i} value={s} />)}</datalist>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" list="supp-email-list" value={form.email} onChange={e=>{setForm(f=>({...f,email:e.target.value})); fetchSuggestions('email', e.target.value);}} onFocus={()=>fetchSuggestions('email', form.email)} autoComplete="off" />
            <datalist id="supp-email-list">{suggestions.email.map((s,i) => <option key={i} value={s} />)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-textarea" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} rows={2}></textarea>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={closeModal}>Cancel</button><button className="btn btn-primary" onClick={save}>Save Supplier</button></div>
      </div>
    </div>
  );
}
