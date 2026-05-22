const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const SettingsRepo = require('../database/repositories/settings');
const AuthService = require('./auth-service');
const WarehousesRepo = require('../database/repositories/warehouses');
const { dbTransaction } = require('../database/connection');

const InventoryService = {
  async getAll(filters) { return await ItemsRepo.getAll(filters); },
  async getById(id) { return await ItemsRepo.getById(id); },
  async search(query) { return await ItemsRepo.search(query); },

  async create(data) {
    // Check if the code already exists (or is pending approval)
    // We automatically resolve collisions instead of throwing an error to handle multiple users working at once
    let attempts = 0;
    while (data.itemCode && await ItemsRepo.checkCodeExists(data.itemCode) && attempts < 10) {
      const oldCode = data.itemCode;
      data.itemCode = await ItemsRepo.getNextCode();
      console.warn(`[InventoryService] Initial code collision: "${oldCode}" taken. Automatically using: "${data.itemCode}"`);
      attempts++;
    }
    const user = AuthService.getCurrentUser();
    const isAdmin = user?.roleName === 'Admin' || user?.roleName === 'Super Admin';
    if (!isAdmin) {
      const requireApproval = SettingsRepo.get('require_inventory_approval') === 'true';
      if (requireApproval) {
        const ApprovalService = require('./approval-service');
        // Enrich data for better approval UI
        if (data.categoryId) {
          const CategoriesRepo = require('../database/repositories/categories');
          const cat = await CategoriesRepo.getById(data.categoryId);
          if (cat) data.categoryName = cat.name;
        }
        if (data.supplierId) {
          const SuppliersRepo = require('../database/repositories/suppliers');
          const supp = await SuppliersRepo.getById(data.supplierId);
          if (supp) data.supplierName = supp.name;
        }
        return await ApprovalService.createRequest('CREATE_ITEM', data);
      }
    }
    return await this._executeCreate(data);
  },

  async _executeCreate(data) {
    if (!data.name) throw new Error('Item name is required');
    
    // Check if the code already exists (common in approval race conditions)
    // We use a loop to be 100% sure we get a unique code
    let attempts = 0;
    while (data.itemCode && await ItemsRepo.checkCodeExists(data.itemCode) && attempts < 10) {
      const oldCode = data.itemCode;
      data.itemCode = await ItemsRepo.getNextCode();
      console.warn(`[InventoryService] Item code collision: "${oldCode}" already exists. Using new code: "${data.itemCode}"`);
      attempts++;
    }
    
    if (!data.itemCode) {
      data.itemCode = await ItemsRepo.getNextCode();
    }

    const id = await ItemsRepo.create(data);
    
    // Create opening stock transaction if applicable
    if (data.openingStock && Number(data.openingStock) > 0) {
      try {
        await StockTransactionsRepo.create({
          itemId: id, 
          type: 'IN', 
          quantity: Number(data.openingStock), 
          stockBefore: 0,
          stockAfter: Number(data.openingStock), 
          reference: 'Opening Stock', 
          notes: 'Initial stock entry',
          createdBy: AuthService.getCurrentUser()?.id,
        });
      } catch (err) {
        console.error(`[InventoryService] Failed to create opening stock transaction for item ${id}:`, err.message);
        // We don't throw here to avoid failing the whole item creation, 
        // but it's a critical missing track.
      }
      
      try {
        const whId = SettingsRepo.get('default_warehouse_id') || 1;
        await WarehousesRepo.setStock(whId, id, Number(data.openingStock));
      } catch (err) {
        console.error(`[InventoryService] Failed to set warehouse stock for item ${id}:`, err.message);
      }
    }
    AuditLogsRepo.create({ userId: AuthService.getCurrentUser()?.id, action: 'CREATE', entityType: 'item', entityId: id, newValue: data });
    return { success: true, id };
  },

  async update(id, data) {
    const user = AuthService.getCurrentUser();
    const isAdmin = user?.roleName === 'Admin' || user?.roleName === 'Super Admin';
    if (!isAdmin) {
      const requireApproval = SettingsRepo.get('require_inventory_approval') === 'true';
      if (requireApproval) {
        const ApprovalService = require('./approval-service');
        const existing = await ItemsRepo.getById(id);
        
        // Enrich data for better approval UI
        if (data.categoryId) {
          const CategoriesRepo = require('../database/repositories/categories');
          const cat = await CategoriesRepo.getById(data.categoryId);
          if (cat) data.categoryName = cat.name;
        }
        if (data.supplierId) {
          const SuppliersRepo = require('../database/repositories/suppliers');
          const supp = await SuppliersRepo.getById(data.supplierId);
          if (supp) data.supplierName = supp.name;
        }
        
        return await ApprovalService.createRequest('UPDATE_ITEM', { id, data, oldData: existing });
      }
    }
    return await this._executeUpdate(id, data);
  },

  async _executeUpdate(id, data) {
    const existing = await ItemsRepo.getById(id);
    if (!existing) throw new Error('Item not found');
    if (!data.name) throw new Error('Item name is required');
    await ItemsRepo.update(id, data);
    AuditLogsRepo.create({ userId: AuthService.getCurrentUser()?.id, action: 'UPDATE', entityType: 'item', entityId: id, oldValue: { name: existing.name }, newValue: data });
    return { success: true };
  },

  async delete(id) {
    const existing = await ItemsRepo.getById(id);
    if (!existing) throw new Error('Item not found');
    await ItemsRepo.delete(id);
    AuditLogsRepo.create({ userId: AuthService.getCurrentUser()?.id, action: 'DELETE', entityType: 'item', entityId: id });
    return { success: true };
  },

  async addStockMovement(data) {
    const user = AuthService.getCurrentUser();
    const isAdmin = user?.roleName === 'Admin' || user?.roleName === 'Super Admin';
    if (!isAdmin) {
      const requireApproval = SettingsRepo.get('require_inventory_approval') === 'true';
      if (requireApproval) {
        const ApprovalService = require('./approval-service');
        return await ApprovalService.createRequest('STOCK_MOVEMENT', data);
      }
    }
    return await this._executeStockMovement(data);
  },

  async _executeStockMovement({ itemId, type, quantity, reference, notes, warehouseId }) {
    const item = await ItemsRepo.getById(itemId);
    if (!item) throw new Error('Item not found');
    if (quantity <= 0) throw new Error('Quantity must be greater than 0');

    const stockBefore = item.current_stock;
    let stockAfter;
    if (type === 'IN') { stockAfter = stockBefore + quantity; }
    else if (type === 'OUT') {
      stockAfter = stockBefore - quantity;
      if (stockAfter < 0) {
        throw new Error(`Insufficient stock. Available: ${stockBefore}, Requested: ${quantity}`);
      }
    } else if (type === 'ADJUSTMENT') { stockAfter = quantity; }
    else throw new Error('Invalid transaction type');

    await ItemsRepo.updateStock(itemId, stockAfter);
    
    // Sync with warehouse
    const whId = warehouseId || SettingsRepo.get('default_warehouse_id') || 1;
    let whDelta = 0;
    if (type === 'IN') whDelta = quantity;
    else if (type === 'OUT') whDelta = -quantity;
    else if (type === 'ADJUSTMENT') {
       // Find current warehouse stock to calculate delta
       const whStocks = await WarehousesRepo.getStockByItem(itemId);
       const currentWhStock = whStocks.find(w => w.warehouse_id === Number(whId))?.quantity || 0;
       whDelta = quantity - currentWhStock;
    }
    
    try {
      await WarehousesRepo.adjustStock(whId, itemId, whDelta);
    } catch (e) {
      console.error('[InventoryService] Failed to sync warehouse stock:', e);
    }
    
    const txnId = await StockTransactionsRepo.create({
      itemId, type, quantity, stockBefore, stockAfter, reference, notes,
      createdBy: AuthService.getCurrentUser()?.id,
    });
    return { success: true, stockAfter, transactionId: txnId };
  },

  async getTransactions(filters) { return await StockTransactionsRepo.getAll(filters); },
};
module.exports = InventoryService;
