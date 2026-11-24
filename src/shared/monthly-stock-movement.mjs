/**
 * Month-wise Stock Movement Report helpers shared between Desktop (Supabase) and Web.
 * Reconstructs Opening Stock, Total In Qty, Total Issue Qty, Current Stock Qty (as of month end),
 * and Last Purchase Date (last Stock In date on or before month end).
 */

function toDate(day, endOfDay) {
  if (!day) return null;
  const s = String(day).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function getMonthWindow(monthFilter) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (monthFilter && /^\d{4}-\d{2}$/.test(String(monthFilter).trim())) {
    const [y, m] = String(monthFilter).trim().split('-').map(Number);
    if (y >= 2000 && m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }

  const mm = String(month).padStart(2, '0');
  const dateFrom = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0);
  const dateTo = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });

  return {
    year,
    month,
    yearMonth: `${year}-${mm}`,
    monthName,
    periodLabel: monthName,
    dateFrom,
    dateTo,
    startIso: toDate(dateFrom, false).toISOString(),
    endIso: toDate(dateTo, true).toISOString(),
  };
}

export function getReportPeriodWindow(filters = {}) {
  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
  const rawFrom = isYmd(filters.dateFrom) ? String(filters.dateFrom).trim() : '';
  const rawTo = isYmd(filters.dateTo) ? String(filters.dateTo).trim() : '';

  if (!rawFrom && !rawTo) {
    return getMonthWindow(filters.month);
  }

  const anchorMonth = (rawFrom || rawTo).slice(0, 7);
  const monthWin = getMonthWindow(filters.month || anchorMonth);

  let dateFrom = rawFrom || `${rawTo.slice(0, 7)}-01`;
  let dateTo = rawTo || getMonthWindow(rawFrom.slice(0, 7)).dateTo;

  if (dateFrom > dateTo) {
    const tmp = dateFrom;
    dateFrom = dateTo;
    dateTo = tmp;
  }

  // Show clean month name when the selected range matches an exact full calendar month
  const fromMonthWin = getMonthWindow(dateFrom.slice(0, 7));
  const isFullCalendarMonth = dateFrom === fromMonthWin.dateFrom && dateTo === fromMonthWin.dateTo;
  const periodLabel = isFullCalendarMonth
    ? fromMonthWin.monthName
    : `${formatReportDate(dateFrom + 'T00:00:00')} to ${formatReportDate(dateTo + 'T00:00:00')}`;

  return {
    year: isFullCalendarMonth ? fromMonthWin.year : monthWin.year,
    month: isFullCalendarMonth ? fromMonthWin.month : monthWin.month,
    yearMonth: isFullCalendarMonth ? fromMonthWin.yearMonth : monthWin.yearMonth,
    monthName: isFullCalendarMonth ? fromMonthWin.monthName : periodLabel,
    periodLabel,
    dateFrom,
    dateTo,
    startIso: toDate(dateFrom, false).toISOString(),
    endIso: toDate(dateTo, true).toISOString(),
  };
}

export function cleanSizeColor(size, color) {
  const parts = [size, color]
    .map((v) => String(v ?? '').trim())
    .filter((v) => v && v !== '-' && !/^n\/?a$/i.test(v));
  return parts.join(' / ');
}

export function formatReportDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '-';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export function aggregateMonthlyMovementRows(items, monthTxs, afterEndTxs, priorLastInMap = {}) {
  const afterDeltaMap = new Map();
  for (const tx of afterEndTxs || []) {
    const id = Number(tx.item_id);
    const qty = Number(tx.quantity) || 0;
    const prev = afterDeltaMap.get(id) || 0;
    // Reverse post-month transactions to obtain stock at end of selected month
    if (tx.type === 'IN') afterDeltaMap.set(id, prev - qty);
    else if (tx.type === 'OUT') afterDeltaMap.set(id, prev + qty);
  }

  const monthStatsMap = new Map();
  for (const tx of monthTxs || []) {
    const id = Number(tx.item_id);
    let stats = monthStatsMap.get(id);
    if (!stats) {
      stats = { totalIn: 0, totalIssue: 0, lastInDate: null, notes: [] };
      monthStatsMap.set(id, stats);
    }
    const qty = Number(tx.quantity) || 0;
    if (tx.type === 'IN') {
      stats.totalIn += qty;
      if (tx.created_at && (!stats.lastInDate || new Date(tx.created_at) > new Date(stats.lastInDate))) {
        stats.lastInDate = tx.created_at;
      }
    } else if (tx.type === 'OUT') {
      stats.totalIssue += qty;
    }
    const note = String(tx.notes || '').trim();
    if (note && !stats.notes.includes(note)) {
      stats.notes.push(note);
    }
  }

  const rows = [];
  for (const item of items || []) {
    const id = Number(item.id);
    const stats = monthStatsMap.get(id);
    const totalIn = Number((stats?.totalIn || 0).toFixed(4));
    const totalIssue = Number((stats?.totalIssue || 0).toFixed(4));
    const closingStock = Number(((Number(item.current_stock) || 0) + (afterDeltaMap.get(id) || 0)).toFixed(4));
    const openingStock = Number((closingStock - totalIn + totalIssue).toFixed(4));

    if (openingStock === 0 && totalIn === 0 && totalIssue === 0 && closingStock === 0) {
      continue;
    }

    const lastInDate = stats?.lastInDate || priorLastInMap[id] || null;
    rows.push({
      id: item.id,
      item_code: item.item_code || '',
      category_name: item.category_name || item.categories?.name || '',
      item_name: item.name || item.item_name || '',
      size: item.size || '',
      color: item.color || '',
      size_color: cleanSizeColor(item.size, item.color),
      unit: (item.unit || 'PCS').toUpperCase(),
      opening_stock: openingStock,
      total_in: totalIn,
      total_issue: totalIssue,
      closing_stock: closingStock,
      last_in_date: lastInDate,
      supplier_name: item.supplier_name || item.suppliers?.name || '',
      remarks: stats?.notes?.join('; ') || '',
      buyer_name: item.buyer_name || '',
      style_name: item.style_name || '',
      order_number: item.order_number || '',
      purchase_no: item.purchase_no || '',
    });
  }

  return rows;
}

export async function fetchMonthlyStockMovementSupabase(supabase, filters = {}, fetchAllFn) {
  const win = getReportPeriodWindow(filters);

  let itemsQuery = supabase
    .from('items')
    .select('id, item_code, name, size, color, unit, current_stock, buyer_name, style_name, order_number, purchase_no, category_id, supplier_id, categories(name), suppliers(name)')
    .eq('is_active', true)
    .order('name')
    .order('id');

  if (filters.search) {
    const s = filters.search;
    itemsQuery = itemsQuery.or(`name.ilike.%${s}%,item_code.ilike.%${s}%,style_name.ilike.%${s}%,order_number.ilike.%${s}%,purchase_no.ilike.%${s}%`);
  }
  if (filters.styleName) itemsQuery = itemsQuery.eq('style_name', filters.styleName);
  if (filters.orderNumber) itemsQuery = itemsQuery.eq('order_number', filters.orderNumber);
  if (filters.purchaseNo) itemsQuery = itemsQuery.eq('purchase_no', filters.purchaseNo);
  if (filters.buyerName) itemsQuery = itemsQuery.eq('buyer_name', filters.buyerName);
  if (filters.categoryId) itemsQuery = itemsQuery.eq('category_id', filters.categoryId);

  const [items, monthTxs, afterEndTxs] = await Promise.all([
    fetchAllFn(itemsQuery),
    fetchAllFn(
      supabase
        .from('stock_transactions')
        .select('item_id, type, quantity, created_at, notes')
        .gte('created_at', win.startIso)
        .lte('created_at', win.endIso)
        .order('created_at', { ascending: true })
    ),
    fetchAllFn(
      supabase
        .from('stock_transactions')
        .select('item_id, type, quantity')
        .gt('created_at', win.endIso)
        .order('id', { ascending: true })
    ),
  ]);

  // Preliminary pass to find items needing pre-month Last Purchase (Stock In) date lookup
  const initialRows = aggregateMonthlyMovementRows(items, monthTxs, afterEndTxs);
  const missingLastInIds = initialRows.filter((r) => !r.last_in_date).map((r) => r.id);

  const priorLastInMap = {};
  if (missingLastInIds.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < missingLastInIds.length; i += batchSize) {
      const batch = missingLastInIds.slice(i, i + batchSize);
      const batchTxs = await fetchAllFn(
        supabase
          .from('stock_transactions')
          .select('item_id, created_at')
          .eq('type', 'IN')
          .in('item_id', batch)
          .lt('created_at', win.startIso)
          .order('created_at', { ascending: false })
      );
      for (const tx of batchTxs || []) {
        const key = Number(tx.item_id);
        if (!priorLastInMap[key]) priorLastInMap[key] = tx.created_at;
      }
    }
  }

  return aggregateMonthlyMovementRows(items, monthTxs, afterEndTxs, priorLastInMap);
}
