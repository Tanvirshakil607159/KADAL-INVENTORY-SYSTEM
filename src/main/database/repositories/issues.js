const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

function extractProdIds(record) {
  let prodIds = [];
  if (record.produced_item_ids) {
    try {
      const parsed = typeof record.produced_item_ids === 'string' ? JSON.parse(record.produced_item_ids) : record.produced_item_ids;
      if (Array.isArray(parsed)) prodIds = parsed.map(Number).filter(Boolean);
    } catch (e) {}
  }
  if (prodIds.length === 0 && record.remarks) {
    const match = String(record.remarks).match(/\[PRODUCED_ITEM_IDS:([0-9,]+)\]/);
    if (match && match[1]) {
      prodIds = match[1].split(',').map(Number).filter(Boolean);
    }
  }
  if (prodIds.length === 0 && record.produced_item_id) {
    prodIds = [Number(record.produced_item_id)];
  }
  return prodIds;
}

function cleanRemarks(remarks) {
  if (!remarks) return null;
  const clean = String(remarks).replace(/\[PRODUCED_ITEM_IDS:[^\]]+\]/g, '').trim();
  return clean || null;
}

const IssuesRepo = {
  // ==================== Issues ====================
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('issues').select(`
        *,
        recipients (name, type),
        users!issues_created_by_fkey (full_name),
        issue_items (id, item_id, quantity, returned_quantity, damage_quantity, rejected_quantity, unit, items (name, item_code))
      `).order('created_at', { ascending: false });

      if (filters.issueType) query = query.eq('issue_type', filters.issueType);
      if (filters.recipientId) query = query.eq('recipient_id', filters.recipientId);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dateFrom) query = query.gte('issue_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('issue_date', filters.dateTo + 'T23:59:59.999Z');
      if (filters.search) {
        query = query.or(`issue_id.ilike.%${filters.search}%,recipient_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data.map(r => ({
        ...r,
        remarks: cleanRemarks(r.remarks),
        created_by_name: r.users?.full_name,
        item_count: (r.issue_items || []).length,
        total_quantity: (r.issue_items || []).reduce((s, i) => s + i.quantity, 0),
      }));
    }

    let where = []; let params = [];
    if (filters.issueType) { where.push('iss.issue_type = ?'); params.push(filters.issueType); }
    if (filters.recipientId) { where.push('iss.recipient_id = ?'); params.push(filters.recipientId); }
    if (filters.status) { where.push('iss.status = ?'); params.push(filters.status); }
    if (filters.dateFrom) { where.push('iss.issue_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('iss.issue_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    if (filters.search) {
      where.push('(iss.issue_id LIKE ? OR iss.recipient_name LIKE ?)');
      const s = `%${filters.search}%`; params.push(s, s);
    }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const rows = dbPrepare(`
      SELECT iss.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM issue_items ii WHERE ii.issue_id = iss.id) as item_count,
        (SELECT COALESCE(SUM(ii.quantity), 0) FROM issue_items ii WHERE ii.issue_id = iss.id) as total_quantity
      FROM issues iss
      LEFT JOIN users u ON iss.created_by = u.id
      ${w}
      ORDER BY iss.created_at DESC
    `).all(...params);

    return rows.map(r => ({
      ...r,
      remarks: cleanRemarks(r.remarks)
    }));
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: iss, error } = await supabase.from('issues').select(`
        *,
        users!issues_created_by_fkey (full_name)
      `).eq('id', id).single();
      if (error) throw error;

      if (iss) {
        const { data: items, error: iErr } = await supabase.from('issue_items').select(`
          *, items (name, item_code, unit, current_stock, buyer_name, size, color, style_name, purchase_no, order_number, order_quantity)
        `).eq('issue_id', id);
        if (iErr) throw iErr;
        iss.items = items.map(i => ({
          ...i,
          item_name: i.items?.name,
          item_code: i.items?.item_code,
          item_unit: i.items?.unit,
          current_stock: i.items?.current_stock,
          buyer_name: i.items?.buyer_name || '-',
          size: i.items?.size || '-',
          color: i.items?.color || '-',
          style_no: i.style_no || i.items?.style_name || '-',
          purchase_no: i.purchase_no || i.items?.purchase_no || '-',
          order_number: i.order_number || i.items?.order_number || '-',
          order_quantity: i.items?.order_quantity,
        }));
        iss.created_by_name = iss.users?.full_name;

        // Fetch produced target products (single or multiple)
        const prodIds = extractProdIds(iss);
        // Preserve raw remarks with tags for frontend fallback before cleaning
        const rawRemarks = iss.remarks;
        iss.remarks = cleanRemarks(iss.remarks);

        // Always initialize produced_items
        iss.produced_items = [];

        if (prodIds.length > 0) {
          const { data: prodItems } = await supabase.from('items')
            .select('id, name, item_code, style_name, purchase_no, order_number, order_quantity, unit, color, size, buyer_name, current_stock')
            .in('id', prodIds);
          if (prodItems && prodItems.length > 0) {
            iss.produced_items = prodItems.map(prodItem => ({
              id: prodItem.id,
              name: prodItem.name,
              item_code: prodItem.item_code,
              style_name: prodItem.style_name,
              purchase_no: prodItem.purchase_no,
              order_number: prodItem.order_number,
              order_quantity: prodItem.order_quantity,
              unit: prodItem.unit,
              color: prodItem.color,
              size: prodItem.size,
              buyer_name: prodItem.buyer_name,
              current_stock: prodItem.current_stock ?? 0,
            }));
            iss.produced_item = iss.produced_items[0];
          }
        }

        // Preserve raw_remarks for frontend fallback extraction
        iss._raw_remarks = rawRemarks;
      }
      return iss;
    }

    const iss = dbPrepare(`
      SELECT iss.*, u.full_name as created_by_name
      FROM issues iss LEFT JOIN users u ON iss.created_by = u.id
      WHERE iss.id = ?
    `).get(id);

    if (iss) {
      iss.items = dbPrepare(`
        SELECT ii.*, it.name as item_name, it.item_code, it.unit as item_unit, it.current_stock,
          it.buyer_name, it.size, it.color, it.order_quantity,
          COALESCE(NULLIF(ii.style_no, ''), it.style_name) as style_no,
          COALESCE(NULLIF(ii.purchase_no, ''), it.purchase_no) as purchase_no,
          COALESCE(NULLIF(ii.order_number, ''), it.order_number) as order_number
        FROM issue_items ii
        JOIN items it ON ii.item_id = it.id
        WHERE ii.issue_id = ?
      `).all(id);

      const prodIds = extractProdIds(iss);
      const rawRemarks = iss.remarks;
      iss.remarks = cleanRemarks(iss.remarks);

      // Always initialize produced_items
      iss.produced_items = [];

      if (prodIds.length > 0) {
        const placeholders = prodIds.map(() => '?').join(',');
        iss.produced_items = dbPrepare(`
          SELECT id, name, item_code, style_name, purchase_no, order_number, order_quantity, unit, color, size, buyer_name, current_stock
          FROM items WHERE id IN (${placeholders})
        `).all(...prodIds);
        if (iss.produced_items && iss.produced_items.length > 0) {
          iss.produced_item = iss.produced_items[0];
        }
      }

      // Preserve raw_remarks for frontend fallback extraction
      iss._raw_remarks = rawRemarks;
    }
    return iss;
  },

  async create({ issueId, issueType, recipientId, recipientName, issueDate, expectedReturnDate, remarks, createdBy, items, isReturnable, producedItemId, producedItemIds }) {
    const isRet = isReturnable === undefined ? true : !!isReturnable;
    const initialStatus = !isRet ? 'RETURNED' : 'PENDING';

    const prodIdsArray = Array.isArray(producedItemIds) && producedItemIds.length > 0
      ? producedItemIds.map(Number).filter(Boolean)
      : (producedItemId ? [Number(producedItemId)] : []);
    const firstProdId = prodIdsArray[0] || (producedItemId ? Number(producedItemId) : null);
    const prodIdsStr = prodIdsArray.length > 0 ? JSON.stringify(prodIdsArray) : null;

    let formattedRemarks = remarks || '';
    if (prodIdsArray.length > 0) {
      formattedRemarks = String(formattedRemarks).replace(/\[PRODUCED_ITEM_IDS:[^\]]+\]/g, '').trim();
      const tag = `[PRODUCED_ITEM_IDS:${prodIdsArray.join(',')}]`;
      formattedRemarks = formattedRemarks ? `${formattedRemarks} ${tag}` : tag;
    }

    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const insertObj = {
        issue_id: issueId,
        issue_type: issueType,
        recipient_id: recipientId,
        recipient_name: recipientName,
        issue_date: issueDate,
        expected_return_date: expectedReturnDate || null,
        remarks: formattedRemarks || null,
        is_returnable: isRet,
        status: initialStatus,
        created_by: createdBy,
        produced_item_id: firstProdId,
      };

      let iss = null;
      let error = null;

      // Try inserting with produced_item_ids column if available in Supabase
      if (prodIdsStr) {
        const { data, error: err } = await supabase.from('issues').insert([{ ...insertObj, produced_item_ids: prodIdsStr }]).select().single();
        if (!err && data) {
          iss = data;
        }
      }

      // Fallback insert without produced_item_ids column
      if (!iss) {
        const { data, error: err } = await supabase.from('issues').insert([insertObj]).select().single();
        if (err) throw err;
        iss = data;
      }

      const issueItems = items.map(item => ({
        issue_id: iss.id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit: item.unit || 'pcs',
        style_no: item.styleNo || null,
        order_number: item.orderNumber || null,
        purchase_no: item.purchaseNo || null,
        notes: item.notes || null,
      }));
      const { error: iErr } = await supabase.from('issue_items').insert(issueItems);
      if (iErr) throw iErr;
      return iss.id;
    }

    let r;
    try {
      r = dbPrepare(`
        INSERT INTO issues (issue_id, issue_type, recipient_id, recipient_name, issue_date, expected_return_date, remarks, is_returnable, status, created_by, produced_item_id, produced_item_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        issueId, 
        issueType, 
        recipientId, 
        recipientName, 
        issueDate, 
        expectedReturnDate || null, 
        formattedRemarks || null, 
        isRet ? 1 : 0, 
        initialStatus, 
        createdBy,
        firstProdId,
        prodIdsStr
      );
    } catch (e) {
      r = dbPrepare(`
        INSERT INTO issues (issue_id, issue_type, recipient_id, recipient_name, issue_date, expected_return_date, remarks, is_returnable, status, created_by, produced_item_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        issueId, 
        issueType, 
        recipientId, 
        recipientName, 
        issueDate, 
        expectedReturnDate || null, 
        formattedRemarks || null, 
        isRet ? 1 : 0, 
        initialStatus, 
        createdBy,
        firstProdId
      );
    }

    const id = r.lastInsertRowid;
    for (const item of items) {
      dbPrepare(`
        INSERT INTO issue_items (issue_id, item_id, quantity, unit, style_no, order_number, purchase_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, item.itemId, item.quantity, item.unit || 'pcs', item.styleNo || null, item.orderNumber || null, item.purchaseNo || null, item.notes || null);
    }
    return id;
  },

  async getNextIssueId(prefix = 'ISS') {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('issues')
        .select('issue_id').like('issue_id', `${prefix}-%`).order('issue_id', { ascending: false });
      if (error) throw error;
      let max = 0;
      (data || []).forEach(r => {
        const parts = r.issue_id.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > max) max = num;
      });
      return `${prefix}-${(max + 1).toString().padStart(4, '0')}`;
    }
    const all = dbPrepare(`SELECT issue_id FROM issues WHERE issue_id LIKE ?`).all(`${prefix}-%`);
    let max = 0;
    all.forEach(r => {
      const parts = r.issue_id.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > max) max = num;
    });
    return `${prefix}-${(max + 1).toString().padStart(4, '0')}`;
  },

  async updateStatus(issueId) {
    // Check if returnable. If not, status is always RETURNED
    let isReturnable = true;
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('issues').select('is_returnable').eq('id', issueId).single();
      if (!error && data) isReturnable = data.is_returnable;
    } else {
      const row = dbPrepare('SELECT is_returnable FROM issues WHERE id = ?').get(issueId);
      if (row) isReturnable = row.is_returnable === 1;
    }

    if (!isReturnable) {
      if (isCloudEnabled()) {
        await getSupabase().from('issues').update({ status: 'RETURNED', updated_at: new Date().toISOString() }).eq('id', issueId);
      } else {
        dbPrepare("UPDATE issues SET status = 'RETURNED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(issueId);
      }
      return 'RETURNED';
    }

    // Recalculate status based on issue_items
    let items;
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('issue_items')
        .select('quantity, returned_quantity, damage_quantity, rejected_quantity, consumed_quantity')
        .eq('issue_id', issueId);
      if (error) throw error;
      items = data || [];
    } else {
      items = dbPrepare('SELECT quantity, returned_quantity, damage_quantity, rejected_quantity, consumed_quantity FROM issue_items WHERE issue_id = ?').all(issueId);
    }

    let allFullyAccounted = true;
    let anyReturned = false;

    for (const item of items) {
      const accounted = (item.returned_quantity || 0) + (item.damage_quantity || 0) + (item.rejected_quantity || 0) + (item.consumed_quantity || 0);
      if (accounted > 0) anyReturned = true;
      if (accounted < item.quantity) allFullyAccounted = false;
    }

    let status = 'PENDING';
    if (allFullyAccounted && items.length > 0) status = 'RETURNED';
    else if (anyReturned) status = 'PARTIAL';

    if (isCloudEnabled()) {
      const { error } = await getSupabase().from('issues').update({ status, updated_at: new Date().toISOString() }).eq('id', issueId);
      if (error) throw error;
    } else {
      dbPrepare('UPDATE issues SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, issueId);
    }
    return status;
  },

  async getOutstandingItems(issueId) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('issue_items').select(`
        *, items (name, item_code, unit)
      `).eq('issue_id', issueId);
      if (error) throw error;
      return data.map(i => ({
        ...i,
        item_name: i.items?.name,
        item_code: i.items?.item_code,
        item_unit: i.items?.unit,
        remaining: i.quantity - (i.returned_quantity || 0) - (i.damage_quantity || 0) - (i.rejected_quantity || 0) - (i.consumed_quantity || 0),
      })).filter(i => i.remaining > 0);
    }

    const items = dbPrepare(`
      SELECT ii.*, it.name as item_name, it.item_code, it.unit as item_unit
      FROM issue_items ii JOIN items it ON ii.item_id = it.id
      WHERE ii.issue_id = ?
    `).all(issueId);

    return items.map(i => ({
      ...i,
      remaining: i.quantity - (i.returned_quantity || 0) - (i.damage_quantity || 0) - (i.rejected_quantity || 0) - (i.consumed_quantity || 0),
    })).filter(i => i.remaining > 0);
  },

  async updateIssueItemReturnQtys(issueItemId, { returnedQty, damageQty, rejectedQty }) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data: current, error: gErr } = await supabase.from('issue_items').select('returned_quantity, damage_quantity, rejected_quantity').eq('id', issueItemId).single();
      if (gErr) throw gErr;
      const { error } = await supabase.from('issue_items').update({
        returned_quantity: (current.returned_quantity || 0) + returnedQty,
        damage_quantity: (current.damage_quantity || 0) + damageQty,
        rejected_quantity: (current.rejected_quantity || 0) + rejectedQty,
      }).eq('id', issueItemId);
      if (error) throw error;
      return true;
    }

    dbPrepare(`
      UPDATE issue_items SET
        returned_quantity = returned_quantity + ?,
        damage_quantity = damage_quantity + ?,
        rejected_quantity = rejected_quantity + ?
      WHERE id = ?
    `).run(returnedQty, damageQty, rejectedQty, issueItemId);
    return true;
  },

  async getIssueItemById(issueItemId) {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('issue_items').select('*').eq('id', issueItemId).single();
      if (error) throw error;
      return data;
    }
    return dbPrepare('SELECT * FROM issue_items WHERE id = ?').get(issueItemId);
  },

  async deleteIssue(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      // Get return IDs for this issue
      const { data: returns } = await supabase.from('returns').select('id').eq('issue_id', id);
      const returnIds = (returns || []).map(r => r.id);
      if (returnIds.length > 0) {
        await supabase.from('return_items').delete().in('return_id', returnIds);
      }
      await supabase.from('returns').delete().eq('issue_id', id);
      await supabase.from('factory_production').delete().eq('issue_id', id);
      await supabase.from('issue_items').delete().eq('issue_id', id);
      const { error } = await supabase.from('issues').delete().eq('id', id);
      if (error) throw error;
      return true;
    }

    // Local: cascade delete
    const returns = dbPrepare('SELECT id FROM returns WHERE issue_id = ?').all(id);
    for (const ret of returns) {
      dbPrepare('DELETE FROM return_items WHERE return_id = ?').run(ret.id);
    }
    dbPrepare('DELETE FROM returns WHERE issue_id = ?').run(id);
    dbPrepare('DELETE FROM factory_production WHERE issue_id = ?').run(id);
    dbPrepare('DELETE FROM issue_items WHERE issue_id = ?').run(id);
    dbPrepare('DELETE FROM issues WHERE id = ?').run(id);
    return true;
  },

  // ==================== Reports ====================
  async getIssueReport(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('issue_items').select(`
        *, issues (issue_id, issue_type, recipient_name, issue_date, status, expected_return_date),
        items (name, item_code, unit, style_name, purchase_no, order_number, size, color, buyer_name)
      `);
      const { data, error } = await query;
      if (error) throw error;

      let result = data.map(r => ({
        issue_id: r.issues?.issue_id,
        issue_type: r.issues?.issue_type,
        recipient_name: r.issues?.recipient_name,
        issue_date: r.issues?.issue_date,
        status: r.issues?.status,
        expected_return_date: r.issues?.expected_return_date,
        item_name: r.items?.name,
        item_code: r.items?.item_code,
        style_name: r.style_no || r.items?.style_name || '-',
        purchase_no: r.purchase_no || r.items?.purchase_no || '-',
        order_number: r.order_number || r.items?.order_number || '-',
        size: r.items?.size,
        color: r.items?.color,
        buyer_name: r.items?.buyer_name,
        quantity: r.quantity,
        returned_quantity: r.returned_quantity,
        damage_quantity: r.damage_quantity,
        rejected_quantity: r.rejected_quantity,
        consumed_quantity: r.consumed_quantity || 0,
        outstanding: r.quantity - (r.returned_quantity || 0) - (r.damage_quantity || 0) - (r.rejected_quantity || 0) - (r.consumed_quantity || 0),
        unit: r.unit || r.items?.unit || 'pcs',
      }));

      if (filters.issueType) result = result.filter(r => r.issue_type === filters.issueType);
      if (filters.status) result = result.filter(r => r.status === filters.status);
      if (filters.dateFrom) result = result.filter(r => r.issue_date >= filters.dateFrom);
      if (filters.dateTo) result = result.filter(r => r.issue_date <= filters.dateTo + 'T23:59:59.999Z');
      if (filters.recipientName) result = result.filter(r => r.recipient_name?.toLowerCase().includes(filters.recipientName.toLowerCase()));
      return result;
    }

    let where = []; let params = [];
    if (filters.issueType) { where.push('iss.issue_type = ?'); params.push(filters.issueType); }
    if (filters.status) { where.push('iss.status = ?'); params.push(filters.status); }
    if (filters.dateFrom) { where.push('iss.issue_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('iss.issue_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    if (filters.recipientName) { where.push('iss.recipient_name LIKE ?'); params.push(`%${filters.recipientName}%`); }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    return dbPrepare(`
      SELECT ii.*, iss.issue_id, iss.issue_type, iss.recipient_name, iss.issue_date, iss.status, iss.expected_return_date,
        it.name as item_name, it.item_code, it.size, it.color, it.buyer_name,
        COALESCE(NULLIF(ii.style_no, ''), it.style_name) as style_name,
        COALESCE(NULLIF(ii.purchase_no, ''), it.purchase_no) as purchase_no,
        COALESCE(NULLIF(ii.order_number, ''), it.order_number) as order_number,
        COALESCE(NULLIF(ii.unit, ''), it.unit) as unit,
        (ii.quantity - COALESCE(ii.returned_quantity,0) - COALESCE(ii.damage_quantity,0) - COALESCE(ii.rejected_quantity,0) - COALESCE(ii.consumed_quantity,0)) as outstanding
      FROM issue_items ii
      JOIN issues iss ON ii.issue_id = iss.id
      JOIN items it ON ii.item_id = it.id
      ${w}
      ORDER BY iss.issue_date DESC
    `).all(...params);
  },

  async getReturnReport(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('return_items').select(`
        *,
        returns (return_date, remarks, approval_status, issues (issue_id, recipient_name, issue_type), users!returns_created_by_fkey (full_name)),
        issue_items (item_id, items (name, item_code))
      `);
      if (error) throw error;
      let result = data.map(r => ({
        issue_id: r.returns?.issues?.issue_id,
        recipient_name: r.returns?.issues?.recipient_name,
        issue_type: r.returns?.issues?.issue_type,
        return_date: r.returns?.return_date,
        approval_status: r.returns?.approval_status,
        created_by_name: r.returns?.users?.full_name,
        item_name: r.issue_items?.items?.name,
        item_code: r.issue_items?.items?.item_code,
        returned_quantity: r.returned_quantity,
        damage_quantity: r.damage_quantity,
        rejected_quantity: r.rejected_quantity,
        notes: r.notes,
      }));
      if (filters.dateFrom) result = result.filter(r => r.return_date >= filters.dateFrom);
      if (filters.dateTo) result = result.filter(r => r.return_date <= filters.dateTo + 'T23:59:59.999Z');
      return result;
    }

    let where = []; let params = [];
    if (filters.dateFrom) { where.push('ret.return_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('ret.return_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    if (filters.issueType) { where.push('iss.issue_type = ?'); params.push(filters.issueType); }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    return dbPrepare(`
      SELECT ri.*, ret.return_date, ret.approval_status, ret.remarks as return_remarks,
        iss.issue_id, iss.recipient_name, iss.issue_type,
        it.name as item_name, it.item_code,
        u.full_name as created_by_name
      FROM return_items ri
      JOIN returns ret ON ri.return_id = ret.id
      JOIN issue_items ii ON ri.issue_item_id = ii.id
      JOIN issues iss ON ret.issue_id = iss.id
      JOIN items it ON ii.item_id = it.id
      LEFT JOIN users u ON ret.created_by = u.id
      ${w}
      ORDER BY ret.return_date DESC
    `).all(...params);
  },

  async getEmployeeOutstandingReport(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('issue_items').select(`
        *, issues (issue_id, issue_type, recipient_name, issue_date, status, expected_return_date),
        items (name, item_code)
      `);
      if (error) throw error;
      return data
        .filter(r => r.issues?.issue_type === 'EMPLOYEE')
        .map(r => ({
          ...r,
          issue_id: r.issues?.issue_id,
          recipient_name: r.issues?.recipient_name,
          issue_date: r.issues?.issue_date,
          expected_return_date: r.issues?.expected_return_date,
          item_name: r.items?.name,
          item_code: r.items?.item_code,
          outstanding: r.quantity - (r.returned_quantity || 0) - (r.damage_quantity || 0) - (r.rejected_quantity || 0) - (r.consumed_quantity || 0),
        }))
        .filter(r => r.outstanding > 0);
    }

    return dbPrepare(`
      SELECT ii.*, iss.issue_id, iss.recipient_name, iss.issue_date, iss.expected_return_date,
        it.name as item_name, it.item_code,
        (ii.quantity - COALESCE(ii.returned_quantity,0) - COALESCE(ii.damage_quantity,0) - COALESCE(ii.rejected_quantity,0) - COALESCE(ii.consumed_quantity,0)) as outstanding
      FROM issue_items ii
      JOIN issues iss ON ii.issue_id = iss.id
      JOIN items it ON ii.item_id = it.id
      WHERE iss.issue_type = 'EMPLOYEE'
      AND (ii.quantity - COALESCE(ii.returned_quantity,0) - COALESCE(ii.damage_quantity,0) - COALESCE(ii.rejected_quantity,0) - COALESCE(ii.consumed_quantity,0)) > 0
      ORDER BY iss.issue_date DESC
    `).all();
  },

  async getFactoryProductionReport(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('factory_production').select(`
        *, issues (issue_id, recipient_name)
      `).order('created_at', { ascending: false });
      if (error) throw error;

      // Extract distinct target product item IDs
      const productItemIds = [...new Set((data || []).map(r => r.product_item_id).filter(Boolean))];
      const itemsMap = {};

      if (productItemIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < productItemIds.length; i += chunkSize) {
          const chunk = productItemIds.slice(i, i + chunkSize);
          const { data: itemsChunk, error: iErr } = await supabase
            .from('items')
            .select('id, item_code, name, style_name, purchase_no, order_number, size, color, buyer_name, unit')
            .in('id', chunk);
          if (iErr) throw iErr;
          (itemsChunk || []).forEach(it => {
            itemsMap[it.id] = it;
          });
        }
      }

      return data.map(r => {
        const prodItem = itemsMap[r.product_item_id];
        return {
          ...r,
          issue_id: r.issues?.issue_id,
          recipient_name: r.issues?.recipient_name,
          product_code: prodItem?.item_code || '',
          product_name: r.product_name || prodItem?.name || '',
          style_name: prodItem?.style_name || '',
          purchase_no: prodItem?.purchase_no || '',
          order_number: prodItem?.order_number || '',
          size: prodItem?.size || '',
          color: prodItem?.color || '',
          buyer_name: prodItem?.buyer_name || '',
          unit: prodItem?.unit || 'pcs'
        };
      });
    }

    return dbPrepare(`
      SELECT fp.*, iss.issue_id, iss.recipient_name,
        COALESCE(NULLIF(fp.product_name, ''), it.name) as product_name,
        it.item_code as product_code,
        it.style_name,
        it.purchase_no,
        it.order_number,
        it.size,
        it.color,
        it.buyer_name,
        COALESCE(NULLIF(it.unit, ''), 'pcs') as unit
      FROM factory_production fp
      JOIN issues iss ON fp.issue_id = iss.id
      LEFT JOIN items it ON fp.product_item_id = it.id
      ORDER BY fp.created_at DESC
    `).all();
  },

  async getIssueReturnSummary(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('issues').select(`
        issue_id, issue_type, recipient_name, issue_date, status,
        issue_items (quantity, returned_quantity, damage_quantity, rejected_quantity, consumed_quantity)
      `);
      if (error) throw error;
      let result = data.map(r => {
        const items = r.issue_items || [];
        const totalIssued = items.reduce((s, i) => s + i.quantity, 0);
        const totalReturned = items.reduce((s, i) => s + (i.returned_quantity || 0), 0);
        const totalDamaged = items.reduce((s, i) => s + (i.damage_quantity || 0), 0);
        const totalRejected = items.reduce((s, i) => s + (i.rejected_quantity || 0), 0);
        const totalConsumed = items.reduce((s, i) => s + (i.consumed_quantity || 0), 0);
        return {
          issue_id: r.issue_id, issue_type: r.issue_type, recipient_name: r.recipient_name,
          issue_date: r.issue_date, status: r.status,
          total_issued: totalIssued, total_returned: totalReturned, total_damaged: totalDamaged,
          total_rejected: totalRejected, total_consumed: totalConsumed,
          outstanding: totalIssued - totalReturned - totalDamaged - totalRejected - totalConsumed,
        };
      });
      if (filters.dateFrom) result = result.filter(r => r.issue_date >= filters.dateFrom);
      if (filters.dateTo) result = result.filter(r => r.issue_date <= filters.dateTo + 'T23:59:59.999Z');
      if (filters.issueType) result = result.filter(r => r.issue_type === filters.issueType);
      return result;
    }

    let where = []; let params = [];
    if (filters.dateFrom) { where.push('iss.issue_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('iss.issue_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    if (filters.issueType) { where.push('iss.issue_type = ?'); params.push(filters.issueType); }
    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    return dbPrepare(`
      SELECT iss.issue_id, iss.issue_type, iss.recipient_name, iss.issue_date, iss.status,
        COALESCE(SUM(ii.quantity), 0) as total_issued,
        COALESCE(SUM(ii.returned_quantity), 0) as total_returned,
        COALESCE(SUM(ii.damage_quantity), 0) as total_damaged,
        COALESCE(SUM(ii.rejected_quantity), 0) as total_rejected,
        COALESCE(SUM(ii.consumed_quantity), 0) as total_consumed,
        COALESCE(SUM(ii.quantity - ii.returned_quantity - ii.damage_quantity - ii.rejected_quantity - ii.consumed_quantity), 0) as outstanding
      FROM issues iss
      JOIN issue_items ii ON ii.issue_id = iss.id
      ${w}
      GROUP BY iss.id
      ORDER BY iss.issue_date DESC
    `).all(...params);
  },

  // Dashboard stats
  async getPendingReturnsCount() {
    if (isCloudEnabled()) {
      const { count, error } = await getSupabase().from('issues')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'PARTIAL']);
      if (error) throw error;
      return count || 0;
    }
    return dbPrepare("SELECT COUNT(*) as count FROM issues WHERE status IN ('PENDING', 'PARTIAL')").get().count;
  },

  async getOverdueReturnsCount() {
    const now = new Date().toISOString();
    if (isCloudEnabled()) {
      const { count, error } = await getSupabase().from('issues')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'PARTIAL'])
        .lt('expected_return_date', now)
        .not('expected_return_date', 'is', null);
      if (error) throw error;
      return count || 0;
    }
    return dbPrepare("SELECT COUNT(*) as count FROM issues WHERE status IN ('PENDING', 'PARTIAL') AND expected_return_date IS NOT NULL AND expected_return_date < ?").get(now).count;
  },

  async getTotalDamaged() {
    if (isCloudEnabled()) {
      const { data, error } = await getSupabase().from('issue_items').select('damage_quantity, rejected_quantity');
      if (error) throw error;
      return data.reduce((s, i) => s + (i.damage_quantity || 0) + (i.rejected_quantity || 0), 0);
    }
    return dbPrepare('SELECT COALESCE(SUM(damage_quantity + rejected_quantity), 0) as total FROM issue_items').get().total;
  },
};

module.exports = IssuesRepo;
