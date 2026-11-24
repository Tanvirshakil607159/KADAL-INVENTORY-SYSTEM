const { dbPrepare, getSupabase, isCloudEnabled } = require('../database/connection');
const { dayStartIso, dayEndIso, dayStartSql, dayEndSql, lastDayOfMonth, localDay, todayLocal, inLocalRange } = require('../utils/date-range');
const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const ChallansRepo = require('../database/repositories/challans');

// Helper to paginate Supabase queries
async function fetchAllSupabase(queryBuilder, pageSize = 1000) {
  let allData = [];
  let page = 0;
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

const ReportService = {
  async stockReport(filters = {}) { return await ItemsRepo.getAll(filters); },
  
  async movementReport(filters = {}) {
    return await StockTransactionsRepo.getMovementSummary(filters);
  },
  
  async lowStockReport(filters = {}) { return await ItemsRepo.getLowStockItems(filters); },
  
  async challanHistory(filters = {}) { 
    return await ChallansRepo.getDetailedHistory(filters); 
  },
  async detailedChallanHistory(filters = {}) {
    return await this.challanHistory(filters);
  },

  // ==================== AUDIT REPORT ====================
  // Option B: Audit report as of a cutoff date (defaults to 30.06.2026)
  // Calculates historical stock by reversing post-cutoff transactions
  async auditReport(filters = {}) {
    const cutoffDate = filters.cutoffDate || todayLocal();
    // End of the cutoff day in local time (Bangladesh), as UTC for Supabase and SQLite
    const cutoffTimestamp = dayEndIso(cutoffDate);
    const cutoffSql = dayEndSql(cutoffDate);

    let rawMaterials = [];
    let finishedGoods = [];
    let workingProcess = [];

    if (isCloudEnabled()) {
      const supabase = getSupabase();

      // 1. Fetch all active items with supplier info
      const allItems = await fetchAllSupabase(
        supabase.from('items')
          .select('*, categories(name), suppliers(name)')
          .eq('is_active', true)
          .order('name')
          .order('id')
      );

      // 2. Fetch post-cutoff transactions to reverse them
      const postCutoffTxs = await fetchAllSupabase(
        supabase.from('stock_transactions')
          .select('item_id, type, quantity')
          .gt('created_at', cutoffTimestamp)
          .order('id')
      );

      // Build adjustment map: how much to adjust each item's current_stock
      const adjustmentMap = {};
      for (const tx of postCutoffTxs) {
        const itemId = Number(tx.item_id);
        if (!adjustmentMap[itemId]) adjustmentMap[itemId] = 0;
        // Reverse: subtract IN, add back OUT
        if (tx.type === 'IN') adjustmentMap[itemId] -= (tx.quantity || 0);
        if (tx.type === 'OUT') adjustmentMap[itemId] += (tx.quantity || 0);
      }

      const mapped = allItems.map(i => {
        const adjustment = adjustmentMap[Number(i.id)] || 0;
        const stockAtCutoff = (i.current_stock || 0) + adjustment;
        return {
          ...i,
          category_name: i.categories?.name || '',
          supplier_name: i.suppliers?.name || '',
          current_stock: stockAtCutoff,
        };
      });

      // Raw Material = source_type 'SOURCE' with stock > 0 at cutoff
      rawMaterials = mapped
        .filter(i => (i.source_type || 'SOURCE') === 'SOURCE' && (i.current_stock || 0) > 0)
        .map(i => ({
          ...i,
          total_value: (i.current_stock || 0) * (i.unit_price || 0),
        }));

      // Finished Goods = source_type 'PRODUCTION' with stock > 0 at cutoff
      finishedGoods = mapped
        .filter(i => i.source_type === 'PRODUCTION' && (i.current_stock || 0) > 0)
        .map(i => ({
          ...i,
          total_value: (i.current_stock || 0) * (i.unit_price || 0),
        }));

      // 3. Working Process In Hand — outstanding factory-issued items as of cutoff
      const issueItems = await fetchAllSupabase(
        supabase.from('issue_items')
          .select(`
            *, 
            issues (issue_id, issue_type, recipient_name, issue_date, status),
            items (name, item_code, unit, unit_price, currency, conversion_rate, style_name, purchase_no, order_number, size, color, buyer_name, category_id)
          `)
          .order('id')
      );

      // Fetch return/consumption logs after cutoff to reverse them for WIP
      // We use issue_items' updated_at or rely on issue_date for filtering
      workingProcess = issueItems
        .filter(r => r.issues?.issue_type === 'FACTORY')
        .filter(r => {
          // Only include issues made on or before cutoff date
          const issueDate = r.issues?.issue_date;
          if (!issueDate) return true;
          return inLocalRange(issueDate, null, cutoffDate);
        })
        .map(r => {
          const outstanding = (r.quantity || 0) - (r.returned_quantity || 0) - (r.damage_quantity || 0) - (r.rejected_quantity || 0) - (r.consumed_quantity || 0);
          return {
            issue_id: r.issues?.issue_id,
            recipient_name: r.issues?.recipient_name,
            issue_date: r.issues?.issue_date,
            issue_status: r.issues?.status,
            item_name: r.items?.name,
            item_code: r.items?.item_code,
            unit: r.unit || r.items?.unit || 'pcs',
            unit_price: r.items?.unit_price || 0,
            currency: r.items?.currency || 'BDT',
            conversion_rate: r.items?.conversion_rate || null,
            style_name: r.style_no || r.items?.style_name || '',
            purchase_no: r.purchase_no || r.items?.purchase_no || '',
            order_number: r.order_number || r.items?.order_number || '',
            size: r.items?.size || '',
            color: r.items?.color || '',
            buyer_name: r.items?.buyer_name || '',
            issued_qty: r.quantity || 0,
            consumed_qty: r.consumed_quantity || 0,
            returned_qty: r.returned_quantity || 0,
            damaged_qty: r.damage_quantity || 0,
            rejected_qty: r.rejected_quantity || 0,
            outstanding: outstanding,
            outstanding_value: outstanding * (r.items?.unit_price || 0),
          };
        })
        .filter(r => r.outstanding > 0);

    } else {
      // ---- Local SQLite fallback ----
      // Calculate stock at cutoff: current_stock - (IN after cutoff) + (OUT after cutoff)

      // Raw Material
      rawMaterials = dbPrepare(`
        SELECT i.*, c.name as category_name, s.name as supplier_name,
          (i.current_stock 
            - COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'IN' AND datetime(st.created_at) > ?), 0)
            + COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'OUT' AND datetime(st.created_at) > ?), 0)
          ) as current_stock,
          (
            (i.current_stock 
              - COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'IN' AND datetime(st.created_at) > ?), 0)
              + COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'OUT' AND datetime(st.created_at) > ?), 0)
            ) * COALESCE(i.unit_price, 0)
          ) as total_value
        FROM items i
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        WHERE i.is_active = 1 AND COALESCE(i.source_type, 'SOURCE') = 'SOURCE'
        AND (i.current_stock 
            - COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'IN' AND datetime(st.created_at) > ?), 0)
            + COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'OUT' AND datetime(st.created_at) > ?), 0)
        ) > 0
        ORDER BY i.name
      `).all(cutoffSql, cutoffSql, cutoffSql, cutoffSql, cutoffSql, cutoffSql);

      // Finished Goods
      finishedGoods = dbPrepare(`
        SELECT i.*, c.name as category_name, s.name as supplier_name,
          (i.current_stock 
            - COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'IN' AND datetime(st.created_at) > ?), 0)
            + COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'OUT' AND datetime(st.created_at) > ?), 0)
          ) as current_stock,
          (
            (i.current_stock 
              - COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'IN' AND datetime(st.created_at) > ?), 0)
              + COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'OUT' AND datetime(st.created_at) > ?), 0)
            ) * COALESCE(i.unit_price, 0)
          ) as total_value
        FROM items i
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        WHERE i.is_active = 1 AND i.source_type = 'PRODUCTION'
        AND (i.current_stock 
            - COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'IN' AND datetime(st.created_at) > ?), 0)
            + COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.item_id = i.id AND st.type = 'OUT' AND datetime(st.created_at) > ?), 0)
        ) > 0
        ORDER BY i.name
      `).all(cutoffSql, cutoffSql, cutoffSql, cutoffSql, cutoffSql, cutoffSql);

      // Working Process In Hand — only issues on or before cutoff
      workingProcess = dbPrepare(`
        SELECT 
          ii.quantity as issued_qty,
          COALESCE(ii.consumed_quantity, 0) as consumed_qty,
          COALESCE(ii.returned_quantity, 0) as returned_qty,
          COALESCE(ii.damage_quantity, 0) as damaged_qty,
          COALESCE(ii.rejected_quantity, 0) as rejected_qty,
          (ii.quantity - COALESCE(ii.returned_quantity,0) - COALESCE(ii.damage_quantity,0) - COALESCE(ii.rejected_quantity,0) - COALESCE(ii.consumed_quantity,0)) as outstanding,
          iss.issue_id, iss.recipient_name, iss.issue_date, iss.status as issue_status,
          it.name as item_name, it.item_code, COALESCE(ii.unit, it.unit) as unit,
          it.unit_price, it.currency, it.conversion_rate,
          COALESCE(NULLIF(ii.style_no, ''), it.style_name) as style_name,
          COALESCE(NULLIF(ii.purchase_no, ''), it.purchase_no) as purchase_no,
          COALESCE(NULLIF(ii.order_number, ''), it.order_number) as order_number,
          it.size, it.color, it.buyer_name, it.category_id,
          ((ii.quantity - COALESCE(ii.returned_quantity,0) - COALESCE(ii.damage_quantity,0) - COALESCE(ii.rejected_quantity,0) - COALESCE(ii.consumed_quantity,0)) * COALESCE(it.unit_price, 0)) as outstanding_value
        FROM issue_items ii
        JOIN issues iss ON ii.issue_id = iss.id
        JOIN items it ON ii.item_id = it.id
        WHERE iss.issue_type = 'FACTORY'
        AND datetime(iss.issue_date) <= ?
        AND (ii.quantity - COALESCE(ii.returned_quantity,0) - COALESCE(ii.damage_quantity,0) - COALESCE(ii.rejected_quantity,0) - COALESCE(ii.consumed_quantity,0)) > 0
        ORDER BY iss.issue_date DESC
      `).all(cutoffSql);
    }

    if (filters.categoryId) {
      rawMaterials = rawMaterials.filter(i => String(i.category_id) === String(filters.categoryId));
      finishedGoods = finishedGoods.filter(i => String(i.category_id) === String(filters.categoryId));
      workingProcess = workingProcess.filter(r => String(r.category_id || r.items?.category_id) === String(filters.categoryId));
    }

    // Convert USD to BDT for items that have a conversion rate; items without conversion rate remain same
    const applyConversionToItems = (itemList, valueKey = 'total_value', priceKey = 'unit_price', stockKey = 'current_stock') => {
      return itemList.map(i => {
        const origCurr = i.currency || 'BDT';
        const isUSD = origCurr === 'USD';
        const rate = Number(i.conversion_rate);
        const hasRate = isUSD && !isNaN(rate) && rate > 0;
        const origPrice = Number(i[priceKey] || 0);
        const effectivePrice = hasRate ? (origPrice * rate) : origPrice;
        const stockQty = Number(i[stockKey] || 0);
        const totalVal = stockQty * effectivePrice;
        return {
          ...i,
          [priceKey]: effectivePrice,
          currency: hasRate ? 'BDT' : origCurr,
          [valueKey]: totalVal,
          converted_from_usd: hasRate,
          original_currency: origCurr,
          original_unit_price: origPrice,
        };
      });
    };

    rawMaterials = applyConversionToItems(rawMaterials, 'total_value', 'unit_price', 'current_stock');
    finishedGoods = applyConversionToItems(finishedGoods, 'total_value', 'unit_price', 'current_stock');
    workingProcess = applyConversionToItems(workingProcess, 'outstanding_value', 'unit_price', 'outstanding');

    // Compute summaries
    const computeSummary = (items, stockKey = 'current_stock', valueKey = 'total_value') => {
      let totalQty = 0, totalBDT = 0, totalUSD = 0, itemCount = items.length;
      items.forEach(i => {
        totalQty += Number(i[stockKey] || 0);
        const val = Number(i[valueKey] || 0);
        if (i.currency === 'USD') {
          totalUSD += val;
        } else {
          totalBDT += val;
        }
      });
      return { itemCount, totalQty, totalBDT, totalUSD };
    };

    const rawSummary = computeSummary(rawMaterials);
    const fgSummary = computeSummary(finishedGoods);
    const wipSummary = computeSummary(workingProcess, 'outstanding', 'outstanding_value');

    return {
      rawMaterials,
      finishedGoods,
      workingProcess,
      cutoffDate,
      summary: {
        raw: rawSummary,
        finished: fgSummary,
        wip: wipSummary,
        grandTotalBDT: rawSummary.totalBDT + fgSummary.totalBDT + wipSummary.totalBDT,
        grandTotalUSD: rawSummary.totalUSD + fgSummary.totalUSD + wipSummary.totalUSD,
      },
      generatedAt: new Date().toISOString(),
    };
  },

  
  async dailySummary(date) {
    const stockSummary = await StockTransactionsRepo.getDailySummary(date);
    let challansCreated = 0;
    let transactions = [];
    
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const start = dayStartIso(date);
      const end = dayEndIso(date);
      
      const { count } = await supabase.from('challans')
        .select('*', { count: 'exact', head: true })
        .gte('challan_date', start)
        .lte('challan_date', end);
      challansCreated = count || 0;
      
      const { data: txs } = await supabase.from('stock_transactions')
        .select('*, items(name, item_code)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
        
      transactions = (txs || []).map(t => ({
        ...t,
        item_name: t.items?.name,
        item_code: t.items?.item_code
      }));
    } else {
      const s = dayStartSql(date), e = dayEndSql(date);
      challansCreated = dbPrepare(`SELECT COUNT(*) as count FROM challans WHERE datetime(challan_date) >= ? AND datetime(challan_date) <= ?`).get(s, e)?.count || 0;
      transactions = dbPrepare(`SELECT st.*, i.name as item_name, i.item_code FROM stock_transactions st JOIN items i ON st.item_id = i.id WHERE datetime(st.created_at) >= ? AND datetime(st.created_at) <= ? ORDER BY st.created_at DESC`).all(s, e);
    }
    return { date, ...stockSummary, challansCreated, transactions };
  },
  
  async monthlySummary(year, month) {
    const dateFrom = `${year}-${String(month).padStart(2,'0')}-01`;
    const dateTo = lastDayOfMonth(year, month); // real last day (Postgres rejects e.g. 2026-11-31)
    const start = dayStartIso(dateFrom);
    const end = dayEndIso(dateTo);

    let dailyBreakdown = [];
    let totalChallans = 0;
    let topMovers = [];

    if (isCloudEnabled()) {
      const supabase = getSupabase();
      
      const { count } = await supabase.from('challans')
        .select('*', { count: 'exact', head: true })
        .gte('challan_date', start)
        .lte('challan_date', end);
      totalChallans = count || 0;

      const { data: txs, error: txErr } = await supabase.from('stock_transactions')
        .select('created_at, type, quantity, item_id, items(name, item_code)')
        .gte('created_at', start)
        .lte('created_at', end);
      if (txErr) throw txErr;

      const dbMap = {};
      const moversMap = {};
      
      for (const t of (txs || [])) {
        const d = localDay(t.created_at);
        if (!dbMap[d]) dbMap[d] = { date: d, total_in: 0, total_out: 0, transaction_count: 0 };
        dbMap[d].transaction_count++;
        if (t.type === 'IN') dbMap[d].total_in += t.quantity;
        if (t.type === 'OUT') dbMap[d].total_out += t.quantity;

        if (t.type === 'OUT') {
          if (!moversMap[t.item_id]) {
            moversMap[t.item_id] = { name: t.items?.name, item_code: t.items?.item_code, total_out: 0 };
          }
          moversMap[t.item_id].total_out += t.quantity;
        }
      }
      dailyBreakdown = Object.values(dbMap).sort((a,b) => a.date.localeCompare(b.date));
      topMovers = Object.values(moversMap).sort((a,b) => b.total_out - a.total_out).slice(0, 10);
    } else {
      const s = dayStartSql(dateFrom), e = dayEndSql(dateTo);
      dailyBreakdown = dbPrepare(`SELECT DATE(created_at, 'localtime') as date, SUM(CASE WHEN type='IN' THEN quantity ELSE 0 END) as total_in, SUM(CASE WHEN type='OUT' THEN quantity ELSE 0 END) as total_out, COUNT(*) as transaction_count FROM stock_transactions WHERE datetime(created_at) >= ? AND datetime(created_at) <= ? GROUP BY DATE(created_at, 'localtime') ORDER BY date`).all(s, e);
      totalChallans = dbPrepare(`SELECT COUNT(*) as count FROM challans WHERE datetime(challan_date) >= ? AND datetime(challan_date) <= ?`).get(s, e)?.count || 0;
      topMovers = dbPrepare(`SELECT i.name, i.item_code, SUM(CASE WHEN st.type='OUT' THEN st.quantity ELSE 0 END) as total_out FROM stock_transactions st JOIN items i ON st.item_id = i.id WHERE datetime(st.created_at) >= ? AND datetime(st.created_at) <= ? GROUP BY st.item_id ORDER BY total_out DESC LIMIT 10`).all(s, e);
    }

    return { year, month, dailyBreakdown, totalChallans, topMovers };
  },

  async monthlyStockMovementReport(filters = {}) {
    const {
      getMonthWindow,
      aggregateMonthlyMovementRows,
      fetchMonthlyStockMovementSupabase,
    } = await import('../../shared/monthly-stock-movement.mjs');

    if (isCloudEnabled()) {
      return await fetchMonthlyStockMovementSupabase(getSupabase(), filters, fetchAllSupabase);
    }

    const win = getMonthWindow(filters.month);
    const startSql = dayStartSql(win.dateFrom);
    const endSql = dayEndSql(win.dateTo);

    let where = ['i.is_active = 1'];
    let params = [];
    if (filters.search) {
      where.push('(i.name LIKE ? OR i.item_code LIKE ? OR i.style_name LIKE ? OR i.order_number LIKE ? OR i.purchase_no LIKE ?)');
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s);
    }
    if (filters.styleName) { where.push('i.style_name = ?'); params.push(filters.styleName); }
    if (filters.orderNumber) { where.push('i.order_number = ?'); params.push(filters.orderNumber); }
    if (filters.purchaseNo) { where.push('i.purchase_no = ?'); params.push(filters.purchaseNo); }
    if (filters.buyerName) { where.push('i.buyer_name = ?'); params.push(filters.buyerName); }
    if (filters.categoryId) { where.push('i.category_id = ?'); params.push(filters.categoryId); }

    const items = dbPrepare(`
      SELECT i.*, c.name as category_name, s.name as supplier_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY i.name ASC, i.id ASC
    `).all(...params);

    const monthTxs = dbPrepare(`
      SELECT item_id, type, quantity, created_at, notes
      FROM stock_transactions
      WHERE datetime(created_at) >= ? AND datetime(created_at) <= ?
      ORDER BY datetime(created_at) ASC
    `).all(startSql, endSql);

    const afterEndTxs = dbPrepare(`
      SELECT item_id, type, quantity
      FROM stock_transactions
      WHERE datetime(created_at) > ?
    `).all(endSql);

    const lastInRows = dbPrepare(`
      SELECT item_id, MAX(created_at) as last_in_date
      FROM stock_transactions
      WHERE type = 'IN' AND datetime(created_at) < ?
      GROUP BY item_id
    `).all(startSql);

    const priorLastInMap = {};
    for (const r of lastInRows) {
      priorLastInMap[Number(r.item_id)] = r.last_in_date;
    }

    return aggregateMonthlyMovementRows(items, monthTxs, afterEndTxs, priorLastInMap);
  },
};
module.exports = ReportService;
