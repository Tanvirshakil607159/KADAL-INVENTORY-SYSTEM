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

  console.log('Fetching issue items...');
  const { data: issueItems } = await supabase
    .from('issue_items')
    .select('*')
    .in('issue_id', [858, 1102]);
    
  console.log('Issue Items:', JSON.stringify(issueItems, null, 2));

  const itemIds = issueItems ? issueItems.map(i => i.item_id) : [];
  
  if (itemIds.length > 0) {
    const { data: tx2 } = await supabase
      .from('stock_transactions')
      .select('*')
      .in('item_id', itemIds)
      .order('created_at', { ascending: false })
      .limit(10);
      
    console.log('Recent transactions for items:', JSON.stringify(tx2, null, 2));

    const { data: items } = await supabase
      .from('items')
      .select('id, name, current_stock')
      .in('id', itemIds);
    console.log('Items:', JSON.stringify(items, null, 2));
  }
}

run().catch(console.error);
