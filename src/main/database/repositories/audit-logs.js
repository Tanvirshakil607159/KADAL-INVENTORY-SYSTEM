const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');
const { dayStartIso, dayEndIso, dayStartSql, dayEndSql, inLocalRange } = require('../../utils/date-range');

const AuditLogsRepo = {
  async create({ userId, action, entityType, entityId, oldValue, newValue }) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('audit_logs').insert([{
        user_id: userId || null,
        action,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null
      }]);
      if (error) console.error('[AuditLog] Cloud insert failed:', error);
      return;
    }
    return dbPrepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`).run(
      userId||null, action, entityType, entityId||null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null
    );
  },

  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('audit_logs').select('*, users (full_name, username)').order('created_at', { ascending: false }).limit(500);
      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters.dateFrom) query = query.gte('created_at', dayStartIso(filters.dateFrom));
      if (filters.dateTo) query = query.lte('created_at', dayEndIso(filters.dateTo));
      
      const { data, error } = await query;
      if (error) throw error;
      return data.map(al => ({
        ...al,
        user_name: al.users?.full_name,
        username: al.users?.username
      }));
    }

    let where = []; let params = [];
    if (filters.userId) { where.push('al.user_id = ?'); params.push(filters.userId); }
    if (filters.entityType) { where.push('al.entity_type = ?'); params.push(filters.entityType); }
    if (filters.dateFrom) { where.push('datetime(al.created_at) >= ?'); params.push(dayStartSql(filters.dateFrom)); }
    if (filters.dateTo) { where.push("datetime(al.created_at) <= ?"); params.push(dayEndSql(filters.dateTo)); }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return dbPrepare(`SELECT al.*, u.full_name as user_name, u.username FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ${w} ORDER BY al.created_at DESC LIMIT 500`).all(...params);
  },
};
module.exports = AuditLogsRepo;
