import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { Save, Plus, Trash2, Edit2, Users, Tag, Truck, Building, Upload, FileSpreadsheet, Link, CheckCircle, AlertCircle, Download, Cloud, RefreshCw, ArrowUpCircle, ArrowDownCircle, FolderOpen, XCircle } from 'lucide-react';

const TABS = [
  { id: 'company', label: 'Company', icon: Building },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'units', label: 'Units', icon: Tag },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'buyers', label: 'Buyers', icon: Tag },
  { id: 'import', label: 'Import Store Data', icon: Upload },
  { id: 'sync', label: 'Cloud Sync', icon: Cloud },
  { id: 'recipients', label: 'Receivers', icon: Users },
  { id: 'system', label: 'System Update', icon: RefreshCw },
];

export default function SettingsPage() {
  const { user } = useStore();

  const availableTabs = TABS.filter(t => {
    if (user?.roleName === 'Super Admin') return true;
    const p = user?.permissions || {};
    if (Object.hasOwn(p, `settings_${t.id}`)) {
      return p[`settings_${t.id}`] === 'rw' || p[`settings_${t.id}`] === true;
    }
    if (p.settings === 'rw' || p.settings === true) return true;
    return t.id === 'system';
  });

  const [activeTab, setActiveTab] = useState(availableTabs.length > 0 ? availableTabs[0].id : '');

  return (
    <div>
      <div className="tabs">
        {availableTabs.map(t => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'company' && <CompanySettings />}
      {activeTab === 'users' && <UserSettings />}
      {activeTab === 'categories' && <CategorySettings />}
      {activeTab === 'units' && <UnitSettings />}
      {activeTab === 'suppliers' && <SupplierSettings />}
      {activeTab === 'buyers' && <BuyerSettings />}
      {activeTab === 'import' && <ImportData />}
      {activeTab === 'sync' && <CloudSync />}
      {activeTab === 'recipients' && <RecipientSettings />}
      {activeTab === 'system' && <SystemSettings />}
    </div>
  );
}

function CompanySettings() {
  const { addToast, user } = useStore();
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const canEdit = user?.permissions?.settings === 'rw';

  useEffect(() => { window.kadal.settings.getAll().then(r => { if (r.success) setSettings(r.data); }); }, []);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    const res = await window.kadal.settings.setBulk(settings);
    if (res?.success) addToast('success', 'Settings saved');
    else addToast('error', 'Failed');
    setSaving(false);
  };

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const handleLogoUpload = (e) => {
    if (!canEdit) return;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast('error', 'Image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      set('company_logo', ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}><label className="form-label">Company Name</label><input className="form-input" value={settings.company_name || ''} onChange={e => set('company_name', e.target.value)} disabled={!canEdit} /></div>
      </div>
      <div className="form-group">
        <label className="form-label">Company Logo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {settings.company_logo && (
            <div style={{ position: 'relative' }}>
              <img src={settings.company_logo} alt="Logo" style={{ height: 60, width: 'auto', objectFit: 'contain', background: '#fff', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
              {canEdit && <button className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger)', color: 'white' }} onClick={() => set('company_logo', '')} title="Remove Logo">✕</button>}
            </div>
          )}
          <input type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleLogoUpload} className="form-input" style={{ flex: 1 }} disabled={!canEdit} />
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Recommended: PNG/JPG with transparent background, max 2MB. This will be used in the Delivery Challan PDF instead of the text name.</div>
      </div>
      <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" rows={2} value={settings.company_address || ''} onChange={e => set('company_address', e.target.value)} disabled={!canEdit} /></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={settings.company_phone || ''} onChange={e => set('company_phone', e.target.value)} disabled={!canEdit} /></div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={settings.company_email || ''} onChange={e => set('company_email', e.target.value)} disabled={!canEdit} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Challan Prefix</label><input className="form-input" value={settings.challan_prefix || ''} onChange={e => set('challan_prefix', e.target.value)} disabled={!canEdit} /></div>
        <div className="form-group"><label className="form-label">Low Stock Threshold</label><input className="form-input" type="number" value={settings.low_stock_threshold || ''} onChange={e => set('low_stock_threshold', e.target.value)} disabled={!canEdit} /></div>
      </div>
      <div className="form-group">
        <label className="form-label">Public Web URL</label>
        <input className="form-input" value={settings.public_web_url || ''} onChange={e => set('public_web_url', e.target.value)} placeholder="https://kadal-inventory.web.app" disabled={!canEdit} />
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>This URL is used to generate the barcode/QR code on Delivery Challan PDFs. E.g., <code>https://my-app.com</code>. If configured, scanning the barcode will open the challan details.</div>
      </div>
      <div className="form-group">
        <label className="form-label">Challan Barcode Format</label>
        <select className="form-input" value={settings.barcode_format || 'QR'} onChange={e => set('barcode_format', e.target.value)} disabled={!canEdit}>
          <option value="CODE128">Barcode (1D - CODE128)</option>
          <option value="QR">QR Code (2D)</option>
        </select>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Select the barcode format printed on Delivery Challan PDFs. QR Code is highly recommended if the Public Web URL is configured (as it remains scannable at small sizes).</div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Approval Module Settings</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={settings.require_challan_approval === 'true'} onChange={e => set('require_challan_approval', e.target.checked ? 'true' : 'false')} disabled={!canEdit} />
            Require Admin Approval for all Challans (Non-Admins)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={settings.require_inventory_approval === 'true'} onChange={e => set('require_inventory_approval', e.target.checked ? 'true' : 'false')} disabled={!canEdit} />
            Require Admin Approval for Stock Movements (Non-Admins)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={settings.require_gate_pass_approval === 'true'} onChange={e => set('require_gate_pass_approval', e.target.checked ? 'true' : 'false')} disabled={!canEdit} />
            Require Admin Approval for all Gate Passes (Non-Admins)
          </label>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Access Control Override Settings</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={settings.allow_challan_to_issue === 'true'} onChange={e => set('allow_challan_to_issue', e.target.checked ? 'true' : 'false')} disabled={!canEdit} />
            Allow Challan Role Users to access/use Issue Module
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={settings.allow_inventory_to_produce === 'true'} onChange={e => set('allow_inventory_to_produce', e.target.checked ? 'true' : 'false')} disabled={!canEdit} />
            Allow Inventory Role Users to access/use Production Module
          </label>
        </div>
      </div>
      {canEdit && <button className="btn btn-primary mt-4" onClick={handleSave} disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}</button>}
    </div>
  );
}

function UserSettings() {
  const { addToast, showConfirm, user, roles, setRoles, openModal } = useStore();
  const [users, setUsers] = useState([]);

  const load = async () => {
    const resUsers = await window.kadal.users.getAll();
    if (resUsers.success) setUsers(resUsers.data);
    const resRoles = await window.kadal.roles.getAll();
    if (resRoles.success) setRoles(resRoles.data);
  };
  useEffect(() => { load(); }, []);

  const handleEdit = (u) => {
    let perms = { inventory: false, challan: false, reports: false, settings: false, maintenance: false };
    try {
      const p = typeof u.custom_permissions === 'string' ? JSON.parse(u.custom_permissions) : (u.custom_permissions || {});
      const rawPerms = p && Object.keys(p).length > 0 ? p : (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || {}));
      perms = {
        dashboard: rawPerms.dashboard === 'rw' || rawPerms.dashboard === true,
        inventory: rawPerms.inventory === 'rw' || rawPerms.inventory === true,
        pending_items: rawPerms.pending_items === 'rw' || rawPerms.pending_items === true,
        warehouses: rawPerms.warehouses === 'rw' || rawPerms.warehouses === true,
        challan: rawPerms.challan === 'rw' || rawPerms.challan === true,
        approvals: rawPerms.approvals === 'rw' || rawPerms.approvals === true,
        gate_pass: rawPerms.gate_pass === 'rw' || rawPerms.gate_pass === true,
        requisition: rawPerms.requisition === 'rw' || rawPerms.requisition === true,
        issue: rawPerms.issue === 'rw' || rawPerms.issue === true,
        production: rawPerms.production === 'rw' || rawPerms.production === true,
        reports: rawPerms.reports === 'r' || rawPerms.reports === 'rw' || rawPerms.reports === true,
        settings: rawPerms.settings === 'rw' || rawPerms.settings === true,
        backup: rawPerms.backup === 'rw' || rawPerms.maintenance === 'rw' || rawPerms.backup === true
      };
    } catch (e) { }

    openModal('USER_FORM', {
      editingUser: u,
      initialForm: { username: u.username, fullName: u.full_name, password: '', roleId: u.role_id, perms },
      onSaved: load
    });
  };

  const toggle = async (id) => {
    await window.kadal.users.toggleActive(id);
    load();
  };

  const del = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      confirmText: 'Delete User',
      type: 'danger'
    });
    if (!confirmed) return;
    const res = await window.kadal.users.delete(id);
    if (res.success) { load(); addToast('success', 'User deleted'); }
    else addToast('error', res.data?.error || res.error);
  };

  return (
    <div>
      <div className="toolbar"><div className="toolbar-left"></div>{user?.permissions?.settings === 'rw' && <button className="btn btn-primary btn-sm" onClick={() => openModal('USER_FORM', { initialForm: { username: '', fullName: '', password: '', roleId: 2, perms: { dashboard: false, inventory: false, pending_items: false, warehouses: false, challan: false, approvals: false, gate_pass: false, requisition: false, issue: false, production: false, reports: false, settings: false, backup: false } }, onSaved: load })}><Plus size={14} /> Add User</button>}</div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>{users.map(u => {
            const isTargetSuperAdmin = u.role_name === 'Super Admin';
            const p = user?.permissions || {};
            const hasSettingsUsers = Object.hasOwn(p, 'settings_users') ? (p.settings_users === 'rw' || p.settings_users === true) : (p.settings === 'rw' || p.settings === true);
            const canEdit = (user?.roleName === 'Super Admin' || !isTargetSuperAdmin) && hasSettingsUsers;

            return (
              <tr key={u.id}>
                <td className="text-mono">{u.username}</td>
                <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                <td><span className="badge badge-info">{u.custom_permissions ? 'Custom' : u.role_name}</span></td>
                <td><span className={`badge badge-${u.is_active ? 'success' : 'danger'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="text-muted">{u.last_login ? new Date(u.last_login).toLocaleString('en-GB') : '-'}</td>
                <td>
                  {canEdit ? (
                    <>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEdit(u)} title="Edit Role/Permissions"><Edit2 size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(u.id)} style={{ marginLeft: 4 }}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(u.id)} style={{ marginLeft: 4 }}><Trash2 size={14} color="var(--danger)" /></button>
                    </>
                  ) : (
                    <span className="text-muted" style={{ fontSize: 11 }}>View Only</span>
                  )}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function CategorySettings() {
  const { addToast, user } = useStore();
  const [cats, setCats] = useState([]);
  const [name, setName] = useState('');
  const canEdit = user?.permissions?.settings === 'rw';

  const load = () => window.kadal.categories.getAll().then(r => { if (r.success) setCats(r.data); });
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!canEdit || !name.trim()) return;
    const res = await window.kadal.categories.create({ name });
    if (res.success) { setName(''); load(); addToast('success', 'Category added'); }
    else addToast('error', res.error);
  };

  const del = async (id) => {
    if (!canEdit) return;
    const res = await window.kadal.categories.delete(id);
    if (res.success) { load(); addToast('success', 'Deleted'); }
    else addToast('error', res.data?.error || res.error);
  };

  return (
    <div style={{ maxWidth: 500 }}>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="form-input" placeholder="New category name..." value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="btn btn-primary" onClick={add}><Plus size={16} /></button>
        </div>
      )}
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Category</th>{canEdit && <th>Actions</th>}</tr></thead>
          <tbody>{cats.map(c => (
            <tr key={c.id}><td style={{ fontWeight: 600 }}>{c.name}</td>
              {canEdit && <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(c.id)}><Trash2 size={14} color="var(--danger)" /></button></td>}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function UnitSettings() {
  const { addToast, user } = useStore();
  const [units, setUnits] = useState([]);
  const [name, setName] = useState('');
  const canEdit = user?.permissions?.settings === 'rw';

  const load = () => window.kadal.units.getAll().then(r => { if (r.success) setUnits(r.data); });
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!canEdit || !name.trim()) return;
    const res = await window.kadal.units.create({ name });
    if (res.success) { setName(''); load(); addToast('success', 'Unit added'); }
    else addToast('error', res.error);
  };

  const del = async (id) => {
    if (!canEdit) return;
    const res = await window.kadal.units.delete(id);
    if (res.success) { load(); addToast('success', 'Deleted'); }
    else addToast('error', res.data?.error || res.error);
  };

  return (
    <div style={{ maxWidth: 500 }}>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="form-input" placeholder="New unit name (e.g. pcs, kg)..." value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="btn btn-primary" onClick={add}><Plus size={16} /></button>
        </div>
      )}
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Unit</th>{canEdit && <th>Actions</th>}</tr></thead>
          <tbody>{units.map(u => (
            <tr key={u.id}><td style={{ fontWeight: 600 }}>{u.name}</td>
              {canEdit && <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(u.id)}><Trash2 size={14} color="var(--danger)" /></button></td>}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierSettings() {
  const { addToast, openModal, user } = useStore();
  const [suppliers, setSuppliers] = useState([]);
  const canEdit = user?.permissions?.settings === 'rw';

  const load = () => window.kadal.suppliers.getAll().then(r => { if (r.success) setSuppliers(r.data); });
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!canEdit) return;
    const res = await window.kadal.suppliers.delete(id);
    if (res.success) { load(); addToast('success', 'Deleted'); }
    else addToast('error', res.data?.error || res.error);
  };

  const handleEdit = (s) => {
    openModal('SUPPLIER_FORM', {
      editingSupplier: s,
      initialForm: {
        name: s.name,
        contactPerson: s.contact_person,
        phone: s.phone,
        email: s.email,
        address: s.address
      },
      onSaved: load
    });
  };

  return (
    <div>
      <div className="toolbar"><div className="toolbar-left"></div>{canEdit && <button className="btn btn-primary btn-sm" onClick={() => openModal('SUPPLIER_FORM', { initialForm: { name: '', contactPerson: '', phone: '', email: '', address: '' }, onSaved: load })}><Plus size={14} /> Add Supplier</button>}</div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th>{canEdit && <th>Actions</th>}</tr></thead>
          <tbody>{suppliers.map(s => (
            <tr key={s.id}><td style={{ fontWeight: 600 }}>{s.name}</td><td>{s.contact_person || '-'}</td><td>{s.phone || '-'}</td><td>{s.email || '-'}</td>
              {canEdit && <td>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEdit(s)} title="Edit"><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(s.id)} title="Delete"><Trash2 size={14} color="var(--danger)" /></button>
              </td>}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function BuyerSettings() {
  const { addToast, user } = useStore();
  const [buyers, setBuyers] = useState([]);
  const [name, setName] = useState('');
  const canEdit = user?.permissions?.settings === 'rw';

  const load = () => window.kadal.buyers.getAll().then(r => { if (r.success) setBuyers(r.data); });
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!canEdit || !name.trim()) return;
    const res = await window.kadal.buyers.create({ name });
    if (res.success) { setName(''); load(); addToast('success', 'Buyer added'); }
    else addToast('error', res.error);
  };

  const del = async (id) => {
    if (!canEdit) return;
    const res = await window.kadal.buyers.delete(id);
    if (res.success) { load(); addToast('success', 'Deleted'); }
    else addToast('error', res.data?.error || res.error);
  };

  return (
    <div style={{ maxWidth: 500 }}>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="form-input" placeholder="New buyer name..." value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="btn btn-primary" onClick={add}><Plus size={16} /></button>
        </div>
      )}
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Buyer Name</th>{canEdit && <th>Actions</th>}</tr></thead>
          <tbody>{buyers.map(b => (
            <tr key={b.id}><td style={{ fontWeight: 600 }}>{b.name}</td>
              {canEdit && <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(b.id)}><Trash2 size={14} color="var(--danger)" /></button></td>}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ImportData() {
  const { addToast } = useStore();
  const [step, setStep] = useState('source'); // source | preview | result
  const [source, setSource] = useState('excel'); // excel | google
  const [googleUrl, setGoogleUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleExcelSelect = async () => {
    setParsing(true);
    try {
      const fileRes = await window.kadal.import.selectFile();
      if (!fileRes.success || !fileRes.data) { setParsing(false); return; }
      const parseRes = await window.kadal.import.parseExcel(fileRes.data);
      if (parseRes.success) {
        setPreviewData(parseRes.data);
        setStep('preview');
      } else {
        addToast('error', parseRes.error || 'Failed to parse file');
      }
    } catch (e) { addToast('error', e.message); }
    setParsing(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await window.kadal.import.downloadTemplate();
      if (res.success && res.data) {
        addToast('success', 'Template downloaded successfully');
      }
    } catch (e) { addToast('error', e.message); }
  };

  const handleDownloadProductionTemplate = async () => {
    try {
      const res = await window.kadal.import.downloadProductionTemplate();
      if (res.success && res.data) {
        addToast('success', 'Production template downloaded successfully');
      }
    } catch (e) { addToast('error', e.message); }
  };

  const handleGoogleSheet = async () => {
    if (!googleUrl.trim()) { addToast('error', 'Please enter a Google Sheet URL'); return; }
    setParsing(true);
    try {
      const parseRes = await window.kadal.import.parseGoogleSheet(googleUrl);
      if (parseRes.success) {
        setPreviewData(parseRes.data);
        setStep('preview');
      } else {
        addToast('error', parseRes.error || 'Failed to parse sheet');
      }
    } catch (e) { addToast('error', e.message); }
    setParsing(false);
  };

  const handleImport = async () => {
    if (!previewData?.rows?.length) return;
    setImporting(true);
    try {
      const res = await window.kadal.import.importItems(previewData.rows);
      if (res.success) {
        setResult(res.data);
        setStep('result');
      } else {
        addToast('error', res.error || 'Import failed');
      }
    } catch (e) { addToast('error', e.message); }
    setImporting(false);
  };

  const reset = () => {
    setStep('source');
    setPreviewData(null);
    setResult(null);
    setGoogleUrl('');
  };

  const PREVIEW_COLS = ['name', 'category', 'size', 'color', 'unit', 'supplier', 'buyerName', 'styleName', 'purchaseNo', 'orderNumber', 'unitPrice', 'currency', 'openingStock', 'minStockLevel', 'notes'];
  const COL_LABELS = { name: 'Item Name', category: 'Category', size: 'Size', color: 'Color', unit: 'Unit', supplier: 'Supplier', buyerName: 'Buyer', styleName: 'Style', purchaseNo: 'Purchase No', orderNumber: 'Order Number', unitPrice: 'Price', currency: 'Currency', openingStock: 'Stock', minStockLevel: 'Min Level', notes: 'Notes' };

  // Step 1: Source selection
  if (step === 'source') {
    return (
      <div style={{ maxWidth: 700 }}>
        <div className="card mb-4" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Import Store Data</h3>
          <p className="text-muted" style={{ margin: '0 0 20px', fontSize: 13 }}>Import items from an Excel spreadsheet or a public Google Sheet. The system will auto-detect columns by header names.</p>

          <div style={{ display: 'flex', gap: 16 }}>
            <button className={`card ${source === 'excel' ? '' : ''}`} onClick={() => setSource('excel')} style={{ flex: 1, padding: 20, cursor: 'pointer', border: source === 'excel' ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', background: source === 'excel' ? 'rgba(99,102,241,0.06)' : 'var(--bg-secondary)', transition: 'var(--transition)' }}>
              <FileSpreadsheet size={32} color={source === 'excel' ? 'var(--accent)' : 'var(--text-muted)'} />
              <div style={{ marginTop: 8, fontWeight: 600 }}>Excel File</div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>.xlsx, .xls, .csv</div>
            </button>
            <button className="card" onClick={() => setSource('google')} style={{ flex: 1, padding: 20, cursor: 'pointer', border: source === 'google' ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', background: source === 'google' ? 'rgba(99,102,241,0.06)' : 'var(--bg-secondary)', transition: 'var(--transition)' }}>
              <Link size={32} color={source === 'google' ? 'var(--accent)' : 'var(--text-muted)'} />
              <div style={{ marginTop: 8, fontWeight: 600 }}>Google Sheet</div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>Public link</div>
            </button>
          </div>

          {source === 'excel' && (
            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleExcelSelect} disabled={parsing}>
                <Upload size={16} /> {parsing ? 'Parsing...' : 'Select Excel File'}
              </button>
              <button className="btn btn-outline" onClick={handleDownloadTemplate}>
                <Download size={16} /> Soucring Template
              </button>
              <button className="btn btn-outline" onClick={handleDownloadProductionTemplate} style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
                <Download size={16} /> Production Template
              </button>
            </div>
          )}

          {source === 'google' && (
            <div style={{ marginTop: 20 }}>
              <div className="form-group">
                <label className="form-label">Google Sheet URL</label>
                <input className="form-input" value={googleUrl} onChange={e => setGoogleUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
                <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>The sheet must be shared as "Anyone with the link can view"</div>
              </div>
              <button className="btn btn-primary" onClick={handleGoogleSheet} disabled={parsing || !googleUrl.trim()}>
                <Upload size={16} /> {parsing ? 'Fetching...' : 'Load Sheet'}
              </button>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Supported Column Headers</h4>
          <p className="text-muted" style={{ fontSize: 12, margin: '0 0 10px' }}>The system auto-maps columns by their header names. Use any of these:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 12 }}>
            <div><strong>Item Name:</strong> <span className="text-muted">Name, Item Name, Product</span></div>
            <div><strong>Category:</strong> <span className="text-muted">Category, Group, Type</span></div>
            <div><strong>Size:</strong> <span className="text-muted">Size, Dimension</span></div>
            <div><strong>Color:</strong> <span className="text-muted">Color, Colour</span></div>
            <div><strong>Unit:</strong> <span className="text-muted">Unit, UOM</span></div>
            <div><strong>Supplier:</strong> <span className="text-muted">Supplier, Vendor</span></div>
            <div><strong>Buyer:</strong> <span className="text-muted">Buyer, Buyer Name, Customer</span></div>
            <div><strong>Style:</strong> <span className="text-muted">Style, Style Name, Style No</span></div>
            <div><strong>Purchase No:</strong> <span className="text-muted">Purchase No, PO, PO No</span></div>
            <div><strong>Order Number:</strong> <span className="text-muted">Order Number, Order No, Order #</span></div>
            <div><strong>Price:</strong> <span className="text-muted">Unit Price, Rate, Cost, Price</span></div>
            <div><strong>Currency:</strong> <span className="text-muted">Currency, Money, Cr</span></div>
            <div><strong>Stock:</strong> <span className="text-muted">Stock, Qty, Quantity, Balance</span></div>
            <div><strong>Min Level:</strong> <span className="text-muted">Min Stock, Minimum, Reorder</span></div>
            <div><strong>Notes:</strong> <span className="text-muted">Notes, Remark, Comments</span></div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Preview
  if (step === 'preview' && previewData) {
    const mappedCols = PREVIEW_COLS.filter(c => previewData.columnMap[c === 'category' ? 'category' : c === 'supplier' ? 'supplier' : c]);
    const activeCols = mappedCols.length > 0 ? mappedCols : PREVIEW_COLS.filter(c => previewData.rows.some(r => r[c]));
    const displayCols = activeCols.length > 0 ? activeCols : ['name'];

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Preview Import Data</h3>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{previewData.totalRows} items found. Verify the data below before importing.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={reset}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
              <CheckCircle size={16} /> {importing ? 'Importing...' : `Import ${previewData.totalRows} Items`}
            </button>
          </div>
        </div>

        <div className="card mb-4" style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
            <span><strong>Mapped Columns:</strong></span>
            {previewData.headers.filter(h => h.mapped).map((h, i) => (
              <span key={i} className="badge badge-info">{h.raw} → {COL_LABELS[h.mapped] || h.mapped}</span>
            ))}
            {previewData.headers.filter(h => !h.mapped && h.raw).map((h, i) => (
              <span key={`u${i}`} className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{h.raw} (skipped)</span>
            ))}
          </div>
        </div>

        <div className="table-wrapper" style={{ maxHeight: 500, overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {displayCols.map(c => <th key={c}>{COL_LABELS[c] || c}</th>)}
              </tr>
            </thead>
            <tbody>
              {previewData.rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-muted" style={{ fontSize: 11 }}>{idx + 1}</td>
                  {displayCols.map(c => (
                    <td key={c} style={{ fontSize: 12 }}>{row[c] || <span className="text-muted">-</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Step 3: Result
  if (step === 'result' && result) {
    return (
      <div style={{ maxWidth: 600 }}>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Import Complete!</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, margin: '20px 0' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{result.imported}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Items Imported</div>
            </div>
            {result.skipped > 0 && (
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warning)' }}>{result.skipped}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Skipped</div>
              </div>
            )}
          </div>
          {result.errors?.length > 0 && (
            <div style={{ textAlign: 'left', marginTop: 16, padding: 12, background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 13, marginBottom: 6 }}><AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Errors:</div>
              {result.errors.slice(0, 10).map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0' }}>{e}</div>
              ))}
              {result.errors.length > 10 && <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>...and {result.errors.length - 10} more</div>}
            </div>
          )}
          <button className="btn btn-primary" onClick={reset} style={{ marginTop: 24 }}>
            <Upload size={16} /> Import More Data
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function CloudSync() {
  const { addToast } = useStore();
  const [settings, setSettings] = useState({ supabase_url: '', supabase_key: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { window.kadal.settings.getAll().then(r => { if (r.success) setSettings(r.data); }); }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await window.kadal.settings.setBulk({
      supabase_url: settings.supabase_url,
      supabase_key: settings.supabase_key
    });
    if (res?.success) {
      addToast('success', 'Supabase configuration saved. Restarting...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      addToast('error', 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="card mb-4" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Cloud size={20} color="var(--accent)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Cloud Native Sync</h3>
        </div>
        <p className="text-muted" style={{ margin: '0 0 20px', fontSize: 13 }}>
          Connect to your Supabase PostgreSQL database. Once connected, all users running KADAL Inventory System will synchronize data in real-time.
        </p>

        <div className="form-group">
          <label className="form-label">Supabase URL</label>
          <input className="form-input" value={settings.supabase_url || ''} onChange={e => setSettings({ ...settings, supabase_url: e.target.value })} placeholder="https://xxxxxxxxxxxx.supabase.co" />
        </div>

        <div className="form-group">
          <label className="form-label">Supabase Anon Key</label>
          <input className="form-input" type="password" value={settings.supabase_key || ''} onChange={e => setSettings({ ...settings, supabase_key: e.target.value })} placeholder="eyJhb..." />
        </div>

        <button className="btn btn-primary mt-4" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>How it works</h4>
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          <div><strong>1.</strong> Enter your Supabase Project URL and Anon API Key.</div>
          <div><strong>2.</strong> Restart the application.</div>
          <div><strong>3.</strong> The system will automatically run in Cloud Mode. Changes made on any PC will appear instantly for everyone else.</div>
        </div>
      </div>
    </div>
  );
}

function SystemSettings() {
  const { addToast, user } = useStore();
  const [checking, setChecking] = useState(false);

  const hasMaintenance = user?.permissions?.maintenance === 'rw';

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const res = await window.kadal.update.check();
      if (!res.success) addToast('error', res.error || 'Failed to check for updates');
    } catch (e) {
      addToast('error', e.message);
    }
    setChecking(false);
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="card mb-4" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <RefreshCw size={20} color="var(--accent)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>System Updates</h3>
        </div>
        <p className="text-muted" style={{ margin: '0 0 20px', fontSize: 13 }}>
          Check for the latest software updates. Updates are downloaded automatically in the background.
        </p>

        <button className="btn btn-primary" onClick={handleCheckUpdate} disabled={checking}>
          <ArrowDownCircle size={16} /> {checking ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>

      {hasMaintenance && (
        <div className="card mb-4" style={{ padding: 24, border: '1px solid var(--danger-subtle)', background: 'rgba(239,68,68,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Trash2 size={20} color="var(--danger)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>Clear History</h3>
          </div>
          <p className="text-muted" style={{ margin: '0 0 20px', fontSize: 13 }}>
            <strong>Clear Challan History:</strong> This will delete all Challans, Challan Items, Gate Passes, and associated stock transactions. It will <strong>NOT</strong> delete Items, Categories, or Suppliers.
          </p>

          <button
            className="btn btn-outline"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 8, width: '100%' }}
            disabled={user?.roleName !== 'Super Admin'}
            onClick={async () => {
              if (user?.roleName !== 'Super Admin') {
                addToast('error', 'Only Super Admin can perform this action');
                return;
              }
              if (window.confirm('DELETE ALL CHALLAN HISTORY? This will permanently remove all challans and gate passes. Items and stock levels will NOT be reset.')) {
                const res = await window.kadal.challans.clearHistory();
                if (res.success) {
                  addToast('success', 'Challan history cleared successfully');
                } else {
                  addToast('error', res.error || 'Failed to clear history');
                }
              }
            }}
          >
            <Trash2 size={16} /> Clear All Challan History
          </button>

          <button
            className="btn btn-outline"
            style={{ borderColor: 'var(--warning)', color: 'var(--warning)', width: '100%', marginTop: 8 }}
            disabled={user?.roleName !== 'Super Admin'}
            onClick={async () => {
              if (user?.roleName !== 'Super Admin') {
                addToast('error', 'Only Super Admin can perform this action');
                return;
              }
              if (window.confirm('CLEAR GATE PASS HISTORY? This will delete all Gate Passes and pending Gate Pass requests, unblocking associated Challans.')) {
                const res = await window.kadal.gatePass.clearHistory();
                if (res.success) {
                  addToast('success', 'Gate Pass history cleared successfully');
                } else {
                  addToast('error', res.error || 'Failed to clear history');
                }
              }
            }}
          >
            <XCircle size={16} /> Clear Gate Pass History
          </button>
          {user?.roleName !== 'Super Admin' && <p style={{ color: 'var(--danger)', fontSize: 11, marginTop: 8 }}>Only Super Admin can clear history.</p>}
        </div>
      )}

      {hasMaintenance && (
        <div className="card" style={{ padding: 24, border: '1px solid var(--danger-subtle)', background: 'rgba(239,68,68,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <AlertCircle size={20} color="var(--danger)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>Database Maintenance (Factory Reset)</h3>
          </div>
          <p className="text-muted" style={{ margin: '0 0 20px', fontSize: 13 }}>
            <strong>Danger Zone:</strong> This will permanently delete <strong>EVERYTHING</strong> (Items, Users, Categories, etc.). Use only for a complete system reset.
          </p>

          <button
            className="btn btn-danger"
            onClick={async () => {
              if (window.confirm('ARE YOU ABSOLUTELY SURE? This will delete ALL data (Items, Challans, Gate Passes, Transactions) and cannot be undone.')) {
                const res = await window.kadal.system.clearData();
                if (res.success) {
                  addToast('success', 'All data cleared successfully. Please restart the app.');
                  window.location.reload();
                } else {
                  addToast('error', res.error || 'Failed to clear data');
                }
              }
            }}
          >
            <Trash2 size={16} /> Clear All Data & Reset Database
          </button>
        </div>
      )}
    </div>

  );
}

function RecipientSettings() {
  const { addToast, openModal, user } = useStore();
  const [recipients, setRecipients] = useState([]);
  const p = user?.permissions || {};
  const canEdit = user?.roleName === 'Super Admin' || (Object.hasOwn(p, 'settings_recipients') ? (p.settings_recipients === 'rw' || p.settings_recipients === true) : (p.settings === 'rw' || p.settings === true));

  const load = () => window.kadal.recipients.getAll().then(r => { if (r.success) setRecipients(r.data); });
  useEffect(() => { load(); }, []);

  const handleEdit = (r) => {
    openModal('RECIPIENT_FORM', {
      editingRecipient: r,
      initialForm: {
        name: r.name,
        type: r.type,
        contactInfo: r.contact_info || '',
        address: r.receiver_address || ''
      },
      onSaved: load
    });
  };

  const del = async (id) => {
    if (!canEdit) return;
    const res = await window.kadal.recipients.delete(id);
    if (res.success) { load(); addToast('success', 'Deleted'); }
    else addToast('error', res.data?.error || res.error);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="toolbar"><div className="toolbar-left"></div>{canEdit && <button className="btn btn-primary btn-sm" onClick={() => openModal('RECIPIENT_FORM', { initialForm: { name: '', type: 'EMPLOYEE', contactInfo: '', address: '' }, onSaved: load })}><Plus size={14} /> Add Receiver</button>}</div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Address</th>{canEdit && <th>Actions</th>}</tr></thead>
          <tbody>{recipients.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.name}</td>
              <td><span className={`badge badge-${r.type === 'FACTORY' ? 'info' : 'warning'}`}>{r.type}</span></td>
              <td>{r.contact_info || '-'}</td>
              <td>{r.receiver_address || '-'}</td>
              {canEdit && <td>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEdit(r)} title="Edit"><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(r.id)} title="Delete"><Trash2 size={14} color="var(--danger)" /></button>
              </td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
