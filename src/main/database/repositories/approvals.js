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
      // Batch enrich STOCK_MOVEMENT items with item details
      let itemMap = {};
      try {
        const stockItemIds = [...new Set(data.filter(a => a.type === 'STOCK_MOVEMENT').map(a => {
          const d = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
          return d?.itemId;
        }).filter(Boolean))];

        if (stockItemIds.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < stockItemIds.length; i += chunkSize) {
            const chunk = stockItemIds.slice(i, i + chunkSize);
            const { data: items } = await getSupabase().from('items').select('id, name, item_code, order_number, color, size, order_quantity, current_stock, unit').in('id', chunk);
            (items || []).forEach(it => { itemMap[it.id] = it; });
          }
        }
      } catch (e) {
        console.warn('[ApprovalsRepo] Could not batch enrich items:', e.message);
      }

      return data.map(a => {
        try {
          const parsedData = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
          if (a.type === 'STOCK_MOVEMENT' && parsedData && parsedData.itemId && itemMap[parsedData.itemId]) {
            const item = itemMap[parsedData.itemId];
            parsedData.itemName = parsedData.itemName || item.name;
            parsedData.itemCode = parsedData.itemCode || item.item_code;
            parsedData.orderNumber = parsedData.orderNumber || item.order_number;
            parsedData.color = parsedData.color || item.color;
            parsedData.size = parsedData.size || item.size;
            parsedData.orderQuantity = parsedData.orderQuantity ?? item.order_quantity;
            parsedData.currentStock = parsedData.currentStock ?? item.current_stock;
            parsedData.unit = parsedData.unit || item.unit;
          }
          return { 
            ...a, 
            requester_name: a.users?.full_name, 
            data: parsedData,
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
        r.data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        if (r.type === 'STOCK_MOVEMENT' && r.data && r.data.itemId) {
          const item = dbPrepare('SELECT * FROM items WHERE id = ?').get(r.data.itemId);
          if (item) {
            r.data.itemName = r.data.itemName || item.name;
            r.data.itemCode = r.data.itemCode || item.item_code;
            r.data.orderNumber = r.data.orderNumber || item.order_number;
            r.data.color = r.data.color || item.color;
            r.data.size = r.data.size || item.size;
            r.data.orderQuantity = r.data.orderQuantity ?? item.order_quantity;
            r.data.currentStock = r.data.currentStock ?? item.current_stock;
            r.data.unit = r.data.unit || item.unit;
          }
        }
        return r;
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
        try { 
          data.data = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
          if (data.type === 'STOCK_MOVEMENT' && data.data?.itemId) {
            const { data: item } = await getSupabase().from('items').select('*').eq('id', data.data.itemId).single();
            if (item) {
              data.data.itemName = data.data.itemName || item.name;
              data.data.itemCode = data.data.itemCode || item.item_code;
              data.data.orderNumber = data.data.orderNumber || item.order_number;
              data.data.color = data.data.color || item.color;
              data.data.size = data.data.size || item.size;
              data.data.orderQuantity = data.data.orderQuantity ?? item.order_quantity;
              data.data.currentStock = data.data.currentStock ?? item.current_stock;
              data.data.unit = data.data.unit || item.unit;
            }
          }
        } catch (e) {}
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
      if (row.type === 'STOCK_MOVEMENT' && row.data && row.data.itemId) {
        const item = dbPrepare('SELECT * FROM items WHERE id = ?').get(row.data.itemId);
        if (item) {
          row.data.itemName = row.data.itemName || item.name;
          row.data.itemCode = row.data.itemCode || item.item_code;
          row.data.orderNumber = row.data.orderNumber || item.order_number;
          row.data.color = row.data.color || item.color;
          row.data.size = row.data.size || item.size;
          row.data.orderQuantity = row.data.orderQuantity ?? item.order_quantity;
          row.data.currentStock = row.data.currentStock ?? item.current_stock;
          row.data.unit = row.data.unit || item.unit;
        }
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
