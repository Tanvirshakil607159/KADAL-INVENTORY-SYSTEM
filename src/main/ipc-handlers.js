const { ipcMain } = require('electron');
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
    const settings = SettingsRepo.getAll();
    return PdfGenerator.generateChallanPdf(challan, settings);
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

  // ==================== REPORTS ====================
  ipcMain.handle('reports:stockReport', wrapHandler((filters) => {
    return ReportService.stockReport(filters);
  }));

  ipcMain.handle('reports:movementReport', wrapHandler((filters) => {
    return ReportService.movementReport(filters);
  }));

  ipcMain.handle('reports:lowStockReport', wrapHandler(() => {
    return ReportService.lowStockReport();
  }));

  ipcMain.handle('reports:challanHistory', wrapHandler((filters) => {
    return ReportService.challanHistory(filters);
  }));
  
  ipcMain.handle('reports:detailedChallanHistory', wrapHandler((filters) => {
    return ReportService.detailedChallanHistory(filters);
  }));


  ipcMain.handle('reports:dailySummary', wrapHandler((date) => {
    return ReportService.dailySummary(date);
  }));

  ipcMain.handle('reports:monthlySummary', wrapHandler((year, month) => {
    return ReportService.monthlySummary(year, month);
  }));

  ipcMain.handle('reports:exportExcel', wrapHandler(async (type, data, options) => {
    const settings = SettingsRepo.getAll();
    const columns = getReportColumns(type);
    return ExcelGenerator.generateReport(getReportTitle(type), columns, data, settings, options);
  }));

  ipcMain.handle('reports:exportPdf', wrapHandler(async (type, data, options) => {
    const settings = SettingsRepo.getAll();
    const columns = getReportColumns(type);
    return PdfGenerator.generateReportPdf(getReportTitle(type), columns, data, settings, options);
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

  ipcMain.handle('approvals:reject', wrapHandler((id, notes) => {
    return ApprovalService.reject(id, notes);
  }));

  // ==================== SETTINGS ====================
  ipcMain.handle('settings:getAll', wrapHandler(() => {
    return SettingsRepo.getAll();
  }));

  ipcMain.handle('settings:get', wrapHandler((key) => {
    return SettingsRepo.get(key);
  }));

  ipcMain.handle('settings:set', wrapHandler((key, value) => {
    SettingsRepo.set(key, value);
    return { success: true };
  }));

  ipcMain.handle('settings:setBulk', wrapHandler((settings) => {
    SettingsRepo.setBulk(settings);
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
      lowStockItems
    ] = await Promise.all([
      ItemsRepo.getCount(),
      ItemsRepo.getTotalStock(),
      ItemsRepo.getTotalValue(),
      ItemsRepo.getLowStockCount(),
      ChallansRepo.getTodayCount(),
      ChallansRepo.getRecent(8),
      ItemsRepo.getLowStockItems()
    ]);

    return {
      totalItems,
      totalStock,
      totalValue,
      lowStockCount,
      todayChallans,
      recentChallans,
      lowStockItems,
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

  // ==================== AUDIT ====================
  ipcMain.handle('audit:getLogs', wrapHandler((filters) => {
    return AuditLogsRepo.getAll(filters);
  }));

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
        { key: 'total_in', label: 'Total IN', width: 60, align: 'right' },
        { key: 'total_out', label: 'Total OUT', width: 60, align: 'right' },
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

    case 'movementDetail': return 'Item Stock Movement Details';
    default: return 'Report';
  }
}

module.exports = { registerIpcHandlers };
