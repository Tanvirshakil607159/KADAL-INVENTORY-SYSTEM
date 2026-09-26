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

  if (!url || !key) {
    console.log('No supabase credentials found.');
    return;
  }

  const supabase = createClient(url, key);

  console.log('Fetching issues...');
  const { data: issues, error: issuesErr } = await supabase
    .from('issues')
    .select('*')
    .in('issue_id', ['ISS-1069', 'ISS-0828']);

  if (issuesErr) {
    console.error('issues error:', issuesErr);
  } else {
    console.log('Issues:', JSON.stringify(issues, null, 2));
    
    if (issues && issues.length > 0) {
      const { data: issueItems, error: itemsErr } = await supabase
        .from('issue_items')
        .select('*')
        .in('issue_id', issues.map(i => i.id));
        
      if (itemsErr) console.error('issue_items error:', itemsErr);
      else console.log('Issue Items:', JSON.stringify(issueItems, null, 2));

      const { data: tx, error: txErr } = await supabase
        .from('stock_transactions')
        .select('*')
        .in('reference_id', issues.map(i => i.id).map(String)); // reference_id might be string or number

      if (txErr) console.error('tx error:', txErr);
      else console.log('Stock Transactions (string):', JSON.stringify(tx, null, 2));
      
      const { data: tx2, error: txErr2 } = await supabase
        .from('stock_transactions')
        .select('*')
        .in('reference_id', issues.map(i => i.id)); // reference_id might be number

      if (txErr2) console.error('tx error2:', txErr2);
      else console.log('Stock Transactions (number):', JSON.stringify(tx2, null, 2));
    }
  }
}

run().catch(console.error);
