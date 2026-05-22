const { dbPrepare, dbTransaction, getSupabase, isCloudEnabled } = require('../connection');

const WarehousesRepo = {
  async getAll(includeInactive = false) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('warehouses').select('*');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    }
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    return dbPrepare(`SELECT * FROM warehouses ${where} ORDER BY name`).all();
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouses').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  },

  async create({ name, code, address, is_default = 0 }) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouses').insert([{ name, code, address, is_default, is_active: 1 }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO warehouses (name, code, address, is_default, is_active) VALUES (?, ?, ?, ?, 1)').run(name, code, address, is_default).lastInsertRowid;
  },

  async update(id, { name, code, address, is_default }) {
    if (isCloudEnabled()) {
      const updateData = { name, code, address };
      if (is_default !== undefined) updateData.is_default = is_default;
      const { error } = await getSupabase().from('warehouses').update(updateData).eq('id', id);
      if (error) throw error;
      return true;
    }
    
    let query = 'UPDATE warehouses SET name = ?, code = ?, address = ?';
    let params = [name, code, address];
    
    if (is_default !== undefined) {
      query += ', is_default = ?';
      params.push(is_default);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    return dbPrepare(query).run(...params);
  },

  async delete(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('warehouses').update({ is_active: 0 }).eq('id', id).eq('is_default', 0);
      if (error) throw error;
      return true;
    }
    // Only soft delete if it's not the default warehouse
    return dbPrepare('UPDATE warehouses SET is_active = 0 WHERE id = ? AND is_default = 0').run(id);
  },

  async getStockByItem(itemId) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('warehouse_stock')
        .select('*, warehouses(name, code)')
        .eq('item_id', itemId);
      if (error) throw error;
      return data.map(d => ({
        ...d,
        warehouse_name: d.warehouses?.name,
        warehouse_code: d.warehouses?.code
      }));
    }
    return dbPrepare(`
      SELECT ws.*, w.name as warehouse_name, w.code as warehouse_code 
      FROM warehouse_stock ws 
      JOIN warehouses w ON ws.warehouse_id = w.id 
      WHERE ws.item_id = ?
    `).all(itemId);
  },

  async getStockByWarehouse(warehouseId) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('warehouse_stock')
        .select('*, items(name, item_code, current_stock, unit)')
        .eq('warehouse_id', warehouseId);
      if (error) throw error;
      return data.map(d => ({
        ...d,
        item_name: d.items?.name,
        item_code: d.items?.item_code,
        global_stock: d.items?.current_stock,
        unit: d.items?.unit
      }));
    }
    return dbPrepare(`
      SELECT ws.*, i.name as item_name, i.item_code as item_code, i.current_stock as global_stock, i.unit 
      FROM warehouse_stock ws 
      JOIN items i ON ws.item_id = i.id 
      WHERE ws.warehouse_id = ?
    `).all(warehouseId);
  },

  async setStock(warehouseId, itemId, quantity) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase()
        .from('warehouse_stock')
        .upsert({ warehouse_id: warehouseId, item_id: itemId, quantity, updated_at: new Date().toISOString() }, { onConflict: 'warehouse_id,item_id' });
      if (error) throw error;
      return true;
    }
    return dbPrepare(`
      INSERT INTO warehouse_stock (warehouse_id, item_id, quantity) 
      VALUES (?, ?, ?) 
      ON CONFLICT(warehouse_id, item_id) 
      DO UPDATE SET quantity = excluded.quantity, updated_at = CURRENT_TIMESTAMP
    `).run(warehouseId, itemId, quantity);
  },

  async adjustStock(warehouseId, itemId, delta) {
    if (isCloudEnabled()) {
      // Need a transaction-like approach or RPC for supabase. For now, fetch and update.
      // A proper implementation would use a Postgres function (RPC) to prevent race conditions.
      const { data: current } = await getSupabase().from('warehouse_stock').select('quantity').eq('warehouse_id', warehouseId).eq('item_id', itemId).maybeSingle();
      const newQty = (current?.quantity || 0) + delta;
      
      const { error } = await getSupabase()
        .from('warehouse_stock')
        .upsert({ warehouse_id: warehouseId, item_id: itemId, quantity: newQty, updated_at: new Date().toISOString() }, { onConflict: 'warehouse_id,item_id' });
      if (error) throw error;
      return true;
    }
    return dbPrepare(`
      INSERT INTO warehouse_stock (warehouse_id, item_id, quantity) 
      VALUES (?, ?, ?) 
      ON CONFLICT(warehouse_id, item_id) 
      DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = CURRENT_TIMESTAMP
    `).run(warehouseId, itemId, delta);
  }
};

module.exports = WarehousesRepo;
