const WarehousesRepo = require('../database/repositories/warehouses');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const { dbTransaction } = require('../database/connection');

const WarehouseService = {
  async transferStock({ fromWarehouseId, toWarehouseId, itemId, quantity, notes }, user) {
    if (!fromWarehouseId || !toWarehouseId || !itemId || !quantity || quantity <= 0) {
      return { success: false, error: 'Invalid transfer details' };
    }
    if (fromWarehouseId === toWarehouseId) {
      return { success: false, error: 'Cannot transfer to the same warehouse' };
    }

    try {
      return await dbTransaction(async () => {
        // 1. Verify source stock
        const sourceStockList = await WarehousesRepo.getStockByItem(itemId);
        const sourceStockEntry = sourceStockList.find(s => s.warehouse_id === Number(fromWarehouseId));
        
        if (!sourceStockEntry || sourceStockEntry.quantity < quantity) {
          throw new Error('Insufficient stock in source warehouse');
        }

        // 2. Deduct from source
        await WarehousesRepo.adjustStock(fromWarehouseId, itemId, -quantity);

        // 3. Add to destination
        await WarehousesRepo.adjustStock(toWarehouseId, itemId, quantity);

        // 4. Log transaction
        const whFrom = await WarehousesRepo.getById(fromWarehouseId);
        const whTo = await WarehousesRepo.getById(toWarehouseId);

        await StockTransactionsRepo.create({
          itemId,
          type: 'TRANSFER',
          quantity,
          stockBefore: sourceStockEntry.quantity, // source stock before
          stockAfter: sourceStockEntry.quantity - quantity, // source stock after
          reference: `Transfer from ${whFrom.code} to ${whTo.code}`,
          createdBy: user.id
        });

        // 5. Audit Log
        await AuditLogsRepo.create({
          userId: user.id,
          action: 'TRANSFER_STOCK',
          entityType: 'WAREHOUSE',
          entityId: itemId,
          oldValue: JSON.stringify({ warehouse: fromWarehouseId, quantity }),
          newValue: JSON.stringify({ warehouse: toWarehouseId, quantity }),
          notes: notes || `Transferred ${quantity} from ${whFrom.name} to ${whTo.name}`
        });

        return { success: true };
      })();
    } catch (err) {
      console.error('[WarehouseService] Transfer failed:', err);
      return { success: false, error: err.message };
    }
  }
};

module.exports = WarehouseService;
