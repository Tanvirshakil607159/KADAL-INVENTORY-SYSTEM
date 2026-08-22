const { dbPrepare, dbTransaction, getSupabase, isCloudEnabled } = require('../connection');

function parseId(id) {
  if (id === undefined || id === null || id === 'undefined' || id === 'null') {
    return null;
  }
  const val = Number(id);
  return isNaN(val) ? null : val;
}

const WarehouseBinsRepo = {
  // ================= ZONES =================
  async getZonesByWarehouse(warehouseId) {
    const parsedId = parseId(warehouseId);
    if (!parsedId) return [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouse_zones').select('*').eq('warehouse_id', parsedId).order('name');
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM warehouse_zones WHERE warehouse_id = ? ORDER BY name').all(parsedId);
  },

  async createZone({ warehouse_id, name, type }) {
    const parsedWarehouseId = parseId(warehouse_id);
    if (!parsedWarehouseId) throw new Error('Invalid warehouse_id');
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouse_zones').insert([{ warehouse_id: parsedWarehouseId, name, type }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO warehouse_zones (warehouse_id, name, type) VALUES (?, ?, ?)')
      .run(parsedWarehouseId, name, type).lastInsertRowid;
  },

  async deleteZone(id) {
    const parsedId = parseId(id);
    if (!parsedId) throw new Error('Invalid zone ID');
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('warehouse_zones').delete().eq('id', parsedId);
      if (error) throw error;
      return true;
    }
    return dbPrepare('DELETE FROM warehouse_zones WHERE id = ?').run(parsedId);
  },

  // ================= BINS =================
  async getBinsByZone(zoneId) {
    const parsedZoneId = parseId(zoneId);
    if (!parsedZoneId) return [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouse_bins').select('*').eq('zone_id', parsedZoneId).order('name');
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM warehouse_bins WHERE zone_id = ? ORDER BY name').all(parsedZoneId);
  },

  async getBinsByWarehouse(warehouseId) {
    const parsedId = parseId(warehouseId);
    if (!parsedId) return [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('warehouse_bins')
        .select('*, warehouse_zones!inner(warehouse_id)')
        .eq('warehouse_zones.warehouse_id', parsedId);
      if (error) throw error;
      return data;
    }
    return dbPrepare(`
      SELECT b.*, z.name as zone_name 
      FROM warehouse_bins b
      JOIN warehouse_zones z ON b.zone_id = z.id
      WHERE z.warehouse_id = ?
      ORDER BY z.name, b.name
    `).all(parsedId);
  },

  async createBin({ zone_id, barcode, name, capacity }) {
    const parsedZoneId = parseId(zone_id);
    if (!parsedZoneId) throw new Error('Invalid zone_id');
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('warehouse_bins').insert([{ zone_id: parsedZoneId, barcode, name, capacity }]).select().single();
      if (error) throw error;
      return data.id;
    }
    return dbPrepare('INSERT INTO warehouse_bins (zone_id, barcode, name, capacity) VALUES (?, ?, ?, ?)')
      .run(parsedZoneId, barcode, name, capacity || 0).lastInsertRowid;
  },

  async deleteBin(id) {
    const parsedId = parseId(id);
    if (!parsedId) throw new Error('Invalid bin ID');
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('warehouse_bins').delete().eq('id', parsedId);
      if (error) throw error;
      return true;
    }
    return dbPrepare('DELETE FROM warehouse_bins WHERE id = ?').run(parsedId);
  },

  // ================= BIN STOCK =================
  async getBinStock(binId) {
    const parsedBinId = parseId(binId);
    if (!parsedBinId) return [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('bin_stock')
        .select('*, items(name, item_code, unit)')
        .eq('bin_id', parsedBinId);
      if (error) throw error;
      return data.map(d => ({
        ...d,
        item_name: d.items?.name,
        item_code: d.items?.item_code,
        unit: d.items?.unit
      }));
    }
    return dbPrepare(`
      SELECT bs.*, i.name as item_name, i.item_code, i.unit 
      FROM bin_stock bs
      JOIN items i ON bs.item_id = i.id
      WHERE bs.bin_id = ?
    `).all(parsedBinId);
  },

  async adjustBinStock(binId, itemId, delta) {
    const parsedBinId = parseId(binId);
    const parsedItemId = parseId(itemId);
    const numericDelta = Number(delta);
    if (!parsedBinId || !parsedItemId || isNaN(numericDelta)) {
      throw new Error('Invalid parameters for adjusting bin stock');
    }
    if (isCloudEnabled()) {
      const { data: current } = await getSupabase().from('bin_stock').select('quantity').eq('bin_id', parsedBinId).eq('item_id', parsedItemId).maybeSingle();
      const newQty = (current?.quantity || 0) + numericDelta;
      
      if (newQty <= 0) {
        await getSupabase().from('bin_stock').delete().eq('bin_id', parsedBinId).eq('item_id', parsedItemId);
      } else {
        await getSupabase().from('bin_stock').upsert({ bin_id: parsedBinId, item_id: parsedItemId, quantity: newQty }, { onConflict: 'bin_id,item_id' });
      }
      return true;
    }
    
    return dbTransaction(() => {
      dbPrepare(`
        INSERT INTO bin_stock (bin_id, item_id, quantity) 
        VALUES (?, ?, ?) 
        ON CONFLICT(bin_id, item_id) 
        DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = CURRENT_TIMESTAMP
      `).run(parsedBinId, parsedItemId, numericDelta);
      
      // Cleanup empty records
      dbPrepare(`DELETE FROM bin_stock WHERE quantity <= 0`).run();
    })();
  }
};

module.exports = WarehouseBinsRepo;

