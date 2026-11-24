import {
  LayoutDashboard, Package, ArrowDownUp, Hourglass, Warehouse,
  ClipboardList, PackageCheck, Landmark, CheckCircle, Truck, Send,
  PackageOpen, Factory, BarChart3, Settings, HardDrive, PlusSquare
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', title: 'Inventory Management', icon: Package },
  { id: 'stock-in-out', label: 'Stock In & Out', title: 'Stock In & Out', icon: ArrowDownUp },
  { id: 'pending-items', label: 'Pending Items', title: 'Pending Items', icon: Hourglass },
  { id: 'warehouses', label: 'Warehouses', title: 'Warehouses', icon: Warehouse },
  { id: 'challan', label: 'Create Challan', title: 'Create Delivery Challan', icon: ClipboardList },
  { id: 'challan-receipt', label: 'Challan Receipt', title: 'Challan Receipt', icon: PackageCheck },
  { id: 'finance', label: 'Finance', title: 'Finance', icon: Landmark },
  { id: 'approvals', label: 'Approvals', title: 'Approvals', icon: CheckCircle },
  { id: 'gate-pass', label: 'Gate Pass', title: 'Gate Pass Management', icon: Truck },
  { id: 'requisition', label: 'Requisition', title: 'Requisition', icon: Send },
  { id: 'issue', label: 'Issue', title: 'Inventory Issue', icon: PackageOpen },
  { id: 'production', label: 'Production', title: 'Production', icon: Factory },
  { id: 'reports', label: 'Reports', title: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', title: 'Settings', icon: Settings },
  { id: 'backup', label: 'Backup & Restore', title: 'Backup & Restore', icon: HardDrive },
];

export const PAGE_TITLES = {
  ...Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item.title])),
  'challan-history': 'Challan History',
  'new-tab': 'New Tab',
};

const EXTRA_META = {
  'challan-history': { id: 'challan-history', label: 'Challan History', title: 'Challan History', icon: ClipboardList },
  'new-tab': { id: 'new-tab', label: 'New Tab', title: 'New Tab', icon: PlusSquare },
};

const META_BY_ID = Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item]));

export function getModuleMeta(moduleId) {
  return META_BY_ID[moduleId] || EXTRA_META[moduleId] || META_BY_ID.dashboard;
}

export function getVisibleNavItems(user, settings = {}) {
  let permsObj = {};
  try {
    permsObj = typeof user?.permissions === 'string'
      ? JSON.parse(user.permissions)
      : (user?.permissions || {});
  } catch (e) {
    permsObj = {};
  }

  return NAV_ITEMS.filter((item) => {
    // These modules need the desktop app (not implemented in the browser build yet)
    if (window.kadal?.isWeb && ['issue', 'gate-pass', 'production', 'backup'].includes(item.id)) return false;

    const permKey = item.id.replace(/-/g, '_');
    const hasExplicitPerm = permsObj && (
      Object.prototype.hasOwnProperty.call(permsObj, item.id) ||
      Object.prototype.hasOwnProperty.call(permsObj, permKey)
    );

    // Restrict Challan Receipt to Super Admin and Recipient / Challan Receipt User only
    if (item.id === 'challan-receipt') {
      const userRole = user?.roleName || user?.role_name || '';
      const isSuperAdmin = userRole === 'Super Admin';
      const isRecipientRole = ['Challan Receipt User', 'Recipient', 'Recipient Portal'].includes(userRole);
      if (!isSuperAdmin && !isRecipientRole) return false;
    }

    if (hasExplicitPerm) {
      const val = permsObj[item.id] !== undefined ? permsObj[item.id] : permsObj[permKey];
      return val === 'rw' || val === true || val === 'r';
    }

    if (item.id === 'stock-in-out' && permsObj.inventory !== 'rw' && permsObj.inventory !== true) return false;
    if (user?.roleName === 'Merchandiser') {
      const allowed = ['dashboard', 'inventory', 'stock-in-out', 'warehouses', 'requisition', 'reports', 'settings'];
      if (!allowed.includes(item.id)) return false;
    }
    if (user?.roleName === 'Inventory') {
      const allowed = ['dashboard', 'inventory', 'stock-in-out', 'pending-items', 'warehouses', 'requisition', 'reports', 'approvals', 'settings'];
      if (settings.allow_inventory_to_produce === 'true') allowed.push('production');
      if (!allowed.includes(item.id)) return false;
    }
    if (user?.roleName === 'Challan') {
      const allowed = ['dashboard', 'challan', 'finance', 'gate-pass', 'reports', 'approvals', 'settings'];
      if (settings.allow_challan_to_issue === 'true') allowed.push('issue');
      if (!allowed.includes(item.id)) return false;
    }
    if (item.id === 'requisition') {
      if (permsObj.requisition === 'none' && !['Admin', 'Super Admin'].includes(user?.roleName)) return false;
    }
    if (item.id === 'production' && !['Admin', 'Super Admin'].includes(user?.roleName)) {
      if (!(user?.roleName === 'Inventory' && settings.allow_inventory_to_produce === 'true')) return false;
    }
    if (item.id === 'backup') {
      if (user?.roleName === 'Operator') return false;
      if (user?.roleName !== 'Super Admin' && permsObj.maintenance !== 'rw' && permsObj.backup !== 'rw') return false;
    }

    return true;
  });
}
