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
  async getByNumber(number) { return await ChallansRepo.getByNumber(number); },

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

    // 1. Validate initial stock availability and prepare stock changes
    const stockChanges = [];
    for (const item of data.items) {
      const dbItem = await ItemsRepo.getById(item.itemId);
      if (!dbItem) throw new Error(`Item not found: ${item.itemId}`);
      
      const stockBefore = dbItem.current_stock;
      const stockAfter = stockBefore - item.quantity;
      
      if (stockAfter < 0) {
        throw new Error(`Insufficient stock for "${dbItem.name}". Available: ${stockBefore}`);
      }
      
      stockChanges.push({
        item,
        dbItem,
        stockBefore,
        stockAfter
      });
    }

    // 2. Deduct stock BEFORE doing the slow challan creation to prevent concurrent race conditions
    const completedDeductions = [];
    try {
      for (const change of stockChanges) {
        // Fetch freshest stock right before updating to catch any concurrent updates
        const freshItem = await ItemsRepo.getById(change.item.itemId);
        if (freshItem.current_stock < change.item.quantity) {
          throw new Error(`Insufficient stock for "${freshItem.name}". Available: ${freshItem.current_stock}`);
        }
        
        const freshStockBefore = freshItem.current_stock;
        const freshStockAfter = freshStockBefore - change.item.quantity;
        
        await ItemsRepo.updateStock(change.item.itemId, freshStockAfter);
        completedDeductions.push({
          itemId: change.item.itemId,
          quantity: change.item.quantity,
          stockBefore: freshStockBefore,
          stockAfter: freshStockAfter
        });
      }
    } catch (err) {
      // Rollback any stock that was already deducted in this loop
      for (const deduction of completedDeductions) {
        await ItemsRepo.updateStock(deduction.itemId, deduction.stockBefore);
      }
      throw err;
    }

    const user = await AuthService.getCurrentUser();
    const prefix = await SettingsRepo.get('challan_prefix') || 'KA';
    
    let challanId;
    let challanNumber;
    let attempts = 0;
    
    try {
      while (attempts < 5) {
        challanNumber = await ChallansRepo.getNextNumber(prefix);
        try {
          challanId = await ChallansRepo.create({
            ...data, challanNumber,
            challanDate: data.challanDate || new Date().toISOString(),
            createdBy: user?.id,
          });
          break; // Success
        } catch (err) {
          if (err.message.includes('already exists') && attempts < 4) {
            attempts++;
            console.warn(`[ChallanService] Challan number collision: "${challanNumber}" taken. Retrying (${attempts}/5)...`);
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      // Rollback all stock updates if challan creation completely fails
      for (const deduction of completedDeductions) {
        await ItemsRepo.updateStock(deduction.itemId, deduction.stockBefore);
      }
      throw err;
    }

    // 3. Create stock transactions
    for (const deduction of completedDeductions) {
      await StockTransactionsRepo.create({
        itemId: deduction.itemId, type: 'OUT', quantity: deduction.quantity,
        stockBefore: deduction.stockBefore, stockAfter: deduction.stockAfter,
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
    
    // IMPORTANT: Check if the update actually happened to prevent double-reversal race conditions
    const result = await ChallansRepo.cancel(id, user?.id, reason);
    const affectedRows = result?.changes !== undefined ? result.changes : (result === true ? 1 : 0);
    
    if (affectedRows === 0 && !isCloudEnabled()) {
      throw new Error('Challan already cancelled or not active');
    }

    // Reverse stock using atomic adjustment
    for (const item of challan.items) {
      const dbItem = await ItemsRepo.getById(item.item_id);
      if (!dbItem) continue;
      
      const stockBefore = dbItem.current_stock;
      await ItemsRepo.adjustStock(item.item_id, item.quantity);
      
      // Update transaction log with accurate "after" value
      const stockAfter = stockBefore + item.quantity;
      await StockTransactionsRepo.create({
        itemId: item.item_id, type: 'IN', quantity: item.quantity, stockBefore, stockAfter,
        challanId: id, reference: `Challan Cancelled: ${challan.challan_number}`,
        notes: `Stock reversed. Reason: ${reason}`, createdBy: user?.id,
      });
    }

    await AuditLogsRepo.create({ userId: user?.id, action: 'CANCEL', entityType: 'challan', entityId: id, oldValue: { status: 'ACTIVE' }, newValue: { status: 'CANCELLED', reason } });
    return { success: true };
  },

  async delete(id) {
    const challan = await ChallansRepo.getById(id);
    if (!challan) throw new Error('Challan not found');

    const user = await AuthService.getCurrentUser();

    // Reverse stock only if it was ACTIVE
    if (challan.status === 'ACTIVE') {
      for (const item of challan.items) {
        const dbItem = await ItemsRepo.getById(item.item_id);
        if (dbItem) {
          const stockBefore = dbItem.current_stock;
          await ItemsRepo.adjustStock(item.item_id, item.quantity);
          const stockAfter = stockBefore + item.quantity;
          
          await StockTransactionsRepo.create({
            itemId: item.item_id, type: 'IN', quantity: item.quantity, stockBefore, stockAfter,
            reference: `Challan Deleted: ${challan.challan_number}`,
            notes: `Stock reversed due to permanent deletion.`, createdBy: user?.id,
          });
        }
      }
    }

    await ChallansRepo.delete(id);
    await AuditLogsRepo.create({ userId: user?.id, action: 'DELETE', entityType: 'challan', entityId: id, oldValue: { challanNumber: challan.challan_number } });
    return { success: true };
  },

};
module.exports = ChallanService;
