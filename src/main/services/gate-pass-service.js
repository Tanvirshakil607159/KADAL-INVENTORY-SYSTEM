const GatePassRepo = require('../database/repositories/gate-passes');
const ChallansRepo = require('../database/repositories/challans');
const AuthService = require('./auth-service');
const PdfGenerator = require('../utils/pdf-generator');

const GatePassService = {
  async getAll(filters) {
    return await GatePassRepo.getAll(filters);
  },

  async getById(id) {
    const gp = await GatePassRepo.getById(id);
    if (gp) {
      const challanIds = typeof gp.challan_ids === 'string' ? JSON.parse(gp.challan_ids) : gp.challan_ids;
      gp.challans = await Promise.all(challanIds.map(cid => ChallansRepo.getById(cid)));
    }
    return gp;
  },

  async create(data) {
    const user = await AuthService.getCurrentUser();
    if (user?.roleName !== 'Admin') {
      const SettingsRepo = require('../database/repositories/settings');
      const requireAll = await SettingsRepo.get('require_gate_pass_approval') === 'true';
      if (requireAll) {
        const ApprovalService = require('./approval-service');
        return await ApprovalService.createRequest('CREATE_GATE_PASS', data);
      }
    }
    return await this._executeCreate(data);
  },

  async _executeCreate(data) {
    const user = await AuthService.getCurrentUser();

    // Validate: each challan can only be gate-passed once
    const usedIds = await GatePassRepo.getUsedChallanIds();
    const duplicates = (data.challanIds || []).filter(id => usedIds.includes(Number(id)));
    if (duplicates.length > 0) {
      throw new Error(`Challan(s) already included in a Gate Pass: IDs ${duplicates.join(', ')}`);
    }

    const gatePassNumber = await GatePassRepo.getNextNumber();
    
    const id = await GatePassRepo.create({
      gatePassNumber,
      challanIds: data.challanIds,
      polyBags: data.polyBags,
      cartons: data.cartons,
      plasticBags: data.plasticBags,
      createdBy: user?.id
    });

    return { success: true, id, gatePassNumber };
  },

  async getNextNumber() {
    return await GatePassRepo.getNextNumber();
  },

  async exportPdf(id) {
    const gp = await this.getById(id);
    if (!gp) throw new Error('Gate Pass not found');
    const SettingsRepo = require('../database/repositories/settings');
    const settings = await SettingsRepo.getAll();
    return await PdfGenerator.generateGatePassPdf(gp, settings);
  }
};

module.exports = GatePassService;
