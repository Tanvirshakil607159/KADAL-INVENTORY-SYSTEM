const RequisitionsRepo = require('../database/repositories/requisitions');
const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const ItemPriceTiersRepo = require('../database/repositories/item-price-tiers');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const SettingsRepo = require('../database/repositories/settings');
const AuthService = require('./auth-service');

const RequisitionService = {
  async getAll(filters) { return await RequisitionsRepo.getAll(filters); },
  async getById(id) { return await RequisitionsRepo.getById(id); },

  async getNextNumber() {
    const prefix = SettingsRepo.get('requisition_prefix') || 'REQ';
    const next = await RequisitionsRepo.getNextNumber(prefix);
    // Requests waiting for approval already show a number; don't hand the same one out twice.
    let maxPending = 0;
    try {
      const ApprovalsRepo = require('../database/repositories/approvals');
      const pending = await ApprovalsRepo.getAll({ status: 'PENDING' });
      for (const a of (pending || [])) {
        if (a.type !== 'CREATE_REQUISITION') continue;
        const d = typeof a.data === 'string' ? JSON.parse(a.data) : (a.data || {});
        const no = d.requisitionNo || '';
        if (!no.startsWith(`${prefix}-`)) continue;
        const n = parseInt(no.split('-').pop(), 10);
        if (!isNaN(n) && n > maxPending) maxPending = n;
      }
    } catch (e) {
      console.warn('[RequisitionService] Could not check pending approvals for numbering:', e.message);
    }
    const nextSeq = parseInt(next.split('-').pop(), 10);
    if (!isNaN(nextSeq) && maxPending >= nextSeq) {
      return `${prefix}-${String(maxPending + 1).padStart(4, '0')}`;
    }
    return next;
  },

  async create(data) {
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    const user = AuthService.getCurrentUser();
    const requisitionNo = await this.getNextNumber();

    // Check if approval is required — if so, route to the approval queue instead of creating directly
    const requireApproval = SettingsRepo.get('require_requisition_approval') === 'true';
    if (requireApproval) {
      // Avoid circular dependency by requiring inside the method
      const ApprovalService = require('./approval-service');
      return await ApprovalService.createRequest('CREATE_REQUISITION', {
        ...data,
        requisitionNo,
        createdBy: user?.id,
      });
    }

    const id = await RequisitionsRepo.create({
      requisitionNo,
      recipientId: data.recipientId,
      requesterName: data.requesterName,
      department: data.department,
      purpose: data.purpose,
      notes: data.notes,
      requisitionDate: data.requisitionDate || new Date().toISOString(),
      createdBy: user?.id,
      items: data.items,
    });

    AuditLogsRepo.create({
      userId: user?.id, action: 'CREATE', entityType: 'requisition', entityId: id,
      newValue: { requisitionNo, requesterName: data.requesterName, department: data.department, itemCount: data.items.length },
    });

    return { success: true, id, requisitionNo };
  },

  // Internal create method called by ApprovalService when a CREATE_REQUISITION approval is approved
  async _executeCreate(data) {
    // The number shown while the request waited for approval is only provisional: another
    // requisition may have taken it in the meantime, so fall back to the next free number.
    let requisitionNo = data.requisitionNo || await this.getNextNumber();
    let id;
    for (let attempt = 0; ; attempt++) {
      try {
        id = await RequisitionsRepo.create({
          requisitionNo,
          recipientId: data.recipientId,
          requesterName: data.requesterName,
          department: data.department,
          purpose: data.purpose,
          notes: data.notes,
          requisitionDate: data.requisitionDate || new Date().toISOString(),
          createdBy: data.createdBy,
          items: data.items,
        });
        break;
      } catch (err) {
        const isDuplicateNo = /unique|duplicate/i.test(err.message || '') && /requisition_no|requisitions/i.test(err.message || '');
        if (!isDuplicateNo || attempt >= 4) throw err;
        requisitionNo = await this.getNextNumber();
      }
    }
    data = { ...data, requisitionNo };

    AuditLogsRepo.create({
      userId: data.createdBy, action: 'CREATE', entityType: 'requisition', entityId: id,
      newValue: { requisitionNo: data.requisitionNo, requesterName: data.requesterName, itemCount: data.items?.length },
    });

    return { success: true, id, requisitionNo: data.requisitionNo };
  },

  async approve(id, notes) {
    const req = await RequisitionsRepo.getById(id);
    if (!req) throw new Error('Requisition not found');
    if (!['PENDING'].includes(req.status)) throw new Error(`Cannot approve a requisition with status: ${req.status}`);

    const user = AuthService.getCurrentUser();
    await RequisitionsRepo.updateStatus(id, 'APPROVED', user?.fullName || user?.full_name || 'Admin');

    AuditLogsRepo.create({
      userId: user?.id, action: 'APPROVE', entityType: 'requisition', entityId: id,
      newValue: { requisitionNo: req.requisition_no, notes },
    });

    return { success: true };
  },

  async reject(id, notes) {
    const req = await RequisitionsRepo.getById(id);
    if (!req) throw new Error('Requisition not found');
    if (!['PENDING', 'APPROVED'].includes(req.status)) throw new Error(`Cannot reject a requisition with status: ${req.status}`);

    const user = AuthService.getCurrentUser();
    await RequisitionsRepo.updateStatus(id, 'REJECTED');

    AuditLogsRepo.create({
      userId: user?.id, action: 'REJECT', entityType: 'requisition', entityId: id,
      newValue: { requisitionNo: req.requisition_no, notes },
    });

    return { success: true };
  },

  async cancel(id, notes) {
    const req = await RequisitionsRepo.getById(id);
    if (!req) throw new Error('Requisition not found');
    if (!['PENDING', 'APPROVED'].includes(req.status)) throw new Error(`Cannot cancel a requisition with status: ${req.status}`);

    const user = AuthService.getCurrentUser();
    await RequisitionsRepo.updateStatus(id, 'CANCELLED');

    AuditLogsRepo.create({
      userId: user?.id, action: 'CANCEL', entityType: 'requisition', entityId: id,
      newValue: { requisitionNo: req.requisition_no, notes },
    });

    return { success: true };
  },

  async fulfill(id) {
    const req = await RequisitionsRepo.getById(id);
    if (!req) throw new Error('Requisition not found');
    if (!['PENDING', 'APPROVED'].includes(req.status)) throw new Error(`Cannot fulfill a requisition with status: ${req.status}`);
    if (!req.items || req.items.length === 0) throw new Error('Requisition has no items');

    const user = AuthService.getCurrentUser();

    // Determine fulfillment quantities: use approved_quantity if APPROVED and set, else requested_quantity
    const fulfillItems = req.items.map(item => {
      const qty = (req.status === 'APPROVED' && item.approved_quantity > 0)
        ? item.approved_quantity
        : item.requested_quantity;
      return { ...item, fulfillQty: qty };
    }).filter(item => item.fulfillQty > 0);

    if (fulfillItems.length === 0) throw new Error('No items have quantities to fulfill');

    // Validate stock availability
    for (const item of fulfillItems) {
      const dbItem = await ItemsRepo.getById(item.item_id);
      if (!dbItem) throw new Error(`Item not found: ${item.item_id}`);
      if (dbItem.current_stock < item.fulfillQty) {
        throw new Error(`Insufficient stock for "${dbItem.name}". Available: ${dbItem.current_stock}, Requested: ${item.fulfillQty}`);
      }
    }

    // Deduct stock with rollback on partial failure
    const completedDeductions = [];
    try {
      for (const item of fulfillItems) {
        const freshItem = await ItemsRepo.getById(item.item_id);
        if (freshItem.current_stock < item.fulfillQty) {
          throw new Error(`Insufficient stock for "${freshItem.name}". Available: ${freshItem.current_stock}, Requested: ${item.fulfillQty}`);
        }
        const stockBefore = freshItem.current_stock;
        const stockAfter = stockBefore - item.fulfillQty;
        await ItemsRepo.updateStock(item.item_id, stockAfter);
        await ItemPriceTiersRepo.deductStockFIFO(item.item_id, item.fulfillQty);
        completedDeductions.push({ item, stockBefore, stockAfter });
      }
    } catch (err) {
      // Rollback any deductions already made
      for (const { item, stockBefore } of completedDeductions) {
        await ItemsRepo.updateStock(item.item_id, stockBefore);
        await ItemPriceTiersRepo.syncItemToStock(item.item_id);
      }
      throw err;
    }

    // Update issued_quantity on each requisition_item
    for (const { item } of completedDeductions) {
      await RequisitionsRepo.updateItemIssuedQty(item.id, item.fulfillQty);
    }

    // Update requisition status to FULFILLED
    await RequisitionsRepo.updateStatus(id, 'FULFILLED', user?.fullName || user?.full_name || 'Store');

    // Log stock transactions
    for (const { item, stockBefore, stockAfter } of completedDeductions) {
      await StockTransactionsRepo.create({
        itemId: item.item_id,
        type: 'OUT',
        quantity: item.fulfillQty,
        stockBefore,
        stockAfter,
        reference: `Requisition: ${req.requisition_no}`,
        notes: `Fulfilled for ${req.requester_name || req.recipient_name || 'requester'} (${req.department || 'dept'})`,
        createdBy: user?.id,
      });
    }

    AuditLogsRepo.create({
      userId: user?.id, action: 'FULFILL', entityType: 'requisition', entityId: id,
      newValue: { requisitionNo: req.requisition_no, itemCount: fulfillItems.length },
    });

    return { success: true };
  },

  async deleteRequisition(id) {
    const user = AuthService.getCurrentUser();
    if (user?.role_name !== 'Super Admin' && user?.roleName !== 'Super Admin') {
      throw new Error('Only Super Admin can delete requisitions');
    }

    const req = await RequisitionsRepo.getById(id);
    if (!req) throw new Error('Requisition not found');

    // If FULFILLED, reverse outstanding issued stock
    if (req.status === 'FULFILLED') {
      for (const item of (req.items || [])) {
        const issued = item.issued_quantity || 0;
        if (issued > 0) {
          const dbItem = await ItemsRepo.getById(item.item_id);
          if (dbItem) {
            const stockBefore = dbItem.current_stock;
            const stockAfter = stockBefore + issued;
            await ItemsRepo.updateStock(item.item_id, stockAfter);
            await ItemPriceTiersRepo.addStockTier(item.item_id, issued, dbItem.unit_price, dbItem.currency, dbItem.conversion_rate);
            await StockTransactionsRepo.create({
              itemId: item.item_id,
              type: 'IN',
              quantity: issued,
              stockBefore,
              stockAfter,
              reference: `Requisition Deleted: ${req.requisition_no}`,
              notes: `Stock reversed on requisition deletion by ${user.fullName || user.full_name}`,
              createdBy: user.id,
            });
          }
        }
      }
    }

    await RequisitionsRepo.deleteRequisition(id);

    AuditLogsRepo.create({
      userId: user.id, action: 'DELETE', entityType: 'requisition', entityId: id,
      newValue: { requisitionNo: req.requisition_no, requesterName: req.requester_name },
    });

    return { success: true };
  },

  async getFieldSuggestions(field, query) {
    return await RequisitionsRepo.getFieldSuggestions(field, query);
  },

  // Dashboard stat
  async getPendingCount() {
    return await RequisitionsRepo.getPendingCount();
  },
};

module.exports = RequisitionService;
