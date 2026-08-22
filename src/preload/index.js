const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kadal', {
  // Auth
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (userId, oldPw, newPw) => ipcRenderer.invoke('auth:changePassword', userId, oldPw, newPw),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    register: (username, password, fullName) => ipcRenderer.invoke('auth:register', username, password, fullName),
    syncSession: (user) => ipcRenderer.invoke('auth:syncSession', user),
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
    getByNumber: (number) => ipcRenderer.invoke('challans:getByNumber', number),
    create: (data) => ipcRenderer.invoke('challans:create', data),
    cancel: (id, reason) => ipcRenderer.invoke('challans:cancel', id, reason),
    getNextNumber: () => ipcRenderer.invoke('challans:getNextNumber'),
    getFieldSuggestions: (field, query) => ipcRenderer.invoke('challans:getFieldSuggestions', field, query),
    exportPdf: (id) => ipcRenderer.invoke('challans:exportPdf', id),
    exportExcel: (id) => ipcRenderer.invoke('challans:exportExcel', id),
    getTotalDelivered: (itemId) => ipcRenderer.invoke('challans:getTotalDelivered', itemId),
    delete: (id) => ipcRenderer.invoke('challans:delete', id),
    clearHistory: () => ipcRenderer.invoke('challans:clearHistory'),
    deleteSuggestion: (field, value) => ipcRenderer.invoke('challans:deleteSuggestion', field, value),
  },

  // Reports
  reports: {
    stockReport: (filters) => ipcRenderer.invoke('reports:stockReport', filters),
    movementReport: (filters) => ipcRenderer.invoke('reports:movementReport', filters),
    lowStockReport: () => ipcRenderer.invoke('reports:lowStockReport'),
    challanHistory: (filters) => ipcRenderer.invoke('reports:challanHistory', filters),
    detailedChallanHistory: (filters) => ipcRenderer.invoke('reports:detailedChallanHistory', filters),

    dailySummary: (date) => ipcRenderer.invoke('reports:dailySummary', date),
    monthlySummary: (year, month) => ipcRenderer.invoke('reports:monthlySummary', year, month),
    exportExcel: (type, data, options) => ipcRenderer.invoke('reports:exportExcel', type, data, options),
    exportPdf: (type, data, options) => ipcRenderer.invoke('reports:exportPdf', type, data, options),
    issueReport: (filters) => ipcRenderer.invoke('reports:issueReport', filters),
    returnReport: (filters) => ipcRenderer.invoke('reports:returnReport', filters),
    factoryProductionReport: (filters) => ipcRenderer.invoke('reports:factoryProductionReport', filters),
    employeeOutstandingReport: (filters) => ipcRenderer.invoke('reports:employeeOutstandingReport', filters),
    issueReturnSummary: (filters) => ipcRenderer.invoke('reports:issueReturnSummary', filters),
    auditReport: (filters) => ipcRenderer.invoke('reports:auditReport', filters),
  },
  approvals: {
    getAll: (status) => ipcRenderer.invoke('approvals:getAll', status),
    getById: (id) => ipcRenderer.invoke('approvals:getById', id),
    approve: (id, notes) => ipcRenderer.invoke('approvals:approve', id, notes),
    reject: (id, notes) => ipcRenderer.invoke('approvals:reject', id, notes),
    updateData: (id, data) => ipcRenderer.invoke('approvals:updateData', id, data),
  },

  gatePass: {
    getAll: (filters) => ipcRenderer.invoke('gatePass:getAll', filters),
    getById: (id) => ipcRenderer.invoke('gatePass:getById', id),
    create: (data) => ipcRenderer.invoke('gatePass:create', data),
    delete: (id) => ipcRenderer.invoke('gatePass:delete', id),
    exportPdf: (id) => ipcRenderer.invoke('gatePass:exportPdf', id),
    getNextNumber: () => ipcRenderer.invoke('gatePass:getNextNumber'),
    getUsedChallanIds: () => ipcRenderer.invoke('gatePass:getUsedChallanIds'),
    clearHistory: () => ipcRenderer.invoke('gatePass:clearHistory'),
  },

  // Issues
  issues: {
    getAll: (filters) => ipcRenderer.invoke('issues:getAll', filters),
    getById: (id) => ipcRenderer.invoke('issues:getById', id),
    create: (data) => ipcRenderer.invoke('issues:create', data),
    getNextId: () => ipcRenderer.invoke('issues:getNextId'),
    getOutstandingItems: (issueId) => ipcRenderer.invoke('issues:getOutstandingItems', issueId),
    delete: (id) => ipcRenderer.invoke('issues:delete', id),
    exportPdf: (id) => ipcRenderer.invoke('issues:exportPdf', id),
    exportExcel: (id) => ipcRenderer.invoke('issues:exportExcel', id),
  },

  // Returns
  returns: {
    getAll: (filters) => ipcRenderer.invoke('returns:getAll', filters),
    getById: (id) => ipcRenderer.invoke('returns:getById', id),
    create: (data) => ipcRenderer.invoke('returns:create', data),
  },

  // Recipients
  recipients: {
    getAll: (filters) => ipcRenderer.invoke('recipients:getAll', filters),
    create: (data) => ipcRenderer.invoke('recipients:create', data),
    update: (id, data) => ipcRenderer.invoke('recipients:update', id, data),
    delete: (id) => ipcRenderer.invoke('recipients:delete', id),
  },

  // Production
  production: {
    getAll: (filters) => ipcRenderer.invoke('production:getAll', filters),
    create: (data) => ipcRenderer.invoke('production:create', data),
    createBatch: (data) => ipcRenderer.invoke('production:createBatch', data),
    delete: (id) => ipcRenderer.invoke('production:delete', id),
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
    downloadProductionTemplate: () => ipcRenderer.invoke('import:downloadProductionTemplate'),
    importProductionItems: (rows) => ipcRenderer.invoke('import:importProductionItems', rows),
  },

  // Auto Update
  update: {
    check: () => ipcRenderer.invoke('system:checkUpdate'),
    onDownloadProgress: (callback) => {
      const subscription = (_event, progress) => callback(progress);
      ipcRenderer.on('update:downloadProgress', subscription);
      return () => ipcRenderer.removeListener('update:downloadProgress', subscription);
    },
    onUpdateAvailable: (callback) => {
      const subscription = (_event, info) => callback(info);
      ipcRenderer.on('update:available', subscription);
      return () => ipcRenderer.removeListener('update:available', subscription);
    },
    onUpdateError: (callback) => {
      const subscription = (_event, error) => callback(error);
      ipcRenderer.on('update:error', subscription);
      return () => ipcRenderer.removeListener('update:error', subscription);
    }
  },
  system: {
    clearData: () => ipcRenderer.invoke('system:clearData'),
    getVersion: () => ipcRenderer.invoke('system:getVersion'),
    getCurrentDbPath: () => ipcRenderer.invoke('system:getCurrentDbPath'),
    selectDatabase: () => ipcRenderer.invoke('system:selectDatabase'),
    createDatabase: () => ipcRenderer.invoke('system:createDatabase'),
  },
  
  // Warehouses
  warehouses: {
    getAll: (includeInactive) => ipcRenderer.invoke('warehouses:getAll', includeInactive),
    getById: (id) => ipcRenderer.invoke('warehouses:getById', id),
    create: (data) => ipcRenderer.invoke('warehouses:create', data),
    update: (id, data) => ipcRenderer.invoke('warehouses:update', id, data),
    delete: (id) => ipcRenderer.invoke('warehouses:delete', id),
    getStockByItem: (itemId) => ipcRenderer.invoke('warehouses:getStockByItem', itemId),
    getStockByWarehouse: (warehouseId) => ipcRenderer.invoke('warehouses:getStockByWarehouse', warehouseId),
    transferStock: (data) => ipcRenderer.invoke('warehouses:transferStock', data),
    getNextCode: () => ipcRenderer.invoke('warehouses:getNextCode'),
  },

  warehouseZones: {
    getByWarehouse: (warehouseId) => ipcRenderer.invoke('warehouseZones:getByWarehouse', warehouseId),
    create: (data) => ipcRenderer.invoke('warehouseZones:create', data),
    delete: (id) => ipcRenderer.invoke('warehouseZones:delete', id),
  },

  warehouseBins: {
    getByZone: (zoneId) => ipcRenderer.invoke('warehouseBins:getByZone', zoneId),
    getByWarehouse: (warehouseId) => ipcRenderer.invoke('warehouseBins:getByWarehouse', warehouseId),
    create: (data) => ipcRenderer.invoke('warehouseBins:create', data),
    delete: (id) => ipcRenderer.invoke('warehouseBins:delete', id),
  },

  binStock: {
    getByBin: (binId) => ipcRenderer.invoke('binStock:getByBin', binId),
    adjust: (binId, itemId, delta) => ipcRenderer.invoke('binStock:adjust', binId, itemId, delta),
  },

  // Requisitions
  requisitions: {
    getAll: (filters) => ipcRenderer.invoke('requisitions:getAll', filters),
    getById: (id) => ipcRenderer.invoke('requisitions:getById', id),
    create: (data) => ipcRenderer.invoke('requisitions:create', data),
    approve: (id, notes) => ipcRenderer.invoke('requisitions:approve', id, notes),
    reject: (id, notes) => ipcRenderer.invoke('requisitions:reject', id, notes),
    cancel: (id, notes) => ipcRenderer.invoke('requisitions:cancel', id, notes),
    fulfill: (id) => ipcRenderer.invoke('requisitions:fulfill', id),
    delete: (id) => ipcRenderer.invoke('requisitions:delete', id),
    getNextNumber: () => ipcRenderer.invoke('requisitions:getNextNumber'),
    getFieldSuggestions: (field, query) => ipcRenderer.invoke('requisitions:getFieldSuggestions', field, query),
    exportPdf: (id) => ipcRenderer.invoke('requisitions:exportPdf', id),
    exportExcel: (id) => ipcRenderer.invoke('requisitions:exportExcel', id),
  },

});

