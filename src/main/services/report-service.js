const { dbPrepare, getSupabase, isCloudEnabled } = require('../database/connection');
const ItemsRepo = require('../database/repositories/items');
const StockTransactionsRepo = require('../database/repositories/stock-transactions');
const ChallansRepo = require('../database/repositories/challans');

const ReportService = {
  async stockReport(filters = {}) { return await ItemsRepo.getAll(filters); },
  
  async movementReport(filters = {}) {
    return await StockTransactionsRepo.getMovementSummary(filters);
  },
  
  async lowStockReport(filters = {}) { return await ItemsRepo.getLowStockItems(filters); },
  
  async challanHistory(filters = {}) { return await ChallansRepo.getAll(filters); },
  
  async dailySummary(date) {
    const stockSummary = await StockTransactionsRepo.getDailySummary(date);
    let challansCreated = 0;
    let transactions = [];
    
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const start = date + 'T00:00:00Z';
      const end = date + 'T23:59:59.999Z';
      
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
      challansCreated = dbPrepare(`SELECT COUNT(*) as count FROM challans WHERE DATE(challan_date) = DATE(?)`).get(date)?.count || 0;
      transactions = dbPrepare(`SELECT st.*, i.name as item_name, i.item_code FROM stock_transactions st JOIN items i ON st.item_id = i.id WHERE DATE(st.created_at) = DATE(?) ORDER BY st.created_at DESC`).all(date);
    }
    return { date, ...stockSummary, challansCreated, transactions };
  },
  
  async monthlySummary(year, month) {
    const dateFrom = `${year}-${String(month).padStart(2,'0')}-01`;
    const dateTo = `${year}-${String(month).padStart(2,'0')}-31`;
    const start = dateFrom + 'T00:00:00Z';
    const end = dateTo + 'T23:59:59.999Z';

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

      const { data: txs } = await supabase.from('stock_transactions')
        .select('created_at, type, quantity, item_id, items(name, item_code)')
        .gte('created_at', start)
        .lte('created_at', end);

      const dbMap = {};
      const moversMap = {};
      
      for (const t of (txs || [])) {
        const d = t.created_at.split('T')[0];
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
      dailyBreakdown = dbPrepare(`SELECT DATE(created_at) as date, SUM(CASE WHEN type='IN' THEN quantity ELSE 0 END) as total_in, SUM(CASE WHEN type='OUT' THEN quantity ELSE 0 END) as total_out, COUNT(*) as transaction_count FROM stock_transactions WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at) ORDER BY date`).all(start, end);
      totalChallans = dbPrepare(`SELECT COUNT(*) as count FROM challans WHERE challan_date >= ? AND challan_date <= ?`).get(start, end)?.count || 0;
      topMovers = dbPrepare(`SELECT i.name, i.item_code, SUM(CASE WHEN st.type='OUT' THEN st.quantity ELSE 0 END) as total_out FROM stock_transactions st JOIN items i ON st.item_id = i.id WHERE st.created_at >= ? AND st.created_at <= ? GROUP BY st.item_id ORDER BY total_out DESC LIMIT 10`).all(start, end);
    }

    return { year, month, dailyBreakdown, totalChallans, topMovers };
  },
};
module.exports = ReportService;
