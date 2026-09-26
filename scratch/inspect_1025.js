const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);
  const getVal = (key) => {
    try {
      const res = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
      return res[0]?.values[0][0];
    } catch { return null; }
  };
  const url = getVal('supabase_url');
  const key = getVal('supabase_key');
  db.close();

  if (url && key) {
    const supabase = createClient(url, key);
    
    // Fetch Stock Transactions for ISS-0995 (Issue 1025)
    const { data: txs, error: txsErr } = await supabase
      .from('stock_transactions')
      .select('*')
      .ilike('reference', '%ISS-0995%')
      .order('id', { ascending: true });
      
    console.log('\n=== STOCK TRANSACTIONS (reference: ISS-0995) ===');
    console.log(JSON.stringify(txs, null, 2), txsErr);

    // Let's also check all stock transactions for item 6369 to calculate running total properly
    const { data: itemTxs } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('item_id', 6369)
      .order('id', { ascending: true });
      
    console.log(`\n=== TRANSACTION HISTORY FOR ITEM 6369 ===`);
    let running = 0;
    itemTxs.forEach((t, i) => {
      const qty = Number(t.quantity);
      const before = running;
      if (t.type === 'IN') running += qty;
      else if (t.type === 'OUT') running -= qty;
      console.log(`[${i+1}] ID:${t.id} Type:${t.type} Qty:${qty} Ref:${t.reference} | Logged:(before=${t.stock_before}, after=${t.stock_after}) | Ledger:(before=${before}, after=${running})`);
    });
  }
}

run().catch(console.error);
