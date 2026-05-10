const ChallansRepo = require('../database/repositories/challans');
const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const SettingsRepo = require('../database/repositories/settings');
const AuthService = require('./auth-service');

const ChallanService = {
  async getAll(filters) { 
    let challans = await ChallansRepo.getAll(filters); 
    if (filters && filters.excludeUsedInGatePass) {
      const GatePassRepo = require('../database/repositories/gate-passes');
      const usedIds = await GatePassRepo.getUsedChallanIds();
      challans = challans.filter(c => !usedIds.includes(c.id));
    }
    return challans;
  },
  async getById(id) { return await ChallansRepo.getById(id); },

  async getNextNumber() {
    const prefix = await SettingsRepo.get('challan_prefix') || 'KA';
    return await ChallansRepo.getNextNumber(prefix);
  },

  async getFieldSuggestions(field, query) {
    return await ChallansRepo.getFieldSuggestions(field, query);
  },

  async getTotalDelivered(itemId) {
    return await ChallansRepo.getTotalDelivered(itemId);
  },

  async create(data) {
    const user = await AuthService.getCurrentUser();
    if (user?.roleName !== 'Admin') {
      const ApprovalService = require('./approval-service');
      const requireAll = await SettingsRepo.get('require_challan_approval') === 'true';
      
      if (requireAll) {
        return await ApprovalService.createRequest('CREATE_CHALLAN', data);
      }

      let needsApproval = false;
      for (const item of data.items) {
        const dbItem = await ItemsRepo.getById(item.itemId);
        if (dbItem && dbItem.order_quantity > 0) {
          const totalDelivered = await ChallansRepo.getTotalDelivered(item.itemId);
          if ((totalDelivered + item.quantity) > dbItem.order_quantity) {
            needsApproval = true;
            break;
          }
        }
      }

      if (needsApproval) {
        return await ApprovalService.createRequest('CREATE_CHALLAN', data);
      }
    }
    return await this._executeCreate(data);
  },

  async _executeCreate(data) {
    if (!data.receiverName) throw new Error('Receiver name is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    // Validate stock
    for (const item of data.items) {
      const dbItem = await ItemsRepo.getById(item.itemId);
      if (!dbItem) throw new Error(`Item not found: ${item.itemId}`);
      if (dbItem.current_stock < item.quantity) {
        throw new Error(`Insufficient stock for "${dbItem.name}". Available: ${dbItem.current_stock}`);
      }
    }

    const user = await AuthService.getCurrentUser();
    const prefix = await SettingsRepo.get('challan_prefix') || 'KA';
    const challanNumber = await ChallansRepo.getNextNumber(prefix);

    const challanId = await ChallansRepo.create({
      ...data, challanNumber,
      challanDate: data.challanDate || new Date().toISOString(),
      createdBy: user?.id,
    });

    // Deduct stock
    for (const item of data.items) {
      const dbItem = await ItemsRepo.getById(item.itemId);
      const stockBefore = dbItem.current_stock;
      const stockAfter = stockBefore - item.quantity;
      await ItemsRepo.updateStock(item.itemId, stockAfter);
      await StockTransactionsRepo.create({
        itemId: item.itemId, type: 'OUT', quantity: item.quantity, stockBefore, stockAfter,
        challanId, reference: `Challan: ${challanNumber}`,
        notes: `Delivered to ${data.receiverName}`, createdBy: user?.id,
      });
    }

    await AuditLogsRepo.create({ userId: user?.id, action: 'CREATE', entityType: 'challan', entityId: challanId, newValue: { challanNumber, receiver: data.receiverName } });
    return { success: true, id: challanId, challanNumber };
  },

  async cancel(id, reason) {
    const challan = await ChallansRepo.getById(id);
    if (!challan) throw new Error('Challan not found');
    if (challan.status === 'CANCELLED') throw new Error('Already cancelled');

    const user = await AuthService.getCurrentUser();
    await ChallansRepo.cancel(id, user?.id, reason);

    // Reverse stock
    for (const item of challan.items) {
      const dbItem = await ItemsRepo.getById(item.item_id);
      const stockBefore = dbItem.current_stock;
      const stockAfter = stockBefore + item.quantity;
      await ItemsRepo.updateStock(item.item_id, stockAfter);
      await StockTransactionsRepo.create({
        itemId: item.item_id, type: 'IN', quantity: item.quantity, stockBefore, stockAfter,
        challanId: id, reference: `Challan Cancelled: ${challan.challan_number}`,
        notes: `Stock reversed. Reason: ${reason}`, createdBy: user?.id,
      });
    }

    await AuditLogsRepo.create({ userId: user?.id, action: 'CANCEL', entityType: 'challan', entityId: id, oldValue: { status: 'ACTIVE' }, newValue: { status: 'CANCELLED', reason } });
    return { success: true };
  },
};
module.exports = ChallanService;
