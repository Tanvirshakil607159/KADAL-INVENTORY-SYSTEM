const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kadal', {
  // Auth
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (userId, oldPw, newPw) => ipcRenderer.invoke('auth:changePassword', userId, oldPw, newPw),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  },

  // Users
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    create: (data) => ipcRenderer.invoke('users:create', data),
    update: (id, data) => ipcRenderer.invoke('users:update', id, data),
    toggleActive: (id) => ipcRenderer.invoke('users:toggleActive', id),
    delete: (id) => ipcRenderer.invoke('users:delete', id),
  },

  // Roles
  roles: {
    getAll: () => ipcRenderer.invoke('roles:getAll'),
  },

  // Buyers
  buyers: {
    getAll: () => ipcRenderer.invoke('buyers:getAll'),
    create: (data) => ipcRenderer.invoke('buyers:create', data),
    delete: (id) => ipcRenderer.invoke('buyers:delete', id),
  },

  // Categories
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    create: (data) => ipcRenderer.invoke('categories:create', data),
    update: (id, data) => ipcRenderer.invoke('categories:update', id, data),
    delete: (id) => ipcRenderer.invoke('categories:delete', id),
  },

  // Units
  units: {
    getAll: () => ipcRenderer.invoke('units:getAll'),
    create: (data) => ipcRenderer.invoke('units:create', data),
    delete: (id) => ipcRenderer.invoke('units:delete', id),
  },

  // Suppliers
  suppliers: {
    getAll: () => ipcRenderer.invoke('suppliers:getAll'),
    create: (data) => ipcRenderer.invoke('suppliers:create', data),
    update: (id, data) => ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
    getFieldSuggestions: (field, query) => ipcRenderer.invoke('suppliers:getFieldSuggestions', field, query),
  },

  // Items
  items: {
    getAll: (filters) => ipcRenderer.invoke('items:getAll', filters),
    getById: (id) => ipcRenderer.invoke('items:getById', id),
    create: (data) => ipcRenderer.invoke('items:create', data),
    update: (id, data) => ipcRenderer.invoke('items:update', id, data),
    delete: (id) => ipcRenderer.invoke('items:delete', id),
    search: (query) => ipcRenderer.invoke('items:search', query),
    getDistinctValues: () => ipcRenderer.invoke('items:getDistinctValues'),
    getNextCode: () => ipcRenderer.invoke('items:getNextCode'),
  },

  // Stock
  stock: {
    addMovement: (data) => ipcRenderer.invoke('stock:addMovement', data),
    getTransactions: (filters) => ipcRenderer.invoke('stock:getTransactions', filters),
    getFieldSuggestions: (field, query) => ipcRenderer.invoke('stock:getFieldSuggestions', field, query),
  },

  // Challans
  challans: {
    getAll: (filters) => ipcRenderer.invoke('challans:getAll', filters),
    getById: (id) => ipcRenderer.invoke('challans:getById', id),
    create: (data) => ipcRenderer.invoke('challans:create', data),
    cancel: (id, reason) => ipcRenderer.invoke('challans:cancel', id, reason),
    getNextNumber: () => ipcRenderer.invoke('challans:getNextNumber'),
    getFieldSuggestions: (field, query) => ipcRenderer.invoke('challans:getFieldSuggestions', field, query),
    exportPdf: (id) => ipcRenderer.invoke('challans:exportPdf', id),
    getTotalDelivered: (itemId) => ipcRenderer.invoke('challans:getTotalDelivered', itemId),
  },

  // Reports
  reports: {
    stockReport: (filters) => ipcRenderer.invoke('reports:stockReport', filters),
    movementReport: (filters) => ipcRenderer.invoke('reports:movementReport', filters),
    lowStockReport: () => ipcRenderer.invoke('reports:lowStockReport'),
    challanHistory: (filters) => ipcRenderer.invoke('reports:challanHistory', filters),
    dailySummary: (date) => ipcRenderer.invoke('reports:dailySummary', date),
    monthlySummary: (year, month) => ipcRenderer.invoke('reports:monthlySummary', year, month),
    exportExcel: (type, data, options) => ipcRenderer.invoke('reports:exportExcel', type, data, options),
    exportPdf: (type, data, options) => ipcRenderer.invoke('reports:exportPdf', type, data, options),
  },
  approvals: {
    getAll: (status) => ipcRenderer.invoke('approvals:getAll', status),
    getById: (id) => ipcRenderer.invoke('approvals:getById', id),
    approve: (id, notes) => ipcRenderer.invoke('approvals:approve', id, notes),
    reject: (id, notes) => ipcRenderer.invoke('approvals:reject', id, notes),
  },

  gatePass: {
    getAll: (filters) => ipcRenderer.invoke('gatePass:getAll', filters),
    getById: (id) => ipcRenderer.invoke('gatePass:getById', id),
    create: (data) => ipcRenderer.invoke('gatePass:create', data),
    exportPdf: (id) => ipcRenderer.invoke('gatePass:exportPdf', id),
    getNextNumber: () => ipcRenderer.invoke('gatePass:getNextNumber'),
    getUsedChallanIds: () => ipcRenderer.invoke('gatePass:getUsedChallanIds'),
  },

  // Backup
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (filePath) => ipcRenderer.invoke('backup:restore', filePath),
    getHistory: () => ipcRenderer.invoke('backup:getHistory'),
    selectFile: () => ipcRenderer.invoke('backup:selectFile'),
    selectDirectory: () => ipcRenderer.invoke('backup:selectDirectory'),
    download: (filePath) => ipcRenderer.invoke('backup:download', filePath),
  },

  // Settings
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    setBulk: (settings) => ipcRenderer.invoke('settings:setBulk', settings),
  },

  // Dashboard
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:getStats'),
  },

  // Audit
  audit: {
    getLogs: (filters) => ipcRenderer.invoke('audit:getLogs', filters),
  },

  // Import
  import: {
    selectFile: () => ipcRenderer.invoke('import:selectFile'),
    parseExcel: (filePath) => ipcRenderer.invoke('import:parseExcel', filePath),
    parseGoogleSheet: (url) => ipcRenderer.invoke('import:parseGoogleSheet', url),
    importItems: (rows) => ipcRenderer.invoke('import:importItems', rows),
    downloadTemplate: () => ipcRenderer.invoke('import:downloadTemplate'),
  },

  // Auto Update
  update: {
    check: () => ipcRenderer.invoke('update:check'),
  },
});
