const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const ReturnsRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('returns').select(`
        *,
        issues (issue_id, issue_type, recipient_name),
        users!returns_created_by_fkey (full_name),
        return_items (returned_quantity, damage_quantity, rejected_quantity, issue_items (item_id, items (name)))
      `).order('return_date', { ascending: false });

      if (filters.issueId) query = query.eq('issue_id', filters.issueId);
      if (filters.dateFrom) query = query.gte('return_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('return_date', filters.dateTo + 'T23:59:59.999Z');

      const { data, error } = await query;
      if (error) throw error;
      return data.map(r => ({
        ...r,
        issue_id_str: r.issues?.issue_id,
        issue_type: r.issues?.issue_type,
        recipient_name: r.issues?.recipient_name,
        created_by_name: r.users?.full_name,
        item_count: (r.return_items || []).length
      }));
    }

    let where = []; let params = [];
    if (filters.issueId) { where.push('r.issue_id = ?'); params.push(filters.issueId); }
    if (filters.dateFrom) { where.push('r.return_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('r.return_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }

    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return dbPrepare(`
      SELECT r.*, i.issue_id as issue_id_str, i.issue_type, i.recipient_name, u.full_name as created_by_name,
      (SELECT COUNT(*) FROM return_items ri WHERE ri.return_id = r.id) as item_count
      FROM returns r
      JOIN issues i ON r.issue_id = i.id
      LEFT JOIN users u ON r.created_by = u.id
      ${w}
      ORDER BY r.return_date DESC
    `).all(...params);
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: ret, error } = await supabase.from('returns').select(`
        *,
        issues (issue_id, issue_type, recipient_name),
        users!returns_created_by_fkey (full_name)
      `).eq('id', id).single();
      if (error) throw error;

      if (ret) {
        const { data: items, error: itemsError } = await supabase.from('return_items').select(`
          *,
          issue_items (item_id, items (name, item_code))
        `).eq('return_id', id);
        if (itemsError) throw itemsError;
        ret.items = items.map(ri => ({
          ...ri,
          item_name: ri.issue_items?.items?.name,
          item_code: ri.issue_items?.items?.item_code,
          item_id: ri.issue_items?.item_id
        }));
      }
      return ret;
    }

    const ret = dbPrepare(`
      SELECT r.*, i.issue_id as issue_id_str, i.issue_type, i.recipient_name, u.full_name as created_by_name
      FROM returns r
      JOIN issues i ON r.issue_id = i.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = ?
    `).get(id);

    if (ret) {
      ret.items = dbPrepare(`
        SELECT ri.*, it.name as item_name, it.item_code, ii.item_id
        FROM return_items ri
        JOIN issue_items ii ON ri.issue_item_id = ii.id
        JOIN items it ON ii.item_id = it.id
        WHERE ri.return_id = ?
      `).all(id);
    }
    return ret;
  },

  async create({ issueId, returnDate, remarks, createdBy, items }) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: ret, error } = await supabase.from('returns').insert([{
        issue_id: issueId,
        return_date: returnDate,
        remarks: remarks || null,
        created_by: createdBy
      }]).select().single();
      if (error) throw error;

      const returnItems = items.map(item => ({
        return_id: ret.id,
        issue_item_id: item.issueItemId,
        returned_quantity: item.returnedQuantity,
        damage_quantity: item.damageQuantity || 0,
        rejected_quantity: item.rejectedQuantity || 0,
        notes: item.notes || null
      }));
      const { error: itemsError } = await supabase.from('return_items').insert(returnItems);
      if (itemsError) throw itemsError;

      return ret.id;
    }

    const r = dbPrepare(`
      INSERT INTO returns (issue_id, return_date, remarks, created_by)
      VALUES (?, ?, ?, ?)
    `).run(issueId, returnDate, remarks || null, createdBy);
    
    const id = r.lastInsertRowid;
    for (const item of items) {
      dbPrepare(`
        INSERT INTO return_items (return_id, issue_item_id, returned_quantity, damage_quantity, rejected_quantity, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, item.issueItemId, item.returnedQuantity, item.damageQuantity || 0, item.rejectedQuantity || 0, item.notes || null);
    }
    return id;
  }
};

module.exports = ReturnsRepo;
