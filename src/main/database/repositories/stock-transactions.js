const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const StockTransactionsRepo = {
  async create(data) {
    const OneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    if (isCloudEnabled()) {
      // duplicate check
      const { data: duplicates } = await getSupabase()
        .from('stock_transactions')
        .select('id')
        .eq('item_id', data.itemId)
        .eq('type', data.type)
        .eq('quantity', data.quantity)
        .eq('created_by', data.createdBy || null)
        .gte('created_at', OneMinuteAgo);
        
      if (duplicates && duplicates.length > 0) {
        console.warn(`[StockTransactionsRepo] Duplicate transaction blocked for item ${data.itemId}`);
        return duplicates[0].id;
      }

      const { data: inserted, error } = await getSupabase()
        .from('stock_transactions')
        .insert([{
          item_id: data.itemId,
          type: data.type,
          quantity: data.quantity,
          stock_before: data.stockBefore,
          stock_after: data.stockAfter,
          challan_id: data.challanId || null,
          reference: data.reference || null,
          notes: data.notes || null,
          created_by: data.createdBy || null
        }])
        .select()
        .single();
      if (error) throw error;
      return inserted.id;
    }

    // duplicate check for local DB
    const dup = dbPrepare(`SELECT id FROM stock_transactions WHERE item_id = ? AND type = ? AND quantity = ? AND (created_by = ? OR (created_by IS NULL AND ? IS NULL)) AND created_at >= ? LIMIT 1`).get(data.itemId, data.type, data.quantity, data.createdBy || null, data.createdBy || null, OneMinuteAgo);
    
    if (dup) {
      console.warn(`[StockTransactionsRepo] Duplicate local transaction blocked for item ${data.itemId}`);
      return dup.id;
    }

    return dbPrepare(`INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, challan_id, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      data.itemId, data.type, data.quantity, data.stockBefore, data.stockAfter, data.challanId || null, data.reference || null, data.notes || null, data.createdBy || null
    ).lastInsertRowid;
  },

  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase
        .from('stock_transactions')
        .select(`
          *,
          items (
            name, item_code, unit, unit_price, currency, 
            style_name, purchase_no, order_number, order_quantity, size, color, buyer_name
          ),
          users (full_name),
          challans (challan_number)
        `);

      if (filters.itemId) query = query.eq('item_id', filters.itemId);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59.999Z');

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;

      return data.map(st => ({
        ...st,
        item_name: st.items?.name,
        item_code: st.items?.item_code,
        item_unit: st.items?.unit,
        unit_price: st.items?.unit_price,
        currency: st.items?.currency,
        style_name: st.items?.style_name,
        purchase_no: st.items?.purchase_no,
        order_number: st.items?.order_number,
        size: st.items?.size,
        color: st.items?.color,
        buyer_name: st.items?.buyer_name,
        created_by_name: st.users?.full_name,
        challan_number: st.challans?.challan_number
      }));
    }

    let where = []; let params = [];
    if (filters.itemId) { where.push('st.item_id = ?'); params.push(filters.itemId); }
    if (filters.type) { where.push('st.type = ?'); params.push(filters.type); }
    if (filters.dateFrom) { where.push('st.created_at >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push("st.created_at <= ?"); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return dbPrepare(`SELECT st.*, i.name as item_name, i.item_code, i.unit as item_unit, i.unit_price, i.currency, i.style_name, i.purchase_no, i.order_number, i.size, i.color, i.buyer_name, u.full_name as created_by_name, ch.challan_number FROM stock_transactions st JOIN items i ON st.item_id = i.id LEFT JOIN users u ON st.created_by = u.id LEFT JOIN challans ch ON st.challan_id = ch.id ${w} ORDER BY st.created_at DESC LIMIT 1000`).all(...params);
  },

  async getMovementSummary(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();

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

      // Fetch items first
      let itemsQuery = supabase.from('items').select('*').eq('is_active', true).order('name').order('id');
      if (filters.search) {
        itemsQuery = itemsQuery.or(`name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,style_name.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%,purchase_no.ilike.%${filters.search}%`);
      }
      if (filters.styleName) itemsQuery = itemsQuery.eq('style_name', filters.styleName);
      if (filters.orderNumber) itemsQuery = itemsQuery.eq('order_number', filters.orderNumber);
      if (filters.purchaseNo) itemsQuery = itemsQuery.eq('purchase_no', filters.purchaseNo);
      if (filters.buyerName) itemsQuery = itemsQuery.eq('buyer_name', filters.buyerName);
      if (filters.categoryId) itemsQuery = itemsQuery.eq('category_id', filters.categoryId);

      const items = await fetchAll(itemsQuery);

      // Fetch transactions for these items within date range
      let txQuery = supabase.from('stock_transactions').select('item_id, type, quantity');
      if (filters.dateFrom) txQuery = txQuery.gte('created_at', filters.dateFrom);
      if (filters.dateTo) txQuery = txQuery.lte('created_at', filters.dateTo + 'T23:59:59.999Z');

      txQuery = txQuery.order('id');
      const txs = await fetchAll(txQuery);

      return items.map(i => {
        const itemTxs = (txs || []).filter(t => Number(t.item_id) === Number(i.id));
        const total_in = itemTxs.filter(t => t.type === 'IN').reduce((sum, t) => sum + (t.quantity || 0), 0);
        const total_out = itemTxs.filter(t => t.type === 'OUT').reduce((sum, t) => sum + (t.quantity || 0), 0);
        return {
          ...i,
          item_name: i.name,
          total_in,
          total_out
        };
      });
    }

    const { dateFrom, dateTo, search, styleName, orderNumber, purchaseNo } = filters;
    let joinConditions = 'i.id = st.item_id';
    let whereConditions = 'i.is_active = 1';
    let joinParams = [];
    let whereParams = [];

    if (dateFrom) { joinConditions += ' AND st.created_at >= ?'; joinParams.push(dateFrom); }
    if (dateTo) { joinConditions += ' AND st.created_at <= ?'; joinParams.push(dateTo + 'T23:59:59.999Z'); }

    if (search) {
      whereConditions += ' AND (i.name LIKE ? OR i.item_code LIKE ? OR i.style_name LIKE ? OR i.order_number LIKE ? OR i.purchase_no LIKE ?)';
      const s = `%${search}%`;
      whereParams.push(s, s, s, s, s);
    }

    if (styleName) { whereConditions += ' AND i.style_name = ?'; whereParams.push(styleName); }
    if (orderNumber) { whereConditions += ' AND i.order_number = ?'; whereParams.push(orderNumber); }
    if (purchaseNo) { whereConditions += ' AND i.purchase_no = ?'; whereParams.push(purchaseNo); }
    if (filters.buyerName) { whereConditions += ' AND i.buyer_name = ?'; whereParams.push(filters.buyerName); }
    if (filters.categoryId) { whereConditions += ' AND i.category_id = ?'; whereParams.push(filters.categoryId); }

    const params = [...joinParams, ...whereParams];
    return dbPrepare(`SELECT i.id, i.item_code, i.name as item_name, i.unit, i.unit_price, i.currency, i.style_name, i.purchase_no, i.order_number, i.order_quantity, i.size, i.color, i.buyer_name, COALESCE(SUM(CASE WHEN st.type = 'IN' THEN st.quantity ELSE 0 END), 0) as total_in, COALESCE(SUM(CASE WHEN st.type = 'OUT' THEN st.quantity ELSE 0 END), 0) as total_out, i.current_stock FROM items i LEFT JOIN stock_transactions st ON ${joinConditions} WHERE ${whereConditions} GROUP BY i.id ORDER BY i.name`).all(...params);
  },

  async getDailySummary(date) {
    if (isCloudEnabled()) {
      const start = date + 'T00:00:00Z';
      const end = date + 'T23:59:59.999Z';
      const { data, error } = await getSupabase()
        .from('stock_transactions')
        .select('id, type, quantity')
        .gte('created_at', start)
        .lte('created_at', end);
      if (error) throw error;

      return {
        in_transactions: data.filter(t => t.type === 'IN').length,
        out_transactions: data.filter(t => t.type === 'OUT').length,
        total_in_qty: data.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0),
        total_out_qty: data.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0)
      };
    }
    return dbPrepare(`SELECT COUNT(DISTINCT CASE WHEN type = 'IN' THEN id END) as in_transactions, COUNT(DISTINCT CASE WHEN type = 'OUT' THEN id END) as out_transactions, COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) as total_in_qty, COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) as total_out_qty FROM stock_transactions WHERE DATE(created_at) = DATE(?)`).get(date);
  },

  async getFieldSuggestions(field, query = '') {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('stock_transactions')
        .select(field)
        .ilike(field, `%${query}%`)
        .not(field, 'is', null)
        .neq(field, '')
        .limit(20);
      if (error) throw error;
      return [...new Set(data.map(r => r[field]))].sort();
    }
    const validFields = { 'reference': 'reference', 'notes': 'notes' };
    const dbField = validFields[field];
    if (!dbField) return [];
    const q = `%${query}%`;
    return dbPrepare(`SELECT DISTINCT ${dbField} as value FROM stock_transactions WHERE ${dbField} LIKE ? AND ${dbField} IS NOT NULL AND TRIM(${dbField}) != '' ORDER BY ${dbField} ASC LIMIT 20`).all(q).map(r => r.value);
  },
};

module.exports = StockTransactionsRepo;
