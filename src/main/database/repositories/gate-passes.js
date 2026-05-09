const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const GatePassRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('gate_passes').select(`
        *, users!gate_passes_created_by_fkey (full_name)
      `).order('created_at', { ascending: false }).limit(500);

      if (filters.search) query = query.ilike('gate_pass_number', `%${filters.search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(gp => ({ ...gp, created_by_name: gp.users?.full_name }));
    }

    let where = []; let params = [];
    if (filters.search) { where.push('gp.gate_pass_number LIKE ?'); params.push(`%${filters.search}%`); }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return dbPrepare(`
      SELECT gp.*, u.full_name as created_by_name 
      FROM gate_passes gp 
      LEFT JOIN users u ON gp.created_by = u.id 
      ${w} ORDER BY gp.created_at DESC LIMIT 500
    `).all(...params);
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('gate_passes').select(`
        *, users!gate_passes_created_by_fkey (full_name)
      `).eq('id', id).single();
      if (error) throw error;
      if (data) data.created_by_name = data.users?.full_name;
      return data;
    }

    return dbPrepare(`
      SELECT gp.*, u.full_name as created_by_name 
      FROM gate_passes gp 
      LEFT JOIN users u ON gp.created_by = u.id 
      WHERE gp.id = ?
    `).get(id);
  },

  async create({ gatePassNumber, challanIds, polyBags, cartons, plasticBags, createdBy }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('gate_passes').insert([{
        gate_pass_number: gatePassNumber,
        challan_ids: JSON.stringify(challanIds),
        poly_bags: polyBags || 0,
        cartons: cartons || 0,
        plastic_bags: plasticBags || 0,
        created_by: createdBy
      }]).select().single();
      if (error) throw error;
      return data.id;
    }

    return dbPrepare(`
      INSERT INTO gate_passes (gate_pass_number, challan_ids, poly_bags, cartons, plastic_bags, created_by) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(gatePassNumber, JSON.stringify(challanIds), polyBags||0, cartons||0, plasticBags||0, createdBy).lastInsertRowid;
  },

  async getUsedChallanIds() {
    const used = new Set();
    
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      // 1. Get from confirmed gate passes (not rejected)
      const { data: gpData } = await supabase.from('gate_passes').select('gate_pass_number, challan_ids');
      (gpData || []).forEach(row => {
        if (!row.gate_pass_number.endsWith('-REJ')) {
          try {
            const ids = JSON.parse(row.challan_ids);
            if (Array.isArray(ids)) ids.forEach(id => used.add(Number(id)));
          } catch (e) {}
        }
      });
      
      // 2. Get from pending approval requests
      const { data: appData } = await supabase.from('approvals').select('data').eq('type', 'CREATE_GATE_PASS').eq('status', 'PENDING');
      (appData || []).forEach(row => {
        try {
          const data = JSON.parse(row.data);
          if (data.challanIds && Array.isArray(data.challanIds)) {
            data.challanIds.forEach(id => used.add(Number(id)));
          }
        } catch (e) {}
      });
      return [...used];
    }

    // 1. Get from confirmed gate passes (not rejected)
    const rows = dbPrepare(`SELECT challan_ids FROM gate_passes WHERE gate_pass_number NOT LIKE '%-REJ'`).all();
    for (const row of rows) {
      try {
        const ids = JSON.parse(row.challan_ids);
        if (Array.isArray(ids)) ids.forEach(id => used.add(Number(id)));
      } catch (e) {}
    }

    // 2. Get from pending approval requests
    const pendingRows = dbPrepare(`SELECT data FROM approvals WHERE type = 'CREATE_GATE_PASS' AND status = 'PENDING'`).all();
    for (const row of pendingRows) {
      try {
        const data = JSON.parse(row.data);
        if (data.challanIds && Array.isArray(data.challanIds)) {
          data.challanIds.forEach(id => used.add(Number(id)));
        }
      } catch (e) {}
    }

    return [...used];
  },

  async getNextNumber(prefix = 'GP') {
    const today = new Date();
    const dateStr = today.getFullYear().toString() + (today.getMonth()+1).toString().padStart(2,'0') + today.getDate().toString().padStart(2,'0');
    const pattern = `${prefix}-${dateStr}-%`;
    
    if (isCloudEnabled()) {
      const { data } = await getSupabase()
        .from('gate_passes')
        .select('gate_pass_number')
        .ilike('gate_pass_number', pattern);
      let maxSeq = 0;
      (data || []).forEach(row => {
        const parts = row.gate_pass_number.split('-');
        if (parts.length >= 3) {
          const seq = parseInt(parts[2], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
      return `${prefix}-${dateStr}-${(maxSeq + 1).toString().padStart(4, '0')}`;
    }

    const rows = dbPrepare(`SELECT gate_pass_number FROM gate_passes WHERE gate_pass_number LIKE ?`).all(pattern);
    
    let maxSeq = 0;
    rows.forEach(row => {
      const parts = row.gate_pass_number.split('-');
      if (parts.length >= 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    
    return `${prefix}-${dateStr}-${(maxSeq + 1).toString().padStart(4, '0')}`;
  }
};

module.exports = GatePassRepo;
