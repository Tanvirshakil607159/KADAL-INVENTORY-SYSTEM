const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const ItemsRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase
        .from('items')
        .select('*, categories(name), suppliers(name)')
        .eq('is_active', true);

      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
      if (filters.styleName) query = query.eq('style_name', filters.styleName);
      if (filters.orderNumber) query = query.eq('order_number', filters.orderNumber);
      if (filters.purchaseNo) query = query.eq('purchase_no', filters.purchaseNo);
      if (filters.buyerName) query = query.eq('buyer_name', filters.buyerName);
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,color.ilike.%${filters.search}%,buyer_name.ilike.%${filters.search}%,style_name.ilike.%${filters.search}%,purchase_no.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%`);
      }
      if (filters.lowStock) {
        query = query.lte('current_stock', 'min_stock_level');
      }

      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      
      // Map Supabase relation format to match local format
      return data.map(i => ({
        ...i,
        category_name: i.categories?.name,
        supplier_name: i.suppliers?.name
      }));
    }

    // Local Fallback
    let where = ['i.is_active = 1'];
    let params = [];
    if (filters.categoryId) { where.push('i.category_id = ?'); params.push(filters.categoryId); }
    if (filters.supplierId) { where.push('i.supplier_id = ?'); params.push(filters.supplierId); }
    if (filters.styleName) { where.push('i.style_name = ?'); params.push(filters.styleName); }
    if (filters.orderNumber) { where.push('i.order_number = ?'); params.push(filters.orderNumber); }
    if (filters.purchaseNo) { where.push('i.purchase_no = ?'); params.push(filters.purchaseNo); }
    if (filters.buyerName) { where.push('i.buyer_name = ?'); params.push(filters.buyerName); }
    if (filters.search) {
      where.push('(i.name LIKE ? OR i.item_code LIKE ? OR i.color LIKE ? OR i.buyer_name LIKE ? OR i.style_name LIKE ? OR i.purchase_no LIKE ? OR i.order_number LIKE ?)');
      const s = `%${filters.search}%`; params.push(s, s, s, s, s, s, s);
    }
    if (filters.lowStock) { where.push('i.current_stock <= i.min_stock_level'); }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return dbPrepare(`SELECT i.*, c.name as category_name, s.name as supplier_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN suppliers s ON i.supplier_id = s.id ${w} ORDER BY i.name ASC`).all(...params);
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('items')
        .select('*, categories(name), suppliers(name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return {
        ...data,
        category_name: data.categories?.name,
        supplier_name: data.suppliers?.name
      };
    }
    return dbPrepare(`SELECT i.*, c.name as category_name, s.name as supplier_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN suppliers s ON i.supplier_id = s.id WHERE i.id = ?`).get(id);
  },

  async search(query) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('items')
        .select('*, categories(name)')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,item_code.ilike.%${query}%,color.ilike.%${query}%,buyer_name.ilike.%${query}%,style_name.ilike.%${query}%,purchase_no.ilike.%${query}%,order_number.ilike.%${query}%`)
        .limit(50)
        .order('name', { ascending: true });
      if (error) throw error;
      return data.map(i => ({ ...i, category_name: i.categories?.name }));
    }
    const s = `%${query}%`;
    return dbPrepare(`SELECT i.*, c.name as category_name FROM items i LEFT JOIN categories c ON i.category_id = c.id WHERE i.is_active = 1 AND (i.name LIKE ? OR i.item_code LIKE ? OR i.color LIKE ? OR i.buyer_name LIKE ? OR i.style_name LIKE ? OR i.purchase_no LIKE ? OR i.order_number LIKE ?) ORDER BY i.name ASC LIMIT 50`).all(s, s, s, s, s, s, s);
  },

  async create(data) {
    if (isCloudEnabled()) {
      const finalCode = await this.getNextCode();
      const { data: inserted, error } = await getSupabase()
        .from('items')
        .insert([{
          item_code: finalCode,
          name: data.name,
          category_id: data.categoryId || null,
          size: data.size || null,
          color: data.color || null,
          unit: data.unit || 'pcs',
          supplier_id: data.supplierId || null,
          opening_stock: data.openingStock || 0,
          current_stock: data.openingStock || 0,
          min_stock_level: data.minStockLevel || 0,
          notes: data.notes || null,
          buyer_name: data.buyerName || null,
          style_name: data.styleName || null,
          purchase_no: data.purchaseNo || null,
          order_number: data.orderNumber || null,
          order_quantity: data.orderQuantity || 0,
          unit_price: data.unitPrice || 0,
          currency: data.currency || 'BDT'
        }])
        .select()
        .single();
      if (error) throw error;
      return inserted.id;
    }
    const finalCode = this.getNextCode();
    return dbPrepare(`INSERT INTO items (item_code, name, category_id, size, color, unit, supplier_id, opening_stock, current_stock, min_stock_level, notes, buyer_name, style_name, purchase_no, order_number, order_quantity, unit_price, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      finalCode, data.name, data.categoryId||null, data.size||null, data.color||null, data.unit||'pcs', data.supplierId||null, data.openingStock||0, data.openingStock||0, data.minStockLevel||0, data.notes||null, data.buyerName||null, data.styleName||null, data.purchaseNo||null, data.orderNumber||null, data.orderQuantity||0, data.unitPrice||0, data.currency||'BDT'
    ).lastInsertRowid;
  },

  async update(id, data) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase()
        .from('items')
        .update({
          name: data.name,
          category_id: data.categoryId || null,
          size: data.size || null,
          color: data.color || null,
          unit: data.unit || 'pcs',
          supplier_id: data.supplierId || null,
          min_stock_level: data.minStockLevel || 0,
          notes: data.notes || null,
          buyer_name: data.buyerName || null,
          style_name: data.styleName || null,
          purchase_no: data.purchaseNo || null,
          order_number: data.orderNumber || null,
          order_quantity: data.orderQuantity || 0,
          unit_price: data.unitPrice || 0,
          currency: data.currency || 'BDT',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE items SET name=?, category_id=?, size=?, color=?, unit=?, supplier_id=?, min_stock_level=?, notes=?, buyer_name=?, style_name=?, purchase_no=?, order_number=?, order_quantity=?, unit_price=?, currency=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      data.name, data.categoryId||null, data.size||null, data.color||null, data.unit||'pcs', data.supplierId||null, data.minStockLevel||0, data.notes||null, data.buyerName||null, data.styleName||null, data.purchaseNo||null, data.orderNumber||null, data.orderQuantity||0, data.unitPrice||0, data.currency||'BDT', id
    );
  },

  async updateStock(id, newStock) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase()
        .from('items')
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newStock, id);
  },

  async delete(id) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase()
        .from('items')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE items SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  },

  async getCount() {
    if (isCloudEnabled()) {
      const { count, error } = await getSupabase()
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count;
    }
    return dbPrepare('SELECT COUNT(*) as count FROM items WHERE is_active = 1').get().count;
  },

  async getTotalStock() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('items')
        .select('current_stock')
        .eq('is_active', true);
      if (error) throw error;
      return data.reduce((sum, item) => sum + (item.current_stock || 0), 0);
    }
    return dbPrepare('SELECT COALESCE(SUM(current_stock), 0) as total FROM items WHERE is_active = 1').get().total;
  },

  async getTotalValue() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('items')
        .select('current_stock, unit_price')
        .eq('is_active', true);
      if (error) throw error;
      return data.reduce((sum, item) => sum + ((item.current_stock || 0) * (item.unit_price || 0)), 0);
    }
    return dbPrepare('SELECT COALESCE(SUM(current_stock * unit_price), 0) as total FROM items WHERE is_active = 1').get().total;
  },

  async getLowStockCount() {
    if (isCloudEnabled()) {
      // Note: Supabase doesn't easily support column-to-column comparison in basic queries without RPC or raw SQL
      // For now, we'll fetch and filter, or use a view if needed.
      const { data, error } = await getSupabase()
        .from('items')
        .select('current_stock, min_stock_level')
        .eq('is_active', true);
      if (error) throw error;
      return data.filter(i => i.current_stock <= i.min_stock_level && i.min_stock_level > 0).length;
    }
    return dbPrepare('SELECT COUNT(*) as count FROM items WHERE is_active = 1 AND current_stock <= min_stock_level AND min_stock_level > 0').get().count;
  },

  async getLowStockItems(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase
        .from('items')
        .select('*, categories(name)')
        .eq('is_active', true);
      
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
      if (filters.buyerName) query = query.eq('buyer_name', filters.buyerName);
      if (filters.styleName) query = query.eq('style_name', filters.styleName);
      if (filters.orderNumber) query = query.eq('order_number', filters.orderNumber);
      if (filters.purchaseNo) query = query.eq('purchase_no', filters.purchaseNo);

      const { data, error } = await query;
      if (error) throw error;
      return data
        .filter(i => i.current_stock <= i.min_stock_level && i.min_stock_level > 0)
        .map(i => ({ ...i, category_name: i.categories?.name }))
        .sort((a, b) => (a.current_stock - a.min_stock_level) - (b.current_stock - b.min_stock_level));
    }

    let where = ['i.is_active = 1', 'i.current_stock <= i.min_stock_level', 'i.min_stock_level > 0'];
    let params = [];
    if (filters.categoryId) { where.push('i.category_id = ?'); params.push(filters.categoryId); }
    if (filters.supplierId) { where.push('i.supplier_id = ?'); params.push(filters.supplierId); }
    if (filters.buyerName) { where.push('i.buyer_name = ?'); params.push(filters.buyerName); }
    if (filters.styleName) { where.push('i.style_name = ?'); params.push(filters.styleName); }
    if (filters.orderNumber) { where.push('i.order_number = ?'); params.push(filters.orderNumber); }
    if (filters.purchaseNo) { where.push('i.purchase_no = ?'); params.push(filters.purchaseNo); }

    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return dbPrepare(`SELECT i.*, c.name as category_name FROM items i LEFT JOIN categories c ON i.category_id = c.id ${w} ORDER BY (i.current_stock - i.min_stock_level) ASC`).all(...params);
  },

  async checkCodeExists(code, excludeId = null) {
    if (isCloudEnabled()) {
      let query = getSupabase().from('items').select('id').eq('item_code', code);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query;
      if (error) throw error;
      return data.length > 0 ? data[0] : null;
    }
    if (excludeId) return dbPrepare('SELECT id FROM items WHERE item_code = ? AND id != ?').get(code, excludeId);
    return dbPrepare('SELECT id FROM items WHERE item_code = ?').get(code);
  },

  async getDistinctValues() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('items')
        .select('name, color, size, style_name, purchase_no, order_number, buyer_name')
        .eq('is_active', true);
      if (error) throw error;

      const getUnique = (field) => [...new Set(data.map(i => i[field]).filter(v => v && v !== ''))].sort();
      
      return {
        names: getUnique('name'),
        colors: getUnique('color'),
        sizes: getUnique('size'),
        styles: getUnique('style_name'),
        purchases: getUnique('purchase_no'),
        orders: getUnique('order_number'),
        buyers: getUnique('buyer_name'),
      };
    }
    const names = dbPrepare("SELECT DISTINCT name FROM items WHERE is_active = 1 AND name IS NOT NULL ORDER BY name").all().map(r => r.name);
    const colors = dbPrepare("SELECT DISTINCT color FROM items WHERE is_active = 1 AND color IS NOT NULL AND color != '' ORDER BY color").all().map(r => r.color);
    const sizes = dbPrepare("SELECT DISTINCT size FROM items WHERE is_active = 1 AND size IS NOT NULL AND size != '' ORDER BY size").all().map(r => r.size);
    const styles = dbPrepare("SELECT DISTINCT style_name FROM items WHERE is_active = 1 AND style_name IS NOT NULL AND style_name != '' ORDER BY style_name").all().map(r => r.style_name);
    const purchases = dbPrepare("SELECT DISTINCT purchase_no FROM items WHERE is_active = 1 AND purchase_no IS NOT NULL AND purchase_no != '' ORDER BY purchase_no").all().map(r => r.purchase_no);
    const orders = dbPrepare("SELECT DISTINCT order_number FROM items WHERE is_active = 1 AND order_number IS NOT NULL AND order_number != '' ORDER BY order_number").all().map(r => r.order_number);
    const buyers = dbPrepare("SELECT DISTINCT buyer_name FROM items WHERE is_active = 1 AND buyer_name IS NOT NULL AND buyer_name != '' ORDER BY buyer_name").all().map(r => r.buyer_name);
    return { names, colors, sizes, styles, purchases, orders, buyers };
  },

  async getNextCode() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('items')
        .select('item_code')
        .like('item_code', 'KADAL-%')
        .order('item_code', { ascending: false })
        .limit(1);
      if (error) throw error;
      
      let seq = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].item_code;
        const parts = lastCode.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num)) seq = num + 1;
      }
      return `KADAL-${seq.toString().padStart(4, '0')}`;
    }
    const last = dbPrepare("SELECT item_code FROM items WHERE item_code LIKE 'KADAL-%' ORDER BY item_code DESC LIMIT 1").get();
    let seq = 1;
    if (last && last.item_code) {
      const parts = last.item_code.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) seq = num + 1;
    }
    return `KADAL-${seq.toString().padStart(4, '0')}`;
  },
};

module.exports = ItemsRepo;
