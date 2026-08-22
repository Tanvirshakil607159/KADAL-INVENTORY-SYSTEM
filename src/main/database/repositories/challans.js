const { dbPrepare, dbTransaction, getSupabase, isCloudEnabled } = require('../connection');

const ChallansRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('challans').select(`
        *,
        users!challans_created_by_fkey (full_name),
        challan_items (quantity, items (name, buyer_name, style_name, order_number, purchase_no))
      `).order('challan_date', { ascending: false }).limit(500);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dateFrom) query = query.gte('challan_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('challan_date', filters.dateTo + 'T23:59:59.999Z');

      const { data, error } = await query;
      if (error) throw error;

      let result = data.map(c => {
        const ci = c.challan_items || [];
        return {
          ...c,
          created_by_name: c.users?.full_name,
          item_count: ci.length,
          total_quantity: ci.reduce((sum, item) => sum + (item.quantity || 0), 0),
          item_names: ci.map(item => item.items?.name).filter(Boolean).join(', '),
          buyer_names: [...new Set(ci.map(item => item.items?.buyer_name).filter(Boolean))].join(', ')
        };
      });

      // In-memory filtering for deep joins
      if (filters.search || filters.styleName || filters.orderNumber || filters.purchaseNo || filters.buyerName) {
        result = result.filter(c => {
          const ci = c.challan_items || [];
          let match = true;
          if (filters.search) {
            const s = filters.search.toLowerCase();
            const matchSearch = c.challan_number?.toLowerCase().includes(s) || 
                                c.receiver_name?.toLowerCase().includes(s) ||
                                ci.some(item => item.items?.name?.toLowerCase().includes(s) || 
                                                item.items?.style_name?.toLowerCase().includes(s) || 
                                                item.items?.order_number?.toLowerCase().includes(s) || 
                                                item.items?.purchase_no?.toLowerCase().includes(s));
            if (!matchSearch) match = false;
          }
          if (filters.styleName && !ci.some(item => item.items?.style_name === filters.styleName)) match = false;
          if (filters.orderNumber && !ci.some(item => item.items?.order_number === filters.orderNumber)) match = false;
          if (filters.purchaseNo && !ci.some(item => item.items?.purchase_no === filters.purchaseNo)) match = false;
          if (filters.buyerName && !ci.some(item => item.items?.buyer_name === filters.buyerName)) match = false;
          return match;
        });
      }
      if (filters.excludeUsedInGatePass) {
        const GatePassRepo = require('./gate-passes');
        const usedIds = await GatePassRepo.getUsedChallanIds();
        result = result.filter(c => !usedIds.includes(c.id));
      }
      return result;

    }

    let where = []; let params = [];
    if (filters.status) { where.push('c.status = ?'); params.push(filters.status); }
    if (filters.search) { 
      where.push('(c.challan_number LIKE ? OR c.receiver_name LIKE ? OR EXISTS (SELECT 1 FROM challan_items ci JOIN items i ON ci.item_id = i.id WHERE ci.challan_id = c.id AND (i.name LIKE ? OR i.style_name LIKE ? OR i.order_number LIKE ? OR i.purchase_no LIKE ?)))'); 
      const s = `%${filters.search}%`; params.push(s, s, s, s, s, s); 
    }
    if (filters.styleName) {
      where.push('EXISTS (SELECT 1 FROM challan_items ci JOIN items i ON ci.item_id = i.id WHERE ci.challan_id = c.id AND i.style_name = ?)');
      params.push(filters.styleName);
    }
    if (filters.orderNumber) {
      where.push('EXISTS (SELECT 1 FROM challan_items ci JOIN items i ON ci.item_id = i.id WHERE ci.challan_id = c.id AND i.order_number = ?)');
      params.push(filters.orderNumber);
    }
    if (filters.purchaseNo) {
      where.push('EXISTS (SELECT 1 FROM challan_items ci JOIN items i ON ci.item_id = i.id WHERE ci.challan_id = c.id AND i.purchase_no = ?)');
      params.push(filters.purchaseNo);
    }
    if (filters.buyerName) {
      where.push('EXISTS (SELECT 1 FROM challan_items ci JOIN items i ON ci.item_id = i.id WHERE ci.challan_id = c.id AND i.buyer_name = ?)');
      params.push(filters.buyerName);
    }
    if (filters.dateFrom && filters.dateFrom.trim()) { where.push('c.challan_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo && filters.dateTo.trim()) { where.push("c.challan_date <= ?"); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    
    if (filters.excludeUsedInGatePass) {
      const GatePassRepo = require('./gate-passes');
      const usedIds = await GatePassRepo.getUsedChallanIds();
      if (usedIds.length > 0) {
        where.push(`c.id NOT IN (${usedIds.join(',')})`);
      }
    }

    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    return dbPrepare(`SELECT c.*, u.full_name as created_by_name, 
      (SELECT COUNT(*) FROM challan_items ci WHERE ci.challan_id = c.id) as item_count, 
      (SELECT COALESCE(SUM(ci.quantity), 0) FROM challan_items ci WHERE ci.challan_id = c.id) as total_quantity,
      (SELECT GROUP_CONCAT(i.name, ', ') FROM challan_items ci JOIN items i ON ci.item_id = i.id WHERE ci.challan_id = c.id) as item_names,
      (SELECT GROUP_CONCAT(DISTINCT i.buyer_name) FROM challan_items ci JOIN items i ON ci.item_id = i.id WHERE ci.challan_id = c.id) as buyer_names
      FROM challans c LEFT JOIN users u ON c.created_by = u.id ${w} ORDER BY c.challan_date DESC LIMIT 500`).all(...params);
  },

  async getDetailedHistory(filters = {}) {
    const limitCount = filters.limit || 1000;
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('challan_items').select(`
        id, quantity, unit, notes, challan_id,
        challans!inner(challan_number, challan_date, receiver_name, status, created_at, users!challans_created_by_fkey(full_name)),
        items!inner(*, categories(name))
      `).order('challan_date', { foreignTable: 'challans', ascending: false });

      if (filters.status) query = query.eq('challans.status', filters.status);
      if (filters.dateFrom) query = query.gte('challans.challan_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('challans.challan_date', filters.dateTo + 'T23:59:59.999Z');
      if (filters.receiverName) query = query.ilike('challans.receiver_name', `%${filters.receiverName}%`);
      if (filters.buyerName) query = query.eq('items.buyer_name', filters.buyerName);
      if (filters.styleName) query = query.eq('items.style_name', filters.styleName);
      if (filters.orderNumber) query = query.eq('items.order_number', filters.orderNumber);
      if (filters.purchaseNo) query = query.eq('items.purchase_no', filters.purchaseNo);

      let data = [];
      let page = 0;
      let pageSize = 1000;
      while (data.length < limitCount) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data: pageData, error } = await query.range(from, to);
        if (error) throw error;
        if (!pageData || pageData.length === 0) break;
        data = data.concat(pageData);
        if (pageData.length < pageSize) break;
        page++;
      }
      
      // Enforce the requested limit exactly just in case
      if (data.length > limitCount) {
        data = data.slice(0, limitCount);
      }

      // Optimize: Fetch all totals in one go instead of a loop
      const itemIds = [...new Set(data.map(r => r.items.id))];
      const { data: allTotals, error: totalErr } = await supabase
        .from('challan_items')
        .select('item_id, quantity, challans!inner(status)')
        .in('item_id', itemIds)
        .eq('challans.status', 'ACTIVE');

      if (totalErr) throw totalErr;

      // Map totals by itemId
      const totalMap = {};
      (allTotals || []).forEach(t => {
        totalMap[t.item_id] = (totalMap[t.item_id] || 0) + t.quantity;
      });

      let result = data.map(row => {
        const item = row.items;
        const challan = row.challans;
        const total_shipped = totalMap[item.id] || 0;
        return {
          id: row.id,
          challan_id: row.challan_id,
          item_id: item.id,
          item_code: item.item_code,
          challan_number: challan.challan_number,
          challan_date: challan.challan_date,
          receiver_name: challan.receiver_name,
          status: challan.status,
          created_by_name: challan.users?.full_name,
          item_name: item.name,
          category_name: item.categories?.name,
          buyer_name: item.buyer_name,
          style_name: item.style_name,
          order_number: item.order_number,
          purchase_no: item.purchase_no,
          size: item.size,
          color: item.color,
          order_quantity: item.order_quantity,
          unit_price: item.unit_price,
          currency: item.currency,
          shipped_quantity: row.quantity,
          unit: row.unit,
          total_shipped,
          balance: (item.order_quantity || 0) - total_shipped
        };
      });

      if (filters.search) {
        const s = filters.search.toLowerCase();
        result = result.filter(r => 
          r.challan_number?.toLowerCase().includes(s) ||
          r.receiver_name?.toLowerCase().includes(s) ||
          r.item_name?.toLowerCase().includes(s) ||
          r.style_name?.toLowerCase().includes(s) ||
          r.order_number?.toLowerCase().includes(s) ||
          r.purchase_no?.toLowerCase().includes(s)
        );
      }

      return result;
    }


    let where = []; let params = [];
    if (filters.status) { where.push('c.status = ?'); params.push(filters.status); }
    if (filters.dateFrom) { where.push('c.challan_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('c.challan_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    if (filters.receiverName) { where.push('c.receiver_name LIKE ?'); params.push(`%${filters.receiverName}%`); }
    if (filters.buyerName) { where.push('i.buyer_name = ?'); params.push(filters.buyerName); }
    if (filters.styleName) { where.push('i.style_name = ?'); params.push(filters.styleName); }
    if (filters.orderNumber) { where.push('i.order_number = ?'); params.push(filters.orderNumber); }
    if (filters.purchaseNo) { where.push('i.purchase_no = ?'); params.push(filters.purchaseNo); }
    if (filters.search) {
      where.push('(c.challan_number LIKE ? OR c.receiver_name LIKE ? OR i.name LIKE ? OR i.style_name LIKE ? OR i.order_number LIKE ? OR i.purchase_no LIKE ?)');
      const s = `%${filters.search}%`; params.push(s, s, s, s, s, s);
    }
    
    if (filters.excludeUsedInGatePass) {
       const GatePassRepo = require('./gate-passes');
       const usedIds = await GatePassRepo.getUsedChallanIds();
       if (usedIds.length > 0) {
         where.push(`c.id NOT IN (${usedIds.join(',')})`);
       }
    }

    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT 
        ci.id as id, ci.challan_id, ci.quantity as shipped_quantity, ci.unit as unit,
        c.challan_number as challan_number, c.challan_date as challan_date, c.receiver_name as receiver_name, c.status as status,
        u.full_name as created_by_name,
        i.name as item_name, i.id as item_id, i.item_code as item_code, i.style_name as style_name, i.order_number as order_number, i.purchase_no as purchase_no, i.order_quantity as order_quantity, i.size as size, i.color as color, i.buyer_name as buyer_name, i.unit_price as unit_price, i.currency as currency,
        cat.name as category_name,
        (SELECT COALESCE(SUM(ci2.quantity), 0) FROM challan_items ci2 JOIN challans c2 ON ci2.challan_id = c2.id WHERE ci2.item_id = i.id AND c2.status = 'ACTIVE') as total_shipped
      FROM challan_items ci
      JOIN challans c ON ci.challan_id = c.id
      JOIN items i ON ci.item_id = i.id
      LEFT JOIN categories cat ON i.category_id = cat.id
      LEFT JOIN users u ON c.created_by = u.id
      ${w}
      ORDER BY c.challan_date DESC LIMIT ${Number(limitCount)}
    `;
    const results = dbPrepare(sql).all(...params);
    return results.map(r => ({
      ...r,
      balance: (r.order_quantity || 0) - r.total_shipped
    }));
  },


  async getByNumber(number) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: challan, error } = await supabase.from('challans').select(`
        *,
        created_by_user:users!challans_created_by_fkey (full_name),
        cancelled_by_user:users!challans_cancelled_by_fkey (full_name)
      `).eq('challan_number', number).maybeSingle();
      
      if (error) throw error;

      if (challan) {
        challan.created_by_name = challan.created_by_user?.full_name;
        challan.cancelled_by_name = challan.cancelled_by_user?.full_name;
        
        const { data: itemsData, error: itemsError } = await supabase.from('challan_items').select(`
          *,
          items (*)
        `).eq('challan_id', challan.id);
        
        if (itemsError) throw itemsError;

        // Optimize: Batch fetch shipped totals
        const itemIds = (itemsData || []).map(ci => ci.item_id);
        const { data: allShipped } = await supabase.from('challan_items')
          .select('item_id, quantity, challans!inner(status)')
          .in('item_id', itemIds)
          .eq('challans.status', 'ACTIVE');
        
        const totalMap = {};
        (allShipped || []).forEach(s => {
          totalMap[s.item_id] = (totalMap[s.item_id] || 0) + s.quantity;
        });

        challan.items = (itemsData || []).map(ci => {
          const item = ci.items || {};
          const total_shipped = totalMap[ci.item_id] || 0;

          return {
            ...ci,
            item_name: item.name,
            item_code: item.item_code,
            size: item.size,
            color: item.color,
            buyer_name: item.buyer_name,
            style_name: item.style_name,
            purchase_no: item.purchase_no,
            order_quantity: item.order_quantity,
            current_stock: item.current_stock,
            order_number: item.order_number,
            total_shipped
          };
        });
      }

      return challan;
    }

    const challan = dbPrepare(`SELECT c.*, u.full_name as created_by_name, u2.full_name as cancelled_by_name FROM challans c LEFT JOIN users u ON c.created_by = u.id LEFT JOIN users u2 ON c.cancelled_by = u2.id WHERE c.challan_number = ?`).get(number);
    if (challan) {
      challan.items = dbPrepare(`
        SELECT ci.*, i.name as item_name, i.item_code, i.size, i.color, i.buyer_name, i.style_name, i.purchase_no, i.order_quantity, i.current_stock, i.order_number,
        (SELECT COALESCE(SUM(ci2.quantity), 0) FROM challan_items ci2 JOIN challans c2 ON ci2.challan_id = c2.id WHERE ci2.item_id = ci.item_id AND c2.status = 'ACTIVE') as total_shipped
        FROM challan_items ci 
        JOIN items i ON ci.item_id = i.id 
        WHERE ci.challan_id = ? 
        ORDER BY ci.id
      `).all(challan.id);
    }
    return challan;
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: challan, error } = await supabase.from('challans').select(`
        *,
        created_by_user:users!challans_created_by_fkey (full_name),
        cancelled_by_user:users!challans_cancelled_by_fkey (full_name)
      `).eq('id', id).single();
      
      if (error) throw error;

      if (challan) {
        challan.created_by_name = challan.created_by_user?.full_name;
        challan.cancelled_by_name = challan.cancelled_by_user?.full_name;
        
        const { data: itemsData, error: itemsError } = await supabase.from('challan_items').select(`
          *,
          items (*)
        `).eq('challan_id', id);
        
        if (itemsError) throw itemsError;

        // Optimize: Batch fetch shipped totals
        const itemIds = (itemsData || []).map(ci => ci.item_id);
        const { data: allShipped } = await supabase.from('challan_items')
          .select('item_id, quantity, challans!inner(status)')
          .in('item_id', itemIds)
          .eq('challans.status', 'ACTIVE');
        
        const totalMap = {};
        (allShipped || []).forEach(s => {
          totalMap[s.item_id] = (totalMap[s.item_id] || 0) + s.quantity;
        });

        challan.items = (itemsData || []).map(ci => {
          const item = ci.items || {};
          const total_shipped = totalMap[ci.item_id] || 0;

          return {
            ...ci,
            item_name: item.name,
            item_code: item.item_code,
            size: item.size,
            color: item.color,
            buyer_name: item.buyer_name,
            style_name: item.style_name,
            purchase_no: item.purchase_no,
            order_quantity: item.order_quantity,
            current_stock: item.current_stock,
            order_number: item.order_number,
            total_shipped
          };
        });
      }

      return challan;
    }

    const challan = dbPrepare(`SELECT c.*, u.full_name as created_by_name, u2.full_name as cancelled_by_name FROM challans c LEFT JOIN users u ON c.created_by = u.id LEFT JOIN users u2 ON c.cancelled_by = u2.id WHERE c.id = ?`).get(id);
    if (challan) {
      challan.items = dbPrepare(`
        SELECT ci.*, i.name as item_name, i.item_code, i.size, i.color, i.buyer_name, i.style_name, i.purchase_no, i.order_quantity, i.current_stock, i.order_number,
        (SELECT COALESCE(SUM(ci2.quantity), 0) FROM challan_items ci2 JOIN challans c2 ON ci2.challan_id = c2.id WHERE ci2.item_id = ci.item_id AND c2.status = 'ACTIVE') as total_shipped
        FROM challan_items ci 
        JOIN items i ON ci.item_id = i.id 
        WHERE ci.challan_id = ? 
        ORDER BY ci.id
      `).all(id);
    }
    return challan;
  },

  async create({ challanNumber, receiverName, receiverContact, receiverAddress, notes, challanDate, createdBy, items }) {
    // Check for duplicate challan number
    if (isCloudEnabled()) {
      const { data: existing } = await getSupabase().from('challans').select('id').eq('challan_number', challanNumber).single();
      if (existing) throw new Error(`Challan number ${challanNumber} already exists`);
    } else {
      const existing = dbPrepare(`SELECT id FROM challans WHERE challan_number = ?`).get(challanNumber);
      if (existing) throw new Error(`Challan number ${challanNumber} already exists`);
    }

    if (isCloudEnabled()) {

      const supabase = getSupabase();
      const { data: challan, error } = await supabase.from('challans').insert([{
        challan_number: challanNumber,
        receiver_name: receiverName,
        receiver_contact: receiverContact || null,
        receiver_address: receiverAddress || null,
        notes: notes || null,
        challan_date: challanDate,
        created_by: createdBy
      }]).select().single();
      
      if (error) throw error;
      
      const challanItems = items.map(item => ({
        challan_id: challan.id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes || null
      }));
      
      const { error: itemsError } = await supabase.from('challan_items').insert(challanItems);
      if (itemsError) throw itemsError;
      
      return challan.id;
    }

    const r = dbPrepare(`INSERT INTO challans (challan_number, receiver_name, receiver_contact, receiver_address, notes, challan_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      challanNumber, receiverName, receiverContact||null, receiverAddress||null, notes||null, challanDate, createdBy
    );
    const challanId = r.lastInsertRowid;
    for (const item of items) {
      dbPrepare(`INSERT INTO challan_items (challan_id, item_id, quantity, unit, notes) VALUES (?, ?, ?, ?, ?)`).run(challanId, item.itemId, item.quantity, item.unit, item.notes||null);
    }
    return challanId;
  },

  async cancel(id, cancelledBy, reason) {
    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('challans')
        .update({ status: 'CANCELLED', cancelled_by: cancelledBy, cancel_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'ACTIVE');
      if (error) throw error;
      return true;
    }
    return dbPrepare(`UPDATE challans SET status = 'CANCELLED', cancelled_by = ?, cancel_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'ACTIVE'`).run(cancelledBy, reason, id);
  },

  async getNextNumber(prefix = 'KA') {
    const today = new Date();
    const dateStr = today.getFullYear().toString() + (today.getMonth()+1).toString().padStart(2,'0') + today.getDate().toString().padStart(2,'0');
    const pattern = `${prefix}-${dateStr}-%`;
    
    let maxSeq = 0;
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('challans')
        .select('challan_number')
        .ilike('challan_number', pattern);
      
      if (error) throw error;
      (data || []).forEach(r => {
        const parts = r.challan_number.split('-');
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      });
    } else {
      const rows = dbPrepare(`SELECT challan_number FROM challans WHERE challan_number LIKE ?`).all(pattern);
      rows.forEach(r => {
        const parts = r.challan_number.split('-');
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      });
    }

    let nextSeq = maxSeq + 1;
    let finalNumber = `${prefix}-${dateStr}-${nextSeq.toString().padStart(4, '0')}`;

    // Safety loop: ensure this number and its -REJ variant don't exist
    let isUnique = false;
    while (!isUnique) {
      finalNumber = `${prefix}-${dateStr}-${nextSeq.toString().padStart(4, '0')}`;
      let exists = false;
      if (isCloudEnabled()) {
        const { data } = await getSupabase()
          .from('challans')
          .select('id')
          .or(`challan_number.eq.${finalNumber},challan_number.eq.${finalNumber}-REJ`)
          .limit(1);
        if (data && data.length > 0) exists = true;
      } else {
        const row = dbPrepare(`SELECT id FROM challans WHERE challan_number = ? OR challan_number = ?`).get(finalNumber, `${finalNumber}-REJ`);
        if (row) exists = true;
      }

      if (!exists) {
        isUnique = true;
      } else {
        nextSeq++;
      }
    }

    return finalNumber;
  },

  async getTodayCount() {
    if (isCloudEnabled()) {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await getSupabase()
        .from('challans')
        .select('*', { count: 'exact', head: true })
        .gte('challan_date', today + 'T00:00:00Z')
        .lte('challan_date', today + 'T23:59:59.999Z');
      if (error) throw error;
      return count || 0;
    }
    const r = dbPrepare(`SELECT COUNT(*) as count FROM challans WHERE DATE(challan_date) = DATE('now')`).get();
    return r ? r.count : 0;
  },

  async getRecent(limit = 10) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('challans').select(`
        *, users!challans_created_by_fkey (full_name), challan_items(id)
      `).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data.map(c => ({
        ...c,
        created_by_name: c.users?.full_name,
        item_count: (c.challan_items || []).length
      }));
    }
    return dbPrepare(`SELECT c.*, u.full_name as created_by_name, (SELECT COUNT(*) FROM challan_items ci WHERE ci.challan_id = c.id) as item_count FROM challans c LEFT JOIN users u ON c.created_by = u.id ORDER BY c.created_at DESC LIMIT ?`).all(limit);
  },

  async getWaitingForGatePassCount() {
    const GatePassRepo = require('./gate-passes');
    const ApprovalsRepo = require('./approvals');
    
    // 1. Get all active challans that have NO gate pass (confirmed or pending)
    const allActive = await this.getAll({ status: 'ACTIVE' });
    const usedIds = await GatePassRepo.getUsedChallanIds();
    const activeUnpassedCount = allActive.filter(c => !usedIds.includes(c.id)).length;

    // 2. Count pending challan approvals (each request represents 1 future challan)
    const allPending = await ApprovalsRepo.getAll({ status: 'PENDING' });
    const pendingChallanCount = allPending.filter(a => a.type === 'CREATE_CHALLAN').length;

    // 3. Count challans trapped in pending gate pass approvals
    let challansInPendingGatePass = 0;
    allPending.filter(a => a.type === 'CREATE_GATE_PASS').forEach(a => {
      const ids = a.data?.challanIds || [];
      if (Array.isArray(ids)) challansInPendingGatePass += ids.length;
    });

    return activeUnpassedCount + pendingChallanCount + challansInPendingGatePass;
  },

  async getFieldSuggestions(field, query = '') {
    const validFields = { 'receiverName': 'receiver_name', 'receiverContact': 'receiver_contact', 'receiverAddress': 'receiver_address', 'notes': 'notes' };
    const dbField = validFields[field];
    if (!dbField) return [];

    const SettingsRepo = require('./settings');
    const settings = await SettingsRepo.getAll();
    let blacklistData = settings.suggestion_blacklist || {};
    if (typeof blacklistData === 'string') {
      try { blacklistData = JSON.parse(blacklistData); } catch (e) { blacklistData = {}; }
    }
    const blacklist = (blacklistData && blacklistData[field]) || [];

    let rawResults = [];
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('challans')
        .select(dbField)
        .ilike(dbField, `%${query}%`)
        .not(dbField, 'is', null)
        .neq(dbField, '')
        .limit(30);
      if (error) throw error;
      rawResults = [...new Set(data.map(r => r[dbField]))];
    } else {
      const s = `%${query}%`;
      const results = dbPrepare(`SELECT DISTINCT ${dbField} as value FROM challans WHERE ${dbField} LIKE ? AND ${dbField} IS NOT NULL AND TRIM(${dbField}) != '' ORDER BY ${dbField} ASC LIMIT 30`).all(s);
      rawResults = results.map(r => r.value);
    }
    
    return rawResults.filter(val => !blacklist.includes(val)).sort().slice(0, 15);
  },

  async getTotalDelivered(itemId) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase()
        .from('challan_items')
        .select('quantity, challans!inner(status)')
        .eq('item_id', itemId)
        .eq('challans.status', 'ACTIVE');
      if (error) throw error;
      return (data || []).reduce((sum, d) => sum + d.quantity, 0);
    }
    const r = dbPrepare(`
      SELECT COALESCE(SUM(ci.quantity), 0) as total 
      FROM challan_items ci 
      JOIN challans c ON ci.challan_id = c.id 
      WHERE ci.item_id = ? AND c.status = 'ACTIVE'
    `).get(itemId);
    return r ? r.total : 0;
  },

  async clearChallanHistory() {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      await supabase.from('gate_passes').delete().neq('id', 0);
      await supabase.from('challan_items').delete().neq('id', 0);
      await supabase.from('challans').delete().neq('id', 0);
      // We also need to clear stock transactions related to challans to keep history consistent
      await supabase.from('stock_transactions').delete().not('challan_id', 'is', null);
      return true;
    }

    const db = require('../connection').getDb();
    db.run('DELETE FROM gate_passes');
    db.run('DELETE FROM challan_items');
    db.run('DELETE FROM challans');
    db.run('DELETE FROM stock_transactions WHERE challan_id IS NOT NULL');
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('challans', 'challan_items', 'gate_passes')");
    require('../connection').saveDatabase();
    return true;
  },

  async clearAllData() {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      await supabase.from('gate_passes').delete().neq('id', 0);
      await supabase.from('audit_logs').delete().neq('id', 0);
      await supabase.from('approvals').delete().neq('id', 0);
      await supabase.from('stock_transactions').delete().neq('id', 0);
      await supabase.from('challan_items').delete().neq('id', 0);
      await supabase.from('challans').delete().neq('id', 0);
      await supabase.from('items').delete().neq('id', 0);
      await supabase.from('buyers').delete().neq('id', 0);
      await supabase.from('suppliers').delete().neq('id', 0);
      await supabase.from('categories').delete().neq('id', 0);
      return true;
    }

    const db = require('../connection').getDb();
    db.run('DELETE FROM gate_passes');
    db.run('DELETE FROM approvals');
    db.run('DELETE FROM stock_transactions');
    db.run('DELETE FROM challan_items');
    db.run('DELETE FROM challans');
    db.run('DELETE FROM items');
    db.run('DELETE FROM buyers');
    db.run('DELETE FROM suppliers');
    db.run('DELETE FROM categories');
    db.run('DELETE FROM audit_logs');
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('challans', 'challan_items', 'items', 'gate_passes', 'stock_transactions', 'approvals')");
    require('../connection').saveDatabase();
    return true;
  },

  async delete(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      await supabase.from('stock_transactions').delete().eq('challan_id', id);
      await supabase.from('challan_items').delete().eq('challan_id', id);
      const { error } = await supabase.from('challans').delete().eq('id', id);
      if (error) throw error;
      return true;
    }

    const db = require('../connection').getDb();
    db.run('DELETE FROM stock_transactions WHERE challan_id = ?', [id]);
    db.run('DELETE FROM challan_items WHERE challan_id = ?', [id]);
    db.run('DELETE FROM challans WHERE id = ?', [id]);
    require('../connection').saveDatabase();
    return true;
  }
};

module.exports = ChallansRepo;
