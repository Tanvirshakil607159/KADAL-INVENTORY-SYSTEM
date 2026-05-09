const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const ApprovalsRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('approvals').select('*, users!approvals_requested_by_fkey(full_name)').order('created_at', { ascending: false });
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.requestedBy) query = query.eq('requested_by', filters.requestedBy);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(a => ({ ...a, requester_name: a.users?.full_name }));
    }

    let sql = `
      SELECT a.*, u.full_name as requester_name 
      FROM approvals a 
      JOIN users u ON a.requested_by = u.id
    `;
    const params = [];
    let where = [];
    if (filters.status) {
      where.push(`a.status = ?`);
      params.push(filters.status);
    }
    if (filters.requestedBy) {
      where.push(`a.requested_by = ?`);
      params.push(filters.requestedBy);
    }
    if (where.length > 0) sql += ` WHERE ` + where.join(' AND ');
    sql += ` ORDER BY a.created_at DESC`;
    return dbPrepare(sql).all(...params);
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('approvals').select('*, users!approvals_requested_by_fkey(full_name)').eq('id', id).single();
      if (error) throw error;
      if (data) data.requester_name = data.users?.full_name;
      return data;
    }
    return dbPrepare(`
      SELECT a.*, u.full_name as requester_name 
      FROM approvals a 
      JOIN users u ON a.requested_by = u.id 
      WHERE a.id = ?
    `).get(id);
  },

  async create({ type, data, requestedBy }) {
    if (isCloudEnabled()) {
      const { data: inserted, error } = await getSupabase().from('approvals').insert([{
        type, data: JSON.stringify(data), requested_by: requestedBy
      }]).select().single();
      if (error) throw error;
      return inserted.id;
    }
    return dbPrepare(`
      INSERT INTO approvals (type, data, requested_by) 
      VALUES (?, ?, ?)
    `).run(type, JSON.stringify(data), requestedBy).lastInsertRowid;
  },

  async updateStatus(id, status, notes = null) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('approvals').update({
        status, notes, updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`
      UPDATE approvals 
      SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, notes, id);
  },

  async delete(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('approvals').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`DELETE FROM approvals WHERE id = ?`).run(id);
  }
};

module.exports = ApprovalsRepo;
