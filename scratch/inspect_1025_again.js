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
    
    // Fetch Issue ISS-1025
    const { data: issue, error: issueErr } = await supabase
      .from('issues')
      .select('*')
      .eq('issue_id', 'ISS-1025')
      .single();
      
    console.log('\n=== ISSUE ISS-1025 ===');
    console.log(issue, issueErr);
    
    if (issue) {
      // 2. Fetch Issue Items
      const { data: items, error: itemsErr } = await supabase
        .from('issue_items')
        .select('*')
        .eq('issue_id', issue.id);
        
      console.log('\n=== ISSUE ITEMS ===');
      console.log(JSON.stringify(items, null, 2), itemsErr);
      
      // 3. Fetch Stock Transactions for ISS-1025
      const { data: txs, error: txsErr } = await supabase
        .from('stock_transactions')
        .select('*')
        .ilike('reference', `%${issue.issue_id}%`)
        .order('id', { ascending: true });
        
      console.log('\n=== STOCK TRANSACTIONS ===');
      console.log(JSON.stringify(txs, null, 2), txsErr);
    }
  }
}

run().catch(console.error);
