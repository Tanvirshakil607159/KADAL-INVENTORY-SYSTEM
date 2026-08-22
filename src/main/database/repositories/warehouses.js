const { dbPrepare, dbTransaction, getSupabase, isCloudEnabled } = require('../connection');

function parseId(id) {
  if (id === undefined || id === null || id === 'undefined' || id === 'null') return null;
  if (typeof id === 'object') {
    if (id.id !== undefined) id = id.id; // handle case where object is passed
    else return null;
  }
  const val = Number(id);
  if (isNaN(val) || val <= 0) return null;
  return val;
}

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
    const parsedId = parseId(id);
    if (!parsedId) return null;
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouses').select('*').eq('id', parsedId).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM warehouses WHERE id = ?').get(parsedId);
  },

  async create({ name, code, address, is_default = 0 }) {
    const finalCode = code || await this.getNextCode();
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouses').insert([{ name, code: finalCode, address, is_default, is_active: 1 }]).select().single();
      if (error) throw error;
      return data.id;
    }
    const info = dbPrepare('INSERT INTO warehouses (name, code, address, is_default, is_active) VALUES (?, ?, ?, ?, 1)').run(name, finalCode, address, is_default);
    return Number(info.lastInsertRowid);
  },

  async update(id, { name, code, address, is_default }) {
    const parsedId = parseId(id);
    if (!parsedId) throw new Error('Invalid warehouse ID');
    if (isCloudEnabled()) {
      const updateData = { name, code, address };
      if (is_default !== undefined) updateData.is_default = is_default;
      const { error } = await getSupabase().from('warehouses').update(updateData).eq('id', parsedId);
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
    params.push(parsedId);
    
    return dbPrepare(query).run(...params);
  },

  async delete(id) {
    const parsedId = parseId(id);
    if (!parsedId) throw new Error('Invalid warehouse ID');
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('warehouses').update({ is_active: 0 }).eq('id', parsedId).eq('is_default', 0);
      if (error) throw error;
      return true;
    }
    // Only soft delete if it's not the default warehouse
    return dbPrepare('UPDATE warehouses SET is_active = 0 WHERE id = ? AND is_default = 0').run(parsedId);
  },

  async getStockByItem(itemId) {
    const parsedItemId = parseId(itemId);
    if (!parsedItemId) return [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('warehouse_stock')
        .select('*, warehouses(name, code)')
        .eq('item_id', parsedItemId);
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
    `).all(parsedItemId);
  },

  async getStockByWarehouse(warehouseId) {
    const parsedWarehouseId = parseId(warehouseId);
    if (!parsedWarehouseId) return [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('warehouse_stock')
        .select('*, items(name, item_code, current_stock, unit)')
        .eq('warehouse_id', parsedWarehouseId);
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
    `).all(parsedWarehouseId);
  },

  async setStock(warehouseId, itemId, quantity) {
    const parsedWarehouseId = parseId(warehouseId);
    const parsedItemId = parseId(itemId);
    if (!parsedWarehouseId || !parsedItemId) throw new Error('Invalid warehouseId or itemId');
    if (isCloudEnabled()) {
      const { error } = await getSupabase()
        .from('warehouse_stock')
        .upsert({ warehouse_id: parsedWarehouseId, item_id: parsedItemId, quantity, updated_at: new Date().toISOString() }, { onConflict: 'warehouse_id,item_id' });
      if (error) throw error;
      return true;
    }
    return dbPrepare(`
      INSERT INTO warehouse_stock (warehouse_id, item_id, quantity) 
      VALUES (?, ?, ?) 
      ON CONFLICT(warehouse_id, item_id) 
      DO UPDATE SET quantity = excluded.quantity, updated_at = CURRENT_TIMESTAMP
    `).run(parsedWarehouseId, parsedItemId, quantity);
  },

  async adjustStock(warehouseId, itemId, delta) {
    const parsedWarehouseId = parseId(warehouseId);
    const parsedItemId = parseId(itemId);
    if (!parsedWarehouseId || !parsedItemId) throw new Error('Invalid warehouseId or itemId');
    if (isCloudEnabled()) {
      // Need a transaction-like approach or RPC for supabase. For now, fetch and update.
      // A proper implementation would use a Postgres function (RPC) to prevent race conditions.
      const { data: current } = await getSupabase().from('warehouse_stock').select('quantity').eq('warehouse_id', parsedWarehouseId).eq('item_id', parsedItemId).maybeSingle();
      const newQty = (current?.quantity || 0) + delta;
      
      const { error } = await getSupabase()
        .from('warehouse_stock')
        .upsert({ warehouse_id: parsedWarehouseId, item_id: parsedItemId, quantity: newQty, updated_at: new Date().toISOString() }, { onConflict: 'warehouse_id,item_id' });
      if (error) throw error;
      return true;
    }
    return dbPrepare(`
      INSERT INTO warehouse_stock (warehouse_id, item_id, quantity) 
      VALUES (?, ?, ?) 
      ON CONFLICT(warehouse_id, item_id) 
      DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = CURRENT_TIMESTAMP
    `).run(parsedWarehouseId, parsedItemId, delta);
  },

  async getNextCode() {
    let allCodes = [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('warehouses')
        .select('code')
        .like('code', 'WH-%');
      if (error) throw error;
      allCodes = (data || []).map(w => w.code);
    } else {
      const all = dbPrepare("SELECT code FROM warehouses WHERE code LIKE 'WH-%'").all();
      allCodes = all.map(w => w.code);
    }

    let maxSeq = 0;
    allCodes.forEach(code => {
      const parts = code.split('-');
      const lastPart = parts[parts.length - 1];
      const num = parseInt(lastPart, 10);
      if (!isNaN(num) && /^\d+$/.test(lastPart)) {
        if (num > maxSeq) maxSeq = num;
      }
    });

    return `WH-${(maxSeq + 1).toString().padStart(2, '0')}`;
  }
};

module.exports = WarehousesRepo;

