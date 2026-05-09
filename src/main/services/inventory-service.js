const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const SettingsRepo = require('../database/repositories/settings');
const AuthService = require('./auth-service');
const { dbTransaction } = require('../database/connection');

const InventoryService = {
  async getAll(filters) { return await ItemsRepo.getAll(filters); },
  async getById(id) { return await ItemsRepo.getById(id); },
  async search(query) { return await ItemsRepo.search(query); },

  async create(data) {
    if (AuthService.getCurrentUser()?.roleName !== 'Admin') {
      const requireApproval = SettingsRepo.get('require_inventory_approval') === 'true';
      if (requireApproval) {
        const ApprovalService = require('./approval-service');
        return await ApprovalService.createRequest('CREATE_ITEM', data);
      }
    }
    return await this._executeCreate(data);
  },

  async _executeCreate(data) {
    if (!data.itemCode || !data.name) throw new Error('Item code and name are required');
    if (await ItemsRepo.checkCodeExists(data.itemCode)) throw new Error(`Item code "${data.itemCode}" already exists`);

    const id = await ItemsRepo.create(data);
    if (data.openingStock && data.openingStock > 0) {
      await StockTransactionsRepo.create({
        itemId: id, type: 'IN', quantity: data.openingStock, stockBefore: 0,
        stockAfter: data.openingStock, reference: 'Opening Stock', notes: 'Initial stock entry',
        createdBy: AuthService.getCurrentUser()?.id,
      });
    }
    AuditLogsRepo.create({ userId: AuthService.getCurrentUser()?.id, action: 'CREATE', entityType: 'item', entityId: id, newValue: data });
    return { success: true, id };
  },

  async update(id, data) {
    if (AuthService.getCurrentUser()?.roleName !== 'Admin') {
      const requireApproval = SettingsRepo.get('require_inventory_approval') === 'true';
      if (requireApproval) {
        const ApprovalService = require('./approval-service');
        return await ApprovalService.createRequest('UPDATE_ITEM', { id, data });
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
    if (AuthService.getCurrentUser()?.roleName !== 'Admin') {
      const requireApproval = SettingsRepo.get('require_inventory_approval') === 'true';
      if (requireApproval) {
        const ApprovalService = require('./approval-service');
        return await ApprovalService.createRequest('STOCK_MOVEMENT', data);
      }
    }
    return await this._executeStockMovement(data);
  },

  async _executeStockMovement({ itemId, type, quantity, reference, notes }) {
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
    const txnId = await StockTransactionsRepo.create({
      itemId, type, quantity, stockBefore, stockAfter, reference, notes,
      createdBy: AuthService.getCurrentUser()?.id,
    });
    return { success: true, stockAfter, transactionId: txnId };
  },

  async getTransactions(filters) { return await StockTransactionsRepo.getAll(filters); },
};
module.exports = InventoryService;
