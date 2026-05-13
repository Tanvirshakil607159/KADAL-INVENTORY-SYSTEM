const ReturnsRepo = require('../database/repositories/returns');
const IssuesRepo = require('../database/repositories/issues');
const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const AuditLogsRepo = require('../database/repositories/audit-logs');
const AuthService = require('./auth-service');

const ReturnService = {
  async getAll(filters) { return await ReturnsRepo.getAll(filters); },
  async getById(id) { return await ReturnsRepo.getById(id); },

  async create(data) {
    if (!data.issueId) throw new Error('Issue ID is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one return item is required');

    // Validate issue exists and is not fully returned
    const issue = await IssuesRepo.getById(data.issueId);
    if (!issue) throw new Error('Issue not found');
    if (issue.status === 'RETURNED') throw new Error('This issue has already been fully returned');

    // Validate each item against over-return
    for (const item of data.items) {
      const issueItem = await IssuesRepo.getIssueItemById(item.issueItemId);
      if (!issueItem) throw new Error(`Issue item not found: ${item.issueItemId}`);

      const maxReturnable = issueItem.quantity
        - (issueItem.returned_quantity || 0)
        - (issueItem.damage_quantity || 0)
        - (issueItem.rejected_quantity || 0)
        - (issueItem.consumed_quantity || 0);
      const totalReturn = (item.returnedQuantity || 0) + (item.damageQuantity || 0) + (item.rejectedQuantity || 0);

      if (totalReturn > maxReturnable) {
        throw new Error(`Over-return prevented. Max returnable: ${maxReturnable}, Attempted: ${totalReturn}`);
      }
      if (totalReturn <= 0) {
        throw new Error('Return quantity must be greater than 0');
      }
    }

    const user = AuthService.getCurrentUser();

    // Create return record
    const returnId = await ReturnsRepo.create({
      issueId: data.issueId,
      returnDate: data.returnDate || new Date().toISOString(),
      remarks: data.remarks,
      createdBy: user?.id,
      items: data.items,
    });

    // Update issue_items running totals and add stock back for good returns
    for (const item of data.items) {
      await IssuesRepo.updateIssueItemReturnQtys(item.issueItemId, {
        returnedQty: item.returnedQuantity || 0,
        damageQty: item.damageQuantity || 0,
        rejectedQty: item.rejectedQuantity || 0,
      });

      // Only good returns go back to inventory stock
      if (item.returnedQuantity > 0) {
        const issueItem = await IssuesRepo.getIssueItemById(item.issueItemId);
        const dbItem = await ItemsRepo.getById(issueItem.item_id);
        const stockBefore = dbItem.current_stock;
        const stockAfter = stockBefore + item.returnedQuantity;
        await ItemsRepo.updateStock(issueItem.item_id, stockAfter);
        await StockTransactionsRepo.create({
          itemId: issueItem.item_id, type: 'IN', quantity: item.returnedQuantity,
          stockBefore, stockAfter,
          reference: `Return from Issue: ${issue.issue_id}`,
          notes: `Returned by ${issue.recipient_name}`,
          createdBy: user?.id,
        });
      }
    }

    // Recalculate issue status
    const newStatus = await IssuesRepo.updateStatus(data.issueId);

    AuditLogsRepo.create({
      userId: user?.id, action: 'CREATE', entityType: 'return', entityId: returnId,
      newValue: { issueId: issue.issue_id, itemCount: data.items.length, newStatus },
    });

    return { success: true, id: returnId, newStatus };
  },
};

module.exports = ReturnService;
