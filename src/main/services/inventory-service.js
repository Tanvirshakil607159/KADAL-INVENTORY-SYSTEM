const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const ItemPriceTiersRepo = require('../database/repositories/item-price-tiers');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const SettingsRepo = require('../database/repositories/settings');
const AuthService = require('./auth-service');
const WarehousesRepo = require('../database/repositories/warehouses');
const { dbTransaction } = require('../database/connection');

// In-memory mutex per item to serialize stock movements on the same item and eliminate race conditions
const itemMovementLocks = new Map();
async function withItemLock(itemId, fn) {
  const parsedId = Number(itemId);
  const prevPromise = itemMovementLocks.get(parsedId) || Promise.resolve();
  let release;
  const lockPromise = new Promise(resolve => { release = resolve; });
  itemMovementLocks.set(parsedId, prevPromise.then(() => lockPromise).catch(() => lockPromise));
  try {
    await prevPromise;
    return await fn();
  } finally {
    release();
    if (itemMovementLocks.get(parsedId) === lockPromise) {
      itemMovementLocks.delete(parsedId);
    }
  }
}

const InventoryService = {
  async getAll(filters) { return await ItemsRepo.getAll(filters); },
  async getById(id) { return await ItemsRepo.getById(id); },
  async search(query) { return await ItemsRepo.search(query); },
  async updateTier(tierId, data) { return await ItemPriceTiersRepo.updateTier(tierId, data); },

  async create(data) {
    const user = AuthService.getCurrentUser();
    
    // intercept Merchandiser item creation
    if (user?.roleName === 'Merchandiser') {
       const ApprovalService = require('./approval-service');
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
       // Don't save code, generate upon approval
       delete data.itemCode;
       
       if (data.sourceType === 'PRODUCTION') {
         // Factory production items go straight to Admin approval
         return await ApprovalService.createRequest('CREATE_ITEM', data);
       } else {
         // Source/Import items go to Pending Items for Inventory user to add Opening Stock
         return await ApprovalService.createRequest('PENDING_ITEM', data);
       }
    }

    // Check if the code already exists (or is pending approval)
    // We automatically resolve collisions instead of throwing an error to handle multiple users working at once
    let attempts = 0;
    while (data.itemCode && await ItemsRepo.checkCodeExists(data.itemCode) && attempts < 10) {
      const oldCode = data.itemCode;
      data.itemCode = await ItemsRepo.getNextCode();
      console.warn(`[InventoryService] Initial code collision: "${oldCode}" taken. Automatically using: "${data.itemCode}"`);
      attempts++;
    }
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

  async _executeCreate(data, options = {}) {
    if (!data.name) throw new Error('Item name is required');
    
    // Check if the code already exists (common in approval race conditions)
    // We use a loop to be 100% sure we get a unique code
    let attempts = 0;
    while (data.itemCode && await ItemsRepo.checkCodeExists(data.itemCode, null, { excludeApprovalId: options.excludeApprovalId, checkPending: false }) && attempts < 10) {
      const oldCode = data.itemCode;
      data.itemCode = await ItemsRepo.getNextCode(options.excludeApprovalId);
      console.warn(`[InventoryService] Item code collision: "${oldCode}" already exists. Using new code: "${data.itemCode}"`);
      attempts++;
    }
    
    if (!data.itemCode) {
      data.itemCode = await ItemsRepo.getNextCode(options.excludeApprovalId);
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
        const item = await ItemsRepo.getById(data.itemId);
        const enrichedData = {
          ...data,
          itemName: data.itemName || item?.name,
          itemCode: data.itemCode || item?.item_code,
          orderNumber: data.orderNumber || item?.order_number,
          color: data.color || item?.color,
          size: data.size || item?.size,
          orderQuantity: data.orderQuantity ?? item?.order_quantity,
          currentStock: data.currentStock ?? item?.current_stock,
          unit: data.unit || item?.unit,
        };
        return await ApprovalService.createRequest('STOCK_MOVEMENT', enrichedData);
      }
    }
    return await this._executeStockMovement(data);
  },

  async _executeStockMovement({ itemId, type, quantity, reference, notes, warehouseId, unitPrice, currency, conversionRate }) {
    return await withItemLock(itemId, async () => {
      const user = AuthService.getCurrentUser();
      const numQty = Number(quantity);
      if (!numQty || numQty <= 0) throw new Error('Quantity must be greater than 0');

      // 1. Rapid duplicate / double-click prevention BEFORE mutating any stock or tiers
      const FourSecsAgo = new Date(Date.now() - 4000).toISOString();
      try {
        const recentTxns = await StockTransactionsRepo.getAll({
          itemId,
          type,
          dateFrom: FourSecsAgo
        });
        const duplicate = (recentTxns || []).find(t => 
          Number(t.quantity) === numQty &&
          (t.reference || null) === (reference || null) &&
          (!user?.id || t.created_by === user.id)
        );
        if (duplicate) {
          console.warn(`[InventoryService] Rapid duplicate stock movement prevented for item ${itemId} (matched tx #${duplicate.id})`);
          const currentItem = await ItemsRepo.getById(itemId);
          return { success: true, stockAfter: currentItem.current_stock, transactionId: duplicate.id, duplicatePrevented: true };
        }
      } catch (checkErr) {
        console.warn('[InventoryService] Warning checking recent txns:', checkErr.message);
      }

      const item = await ItemsRepo.getById(itemId);
      if (!item) throw new Error('Item not found');

      const stockBefore = Number(item.current_stock) || 0;
      let stockAfter;
      const restockPrice = unitPrice !== undefined && unitPrice !== null && unitPrice !== '' ? Number(unitPrice) : Number(item.unit_price || 0);
      const curr = currency || item.currency || 'BDT';
      const convRate = conversionRate !== undefined ? conversionRate : item.conversion_rate;

      if (type === 'IN') { 
        stockAfter = stockBefore + numQty; 
        await ItemPriceTiersRepo.addStockTier(itemId, numQty, restockPrice, curr, convRate);
      }
      else if (type === 'OUT') {
        stockAfter = stockBefore - numQty;
        if (stockAfter < 0) {
          throw new Error(`Insufficient stock. Available: ${stockBefore}, Requested: ${numQty}`);
        }
        await ItemPriceTiersRepo.deductStockFIFO(itemId, numQty);
      } else if (type === 'ADJUSTMENT') { 
        stockAfter = numQty; 
        await ItemPriceTiersRepo.adjustStock(itemId, numQty, item.unit_price, item.currency);
      }
      else throw new Error('Invalid transaction type');

      // 2. Active price tier alignment: if active price tiers exist, guarantee stock matches tier sum
      try {
        const activeTiers = await ItemPriceTiersRepo.getActiveByItem(itemId);
        if (activeTiers && activeTiers.length > 0) {
          const tierSum = activeTiers.reduce((acc, t) => acc + Number(t.quantity || 0), 0);
          if (Math.abs(tierSum - stockAfter) > 0.001) {
            console.warn(`[InventoryService] Synchronizing stockAfter (${stockAfter}) with price tier sum (${tierSum}) for item ${itemId}`);
            stockAfter = tierSum;
          }
        }
      } catch (tierSyncErr) {
        console.warn('[InventoryService] Warning syncing tier total:', tierSyncErr.message);
      }

      await ItemsRepo.updateStock(itemId, stockAfter);
      if (type === 'IN' && curr === 'USD' && convRate !== null && convRate !== undefined) {
        try {
          await ItemsRepo.updateConversionRate(itemId, convRate);
        } catch (e) {
          console.warn('[InventoryService] Failed to update item conversion rate:', e.message);
        }
      }
      
      // Sync with warehouse
      const whId = warehouseId || SettingsRepo.get('default_warehouse_id') || 1;
      let whDelta = 0;
      if (type === 'IN') whDelta = numQty;
      else if (type === 'OUT') whDelta = -numQty;
      else if (type === 'ADJUSTMENT') {
         const whStocks = await WarehousesRepo.getStockByItem(itemId);
         const currentWhStock = whStocks.find(w => w.warehouse_id === Number(whId))?.quantity || 0;
         whDelta = numQty - currentWhStock;
      }
      
      try {
        await WarehousesRepo.adjustStock(whId, itemId, whDelta);
      } catch (e) {
        console.error('[InventoryService] Failed to sync warehouse stock:', e);
      }
      
      const txnId = await StockTransactionsRepo.create({
        itemId, type, quantity: numQty, stockBefore, stockAfter, reference, notes,
        unitPrice: type === 'IN' ? restockPrice : item.unit_price,
        currency: curr,
        conversionRate: convRate,
        createdBy: user?.id,
      });
      return { success: true, stockAfter, transactionId: txnId };
    });
  },

  async reconcileItemStock(itemId) {
    const parsedId = Number(itemId);
    if (!parsedId) return { success: false, error: 'Invalid item ID' };
    const item = await ItemsRepo.getById(parsedId);
    if (!item) return { success: false, error: 'Item not found' };

    const activeTiers = await ItemPriceTiersRepo.getActiveByItem(parsedId);
    if (activeTiers && activeTiers.length > 0) {
      const tierSum = activeTiers.reduce((acc, t) => acc + Number(t.quantity || 0), 0);
      if (Math.abs(tierSum - Number(item.current_stock)) > 0.001) {
        await ItemsRepo.updateStock(parsedId, tierSum);
        return { success: true, reconciled: true, oldStock: item.current_stock, newStock: tierSum };
      }
    }
    return { success: true, reconciled: false, currentStock: item.current_stock };
  },

  async getTransactions(filters) { return await StockTransactionsRepo.getAll(filters); },
};
module.exports = InventoryService;
