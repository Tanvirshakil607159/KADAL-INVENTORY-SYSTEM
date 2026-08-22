const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');
const { normalizeBuyerName } = require('../../utils/buyer-normalizer');

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
        query = query.or(`name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,color.ilike.%${filters.search}%,size.ilike.%${filters.search}%,buyer_name.ilike.%${filters.search}%,style_name.ilike.%${filters.search}%,purchase_no.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%`);
      }
      if (filters.lowStock) {
        query = query.lte('current_stock', 'min_stock_level');
      }

      async function fetchAll(queryBuilder) {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data, error } = await queryBuilder.range(from, to);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < pageSize) break;
          page++;
        }
        return allData;
      }

      const data = await fetchAll(query.order('name', { ascending: true }).order('id', { ascending: true }));
      
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
      where.push('(i.name LIKE ? OR i.item_code LIKE ? OR i.color LIKE ? OR i.size LIKE ? OR i.buyer_name LIKE ? OR i.style_name LIKE ? OR i.purchase_no LIKE ? OR i.order_number LIKE ?)');
      const s = `%${filters.search}%`; params.push(s, s, s, s, s, s, s, s);
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
        .or(`name.ilike.%${query}%,item_code.ilike.%${query}%,color.ilike.%${query}%,size.ilike.%${query}%,buyer_name.ilike.%${query}%,style_name.ilike.%${query}%,purchase_no.ilike.%${query}%,order_number.ilike.%${query}%`)
        .limit(50)
        .order('name', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data.map(i => ({ ...i, category_name: i.categories?.name }));
    }
    const s = `%${query}%`;
    return dbPrepare(`SELECT i.*, c.name as category_name FROM items i LEFT JOIN categories c ON i.category_id = c.id WHERE i.is_active = 1 AND (i.name LIKE ? OR i.item_code LIKE ? OR i.color LIKE ? OR i.size LIKE ? OR i.buyer_name LIKE ? OR i.style_name LIKE ? OR i.purchase_no LIKE ? OR i.order_number LIKE ?) ORDER BY i.name ASC LIMIT 50`).all(s, s, s, s, s, s, s, s);
  },

  async create(data) {
    const finalCode = data.itemCode || await this.getNextCode();
    // Normalize buyer name to canonical format
    const normalizedBuyer = data.buyerName ? normalizeBuyerName(data.buyerName) : null;
    
    if (isCloudEnabled()) {
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
          buyer_name: normalizedBuyer,
          style_name: data.styleName || null,
          purchase_no: data.purchaseNo || null,
          order_number: data.orderNumber || null,
          order_quantity: data.orderQuantity || 0,
          unit_price: data.unitPrice || 0,
          currency: data.currency || 'BDT',
          source_type: data.sourceType || 'SOURCE'
        }])
        .select()
        .single();
      if (error) throw error;
      return inserted.id;
    }

    return dbPrepare(`INSERT INTO items (item_code, name, category_id, size, color, unit, supplier_id, opening_stock, current_stock, min_stock_level, notes, buyer_name, style_name, purchase_no, order_number, order_quantity, unit_price, currency, source_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      finalCode, data.name, data.categoryId||null, data.size||null, data.color||null, data.unit||'pcs', data.supplierId||null, data.openingStock||0, data.openingStock||0, data.minStockLevel||0, data.notes||null, normalizedBuyer, data.styleName||null, data.purchaseNo||null, data.orderNumber||null, data.orderQuantity||0, data.unitPrice||0, data.currency||'BDT', data.sourceType||'SOURCE'
    ).lastInsertRowid;
  },

  async update(id, data) {
    // Normalize buyer name to canonical format
    const normalizedBuyer = data.buyerName ? normalizeBuyerName(data.buyerName) : null;
    
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
          buyer_name: normalizedBuyer,
          style_name: data.styleName || null,
          purchase_no: data.purchaseNo || null,
          order_number: data.orderNumber || null,
          order_quantity: data.orderQuantity || 0,
          unit_price: data.unitPrice || 0,
          currency: data.currency || 'BDT',
          source_type: data.sourceType || 'SOURCE',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE items SET name=?, category_id=?, size=?, color=?, unit=?, supplier_id=?, min_stock_level=?, notes=?, buyer_name=?, style_name=?, purchase_no=?, order_number=?, order_quantity=?, unit_price=?, currency=?, source_type=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      data.name, data.categoryId||null, data.size||null, data.color||null, data.unit||'pcs', data.supplierId||null, data.minStockLevel||0, data.notes||null, normalizedBuyer, data.styleName||null, data.purchaseNo||null, data.orderNumber||null, data.orderQuantity||0, data.unitPrice||0, data.currency||'BDT', data.sourceType||'SOURCE', id
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

  async adjustStock(id, delta) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      // Supabase rpc for atomic increment/decrement is preferred, but for now we'll use a direct update with a formula if supported or just the standard way
      // Actually, Supabase doesn't support easy formulas in .update() without RPC.
      // So we'll fetch and update, but since we are in a service we'll trust the atomic nature of SQL for local and do our best for cloud.
      const { data, error: fetchErr } = await supabase.from('items').select('current_stock').eq('id', id).single();
      if (fetchErr) throw fetchErr;
      const { error } = await supabase.from('items')
        .update({ current_stock: data.current_stock + delta, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE items SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(delta, id);
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
        .select('current_stock, unit_price, currency')
        .eq('is_active', true);
      if (error) throw error;
      const res = { BDT: 0, USD: 0 };
      data.forEach(i => {
        const val = (i.current_stock || 0) * (i.unit_price || 0);
        if (i.currency === 'USD') res.USD += val;
        else res.BDT += val;
      });
      return res;
    }
    const rows = dbPrepare('SELECT currency, SUM(current_stock * unit_price) as total FROM items WHERE is_active = 1 GROUP BY currency').all();
    const res = { BDT: 0, USD: 0 };
    rows.forEach(r => {
      if (r.currency === 'USD') res.USD = r.total;
      else res.BDT += r.total;
    });
    return res;
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
      if (data.length > 0) return data[0];

      // Also check pending approvals
      const { data: pending, error: pErr } = await getSupabase()
        .from('approvals')
        .select('data')
        .eq('type', 'CREATE_ITEM')
        .eq('status', 'PENDING');
      
      if (pErr) throw pErr;
      const found = pending.find(a => {
        const d = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
        return d.itemCode === code;
      });
      return found ? { id: 'pending' } : null;
    }

    if (excludeId) {
      const existing = dbPrepare('SELECT id FROM items WHERE item_code = ? AND id != ?').get(code, excludeId);
      if (existing) return existing;
    } else {
      const existing = dbPrepare('SELECT id FROM items WHERE item_code = ?').get(code);
      if (existing) return existing;
    }

    // Check pending approvals locally
    const pending = dbPrepare("SELECT data FROM approvals WHERE type = 'CREATE_ITEM' AND status = 'PENDING'").all();
    const found = pending.find(a => {
      const d = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
      return d.itemCode === code;
    });
    return found ? { id: 'pending' } : null;
  },

  async getDistinctValues() {
    if (isCloudEnabled()) {
      // Fetching only required columns to reduce bandwidth
      const { data, error } = await getSupabase()
        .from('items')
        .select('name, color, size, style_name, purchase_no, order_number, buyer_name, notes')
        .eq('is_active', true);
      
      if (error) throw error;

      // Efficient unique extraction
      const res = { names: new Set(), colors: new Set(), sizes: new Set(), styles: new Set(), purchases: new Set(), orders: new Set(), buyers: new Set(), notes: new Set() };
      
      data.forEach(i => {
        if (i.name) res.names.add(i.name);
        if (i.color) res.colors.add(i.color);
        if (i.size) res.sizes.add(i.size);
        if (i.style_name) res.styles.add(i.style_name);
        if (i.purchase_no) res.purchases.add(i.purchase_no);
        if (i.order_number) res.orders.add(i.order_number);
        if (i.buyer_name) res.buyers.add(i.buyer_name);
        if (i.notes) res.notes.add(i.notes);
      });

      const { data: cData } = await getSupabase()
        .from('challans')
        .select('receiver_name')
        .not('receiver_name', 'is', null)
        .neq('receiver_name', '');
      const receivers = new Set();
      if (cData) cData.forEach(c => receivers.add(c.receiver_name));

      return {
        names: [...res.names].sort(),
        colors: [...res.colors].sort(),
        sizes: [...res.sizes].sort(),
        styles: [...res.styles].sort(),
        purchases: [...res.purchases].sort(),
        orders: [...res.orders].sort(),
        buyers: [...res.buyers].sort(),
        notes: [...res.notes].sort(),
        receivers: [...receivers].sort(),
      };
    }

    const names = dbPrepare("SELECT DISTINCT name FROM items WHERE is_active = 1 AND name IS NOT NULL ORDER BY name").all().map(r => r.name);
    const colors = dbPrepare("SELECT DISTINCT color FROM items WHERE is_active = 1 AND color IS NOT NULL AND color != '' ORDER BY color").all().map(r => r.color);
    const sizes = dbPrepare("SELECT DISTINCT size FROM items WHERE is_active = 1 AND size IS NOT NULL AND size != '' ORDER BY size").all().map(r => r.size);
    const styles = dbPrepare("SELECT DISTINCT style_name FROM items WHERE is_active = 1 AND style_name IS NOT NULL AND style_name != '' ORDER BY style_name").all().map(r => r.style_name);
    const purchases = dbPrepare("SELECT DISTINCT purchase_no FROM items WHERE is_active = 1 AND purchase_no IS NOT NULL AND purchase_no != '' ORDER BY purchase_no").all().map(r => r.purchase_no);
    const orders = dbPrepare("SELECT DISTINCT order_number FROM items WHERE is_active = 1 AND order_number IS NOT NULL AND order_number != '' ORDER BY order_number").all().map(r => r.order_number);
    const buyers = dbPrepare("SELECT DISTINCT buyer_name FROM items WHERE is_active = 1 AND buyer_name IS NOT NULL AND buyer_name != '' ORDER BY buyer_name").all().map(r => r.buyer_name);
    const notes = dbPrepare("SELECT DISTINCT notes FROM items WHERE is_active = 1 AND notes IS NOT NULL AND notes != '' ORDER BY notes").all().map(r => r.notes);
    const receivers = dbPrepare("SELECT DISTINCT receiver_name FROM challans WHERE receiver_name IS NOT NULL AND TRIM(receiver_name) != '' ORDER BY receiver_name").all().map(r => r.receiver_name);
    return { names, colors, sizes, styles, purchases, orders, buyers, notes, receivers };
  },

  async getNextCode() {
    let allCodes = [];

    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('items')
        .select('item_code')
        .like('item_code', 'KADAL-%')
        .order('item_code', { ascending: false })
        .limit(2000); // Increased limit to be safer
      if (error) throw error;
      allCodes = (data || []).map(i => i.item_code);

      // Also fetch pending approvals to ensure they are skipped
      const { data: pending, error: pErr } = await getSupabase()
        .from('approvals')
        .select('data')
        .eq('type', 'CREATE_ITEM')
        .eq('status', 'PENDING');
      
      if (!pErr && pending) {
        pending.forEach(a => {
          const d = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
          if (d.itemCode) allCodes.push(d.itemCode);
        });
      }
    } else {
      const all = dbPrepare("SELECT item_code FROM items WHERE item_code LIKE 'KADAL-%'").all();
      allCodes = all.map(item => item.item_code);

      // Check pending approvals locally
      const pending = dbPrepare("SELECT data FROM approvals WHERE type = 'CREATE_ITEM' AND status = 'PENDING'").all();
      pending.forEach(a => {
        const d = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
        if (d.itemCode) allCodes.push(d.itemCode);
      });
    }

    let maxSeq = 0;
    allCodes.forEach(code => {
      const parts = code.split('-');
      for (let i = parts.length - 1; i >= 0; i--) {
        const num = parseInt(parts[i], 10);
        if (!isNaN(num) && /^\d+$/.test(parts[i])) {
          if (num > maxSeq) maxSeq = num;
          break;
        }
      }
    });

    return `KADAL-${(maxSeq + 1).toString().padStart(4, '0')}`;
  },
};

module.exports = ItemsRepo;
