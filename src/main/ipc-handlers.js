const { ipcMain, app } = require('electron');
const AuthService = require('./services/auth-service');
const InventoryService = require('./services/inventory-service');
const ChallanService = require('./services/challan-service');
const ReportService = require('./services/report-service');
const BackupService = require('./services/backup-service');
const UsersRepo = require('./database/repositories/users');
const CategoriesRepo = require('./database/repositories/categories');
const SuppliersRepo = require('./database/repositories/suppliers');
const BuyersRepo = require('./database/repositories/buyers');
const ItemsRepo = require('./database/repositories/items');
const ChallansRepo = require('./database/repositories/challans');
const SettingsRepo = require('./database/repositories/settings');
const AuditLogsRepo = require('./database/repositories/audit-logs');
const UnitsRepo = require('./database/repositories/units');
const PdfGenerator = require('./utils/pdf-generator');
const ExcelGenerator = require('./utils/excel-generator');
const bcrypt = require('bcryptjs');
const ImportService = require('./services/import-service');
const StockTransactionsRepo = require('./database/repositories/stock-transactions');

const ApprovalsRepo = require('./database/repositories/approvals');
const ApprovalService = require('./services/approval-service');
const GatePassService = require('./services/gate-pass-service');
const RolesRepo = require('./database/repositories/roles');
const GatePassRepo = require('./database/repositories/gate-passes');
const IssueService = require('./services/issue-service');
const ReturnService = require('./services/return-service');
const RecipientsRepo = require('./database/repositories/recipients');
const IssuesRepo = require('./database/repositories/issues');
const ProductionRepo = require('./database/repositories/production');
const WarehousesRepo = require('./database/repositories/warehouses');
const WarehouseBinsRepo = require('./database/repositories/warehouse-bins');
const WarehouseService = require('./services/warehouse-service');
const RequisitionService = require('./services/requisition-service');
const RequisitionsRepo = require('./database/repositories/requisitions');
function wrapHandler(fn) {
  return async (event, ...args) => {
    try {
      return { success: true, data: await fn(...args) };
    } catch (err) {
      console.error('[IPC Error]', err.message);
      return { success: false, error: err.message };
    }
  };
}

function registerIpcHandlers() {
  // ==================== AUTH ====================
  ipcMain.handle('auth:login', wrapHandler((username, password) => {
    return AuthService.login(username, password);
  }));

  ipcMain.handle('auth:logout', wrapHandler(() => {
    return AuthService.logout();
  }));

  ipcMain.handle('auth:changePassword', wrapHandler((userId, oldPw, newPw) => {
    return AuthService.changePassword(userId, oldPw, newPw);
  }));

  ipcMain.handle('auth:getCurrentUser', wrapHandler(() => {
    return AuthService.getCurrentUser();
  }));

  ipcMain.handle('auth:register', wrapHandler((username, password, fullName) => {
    return AuthService.register(username, password, fullName);
  }));
  
  ipcMain.handle('auth:syncSession', wrapHandler((user) => {
    return AuthService.syncSession(user);
  }));

  // ==================== USERS ====================
  ipcMain.handle('users:getAll', wrapHandler(() => {
    return UsersRepo.getAll();
  }));

  ipcMain.handle('users:create', wrapHandler(async (data) => {
    const hash = bcrypt.hashSync(data.password, 10);
    const id = await UsersRepo.create({
      username: data.username,
      passwordHash: hash,
      fullName: data.fullName,
      roleId: data.roleId,
      customPermissions: data.customPermissions,
    });
    const user = await AuthService.getCurrentUser();
    await AuditLogsRepo.create({
      userId: user?.id,
      action: 'CREATE',
      entityType: 'user',
      entityId: id,
      newValue: { username: data.username, fullName: data.fullName },
    });
    return { id };
  }));

  ipcMain.handle('users:update', wrapHandler(async (id, data) => {
    await UsersRepo.update(id, { fullName: data.fullName, roleId: data.roleId, customPermissions: data.customPermissions });
    if (data.password) {
      const hash = bcrypt.hashSync(data.password, 10);
      await UsersRepo.updatePassword(id, hash);
    }
    return { success: true };
  }));

  ipcMain.handle('users:toggleActive', wrapHandler(async (id) => {
    await UsersRepo.toggleActive(id);
    return { success: true };
  }));

  ipcMain.handle('users:delete', wrapHandler(async (id) => {
    await UsersRepo.delete(id);
    return { success: true };
  }));

  ipcMain.handle('roles:getAll', wrapHandler(() => {
    return RolesRepo.getAll();
  }));

  // ==================== BUYERS ====================
  ipcMain.handle('buyers:getAll', wrapHandler(() => {
    return BuyersRepo.getAll();
  }));

  ipcMain.handle('buyers:create', wrapHandler(async (data) => {
    const id = await BuyersRepo.create(data);
    return { id };
  }));

  ipcMain.handle('buyers:delete', wrapHandler(async (id) => {
    await BuyersRepo.delete(id);
    return { success: true };
  }));

  // ==================== CATEGORIES ====================
  ipcMain.handle('categories:getAll', wrapHandler(() => {
    return CategoriesRepo.getAll(true);
  }));

  ipcMain.handle('categories:create', wrapHandler(async (data) => {
    const id = await CategoriesRepo.create(data);
    return { id };
  }));

  ipcMain.handle('categories:update', wrapHandler(async (id, data) => {
    await CategoriesRepo.update(id, data);
    return { success: true };
  }));

  ipcMain.handle('categories:delete', wrapHandler(async (id) => {
    await CategoriesRepo.delete(id);
    return { success: true };
  }));

  // ==================== UNITS ====================
  ipcMain.handle('units:getAll', wrapHandler(() => {
    return UnitsRepo.getAll(true);
  }));

  ipcMain.handle('units:create', wrapHandler(async (data) => {
    const id = await UnitsRepo.create(data);
    return { id };
  }));

  ipcMain.handle('units:delete', wrapHandler(async (id) => {
    await UnitsRepo.delete(id);
    return { success: true };
  }));

  // ==================== SUPPLIERS ====================
  ipcMain.handle('suppliers:getAll', wrapHandler(() => {
    return SuppliersRepo.getAll(true);
  }));

  ipcMain.handle('suppliers:create', wrapHandler(async (data) => {
    const id = await SuppliersRepo.create(data);
    return { id };
  }));

  ipcMain.handle('suppliers:update', wrapHandler(async (id, data) => {
    await SuppliersRepo.update(id, data);
    return { success: true };
  }));

  ipcMain.handle('suppliers:delete', wrapHandler(async (id) => {
    await SuppliersRepo.delete(id);
    return { success: true };
  }));

  ipcMain.handle('suppliers:getFieldSuggestions', wrapHandler((field, query) => {
    return SuppliersRepo.getFieldSuggestions(field, query);
  }));

  // ==================== ITEMS ====================
  ipcMain.handle('items:getAll', wrapHandler((filters) => {
    return InventoryService.getAll(filters);
  }));

  ipcMain.handle('items:getById', wrapHandler((id) => {
    return InventoryService.getById(id);
  }));

  ipcMain.handle('items:create', wrapHandler((data) => {
    return InventoryService.create(data);
  }));

  ipcMain.handle('items:update', wrapHandler((id, data) => {
    return InventoryService.update(id, data);
  }));

  ipcMain.handle('items:delete', wrapHandler((id) => {
    return InventoryService.delete(id);
  }));

  ipcMain.handle('items:search', wrapHandler((query) => {
    return InventoryService.search(query);
  }));

  ipcMain.handle('items:getDistinctValues', wrapHandler(() => {
    return ItemsRepo.getDistinctValues();
  }));

  ipcMain.handle('items:getNextCode', wrapHandler(() => {
    return ItemsRepo.getNextCode();
  }));

  // ==================== STOCK ====================
  ipcMain.handle('stock:addMovement', wrapHandler((data) => {
    return InventoryService.addStockMovement(data);
  }));

  ipcMain.handle('stock:getTransactions', wrapHandler((filters) => {
    return InventoryService.getTransactions(filters);
  }));

  ipcMain.handle('stock:getFieldSuggestions', wrapHandler((field, query) => {
    return StockTransactionsRepo.getFieldSuggestions(field, query);
  }));

  // ==================== CHALLANS ====================
  ipcMain.handle('challans:getAll', wrapHandler((filters) => {
    return ChallanService.getAll(filters);
  }));

  ipcMain.handle('challans:getById', wrapHandler((id) => {
    return ChallanService.getById(id);
  }));

  ipcMain.handle('challans:getByNumber', wrapHandler((number) => {
    return ChallanService.getByNumber(number);
  }));

  ipcMain.handle('challans:create', wrapHandler((data) => {
    return ChallanService.create(data);
  }));

  ipcMain.handle('challans:cancel', wrapHandler((id, reason) => {
    return ChallanService.cancel(id, reason);
  }));

  ipcMain.handle('challans:getNextNumber', wrapHandler(() => {
    return ChallanService.getNextNumber();
  }));

  ipcMain.handle('challans:getFieldSuggestions', wrapHandler((field, query) => {
    return ChallanService.getFieldSuggestions(field, query);
  }));

  ipcMain.handle('challans:getTotalDelivered', wrapHandler((itemId) => {
    return ChallanService.getTotalDelivered(itemId);
  }));

  ipcMain.handle('challans:exportPdf', wrapHandler(async (id) => {
    const challan = await ChallansRepo.getById(id);
    if (!challan) throw new Error('Challan not found');
    const settings = await SettingsRepo.getAll();
    return PdfGenerator.generateChallanPdf(challan, settings);
  }));

  ipcMain.handle('challans:exportExcel', wrapHandler(async (id) => {
    const challan = await ChallansRepo.getById(id);
    if (!challan) throw new Error('Challan not found');
    const settings = await SettingsRepo.getAll();
    
    const columns = [
      { key: 'item_name', label: 'Item Name' },
      { key: 'item_code', label: 'Code' },
      { key: 'style_name', label: 'Style' },
      { key: 'order_number', label: 'Order No' },
      { key: 'purchase_no', label: 'Purchase No' },
      { key: 'size', label: 'Size' },
      { key: 'color', label: 'Color' },
      { key: 'quantity', label: 'Quantity', align: 'right' },
      { key: 'unit', label: 'Unit' },
      { key: 'notes', label: 'Notes' }
    ];

    const subtitles = [
      `Challan No: ${challan.challan_number}`,
      `Date: ${new Date(challan.challan_date).toLocaleDateString('en-GB')}`,
      `Receiver: ${challan.receiver_name}`,
      `Contact: ${challan.receiver_contact || '-'}`,
      `Address: ${challan.receiver_address || '-'}`
    ];

    return ExcelGenerator.generateReport(`Challan-${challan.challan_number}`, columns, challan.items, settings, { subtitles });
  }));

  ipcMain.handle('challans:delete', wrapHandler(async (id) => {
    return ChallanService.delete(id);
  }));

  ipcMain.handle('challans:clearHistory', wrapHandler(async () => {
    return ChallansRepo.clearChallanHistory();
  }));

  ipcMain.handle('challans:deleteSuggestion', wrapHandler(async (field, value) => {
    const s = await SettingsRepo.getAll();
    let blacklist = {};
    try {
      blacklist = typeof s.suggestion_blacklist === 'string' 
        ? JSON.parse(s.suggestion_blacklist) 
        : (s.suggestion_blacklist || {});
    } catch (e) { blacklist = {}; }

    if (!blacklist[field]) blacklist[field] = [];
    if (!blacklist[field].includes(value)) {
      blacklist[field].push(value);
      await SettingsRepo.set('suggestion_blacklist', JSON.stringify(blacklist));
    }
    return true;
  }));

  // ==================== GATE PASS ====================
  ipcMain.handle('gatePass:getAll', wrapHandler((filters) => {
    return GatePassService.getAll(filters);
  }));
  ipcMain.handle('gatePass:getById', wrapHandler((id) => {
    return GatePassService.getById(id);
  }));
  ipcMain.handle('gatePass:create', wrapHandler((data) => {
    return GatePassService.create(data);
  }));
  ipcMain.handle('gatePass:exportPdf', wrapHandler((id) => {
    return GatePassService.exportPdf(id);
  }));
  ipcMain.handle('gatePass:getNextNumber', wrapHandler(() => {
    return GatePassService.getNextNumber();
  }));
  ipcMain.handle('gatePass:getUsedChallanIds', wrapHandler(async () => {
    return await GatePassRepo.getUsedChallanIds();
  }));
  ipcMain.handle('gatePass:delete', wrapHandler((id) => {
    return GatePassRepo.delete(id);
  }));

  // ==================== REPORTS ====================
  console.log('[IPC] Registering Report Handlers...');
  const reportChannels = [
    'reports:stockReport', 'reports:movementReport', 'reports:lowStockReport',
    'reports:challanHistory', 'reports:detailedChallanHistory',
    'reports:dailySummary', 'reports:monthlySummary', 'reports:exportExcel', 'reports:exportPdf',
    'reports:auditReport'
  ];
  
  reportChannels.forEach(channel => ipcMain.removeHandler(channel));

  ipcMain.handle('reports:stockReport', wrapHandler((filters) => ReportService.stockReport(filters)));
  ipcMain.handle('reports:movementReport', wrapHandler((filters) => ReportService.movementReport(filters)));
  ipcMain.handle('reports:lowStockReport', wrapHandler((filters) => ReportService.lowStockReport(filters)));
  ipcMain.handle('reports:challanHistory', wrapHandler((filters) => ReportService.challanHistory(filters)));
  ipcMain.handle('reports:detailedChallanHistory', wrapHandler((filters) => ReportService.detailedChallanHistory(filters)));

  ipcMain.handle('reports:dailySummary', wrapHandler((date) => ReportService.dailySummary(date)));
  ipcMain.handle('reports:monthlySummary', wrapHandler((year, month) => ReportService.monthlySummary(year, month)));

  ipcMain.handle('reports:auditReport', wrapHandler((filters) => ReportService.auditReport(filters)));

  // Helper: compute delivery summary for dailyDelivery / monthlyReport / itemDeliverySummary / categoryDeliverySummary
  function buildDeliverySummary(data, type) {
    const totalItems = data.length;
    const totalQty = data.reduce((s, r) => s + (Number(r.shipped_quantity) || Number(r.total_delivered) || 0), 0);
    let totalBDT = 0;
    let totalUSD = 0;

    if (type === 'categoryDeliverySummary') {
      totalBDT = data.reduce((s, r) => s + (Number(r.total_value_bdt) || 0), 0);
      totalUSD = data.reduce((s, r) => s + (Number(r.total_value_usd) || 0), 0);
    } else {
      totalBDT = data.filter(r => (r.currency || 'BDT') !== 'USD').reduce((s, r) => s + ((Number(r.shipped_quantity) || Number(r.total_delivered) || 0) * (Number(r.unit_price) || 0)), 0);
      totalUSD = data.filter(r => r.currency === 'USD').reduce((s, r) => s + ((Number(r.shipped_quantity) || Number(r.total_delivered) || 0) * (Number(r.unit_price) || 0)), 0);
    }

    const buyerMap = {};
    if (type !== 'itemDeliverySummary' && type !== 'categoryDeliverySummary') {
      data.forEach(r => {
        const buyer = r.buyer_name || 'N/A';
        if (!buyerMap[buyer]) buyerMap[buyer] = { qty: 0, bdt: 0, usd: 0, count: 0 };
        buyerMap[buyer].count++;
        const qty = Number(r.shipped_quantity) || Number(r.total_delivered) || 0;
        buyerMap[buyer].qty += qty;
        if (r.currency === 'USD') buyerMap[buyer].usd += qty * (Number(r.unit_price) || 0);
        else buyerMap[buyer].bdt += qty * (Number(r.unit_price) || 0);
      });
    }

    const fmtBDT = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const fmtUSD = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const subtitles = [];
    if (type === 'categoryDeliverySummary') {
      const sumUnique = data.reduce((s, r) => s + (r.unique_items || 0), 0);
      subtitles.push(`Total Categories: ${totalItems}    |    Total Unique Items: ${sumUnique.toLocaleString()}    |    Total Delivery Qty: ${totalQty.toLocaleString()}`);
    } else {
      subtitles.push(`Total Items: ${totalItems}    |    Total Delivery Qty: ${totalQty.toLocaleString()}`);
    }
    let valueLine = `Total Value (BDT): ${fmtBDT(totalBDT)}`;
    if (totalUSD > 0) valueLine += `    |    Total Value (USD): ${fmtUSD(totalUSD)}`;
    subtitles.push(valueLine);
    subtitles.push('');

    let buyerEntries = [];
    if (type !== 'itemDeliverySummary' && type !== 'categoryDeliverySummary') {
      buyerEntries = Object.entries(buyerMap).sort((a, b) => (b[1].bdt + b[1].usd) - (a[1].bdt + a[1].usd));
      subtitles.push('BUYER-WISE SUMMARY:');
      buyerEntries.forEach(([buyer, s]) => {
        let line = `${buyer}: ${s.count} items, Qty: ${s.qty.toLocaleString()}`;
        if (s.bdt > 0) line += ` — BDT: ${fmtBDT(s.bdt)}`;
        if (s.usd > 0) line += ` — USD: ${fmtUSD(s.usd)}`;
        subtitles.push(line);
      });
    }

    return { subtitles, totalQty, totalBDT, totalUSD, buyerMap: buyerEntries };
  }

  ipcMain.handle('reports:exportExcel', wrapHandler(async (type, data, options) => {
    const settings = SettingsRepo.getAll();
    const columns = getReportColumns(type);
    const excelOptions = { ...options };
    if (type === 'dailyDelivery' || type === 'monthlyReport' || type === 'itemDeliverySummary' || type === 'categoryDeliverySummary') {
      const summary = buildDeliverySummary(data, type);
      excelOptions.subtitles = [...(excelOptions.subtitles || []), ...summary.subtitles];
      
      if (type === 'categoryDeliverySummary') {
        const sumUnique = data.reduce((s, r) => s + (r.unique_items || 0), 0);
        const fmtBDT = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        const fmtUSD = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        excelOptions.footerRow = [
          { text: 'Grand Total:', colSpan: 2, alignment: 'right', bold: true, fillColor: '#f0f0f0' },
          {},
          { text: sumUnique.toLocaleString(), alignment: 'center', bold: true, fillColor: '#f0f0f0' },
          { text: summary.totalQty.toLocaleString(), alignment: 'right', bold: true, fillColor: '#f0f0f0' },
          { text: summary.totalBDT > 0 ? fmtBDT(summary.totalBDT) : '-', alignment: 'right', bold: true, fillColor: '#f0f0f0' },
          { text: summary.totalUSD > 0 ? fmtUSD(summary.totalUSD) : '-', alignment: 'right', bold: true, fillColor: '#f0f0f0' }
        ];
      }
    }
    return ExcelGenerator.generateReport(getReportTitle(type), columns, data, settings, excelOptions);
  }));

  ipcMain.handle('reports:exportPdf', wrapHandler(async (type, data, options) => {
    const settings = SettingsRepo.getAll();
    const columns = getReportColumns(type);
    const pdfOptions = { ...options };
    if (type === 'dailyDelivery' || type === 'monthlyReport' || type === 'itemDeliverySummary' || type === 'categoryDeliverySummary') {
      pdfOptions.orientation = 'portrait';
      const summary = buildDeliverySummary(data, type);
      pdfOptions.subtitles = [...(pdfOptions.subtitles || []), ...summary.subtitles];
      pdfOptions.deliverySummary = summary;
      
      if (type === 'categoryDeliverySummary') {
        const sumUnique = data.reduce((s, r) => s + (r.unique_items || 0), 0);
        const fmtBDT = (v) => `৳${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        const fmtUSD = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        pdfOptions.footerRow = [
          { text: 'Grand Total:', colSpan: 2, alignment: 'right', bold: true, fillColor: '#f0f0f0' },
          {},
          { text: sumUnique.toLocaleString(), alignment: 'center', bold: true, fillColor: '#f0f0f0' },
          { text: summary.totalQty.toLocaleString(), alignment: 'right', bold: true, fillColor: '#f0f0f0' },
          { text: summary.totalBDT > 0 ? fmtBDT(summary.totalBDT) : '-', alignment: 'right', bold: true, fillColor: '#f0f0f0' },
          { text: summary.totalUSD > 0 ? fmtUSD(summary.totalUSD) : '-', alignment: 'right', bold: true, fillColor: '#f0f0f0' }
        ];
      }
    }
    return PdfGenerator.generateReportPdf(getReportTitle(type), columns, data, settings, pdfOptions);
  }));

  ipcMain.handle('gatePass:clearHistory', wrapHandler(async () => {
    return GatePassRepo.clearGatePassHistory();
  }));

  // ==================== BACKUP ====================
  ipcMain.handle('backup:create', wrapHandler(() => {
    const result = BackupService.create();
    AuditLogsRepo.create({
      userId: AuthService.getCurrentUser()?.id,
      action: 'BACKUP_CREATE',
      entityType: 'system',
      newValue: { path: result.path },
    });
    return result;
  }));

  ipcMain.handle('backup:restore', wrapHandler(async (filePath) => {
    return BackupService.restore(filePath);
  }));

  ipcMain.handle('backup:getHistory', wrapHandler(() => {
    return BackupService.getHistory();
  }));

  ipcMain.handle('backup:selectFile', wrapHandler(async () => {
    return BackupService.selectFile();
  }));

  ipcMain.handle('backup:selectDirectory', wrapHandler(async () => {
    return BackupService.selectDirectory();
  }));

  ipcMain.handle('backup:download', wrapHandler(async (filePath) => {
    return BackupService.download(filePath);
  }));

  // ==================== APPROVALS ====================
  ipcMain.handle('approvals:getAll', wrapHandler((filters) => {
    return ApprovalsRepo.getAll(filters);
  }));

  ipcMain.handle('approvals:getById', wrapHandler((id) => {
    return ApprovalsRepo.getById(id);
  }));

  ipcMain.handle('approvals:approve', wrapHandler((id, notes) => {
    return ApprovalService.approve(id, notes);
  }));

  ipcMain.handle('approvals:reject', wrapHandler((id, notes) => ApprovalService.reject(id, notes)));
  ipcMain.handle('approvals:updateData', wrapHandler((id, data) => ApprovalsRepo.updateData(id, data)));

  // ==================== SETTINGS ====================
  ipcMain.handle('settings:getAll', wrapHandler(async () => {
    return await SettingsRepo.getAll();
  }));

  ipcMain.handle('settings:get', wrapHandler(async (key) => {
    return await SettingsRepo.get(key);
  }));

  ipcMain.handle('settings:set', wrapHandler(async (key, value) => {
    await SettingsRepo.set(key, value);
    return { success: true };
  }));

  ipcMain.handle('settings:setBulk', wrapHandler(async (settings) => {
    await SettingsRepo.setBulk(settings);
    return { success: true };
  }));

  // ==================== DASHBOARD ====================
  ipcMain.handle('dashboard:getStats', wrapHandler(async () => {
    const [
      totalItems,
      totalStock,
      totalValue,
      lowStockCount,
      todayChallans,
      recentChallans,
      lowStockItems,
      issueStats,
      waitingForGatePass
    ] = await Promise.all([
      ItemsRepo.getCount(),
      ItemsRepo.getTotalStock(),
      ItemsRepo.getTotalValue(),
      ItemsRepo.getLowStockCount(),
      ChallansRepo.getTodayCount(),
      ChallansRepo.getRecent(8),
      ItemsRepo.getLowStockItems(),
      IssueService.getIssueStats(),
      ChallansRepo.getWaitingForGatePassCount()
    ]);

    return {
      totalItems,
      totalStock,
      totalValue,
      lowStockCount,
      todayChallans,
      recentChallans,
      lowStockItems,
      waitingForGatePass,
      ...issueStats,
    };
  }));

  // ==================== IMPORT ====================
  ipcMain.handle('import:selectFile', wrapHandler(async () => {
    return ImportService.selectExcelFile();
  }));

  ipcMain.handle('import:parseExcel', wrapHandler(async (filePath) => {
    return ImportService.parseExcelFile(filePath);
  }));

  ipcMain.handle('import:parseGoogleSheet', wrapHandler(async (url) => {
    return ImportService.parseGoogleSheet(url);
  }));

  ipcMain.handle('import:importItems', wrapHandler(async (rows) => {
    return await ImportService.importItems(rows);
  }));

  ipcMain.handle('import:downloadTemplate', wrapHandler(async () => {
    return ImportService.downloadTemplate();
  }));

  ipcMain.handle('import:downloadProductionTemplate', wrapHandler(async () => {
    return ImportService.downloadProductionTemplate();
  }));

  ipcMain.handle('import:importProductionItems', wrapHandler(async (rows) => {
    return await ImportService.importProductionItems(rows);
  }));

  // ==================== AUDIT ====================
  ipcMain.handle('audit:getLogs', wrapHandler((filters) => {
    return AuditLogsRepo.getAll(filters);
  }));

  // ==================== WAREHOUSES ====================
  ipcMain.handle('warehouses:getAll', wrapHandler((includeInactive) => {
    return WarehousesRepo.getAll(includeInactive);
  }));

  ipcMain.handle('warehouses:getById', wrapHandler((id) => {
    return WarehousesRepo.getById(id);
  }));

  ipcMain.handle('warehouses:create', wrapHandler(async (data) => {
    const id = await WarehousesRepo.create(data);
    return { id };
  }));

  ipcMain.handle('warehouses:update', wrapHandler(async (id, data) => {
    await WarehousesRepo.update(id, data);
    return { success: true };
  }));

  ipcMain.handle('warehouses:delete', wrapHandler(async (id) => {
    await WarehousesRepo.delete(id);
    return { success: true };
  }));

  ipcMain.handle('warehouses:getStockByItem', wrapHandler((itemId) => {
    return WarehousesRepo.getStockByItem(itemId);
  }));

  ipcMain.handle('warehouses:getStockByWarehouse', wrapHandler((warehouseId) => {
    return WarehousesRepo.getStockByWarehouse(warehouseId);
  }));

  ipcMain.handle('warehouses:transferStock', wrapHandler(async (data) => {
    const user = await AuthService.getCurrentUser();
    return WarehouseService.transferStock(data, user);
  }));

  ipcMain.handle('warehouses:getNextCode', wrapHandler(() => {
    return WarehousesRepo.getNextCode();
  }));

  // ==================== ZONES & BINS ====================
  ipcMain.handle('warehouseZones:getByWarehouse', wrapHandler((warehouseId) => WarehouseBinsRepo.getZonesByWarehouse(warehouseId)));
  ipcMain.handle('warehouseZones:create', wrapHandler((data) => WarehouseBinsRepo.createZone(data)));
  ipcMain.handle('warehouseZones:delete', wrapHandler((id) => WarehouseBinsRepo.deleteZone(id)));

  ipcMain.handle('warehouseBins:getByZone', wrapHandler((zoneId) => WarehouseBinsRepo.getBinsByZone(zoneId)));
  ipcMain.handle('warehouseBins:getByWarehouse', wrapHandler((warehouseId) => WarehouseBinsRepo.getBinsByWarehouse(warehouseId)));
  ipcMain.handle('warehouseBins:create', wrapHandler((data) => WarehouseBinsRepo.createBin(data)));
  ipcMain.handle('warehouseBins:delete', wrapHandler((id) => WarehouseBinsRepo.deleteBin(id)));

  ipcMain.handle('binStock:getByBin', wrapHandler((binId) => WarehouseBinsRepo.getBinStock(binId)));
  ipcMain.handle('binStock:adjust', wrapHandler((binId, itemId, delta) => WarehouseBinsRepo.adjustBinStock(binId, itemId, delta)));

  // ==================== AUTO UPDATE ====================
  ipcMain.handle('system:checkUpdate', wrapHandler(async () => {

    const UpdateService = require('./services/update-service');
    const { BrowserWindow } = require('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      await UpdateService.manualCheck(mainWindow);
      return { success: true };
    }
    return { success: false, error: 'No main window found' };
  }));

  ipcMain.handle('system:clearData', wrapHandler(() => {
    return ChallansRepo.clearAllData();
  }));

  ipcMain.handle('system:getVersion', wrapHandler(() => {
    return app.getVersion();
  }));

  ipcMain.handle('system:getCurrentDbPath', wrapHandler(() => {
    const { getDbPath } = require('./database/connection');
    return getDbPath();
  }));

  ipcMain.handle('system:selectDatabase', wrapHandler(async () => {
    const { dialog, app } = require('electron');
    const { setCustomDbPath } = require('./database/connection');
    const result = await dialog.showOpenDialog({
      title: 'Select Database File',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      setCustomDbPath(result.filePaths[0]);
      app.relaunch();
      app.exit(0);
    }
    return { success: true };
  }));

  ipcMain.handle('system:createDatabase', wrapHandler(async () => {
    const { dialog, app } = require('electron');
    const { setCustomDbPath } = require('./database/connection');
    const result = await dialog.showSaveDialog({
      title: 'Create New Database File',
      defaultPath: 'kadal_new.db',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });
    if (!result.canceled && result.filePath) {
      setCustomDbPath(result.filePath);
      app.relaunch();
      app.exit(0);
    }
    return { success: true };
  }));

  // ==================== RECIPIENTS ====================
  ipcMain.handle('recipients:getAll', wrapHandler((filters) => RecipientsRepo.getAll(filters)));
  ipcMain.handle('recipients:create', wrapHandler((data) => RecipientsRepo.create(data)));
  ipcMain.handle('recipients:update', wrapHandler((id, data) => RecipientsRepo.update(id, data)));
  ipcMain.handle('recipients:delete', wrapHandler((id) => RecipientsRepo.delete(id)));

  // ==================== ISSUES ====================
  ipcMain.handle('issues:getAll', wrapHandler((filters) => IssueService.getAll(filters)));
  ipcMain.handle('issues:getById', wrapHandler((id) => IssueService.getById(id)));
  ipcMain.handle('issues:create', wrapHandler((data) => IssueService.create(data)));
  ipcMain.handle('issues:getNextId', wrapHandler(() => IssueService.getNextId()));
  ipcMain.handle('issues:getOutstandingItems', wrapHandler((issueId) => IssueService.getOutstandingItems(issueId)));
  ipcMain.handle('issues:delete', wrapHandler((id) => IssueService.deleteIssue(id)));

  ipcMain.handle('issues:exportPdf', wrapHandler(async (id) => {
    const issue = await IssueService.getById(id);
    const settings = await SettingsRepo.getAll();
    return PdfGenerator.generateIssuePdf(issue, settings);
  }));

  ipcMain.handle('issues:exportExcel', wrapHandler(async (id) => {
    const issue = await IssueService.getById(id);
    const settings = await SettingsRepo.getAll();
    const isFactory = issue.issue_type === 'FACTORY';
    const columns = [
      { label: 'Issue Item', key: 'item_name' },
      { label: 'Color', key: 'color' },
      { label: 'Issued Qty', key: 'quantity', align: 'right' },
      ...(!isFactory ? [{ label: 'Returned Qty', key: 'returned_quantity', align: 'right' }] : []),
      { label: 'Unit', key: 'unit' }
    ];
    const subtitles = [
      `Issue No: ${issue.issue_id}`,
      `Date: ${new Date(issue.issue_date).toLocaleDateString('en-GB')}`,
      `Recipient: ${issue.recipient_name} (${issue.issue_type})`
    ];

    const prodItems = (issue.produced_items && issue.produced_items.length > 0)
      ? issue.produced_items
      : (issue.produced_item ? [issue.produced_item] : []);

    if (isFactory && prodItems.length > 0) {
      subtitles.push(`--- PRODUCTION & ORDER INFORMATION ---`);
      prodItems.forEach((pItem, idx) => {
        subtitles.push(`Target Product #${idx + 1}: [${pItem.item_code || '-'}] ${pItem.name || '-'}`);
        subtitles.push(`Order No. / Style / Purchase No.: ${[pItem.order_number, pItem.style_name, pItem.purchase_no].filter(Boolean).join(' / ') || '-'}`);
        subtitles.push(`Order Qty: ${(pItem.order_quantity || 0).toLocaleString()} ${pItem.unit || 'pcs'}`);
        subtitles.push(`Specs (Color/Size): ${[pItem.color, pItem.size].filter(Boolean).join(' / ') || '-'}`);
      });
    }

    const signatures = ['Receiver', 'Issued by', 'Order by', 'Approved by'];

    return ExcelGenerator.generateReport(`Issue-${issue.issue_id}`, columns, issue.items, settings, { subtitles, signatures });
  }));

  // ==================== RETURNS ====================
  ipcMain.handle('returns:getAll', wrapHandler((filters) => ReturnService.getAll(filters)));
  ipcMain.handle('returns:getById', wrapHandler((id) => ReturnService.getById(id)));
  ipcMain.handle('returns:create', wrapHandler((data) => ReturnService.create(data)));

  // ==================== ISSUE REPORTS ====================
  ipcMain.handle('reports:issueReport', wrapHandler((filters) => IssueService.issueReport(filters)));
  ipcMain.handle('reports:returnReport', wrapHandler((filters) => IssueService.returnReport(filters)));
  ipcMain.handle('reports:factoryProductionReport', wrapHandler((filters) => IssueService.factoryProductionReport(filters)));
  ipcMain.handle('reports:employeeOutstandingReport', wrapHandler((filters) => IssueService.employeeOutstandingReport(filters)));
  ipcMain.handle('reports:issueReturnSummary', wrapHandler((filters) => IssueService.issueReturnSummary(filters)));

  // ==================== PRODUCTION ====================
  ipcMain.handle('production:getAll', wrapHandler((filters) => ProductionRepo.getAll(filters)));
  ipcMain.handle('production:create', wrapHandler((data) => ProductionRepo.create(data)));
  ipcMain.handle('production:createBatch', wrapHandler((data) => ProductionRepo.createBatch(data)));
  ipcMain.handle('production:delete', wrapHandler((id) => ProductionRepo.delete(id)));

  // ==================== REQUISITIONS ====================
  ipcMain.handle('requisitions:getAll', wrapHandler((filters) => RequisitionService.getAll(filters)));
  ipcMain.handle('requisitions:getById', wrapHandler((id) => RequisitionService.getById(id)));
  ipcMain.handle('requisitions:create', wrapHandler((data) => RequisitionService.create(data)));
  ipcMain.handle('requisitions:approve', wrapHandler((id, notes) => RequisitionService.approve(id, notes)));
  ipcMain.handle('requisitions:reject', wrapHandler((id, notes) => RequisitionService.reject(id, notes)));
  ipcMain.handle('requisitions:cancel', wrapHandler((id, notes) => RequisitionService.cancel(id, notes)));
  ipcMain.handle('requisitions:fulfill', wrapHandler((id) => RequisitionService.fulfill(id)));
  ipcMain.handle('requisitions:delete', wrapHandler((id) => RequisitionService.deleteRequisition(id)));
  ipcMain.handle('requisitions:getNextNumber', wrapHandler(() => RequisitionService.getNextNumber()));
  ipcMain.handle('requisitions:getFieldSuggestions', wrapHandler((field, query) => RequisitionService.getFieldSuggestions(field, query)));

  ipcMain.handle('requisitions:exportPdf', wrapHandler(async (id) => {
    const req = await RequisitionService.getById(id);
    if (!req) throw new Error('Requisition not found');
    const settingsData = await SettingsRepo.getAll();
    return PdfGenerator.generateRequisitionPdf(req, settingsData);
  }));

  ipcMain.handle('requisitions:exportExcel', wrapHandler(async (id) => {
    const req = await RequisitionService.getById(id);
    if (!req) throw new Error('Requisition not found');
    const settingsData = await SettingsRepo.getAll();
    const columns = [
      { key: 'item_code', label: 'Item Code', width: 60 },
      { key: 'item_name', label: 'Item Name', width: '*' },
      { key: 'style_name', label: 'Style', width: 60, format: (v) => v || '-' },
      { key: 'size', label: 'Size', width: 40, format: (v) => v || '-' },
      { key: 'color', label: 'Color', width: 40, format: (v) => v || '-' },
      { key: 'buyer_name', label: 'Buyer', width: 65, format: (v) => v || '-' },
      { key: 'requested_quantity', label: 'Requested Qty', width: 55, align: 'right' },
      { key: 'approved_quantity', label: 'Approved Qty', width: 55, align: 'right' },
      { key: 'issued_quantity', label: 'Issued Qty', width: 55, align: 'right' },
      { key: 'item_unit', label: 'Unit', width: 40 },
    ];
    const subtitles = [
      `Requisition No: ${req.requisition_no}`,
      `Requester: ${req.requester_name || '-'} | Dept: ${req.department || '-'}`,
      `Status: ${req.status} | Date: ${new Date(req.requisition_date).toLocaleDateString('en-GB')}`,
    ];
    return ExcelGenerator.generateReport(`Requisition-${req.requisition_no}`, columns, req.items || [], settingsData, { subtitles });
  }));

  console.log('[IPC] All handlers registered');
}


// Report column definitions
function getReportColumns(type) {
  switch (type) {
    case 'stock':
      return [
        { key: 'item_name_code', label: 'Item / Code', width: 100, format: (v, r) => `${r.name} (${r.item_code})` },
        { key: 'style_purchase_order', label: 'Style / Purchase / Order', width: 120, format: (v, r) => `${r.style_name || '-'} / ${r.purchase_no || '-'} / ${r.order_number || '-'}` },
        { key: 'size_color', label: 'Size / Color', width: 80, format: (v, r) => [r.size, r.color].filter(Boolean).join(' / ') || '-' },
        { key: 'buyer_name', label: 'Buyer', width: 80 },
        { key: 'unit_price', label: 'Unit Price', width: 60, align: 'right', format: (v) => Number(v || 0).toFixed(2) },
        { key: 'current_stock', label: 'Stock', width: 50, align: 'right' },
        { key: 'total_value', label: 'Total Value', width: 70, align: 'right', format: (v, r) => (r.current_stock * (r.unit_price || 0)).toFixed(2) },
        { key: 'unit', label: 'Unit', width: 40 },
        { key: 'min_stock_level', label: 'Min Level', width: 55, align: 'right' },
      ];
    case 'movement':
      return [
        { key: 'item_name_code', label: 'Item / Code', width: 100, format: (v, r) => `${r.item_name} (${r.item_code})` },
        { key: 'style_purchase_order', label: 'Style / Purchase / Order', width: 120, format: (v, r) => `${r.style_name || '-'} / ${r.purchase_no || '-'} / ${r.order_number || '-'}` },
        { key: 'size_color', label: 'Size / Color', width: 80, format: (v, r) => [r.size, r.color].filter(Boolean).join(' / ') || '-' },
        { key: 'buyer_name', label: 'Buyer', width: 80 },
        { key: 'order_quantity', label: 'Order Qty', width: 60, align: 'right', format: (v, r) => r.order_quantity || 0 },
        { key: 'total_in', label: 'Total IN', width: 60, align: 'right' },
        { key: 'total_out', label: 'Total OUT', width: 60, align: 'right' },
        { key: 'balance', label: 'Balance', width: 60, align: 'right', format: (v, r) => r.balance ?? 0 },
        { key: 'current_stock', label: 'Current Stock', width: 70, align: 'right' },
        { key: 'unit', label: 'Unit', width: 40 },
      ];
    case 'lowStock':
      return [
        { key: 'item_code', label: 'Code', width: 60 },
        { key: 'name', label: 'Item Name', width: '*' },
        { key: 'buyer_name', label: 'Buyer', width: 80 },
        { key: 'category_name', label: 'Category', width: 80 },
        { key: 'current_stock', label: 'Current', width: 55, align: 'right' },
        { key: 'min_stock_level', label: 'Min Level', width: 55, align: 'right' },
        { key: 'unit', label: 'Unit', width: 40 },
      ];
    case 'challan':
      return [
        { key: 'challan_number', label: 'Challan No', width: 65 },
        { key: 'challan_date', label: 'Date', width: 55, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'receiver_name', label: 'Receiver', width: 75 },
        { key: 'buyer_name', label: 'Buyer', width: 65, format: (v, r) => r.buyer_name || '-' },
        { key: 'item_name', label: 'Item Details', width: 110, format: (v, r) => `${r.item_name || '-'}\n${[r.size, r.color].filter(Boolean).join(' / ') || '-'}` },
        { key: 'style_order_purchase', label: 'Style / Order / Purchase', width: 120, format: (v, r) => `${r.style_name || '-'}\n${r.order_number || '-'} / ${r.purchase_no || '-'}` },
        { key: 'order_quantity', label: 'Order Qty', width: 45, align: 'right', format: (v, r) => r.order_quantity ?? 0 },
        { key: 'shipped_quantity', label: 'Shipped', width: 45, align: 'right', format: (v, r) => r.shipped_quantity ?? 0 },
        { key: 'total_shipped', label: 'Total Out', width: 45, align: 'right', format: (v, r) => r.total_shipped ?? 0 },
        { key: 'balance', label: 'Balance', width: 45, align: 'right', format: (v, r) => r.balance ?? 0 },
        { key: 'status', label: 'Status', width: 45 },
      ];
    case 'itemChallan':
      return [
        { key: 'item_name', label: 'Item Details', width: 110, format: (v, r) => `${r.item_name || '-'}\n${r.item_code || '-'}` },
        { key: 'style_order_purchase', label: 'Style / Order / Purchase', width: 120, format: (v, r) => `${r.style_name || '-'}\n${r.order_number || '-'} / ${r.purchase_no || '-'}` },
        { key: 'buyer_name', label: 'Buyer', width: 65, format: (v, r) => r.buyer_name || '-' },
        { key: 'challan_number', label: 'Challan No', width: 65 },
        { key: 'challan_date', label: 'Date', width: 55, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'receiver_name', label: 'Receiver', width: 75 },
        { key: 'order_quantity', label: 'Order Qty', width: 45, align: 'right', format: (v, r) => r.order_quantity ?? 0 },
        { key: 'shipped_quantity', label: 'Shipped', width: 45, align: 'right', format: (v, r) => r.shipped_quantity ?? 0 },
        { key: 'status', label: 'Status', width: 45 },
      ];
    case 'dailyDelivery':
    case 'monthlyReport':
      return [
        { key: 'sl_no', label: 'SL', width: 25, format: (v, r, i) => i + 1 },
        { key: 'item_name', label: 'Item Details', width: '*', format: (v, r) => `${r.item_name || '-'}\n${[r.size, r.color].filter(Boolean).join(' / ') || '-'}` },
        { key: 'buyer_name', label: 'Buyer', width: 55, format: (v, r) => r.buyer_name || '-' },
        { key: 'style_name', label: 'Style', width: 60, format: (v, r) => r.style_name || '-' },
        { key: 'shipped_quantity', label: 'Del. Qty', width: 40, align: 'right', format: (v, r) => r.shipped_quantity ?? 0 },
        { key: 'unit_price', label: 'Unit Price', width: 55, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(r.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { key: 'total_value', label: 'Total Value', width: 60, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number((r.shipped_quantity || 0) * (r.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { key: 'challan_number', label: 'Challan No.', width: 55 },
      ];
    case 'itemDeliverySummary':
      return [
        { key: 'sl_no', label: 'SL', width: 25, format: (v, r, i) => i + 1 },
        { key: 'item_name', label: 'Item Details', width: '*', format: (v, r) => `${r.item_name || '-'}\n${r.item_code || '-'}\n${[r.size, r.color].filter(Boolean).join(' / ') || '-'}` },
        { key: 'total_delivered', label: 'Total Delivered', width: 60, align: 'right', format: (v, r) => r.total_delivered ?? 0 },
        { key: 'unit_price', label: 'Unit Price', width: 60, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(r.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { key: 'total_value', label: 'Total Value', width: 70, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number((r.total_delivered || 0) * (r.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { key: 'challan_numbers', label: 'Challans', width: 100, format: (v, r) => (r.challan_numbers || []).join(', ') },
      ];
    case 'categoryDeliverySummary':
      return [
        { key: 'sl_no', label: 'SL', width: 30, format: (v, r, i) => i + 1 },
        { key: 'category_name', label: 'Category Name', width: '*', format: (v, r) => r.category_name || '-' },
        { key: 'unique_items', label: 'Unique Items', width: 65, align: 'center', format: (v, r) => r.unique_items || 0 },
        { key: 'total_delivered', label: 'Total Delivered', width: 75, align: 'right', format: (v, r) => r.total_delivered ?? 0 },
        { key: 'total_value_bdt', label: 'Total Value (BDT)', width: 85, align: 'right', format: (v, r) => r.total_value_bdt > 0 ? `৳${Number(r.total_value_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-' },
        { key: 'total_value_usd', label: 'Total Value (USD)', width: 85, align: 'right', format: (v, r) => r.total_value_usd > 0 ? `$${Number(r.total_value_usd).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-' },
      ];

    case 'movementDetail':
      return [
        { key: 'created_at', label: 'Date & Time', width: 90, format: (v) => v ? new Date(v).toLocaleString('en-GB') : '' },
        { key: 'type', label: 'Type', width: 40 },
        { key: 'quantity', label: 'Qty', width: 50, align: 'right' },
        { key: 'unit_price', label: 'Unit Price', width: 60, align: 'right', format: (v, r) => r.unit_price || 0 },
        { key: 'total_value', label: 'Total Value', width: 70, align: 'right', format: (v, r) => (r.quantity * (r.unit_price || 0)).toFixed(2) },
        { key: 'stock_before', label: 'Stock Before', width: 55, align: 'right' },
        { key: 'stock_after', label: 'Stock After', width: 55, align: 'right' },
        { key: 'reference', label: 'Reference', width: 80 },
        { key: 'created_by_name', label: 'By', width: 60 },
        { key: 'notes', label: 'Notes', width: '*' },
      ];
    case 'issueReport':
      return [
        { key: 'issue_id', label: 'Issue ID', width: 55 },
        { key: 'issue_date', label: 'Date', width: 50, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'issue_type', label: 'Type', width: 40 },
        { key: 'recipient_name', label: 'Recipient', width: 70 },
        { key: 'item_name', label: 'Item Name', width: 80 },
        { key: 'item_code', label: 'Code', width: 50 },
        { key: 'style_name', label: 'Style', width: 60, format: (v) => v || '-' },
        { key: 'purchase_no', label: 'Purchase No', width: 60, format: (v) => v || '-' },
        { key: 'order_number', label: 'Order No', width: 60, format: (v) => v || '-' },
        { key: 'size', label: 'Size', width: 40, format: (v) => v || '-' },
        { key: 'color', label: 'Color', width: 40, format: (v) => v || '-' },
        { key: 'buyer_name', label: 'Buyer', width: 65, format: (v) => v || '-' },
        { key: 'quantity', label: 'Issued', width: 45, align: 'right' },
        { key: 'returned_quantity', label: 'Returned', width: 40, align: 'right' },
        { key: 'damage_quantity', label: 'Damaged', width: 45, align: 'right' },
        { key: 'rejected_quantity', label: 'Rejected', width: 45, align: 'right' },
        { key: 'outstanding', label: 'Outstanding', width: 45, align: 'right' },
        { key: 'unit', label: 'Unit', width: 40, format: (v) => v || '-' },
        { key: 'status', label: 'Status', width: 40 },
      ];
    case 'factoryProductionReport':
      return [
        { key: 'created_at', label: 'Date', width: 45, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'id', label: 'Production / Issue ID', width: 70, format: (v, r) => `PRD-${r.id}\n${r.issue_id}` },
        { key: 'recipient_name', label: 'Factory', width: 65 },
        { key: 'product_name', label: 'Produced Item', width: 80 },
        { key: 'product_code', label: 'Code', width: 50 },
        { key: 'style_name', label: 'Style / Purchase / Order', width: 90, format: (v, r) => `${r.style_name || '-'}\n${[r.purchase_no, r.order_number].filter(Boolean).join(' / ') || '-'}` },
        { key: 'size', label: 'Size / Color', width: 50, format: (v, r) => [r.size?.trim(), r.color?.trim()].filter(Boolean).join(' / ') || '-' },
        { key: 'buyer_name', label: 'Buyer', width: 60, format: (v) => v || '-' },
        { key: 'production_quantity', label: 'Produced Qty', width: 45, align: 'right' },
        { key: 'wastage_quantity', label: 'Wastage', width: 45, align: 'right', format: (v) => v || 0 },
        { key: 'unit', label: 'Unit', width: 35, format: (v) => v || 'pcs' },
      ];
    case 'returnReport':
      return [
        { key: 'issue_id', label: 'Issue ID', width: 65 },
        { key: 'return_date', label: 'Return Date', width: 60, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'recipient_name', label: 'Recipient', width: 80 },
        { key: 'item_name', label: 'Item', width: 80 },
        { key: 'item_code', label: 'Code', width: 60 },
        { key: 'returned_quantity', label: 'Good Qty', width: 50, align: 'right' },
        { key: 'damage_quantity', label: 'Damaged', width: 50, align: 'right' },
        { key: 'rejected_quantity', label: 'Rejected', width: 50, align: 'right' },
        { key: 'created_by_name', label: 'By', width: 60 },
      ];
    case 'employeeOutstanding':
      return [
        { key: 'recipient_name', label: 'Employee', width: 80 },
        { key: 'issue_id', label: 'Issue ID', width: 65 },
        { key: 'issue_date', label: 'Issue Date', width: 60, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'item_name', label: 'Item', width: 80 },
        { key: 'item_code', label: 'Code', width: 60 },
        { key: 'quantity', label: 'Issued', width: 45, align: 'right' },
        { key: 'outstanding', label: 'Outstanding', width: 55, align: 'right' },
        { key: 'expected_return_date', label: 'Due Date', width: 60, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
      ];
    case 'issueReturnSummary':
      return [
        { key: 'issue_id', label: 'Issue ID', width: 65 },
        { key: 'issue_type', label: 'Type', width: 45 },
        { key: 'recipient_name', label: 'Recipient', width: 80 },
        { key: 'issue_date', label: 'Date', width: 55, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'total_issued', label: 'Issued', width: 45, align: 'right' },
        { key: 'total_returned', label: 'Returned', width: 50, align: 'right' },
        { key: 'total_damaged', label: 'Damaged', width: 45, align: 'right' },
        { key: 'total_rejected', label: 'Rejected', width: 45, align: 'right' },
        { key: 'outstanding', label: 'Outstanding', width: 55, align: 'right' },
        { key: 'status', label: 'Status', width: 45 },
      ];
    case 'requisitionReport':
      return [
        { key: 'requisition_no', label: 'Req. No', width: 65 },
        { key: 'requisition_date', label: 'Date', width: 55, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '' },
        { key: 'requester_name', label: 'Requester', width: 80 },
        { key: 'department', label: 'Department', width: 70, format: (v) => v || '-' },
        { key: 'recipient_name', label: 'Recipient', width: 80, format: (v) => v || '-' },
        { key: 'purpose', label: 'Purpose', width: 80, format: (v) => v || '-' },
        { key: 'item_count', label: 'Items', width: 40, align: 'right' },
        { key: 'total_requested', label: 'Total Requested', width: 65, align: 'right' },
        { key: 'status', label: 'Status', width: 55 },
      ];
    case 'auditRawMaterial':
      return [
        { key: 'item_code', label: 'Item Code', width: 65 },
        { key: 'name', label: 'Item Name', width: '*' },
        { key: 'style_purchase_order', label: 'Style / Purchase / Order', width: 110, format: (v, r) => `${r.style_name || '-'} / ${r.purchase_no || '-'} / ${r.order_number || '-'}` },
        { key: 'size_color', label: 'Size / Color', width: 70, format: (v, r) => [r.size, r.color].filter(Boolean).join(' / ') || '-' },
        { key: 'buyer_name', label: 'Buyer', width: 70, format: (v) => v || '-' },
        { key: 'supplier_name', label: 'Supplier', width: 70, format: (v) => v || '-' },
        { key: 'current_stock', label: 'Stock In Hand', width: 55, align: 'right' },
        { key: 'unit', label: 'Unit', width: 35 },
        { key: 'unit_price', label: 'Unit Price', width: 55, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(v || 0).toFixed(2)}` },
        { key: 'total_value', label: 'Total Value', width: 65, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(v || 0).toFixed(2)}` },
      ];
    case 'auditFinishedGoods':
      return [
        { key: 'item_code', label: 'Item Code', width: 65 },
        { key: 'name', label: 'Item Name', width: '*' },
        { key: 'style_purchase_order', label: 'Style / Purchase / Order', width: 110, format: (v, r) => `${r.style_name || '-'} / ${r.purchase_no || '-'} / ${r.order_number || '-'}` },
        { key: 'size_color', label: 'Size / Color', width: 70, format: (v, r) => [r.size, r.color].filter(Boolean).join(' / ') || '-' },
        { key: 'buyer_name', label: 'Buyer', width: 70, format: (v) => v || '-' },
        { key: 'current_stock', label: 'Stock In Hand', width: 55, align: 'right' },
        { key: 'unit', label: 'Unit', width: 35 },
        { key: 'unit_price', label: 'Unit Price', width: 55, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(v || 0).toFixed(2)}` },
        { key: 'total_value', label: 'Total Value', width: 65, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(v || 0).toFixed(2)}` },
      ];
    case 'auditWorkingProcess':
      return [
        { key: 'issue_id', label: 'Issue ID', width: 55 },
        { key: 'recipient_name', label: 'Factory', width: 70 },
        { key: 'item_name_code', label: 'Item / Code', width: 100, format: (v, r) => `${r.item_name || '-'} (${r.item_code || '-'})` },
        { key: 'style_purchase_order', label: 'Style / Purchase / Order', width: 100, format: (v, r) => `${r.style_name || '-'} / ${r.purchase_no || '-'} / ${r.order_number || '-'}` },
        { key: 'buyer_name', label: 'Buyer', width: 65, format: (v) => v || '-' },
        { key: 'issued_qty', label: 'Issued', width: 40, align: 'right' },
        { key: 'consumed_qty', label: 'Consumed', width: 45, align: 'right' },
        { key: 'returned_qty', label: 'Returned', width: 45, align: 'right' },
        { key: 'outstanding', label: 'Outstanding', width: 50, align: 'right' },
        { key: 'unit', label: 'Unit', width: 35 },
        { key: 'unit_price', label: 'Unit Price', width: 55, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(v || 0).toFixed(2)}` },
        { key: 'outstanding_value', label: 'Outstanding Value', width: 65, align: 'right', format: (v, r) => `${r.currency === 'USD' ? '$' : '৳'}${Number(v || 0).toFixed(2)}` },
      ];
    default:
      return [];
  }
}

function getReportTitle(type) {
  switch (type) {
    case 'stock': return 'Current Stock Report';
    case 'movement': return 'Stock Movement Report';
    case 'lowStock': return 'Low Stock Alert Report';
    case 'challan': return 'Challan History Report';
    case 'itemChallan': return 'Item Wise Challan Report';
    case 'dailyDelivery': return 'Daily Delivery Report';
    case 'itemDeliverySummary': return 'Item Wise Delivery Summary';
    case 'categoryDeliverySummary': return 'Category Wise Delivery Summary';
    case 'monthlyReport': return 'Monthly Report';
    case 'movementDetail': return 'Item Stock Movement Details';
    case 'issueReport': return 'Issue Report';
    case 'returnReport': return 'Return Report';
    case 'employeeOutstanding': return 'Employee Outstanding Report';
    case 'issueReturnSummary': return 'Issue vs Return Summary';
    case 'factoryProductionReport': return 'Factory Production Report';
    case 'requisitionReport': return 'Requisition Report';
    case 'auditRawMaterial': return 'Audit Report - Raw Material In Hand';
    case 'auditFinishedGoods': return 'Audit Report - Finished Goods In Hand';
    case 'auditWorkingProcess': return 'Audit Report - Working Process In Hand';
    default: return 'Report';
  }
}

module.exports = { registerIpcHandlers };
