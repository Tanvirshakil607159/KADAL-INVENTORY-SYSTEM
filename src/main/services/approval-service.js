const ApprovalsRepo = require('../database/repositories/approvals');
const AuthService = require('./auth-service');

const ApprovalService = {
  async createRequest(type, data) {
    const user = await AuthService.getCurrentUser();
    const id = await ApprovalsRepo.create({
      type,
      data,
      requestedBy: user?.id
    });
    return { success: true, pendingApproval: true, requestId: id };
  },

  async approve(id, notes) {
    const request = await ApprovalsRepo.getById(id);
    if (!request) throw new Error('Approval request not found');
    if (request.status !== 'PENDING') throw new Error('Request already processed');

    const data = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
    let result;

    // We need to avoid circular dependencies, so we require services inside the method
    const InventoryService = require('./inventory-service');
    const ChallanService = require('./challan-service');

    try {
      switch (request.type) {
        case 'CREATE_ITEM':
          result = await InventoryService._executeCreate(data);
          break;
        case 'UPDATE_ITEM':
          result = await InventoryService._executeUpdate(data.id, data.data);
          break;
        case 'STOCK_MOVEMENT':
          result = await InventoryService._executeStockMovement(data);
          break;
        case 'CREATE_CHALLAN':
          result = await ChallanService._executeCreate(data);
          break;
        case 'CREATE_GATE_PASS':
          const GatePassService = require('./gate-pass-service');
          result = await GatePassService._executeCreate(data);
          break;
        default:
          throw new Error('Unknown approval type: ' + request.type);
      }

      await ApprovalsRepo.updateStatus(id, 'APPROVED', notes);
      return { success: true, result };
    } catch (err) {
      console.error('[Approval Error]', err);
      throw err;
    }
  },

  async reject(id, notes) {
    const request = await ApprovalsRepo.getById(id);
    if (!request) throw new Error('Approval request not found');
    if (request.status !== 'PENDING') throw new Error('Request already processed');

    const data = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
    const user = await AuthService.getCurrentUser();

    // Store rejected challans in challan history with CANCELLED status
    if (request.type === 'CREATE_CHALLAN') {
      const ChallansRepo = require('../database/repositories/challans');
      const SettingsRepo = require('../database/repositories/settings');
      const prefix = await SettingsRepo.get('challan_prefix') || 'KA';
      const challanNumber = (await ChallansRepo.getNextNumber(prefix)) + '-REJ';
      try {
        const challanId = await ChallansRepo.create({
          challanNumber,
          receiverName: data.receiverName,
          receiverContact: data.receiverContact,
          receiverAddress: data.receiverAddress,
          notes: `[REJECTED] ${notes || 'No reason provided'}`,
          challanDate: new Date().toISOString(),
          createdBy: request.requested_by,
          items: data.items || [],
        });
        // Mark it as cancelled immediately
        await ChallansRepo.cancel(challanId, user?.id, notes || 'Approval rejected');
      } catch (e) {
        console.error('[Approval Reject] Failed to store rejected challan:', e.message);
      }
    }

    // Store rejected gate passes in GP history
    if (request.type === 'CREATE_GATE_PASS') {
      const GatePassRepo = require('../database/repositories/gate-passes');
      try {
        const gpNumber = (await GatePassRepo.getNextNumber()) + '-REJ';
        await GatePassRepo.create({
          gatePassNumber: gpNumber,
          challanIds: data.challanIds || [],
          polyBags: data.polyBags || 0,
          cartons: data.cartons || 0,
          plasticBags: data.plasticBags || 0,
          createdBy: request.requested_by,
        });
        // Note: Gate passes don't have a cancel mechanism, but the -REJ suffix marks it
      } catch (e) {
        console.error('[Approval Reject] Failed to store rejected gate pass:', e.message);
      }
    }

    await ApprovalsRepo.updateStatus(id, 'REJECTED', notes);
    return { success: true };
  }
};

module.exports = ApprovalService;
