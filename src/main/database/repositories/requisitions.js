const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const RequisitionsRepo = {
  // ==================== Requisitions ====================

  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('requisitions').select(`
        *,
        recipients (name, type),
        users!requisitions_created_by_fkey (full_name),
        requisition_items (id, item_id, requested_quantity, approved_quantity, issued_quantity, items (name, item_code))
      `).order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.recipientId) query = query.eq('recipient_id', filters.recipientId);
      if (filters.dateFrom) query = query.gte('requisition_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('requisition_date', filters.dateTo + 'T23:59:59.999Z');
      if (filters.search) {
        query = query.or(`requisition_no.ilike.%${filters.search}%,requester_name.ilike.%${filters.search}%,department.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data.map(r => ({
        ...r,
        created_by_name: r.users?.full_name,
        recipient_name: r.recipients?.name,
        item_count: (r.requisition_items || []).length,
        total_requested: (r.requisition_items || []).reduce((s, i) => s + (i.requested_quantity || 0), 0),
      }));
    }

    let where = []; let params = [];
    if (filters.status) { where.push('r.status = ?'); params.push(filters.status); }
    if (filters.recipientId) { where.push('r.recipient_id = ?'); params.push(filters.recipientId); }
    if (filters.dateFrom) { where.push('r.requisition_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('r.requisition_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    if (filters.search) {
      where.push('(r.requisition_no LIKE ? OR r.requester_name LIKE ? OR r.department LIKE ?)');
      const s = `%${filters.search}%`; params.push(s, s, s);
    }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    return dbPrepare(`
      SELECT r.*, u.full_name as created_by_name, rec.name as recipient_name,
        (SELECT COUNT(*) FROM requisition_items ri WHERE ri.requisition_id = r.id) as item_count,
        (SELECT COALESCE(SUM(ri.requested_quantity), 0) FROM requisition_items ri WHERE ri.requisition_id = r.id) as total_requested
      FROM requisitions r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN recipients rec ON r.recipient_id = rec.id
      ${w}
      ORDER BY r.created_at DESC
    `).all(...params);
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: req, error } = await supabase.from('requisitions').select(`
        *,
        users!requisitions_created_by_fkey (full_name),
        recipients (name, type)
      `).eq('id', id).single();
      if (error) throw error;

      if (req) {
        const { data: items, error: iErr } = await supabase.from('requisition_items').select(`
          *, items (name, item_code, unit, current_stock, buyer_name, size, color, style_name, purchase_no, order_number)
        `).eq('requisition_id', id);
        if (iErr) throw iErr;
        req.items = items.map(i => ({
          ...i,
          item_name: i.items?.name,
          item_code: i.items?.item_code,
          item_unit: i.items?.unit,
          current_stock: i.items?.current_stock,
          buyer_name: i.items?.buyer_name || '-',
          size: i.items?.size || '-',
          color: i.items?.color || '-',
          style_name: i.items?.style_name || '-',
          purchase_no: i.items?.purchase_no || '-',
          order_number: i.items?.order_number || '-',
        }));
        req.created_by_name = req.users?.full_name;
        req.recipient_name = req.recipients?.name;
      }
      return req;
    }

    const req = dbPrepare(`
      SELECT r.*, u.full_name as created_by_name, rec.name as recipient_name
      FROM requisitions r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN recipients rec ON r.recipient_id = rec.id
      WHERE r.id = ?
    `).get(id);

    if (req) {
      req.items = dbPrepare(`
        SELECT ri.*, it.name as item_name, it.item_code, it.unit as item_unit, it.current_stock,
          it.buyer_name, it.size, it.color, it.style_name, it.purchase_no, it.order_number
        FROM requisition_items ri
        JOIN items it ON ri.item_id = it.id
        WHERE ri.requisition_id = ?
      `).all(id);
    }
    return req;
  },

  async create({ requisitionNo, recipientId, requesterName, department, purpose, notes, requisitionDate, createdBy, items }) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: req, error } = await supabase.from('requisitions').insert([{
        requisition_no: requisitionNo,
        recipient_id: recipientId || null,
        requester_name: requesterName || null,
        department: department || null,
        purpose: purpose || null,
        notes: notes || null,
        status: 'PENDING',
        requisition_date: requisitionDate || new Date().toISOString(),
        created_by: createdBy,
      }]).select().single();
      if (error) throw error;

      const reqItems = items.map(item => ({
        requisition_id: req.id,
        item_id: item.itemId,
        requested_quantity: item.quantity,
        approved_quantity: 0,
        issued_quantity: 0,
        notes: item.notes || null,
      }));
      const { error: iErr } = await supabase.from('requisition_items').insert(reqItems);
      if (iErr) throw iErr;
      return req.id;
    }

    const r = dbPrepare(`
      INSERT INTO requisitions (requisition_no, recipient_id, requester_name, department, purpose, notes, status, requisition_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      requisitionNo,
      recipientId || null,
      requesterName || null,
      department || null,
      purpose || null,
      notes || null,
      requisitionDate || new Date().toISOString(),
      createdBy
    );

    const id = r.lastInsertRowid;
    for (const item of items) {
      dbPrepare(`
        INSERT INTO requisition_items (requisition_id, item_id, requested_quantity, approved_quantity, issued_quantity, notes)
        VALUES (?, ?, ?, 0, 0, ?)
      `).run(id, item.itemId, item.quantity, item.notes || null);
    }
    return id;
  },

  async updateStatus(id, status, approvedBy = null) {
    const now = new Date().toISOString();
    if (isCloudEnabled()) {
      const updates = { status, updated_at: now };
      if (approvedBy !== null) updates.approved_by = approvedBy;
      const { error } = await getSupabase().from('requisitions').update(updates).eq('id', id);
      if (error) throw error;
    } else {
      if (approvedBy !== null) {
        dbPrepare('UPDATE requisitions SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, approvedBy, id);
      } else {
        dbPrepare('UPDATE requisitions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
      }
    }
    return true;
  },

  async updateItemApprovedQty(requisitionId, approvedItems) {
    // approvedItems: [{ itemId, approvedQuantity }]
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      for (const { itemId, approvedQuantity } of approvedItems) {
        const { error } = await supabase.from('requisition_items')
          .update({ approved_quantity: approvedQuantity })
          .eq('requisition_id', requisitionId)
          .eq('item_id', itemId);
        if (error) throw error;
      }
    } else {
      for (const { itemId, approvedQuantity } of approvedItems) {
        dbPrepare('UPDATE requisition_items SET approved_quantity = ? WHERE requisition_id = ? AND item_id = ?')
          .run(approvedQuantity, requisitionId, itemId);
      }
    }
    return true;
  },

  async updateItemIssuedQty(requisitionItemId, issuedQuantity) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('requisition_items')
        .update({ issued_quantity: issuedQuantity })
        .eq('id', requisitionItemId);
      if (error) throw error;
    } else {
      dbPrepare('UPDATE requisition_items SET issued_quantity = ? WHERE id = ?').run(issuedQuantity, requisitionItemId);
    }
    return true;
  },

  async deleteRequisition(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      await supabase.from('requisition_items').delete().eq('requisition_id', id);
      const { error } = await supabase.from('requisitions').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    dbPrepare('DELETE FROM requisition_items WHERE requisition_id = ?').run(id);
    dbPrepare('DELETE FROM requisitions WHERE id = ?').run(id);
    return true;
  },

  async getNextNumber(prefix = 'REQ') {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('requisitions')
        .select('requisition_no').like('requisition_no', `${prefix}-%`).order('requisition_no', { ascending: false });
      if (error) throw error;
      let max = 0;
      (data || []).forEach(r => {
        const parts = r.requisition_no.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > max) max = num;
      });
      return `${prefix}-${(max + 1).toString().padStart(4, '0')}`;
    }
    const all = dbPrepare(`SELECT requisition_no FROM requisitions WHERE requisition_no LIKE ?`).all(`${prefix}-%`);
    let max = 0;
    all.forEach(r => {
      const parts = r.requisition_no.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > max) max = num;
    });
    return `${prefix}-${(max + 1).toString().padStart(4, '0')}`;
  },

  async getFieldSuggestions(field, query = '') {
    const validFields = ['requester_name', 'department', 'purpose'];
    if (!validFields.includes(field)) return [];
    const q = `%${query}%`;
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('requisitions')
        .select(field)
        .ilike(field, q)
        .not(field, 'is', null)
        .neq(field, '')
        .limit(20);
      if (error) throw error;
      return [...new Set(data.map(r => r[field]))].sort();
    }
    return dbPrepare(`SELECT DISTINCT ${field} as value FROM requisitions WHERE ${field} LIKE ? AND ${field} IS NOT NULL AND TRIM(${field}) != '' ORDER BY ${field} ASC LIMIT 20`).all(q).map(r => r.value);
  },

  // Dashboard stat
  async getPendingCount() {
    if (isCloudEnabled()) {
      const { count, error } = await getSupabase().from('requisitions')
        .select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
      if (error) throw error;
      return count || 0;
    }
    return dbPrepare("SELECT COUNT(*) as count FROM requisitions WHERE status = 'PENDING'").get().count;
  },
};

module.exports = RequisitionsRepo;
