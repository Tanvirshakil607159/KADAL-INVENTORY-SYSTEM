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
        dashboard: form.perms.dashboard ? 'rw' : 'none',
        inventory: form.perms.inventory ? 'rw' : 'none',
        pending_items: form.perms.pending_items ? 'rw' : 'none',
        warehouses: form.perms.warehouses ? 'rw' : 'none',
        challan: form.perms.challan ? 'rw' : 'none',
        approvals: form.perms.approvals ? 'rw' : 'none',
        gate_pass: form.perms.gate_pass ? 'rw' : 'none',
        requisition: form.perms.requisition ? 'rw' : 'none',
        issue: form.perms.issue ? 'rw' : 'none',
        production: form.perms.production ? 'rw' : 'none',
        reports: form.perms.reports ? 'rw' : 'none',
        settings: form.perms.settings ? 'rw' : 'none',
        settings_company: form.perms.settings_company ? 'rw' : 'none',
        settings_users: form.perms.settings_users ? 'rw' : 'none',
        settings_categories: form.perms.settings_categories ? 'rw' : 'none',
        settings_units: form.perms.settings_units ? 'rw' : 'none',
        settings_suppliers: form.perms.settings_suppliers ? 'rw' : 'none',
        settings_buyers: form.perms.settings_buyers ? 'rw' : 'none',
        settings_import: form.perms.settings_import ? 'rw' : 'none',
        settings_sync: form.perms.settings_sync ? 'rw' : 'none',
        settings_recipients: form.perms.settings_recipients ? 'rw' : 'none',
        settings_system: form.perms.settings_system ? 'rw' : 'none',
        backup: form.perms.backup ? 'rw' : 'none',
        maintenance: form.perms.backup ? 'rw' : 'none' // keep for backward compatibility
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
              let newPerms = { dashboard: false, inventory: false, pending_items: false, warehouses: false, challan: false, approvals: false, gate_pass: false, requisition: false, issue: false, production: false, reports: false, settings: false, settings_company: false, settings_users: false, settings_categories: false, settings_units: false, settings_suppliers: false, settings_buyers: false, settings_import: false, settings_sync: false, settings_recipients: false, settings_system: false, backup: false };
              if (role) {
                try {
                  const p = JSON.parse(role.permissions);
                  const s = p.settings === 'rw' || p.settings === true;
                  newPerms = {
                    dashboard: p.dashboard === 'rw' || p.dashboard === true,
                    inventory: p.inventory === 'rw' || p.inventory === true,
                    pending_items: p.pending_items === 'rw' || p.pending_items === true,
                    warehouses: p.warehouses === 'rw' || p.warehouses === true,
                    challan: p.challan === 'rw' || p.challan === true,
                    approvals: p.approvals === 'rw' || p.approvals === true,
                    gate_pass: p.gate_pass === 'rw' || p.gate_pass === true,
                    requisition: p.requisition === 'rw' || p.requisition === true,
                    issue: p.issue === 'rw' || p.issue === true,
                    production: p.production === 'rw' || p.production === true,
                    reports: p.reports === 'r' || p.reports === 'rw' || p.reports === true,
                    settings: s,
                    settings_company: Object.hasOwn(p, 'settings_company') ? (p.settings_company === 'rw' || p.settings_company === true) : s,
                    settings_users: Object.hasOwn(p, 'settings_users') ? (p.settings_users === 'rw' || p.settings_users === true) : s,
                    settings_categories: Object.hasOwn(p, 'settings_categories') ? (p.settings_categories === 'rw' || p.settings_categories === true) : s,
                    settings_units: Object.hasOwn(p, 'settings_units') ? (p.settings_units === 'rw' || p.settings_units === true) : s,
                    settings_suppliers: Object.hasOwn(p, 'settings_suppliers') ? (p.settings_suppliers === 'rw' || p.settings_suppliers === true) : s,
                    settings_buyers: Object.hasOwn(p, 'settings_buyers') ? (p.settings_buyers === 'rw' || p.settings_buyers === true) : s,
                    settings_import: Object.hasOwn(p, 'settings_import') ? (p.settings_import === 'rw' || p.settings_import === true) : s,
                    settings_sync: Object.hasOwn(p, 'settings_sync') ? (p.settings_sync === 'rw' || p.settings_sync === true) : s,
                    settings_recipients: Object.hasOwn(p, 'settings_recipients') ? (p.settings_recipients === 'rw' || p.settings_recipients === true) : s,
                    settings_system: Object.hasOwn(p, 'settings_system') ? (p.settings_system === 'rw' || p.settings_system === true) : s,
                    backup: p.backup === 'rw' || p.maintenance === 'rw' || p.backup === true
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
                <input type="checkbox" checked={form.perms.dashboard} onChange={e=>setForm(f=>({...f, perms: {...f.perms, dashboard: e.target.checked}}))} /> Dashboard
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.inventory} onChange={e=>setForm(f=>({...f, perms: {...f.perms, inventory: e.target.checked}}))} /> Inventory
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.pending_items} onChange={e=>setForm(f=>({...f, perms: {...f.perms, pending_items: e.target.checked}}))} /> Pending Items
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.warehouses} onChange={e=>setForm(f=>({...f, perms: {...f.perms, warehouses: e.target.checked}}))} /> Warehouses
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.challan} onChange={e=>setForm(f=>({...f, perms: {...f.perms, challan: e.target.checked}}))} /> Create Challan
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.approvals} onChange={e=>setForm(f=>({...f, perms: {...f.perms, approvals: e.target.checked}}))} /> Approvals
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.gate_pass} onChange={e=>setForm(f=>({...f, perms: {...f.perms, gate_pass: e.target.checked}}))} /> Gate Pass
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.requisition} onChange={e=>setForm(f=>({...f, perms: {...f.perms, requisition: e.target.checked}}))} /> Requisition
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.issue} onChange={e=>setForm(f=>({...f, perms: {...f.perms, issue: e.target.checked}}))} /> Issue
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.production} onChange={e=>setForm(f=>({...f, perms: {...f.perms, production: e.target.checked}}))} /> Production
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.reports} onChange={e=>setForm(f=>({...f, perms: {...f.perms, reports: e.target.checked}}))} /> Reports
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings: e.target.checked}}))} /> Settings
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: (currentUser?.roleName === 'Super Admin') ? 1 : 0.6, cursor: (currentUser?.roleName === 'Super Admin') ? 'pointer' : 'not-allowed' }}>
                <input 
                  type="checkbox" 
                  checked={form.perms.backup} 
                  onChange={e=>setForm(f=>({...f, perms: {...f.perms, backup: e.target.checked}}))} 
                  disabled={currentUser?.roleName !== 'Super Admin'}
                /> Backup & Restore
              </label>
            </div>
            
            <label className="form-label" style={{ marginTop: 16 }}>Settings Modules Access</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_company} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_company: e.target.checked}}))} /> Company
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_users} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_users: e.target.checked}}))} /> Users
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_categories} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_categories: e.target.checked}}))} /> Categories
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_units} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_units: e.target.checked}}))} /> Units
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_suppliers} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_suppliers: e.target.checked}}))} /> Suppliers
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_buyers} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_buyers: e.target.checked}}))} /> Buyers
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_import} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_import: e.target.checked}}))} /> Import Store Data
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_sync} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_sync: e.target.checked}}))} /> Cloud Sync
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_recipients} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_recipients: e.target.checked}}))} /> Receivers
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.perms.settings_system} onChange={e=>setForm(f=>({...f, perms: {...f.perms, settings_system: e.target.checked}}))} /> System Update
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={closeModal}>Cancel</button><button className="btn btn-primary" onClick={handleSaveUser}>{editingUser ? 'Update' : 'Create'}</button></div>
      </div>
    </div>
  );
}
