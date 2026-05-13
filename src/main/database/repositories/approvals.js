const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const ApprovalsRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('approvals').select('*, users!approvals_requested_by_fkey(full_name)').order('created_at', { ascending: false });
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.requestedBy) query = query.eq('requested_by', filters.requestedBy);
      const { data, error } = await query;
      if (error) {
        // If columns are missing in cloud, return data without them instead of crashing
        if (error.message.includes('entity_id') || error.message.includes('column')) {
          console.warn('[ApprovalsRepo] Cloud schema missing new columns. Data returned without links.');
          const { data: fallback, error: fErr } = await getSupabase().from('approvals').select('*, users!approvals_requested_by_fkey(full_name)').order('created_at', { ascending: false });
          if (fErr) throw fErr;
          return fallback.map(a => ({ ...a, requester_name: a.users?.full_name, data: typeof a.data === 'string' ? JSON.parse(a.data) : a.data }));
        }
        throw error;
      }
      return data.map(a => {
        try {
          return { 
            ...a, 
            requester_name: a.users?.full_name, 
            data: typeof a.data === 'string' ? JSON.parse(a.data) : a.data,
            entityId: a.entity_id || null,
            entityNumber: a.entity_number || null
          };
        } catch (e) { return { ...a, requester_name: a.users?.full_name }; }
      });
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
    const rows = dbPrepare(sql).all(...params);
    return rows.map(r => {
      try {
        return { ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data };
      } catch (e) {
        console.error('[ApprovalsRepo] Failed to parse data for ID:', r.id);
        return r;
      }
    });
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('approvals').select('*, users!approvals_requested_by_fkey(full_name)').eq('id', id).single();
      if (error) throw error;
      if (data) {
        data.requester_name = data.users?.full_name;
        data.entityId = data.entity_id;
        data.entityNumber = data.entity_number;
        try { data.data = typeof data.data === 'string' ? JSON.parse(data.data) : data.data; } catch (e) {}
      }
      return data;
    }
    const row = dbPrepare(`
      SELECT a.*, u.full_name as requester_name 
      FROM approvals a 
      JOIN users u ON a.requested_by = u.id 
      WHERE a.id = ?
    `).get(id);
    if (row) {
      if (typeof row.data === 'string') {
        try { row.data = JSON.parse(row.data); } catch (e) {}
      }
      row.entityId = row.entity_id;
      row.entityNumber = row.entity_number;
    }
    return row;
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

  async updateStatus(id, status, notes = null, entityId = null, entityNumber = null) {
    if (isCloudEnabled()) {
      const payload = {
        status, notes, updated_at: new Date().toISOString()
      };
      // Only include new columns if they exist (or just try and catch)
      if (entityId) payload.entity_id = entityId;
      if (entityNumber) payload.entity_number = entityNumber;

      const { error } = await getSupabase().from('approvals').update(payload).eq('id', id);
      if (error) {
        if (error.message.includes('entity_id') || error.message.includes('column')) {
          console.warn('[ApprovalsRepo] Cloud schema missing new columns. Updating status only.');
          const { error: fErr } = await getSupabase().from('approvals').update({ status, notes, updated_at: new Date().toISOString() }).eq('id', id);
          if (fErr) throw fErr;
        } else throw error;
      }
      return true;
    }
    return dbPrepare(`
      UPDATE approvals 
      SET status = ?, notes = ?, entity_id = ?, entity_number = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, notes, entityId, entityNumber, id);
  },

  async updateData(id, data) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('approvals').update({
        data: JSON.stringify(data)
      }).eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare('UPDATE approvals SET data = ? WHERE id = ?').run(JSON.stringify(data), id);
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
