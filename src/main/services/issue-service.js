const IssuesRepo = require('../database/repositories/issues');
const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const ItemPriceTiersRepo = require('../database/repositories/item-price-tiers');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const SettingsRepo = require('../database/repositories/settings');
const AuthService = require('./auth-service');

const IssueService = {
  async getAll(filters) { return await IssuesRepo.getAll(filters); },
  async getById(id) { return await IssuesRepo.getById(id); },
  async getOutstandingItems(issueId) { return await IssuesRepo.getOutstandingItems(issueId); },

  async getNextId() {
    const prefix = SettingsRepo.get('issue_prefix') || 'ISS';
    return await IssuesRepo.getNextIssueId(prefix);
  },

  async create(data) {
    if (!data.recipientId) throw new Error('Recipient is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    const user = AuthService.getCurrentUser();
    const isAdmin = user?.roleName === 'Admin' || user?.roleName === 'Super Admin' || user?.role_name === 'Admin' || user?.role_name === 'Super Admin';
    const requireApproval = (await SettingsRepo.get('require_issue_approval')) === 'true';

    if (!isAdmin && requireApproval) {
      // 1. Pre-validate stock availability so an invalid issue cannot be queued
      for (const item of data.items) {
        const dbItem = await ItemsRepo.getById(item.itemId);
        if (!dbItem) throw new Error(`Item not found: ${item.itemId}`);
        if (dbItem.current_stock < item.quantity) {
          throw new Error(`Insufficient stock for "${dbItem.name}". Available: ${dbItem.current_stock}, Requested: ${item.quantity}`);
        }
      }

      // 2. Enrich item details for clear approval review display
      for (const item of data.items) {
        if (!item.name || !item.itemCode) {
          const dbItem = await ItemsRepo.getById(item.itemId);
          if (dbItem) {
            item.name = item.name || dbItem.name;
            item.itemCode = item.itemCode || dbItem.item_code;
            item.unit = item.unit || dbItem.unit;
            item.currentStock = item.currentStock ?? dbItem.current_stock;
            item.buyerName = item.buyerName || dbItem.buyer_name;
            item.styleNo = item.styleNo || dbItem.style_name;
            item.orderNumber = item.orderNumber || dbItem.order_number;
          }
        }
      }

      // 3. Enrich produced items if any
      const enrichedProducedProducts = [];
      const prodIds = Array.isArray(data.producedItemIds) && data.producedItemIds.length > 0
        ? data.producedItemIds
        : (data.producedItemId ? [data.producedItemId] : []);
      if (prodIds.length > 0) {
        for (const pid of prodIds) {
          const prod = await ItemsRepo.getById(pid);
          if (prod) {
            enrichedProducedProducts.push({
              id: prod.id,
              name: prod.name,
              itemCode: prod.item_code,
              unit: prod.unit,
              styleName: prod.style_name,
              buyerName: prod.buyer_name,
              color: prod.color,
              size: prod.size,
              orderNumber: prod.order_number,
              purchaseNo: prod.purchase_no,
              orderQuantity: prod.order_quantity,
            });
          }
        }
      }

      const ApprovalService = require('./approval-service');
      return await ApprovalService.createRequest('CREATE_ISSUE', {
        ...data,
        producedProducts: enrichedProducedProducts,
        createdBy: user?.id,
        requesterName: user?.fullName || user?.full_name,
      });
    }

    return await this._executeCreate(data);
  },

  async _executeCreate(data) {
    if (!data.recipientId) throw new Error('Recipient is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    // 1. Validate initial stock availability and prepare stock changes
    const stockChanges = [];
    for (const item of data.items) {
      const dbItem = await ItemsRepo.getById(item.itemId);
      if (!dbItem) throw new Error(`Item not found: ${item.itemId}`);
      
      const stockBefore = dbItem.current_stock;
      const stockAfter = stockBefore - item.quantity;
      
      if (stockAfter < 0) {
        throw new Error(`Insufficient stock for "${dbItem.name}". Available: ${stockBefore}, Requested: ${item.quantity}`);
      }
      
      stockChanges.push({
        item,
        dbItem,
        stockBefore,
        stockAfter
      });
    }

    // 2. Deduct stock BEFORE doing the slow issue creation to prevent concurrent race conditions
    const completedDeductions = [];
    try {
      for (const change of stockChanges) {
        // Fetch freshest stock right before updating to catch any concurrent updates
        const freshItem = await ItemsRepo.getById(change.item.itemId);
        if (freshItem.current_stock < change.item.quantity) {
          throw new Error(`Insufficient stock for "${freshItem.name}". Available: ${freshItem.current_stock}, Requested: ${change.item.quantity}`);
        }
        
        const freshStockBefore = freshItem.current_stock;
        const freshStockAfter = freshStockBefore - change.item.quantity;
        
        await ItemsRepo.updateStock(change.item.itemId, freshStockAfter);
        await ItemPriceTiersRepo.deductStockFIFO(change.item.itemId, change.item.quantity);
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

    const user = AuthService.getCurrentUser();
    const issueId = await this.getNextId();
    let id;

    try {
      id = await IssuesRepo.create({
        issueId,
        issueType: data.issueType || 'FACTORY',
        recipientId: data.recipientId,
        recipientName: data.recipientName,
        issueDate: data.issueDate || new Date().toISOString(),
        expectedReturnDate: data.expectedReturnDate,
        remarks: data.remarks,
        createdBy: data.createdBy || user?.id,
        items: data.items,
        isReturnable: data.isReturnable,
        producedItemId: data.producedItemId,
        producedItemIds: data.producedItemIds,
      });
    } catch (err) {
      // Rollback all stock updates if issue creation fails
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
        reference: `Issue: ${issueId}`,
        notes: `Issued to ${data.recipientName} (${data.issueType})`,
        createdBy: data.createdBy || user?.id,
      });
    }

    AuditLogsRepo.create({
      userId: user?.id, action: 'CREATE', entityType: 'issue', entityId: id,
      newValue: { issueId, recipientName: data.recipientName, issueType: data.issueType, itemCount: data.items.length },
    });

    return { success: true, id, issueId };
  },

  async addItems(data) {
    if (!data.issueId) throw new Error('Issue ID is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    const issue = await IssuesRepo.getById(data.issueId);
    if (!issue) throw new Error('Issue not found');

    const user = AuthService.getCurrentUser();
    const isAdmin = user?.roleName === 'Admin' || user?.roleName === 'Super Admin' || user?.role_name === 'Admin' || user?.role_name === 'Super Admin';
    const settingVal = await SettingsRepo.get('require_reissue_approval');
    const requireApproval = settingVal !== 'false';

    if (!isAdmin && requireApproval) {
      // 1. Pre-validate stock availability so an invalid reissue cannot be queued
      for (const item of data.items) {
        const itemId = item.itemId || item.id;
        const dbItem = await ItemsRepo.getById(itemId);
        if (!dbItem) throw new Error(`Item not found: ${itemId}`);
        const qty = Number(item.quantity);
        if (dbItem.current_stock < qty) {
          throw new Error(`Insufficient stock for "${dbItem.name}". Available: ${dbItem.current_stock}, Requested: ${qty}`);
        }
      }

      // 2. Fully enrich item details for clear approval review display
      const enrichedItems = [];
      for (const item of data.items) {
        const itemId = item.itemId || item.id;
        const dbItem = await ItemsRepo.getById(itemId);
        enrichedItems.push({
          itemId: itemId,
          name: item.name || dbItem?.name || 'Unknown Item',
          itemCode: item.itemCode || dbItem?.item_code || '',
          unit: item.unit || dbItem?.unit || 'Pcs',
          currentStock: dbItem ? dbItem.current_stock : (item.currentStock ?? 0),
          quantity: Number(item.quantity),
          notes: item.notes || '',
          buyerName: item.buyerName || dbItem?.buyer_name || '',
          color: item.color || dbItem?.color || '',
          size: item.size || dbItem?.size || '',
          styleNo: item.styleNo || dbItem?.style_name || '',
          orderNumber: item.orderNumber || dbItem?.order_number || '',
          purchaseNo: item.purchaseNo || dbItem?.purchase_no || '',
        });
      }

      // 3. Enrich produced products from the parent issue if present
      const enrichedProducedProducts = [];
      const prodItems = (issue.produced_items && issue.produced_items.length > 0)
        ? issue.produced_items
        : (issue.produced_item ? [issue.produced_item] : []);
      if (prodItems.length > 0) {
        for (const p of prodItems) {
          enrichedProducedProducts.push({
            id: p.id,
            name: p.name,
            itemCode: p.item_code || p.itemCode,
            unit: p.unit,
            styleName: p.style_name || p.styleName,
            buyerName: p.buyer_name || p.buyerName,
            color: p.color,
            size: p.size,
            orderNumber: p.order_number || p.orderNumber,
            purchaseNo: p.purchase_no || p.purchaseNo,
            orderQuantity: p.order_quantity ?? p.orderQuantity,
          });
        }
      }

      const ApprovalService = require('./approval-service');
      return await ApprovalService.createRequest('REISSUE_ITEM', {
        issueId: issue.id,
        issueNumber: issue.issue_id,
        recipientName: issue.recipient_name,
        issueType: issue.issue_type,
        issueDate: issue.issue_date,
        items: enrichedItems,
        producedProducts: enrichedProducedProducts,
        remarks: data.remarks || '',
        createdBy: user?.id,
        requesterName: user?.fullName || user?.full_name,
      });
    }

    return await this._executeAddItems(data);
  },

  async _executeAddItems(data) {
    if (!data.issueId) throw new Error('Issue ID is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    const issue = await IssuesRepo.getById(data.issueId);
    if (!issue) throw new Error('Issue not found');

    const user = AuthService.getCurrentUser();
    const createdBy = data.createdBy || user?.id;

    // 1. Validate initial stock availability and prepare stock changes
    const stockChanges = [];
    for (const item of data.items) {
      const itemId = item.itemId || item.id;
      const dbItem = await ItemsRepo.getById(itemId);
      if (!dbItem) throw new Error(`Item not found: ${itemId}`);
      
      const qty = Number(item.quantity);
      const stockBefore = dbItem.current_stock;
      const stockAfter = stockBefore - qty;
      
      if (stockAfter < 0) {
        throw new Error(`Insufficient stock for "${dbItem.name}". Available: ${stockBefore}, Requested: ${qty}`);
      }
      
      stockChanges.push({ 
        item: { ...item, itemId, quantity: qty }, 
        dbItem, 
        stockBefore, 
        stockAfter 
      });
    }

    // 2. Deduct stock BEFORE saving issue items
    const completedDeductions = [];
    try {
      for (const change of stockChanges) {
        const freshItem = await ItemsRepo.getById(change.item.itemId);
        if (freshItem.current_stock < change.item.quantity) {
          throw new Error(`Insufficient stock for "${freshItem.name}". Available: ${freshItem.current_stock}, Requested: ${change.item.quantity}`);
        }
        
        const freshStockBefore = freshItem.current_stock;
        const freshStockAfter = freshStockBefore - change.item.quantity;
        
        await ItemsRepo.updateStock(change.item.itemId, freshStockAfter);
        await ItemPriceTiersRepo.deductStockFIFO(change.item.itemId, change.item.quantity);
        completedDeductions.push({ itemId: change.item.itemId, quantity: change.item.quantity, stockBefore: freshStockBefore, stockAfter: freshStockAfter });
      }
    } catch (err) {
      for (const deduction of completedDeductions) {
        await ItemsRepo.updateStock(deduction.itemId, deduction.stockBefore);
      }
      throw err;
    }

    try {
      const normalizedItems = data.items.map(it => ({
        itemId: it.itemId || it.id,
        quantity: Number(it.quantity),
        unit: it.unit || 'pcs',
        styleNo: it.styleNo || it.style_name || null,
        orderNumber: it.orderNumber || it.order_number || null,
        purchaseNo: it.purchaseNo || it.purchase_no || null,
        notes: it.notes || null,
      }));
      await IssuesRepo.addItemsToIssue(issue.id, normalizedItems);
    } catch (err) {
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
        reference: `Issue: ${issue.issue_id}`,
        notes: `Re-issued to ${issue.recipient_name} (${issue.issue_type})`,
        createdBy,
      });
    }

    AuditLogsRepo.create({
      userId: user?.id || createdBy, action: 'UPDATE', entityType: 'issue', entityId: issue.id,
      newValue: { issueId: issue.issue_id, addedItemsCount: data.items.length },
    });

    // Update issue status if it was RETURNED but now has more items, it should become PENDING or PARTIAL
    await IssuesRepo.updateStatus(issue.id);

    return { success: true, id: issue.id, issueId: issue.issue_id };
  },

  // Reports
  async issueReport(filters) { return await IssuesRepo.getIssueReport(filters); },
  async returnReport(filters) { return await IssuesRepo.getReturnReport(filters); },
  async factoryProductionReport(filters) { return await IssuesRepo.getFactoryProductionReport(filters); },
  async employeeOutstandingReport(filters) { return await IssuesRepo.getEmployeeOutstandingReport(filters); },
  async issueReturnSummary(filters) { return await IssuesRepo.getIssueReturnSummary(filters); },

  // Dashboard
  async getIssueStats() {
    const [pendingReturns, overdueReturns, totalDamaged] = await Promise.all([
      IssuesRepo.getPendingReturnsCount(),
      IssuesRepo.getOverdueReturnsCount(),
      IssuesRepo.getTotalDamaged(),
    ]);
    return { pendingReturns, overdueReturns, totalDamaged };
  },

  // Delete issue (Super Admin or Admin) — reverses outstanding stock, preserves item data
  async deleteIssue(id) {
    const user = AuthService.getCurrentUser();
    const canDelete = ['Super Admin', 'Admin'].includes(user?.role_name) || ['Super Admin', 'Admin'].includes(user?.roleName);
    if (!canDelete) throw new Error('Only Admin or Super Admin can delete issues');

    const issue = await IssuesRepo.getById(id);
    if (!issue) throw new Error('Issue not found');

    // Reverse outstanding stock: add back (issued - returned) for each item
    for (const item of (issue.items || [])) {
      const outstanding = item.quantity - (item.returned_quantity || 0);
      if (outstanding > 0) {
        const dbItem = await ItemsRepo.getById(item.item_id);
        if (dbItem) {
          const stockBefore = dbItem.current_stock;
          const stockAfter = stockBefore + outstanding;
          await ItemsRepo.updateStock(item.item_id, stockAfter);
          await ItemPriceTiersRepo.addStockTier(item.item_id, outstanding, dbItem.unit_price, dbItem.currency, dbItem.conversion_rate);
          await StockTransactionsRepo.create({
            itemId: item.item_id, type: 'IN', quantity: outstanding,
            stockBefore, stockAfter,
            reference: `Issue Deleted: ${issue.issue_id}`,
            notes: `Stock reversed on issue deletion by ${user.full_name}`,
            createdBy: user.id,
          });
        }
      }
    }

    await IssuesRepo.deleteIssue(id);

    AuditLogsRepo.create({
      userId: user.id, action: 'DELETE', entityType: 'issue', entityId: id,
      newValue: { issueId: issue.issue_id, recipientName: issue.recipient_name },
    });

    return { success: true };
  },
};

module.exports = IssueService;
