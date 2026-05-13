import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function UserFormModal({ data, onSaved }) {
  const { addToast, closeModal, setModalMinimized, modal, roles, user: currentUser } = useStore();
  const { editingUser, initialForm } = data;
  const isMinimized = modal?.isMinimized;

  const [form, setForm] = useState(initialForm);

  const handleSaveUser = async () => {
    if (!form.username || !form.fullName || (!editingUser && !form.password)) {
      addToast('error', 'Please fill in all required fields');
      return;
    }
    try {
      const customPermissions = JSON.stringify({
        inventory: form.perms.inventory ? 'rw' : 'none',
        challan: form.perms.challan ? 'rw' : 'none',
        reports: form.perms.reports ? 'rw' : 'none',
        settings: form.perms.settings ? 'rw' : 'none',
        maintenance: form.perms.maintenance ? 'rw' : 'none'
      });

      const payload = {
        ...form,
        customPermissions
      };

      const res = editingUser
        ? await window.kadal.users.update(editingUser.id, payload)
        : await window.kadal.users.create(payload);
      
      if (res.success) {
        addToast('success', editingUser ? 'User updated' : 'User created');
        if (onSaved) onSaved();
        closeModal();
      } else {
        addToast('error', res.data?.error || res.error);
      }
    } catch (err) {
      addToast('error', err.message);
    }
  };

  return (
    <div className={`modal-overlay ${isMinimized ? 'minimized-mode' : ''}`}>
      <div className={`modal ${isMinimized ? 'minimized' : ''}`} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editingUser ? 'Edit User' : 'Add User'}</h3>
          <div className="modal-controls">
            <button className="btn-control btn-minimize" onClick={() => setModalMinimized(!isMinimized)} title={isMinimized ? 'Restore' : 'Minimize'}>{isMinimized ? '+' : '-'}</button>
            <button className="btn-control btn-close" onClick={closeModal}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} disabled={!!editingUser} /></div>
          <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} /></div>
          <div className="form-group">
            <label className="form-label">Password {editingUser && '(Leave blank to keep current)'}</label>
            <input className="form-input" type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder={editingUser ? '••••••••' : ''} />
          </div>
          <div className="form-group">
            <label className="form-label">User Role</label>
            <select className="form-select" value={form.roleId} onChange={e => {
              const rid = parseInt(e.target.value);
              const role = roles.find(r => r.id === rid);
              let newPerms = { inventory: false, challan: false, reports: false, settings: false, maintenance: false };
              if (role) {
                try {
                  const p = JSON.parse(role.permissions);
                  newPerms = {
                    inventory: p.inventory === 'rw',
                    challan: p.challan === 'rw',
                    reports: p.reports === 'r' || p.reports === 'rw',
                    settings: p.settings === 'rw',
                    maintenance: p.maintenance === 'rw'
                  };
                } catch(e) {}
              }
              setForm(f => ({...f, roleId: rid, perms: newPerms }));
            }}>
              {roles.filter(r => {
                if (currentUser?.roleName === 'Admin') {
                  return r.name !== 'Super Admin';
                }
                return true;
              }).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Access Permissions</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.inventory} onChange={e=>setForm(f=>({...f, perms: {...f.perms, inventory: e.target.checked}}))} /> Manage Inventory
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.challan} onChange={e=>setForm(f=>({...f, perms: {...f.perms, challan: e.target.checked}}))} /> Manage Challans
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.reports} onChange={e=>setForm(f=>({...f, perms: {...f.perms, reports: e.target.checked}}))} /> View Reports
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings: e.target.checked}}))} /> Admin Access
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: (currentUser?.roleName === 'Super Admin') ? 1 : 0.6, cursor: (currentUser?.roleName === 'Super Admin') ? 'pointer' : 'not-allowed' }}>
                <input 
                  type="checkbox" 
                  checked={form.perms.maintenance} 
                  onChange={e=>setForm(f=>({...f, perms: {...f.perms, maintenance: e.target.checked}}))} 
                  disabled={currentUser?.roleName !== 'Super Admin'}
                /> Database Maintenance
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={closeModal}>Cancel</button><button className="btn btn-primary" onClick={handleSaveUser}>{editingUser ? 'Update' : 'Create'}</button></div>
      </div>
    </div>
  );
}
