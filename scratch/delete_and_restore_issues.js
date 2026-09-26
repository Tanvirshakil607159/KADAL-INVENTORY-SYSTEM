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

  console.log('Starting deletion and restore process...');

  const issueIds = [858, 1102];
  const issueRefs = ['Issue: ISS-0828', 'Issue: ISS-1069'];

  // Fetch current stocks
  const itemIds = [5722, 5297, 3714];
  const { data: items, error: fetchErr } = await supabase.from('items').select('id, current_stock').in('id', itemIds);
  
  if (fetchErr) {
    console.error('Failed to fetch items:', fetchErr);
    return;
  }

  const stockMap = {};
  items.forEach(i => stockMap[i.id] = i.current_stock);

  // Quantities to restore based on our previous inspection
  // ISS-1069: item 5722 (qty: 69)
  // ISS-0828: item 5297 (qty: 40), item 3714 (qty: 14)
  const restoreMap = {
    5722: 69,
    5297: 40,
    3714: 14
  };

  // 1. Update items
  for (const id of itemIds) {
    const newStock = (stockMap[id] || 0) + restoreMap[id];
    console.log(`Updating item ${id} stock from ${stockMap[id]} to ${newStock}...`);
    const { error: updateErr } = await supabase
      .from('items')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updateErr) {
      console.error(`Error updating item ${id}:`, updateErr);
    } else {
      console.log(`Item ${id} stock updated successfully.`);
    }
  }

  // 2. Delete stock transactions
  console.log('Deleting stock transactions...');
  const { error: txErr } = await supabase.from('stock_transactions').delete().in('reference', issueRefs);
  if (txErr) {
    console.error('Error deleting stock transactions:', txErr);
  } else {
    console.log('Stock transactions deleted successfully.');
  }

  // 3. Delete issue items
  console.log('Deleting issue items...');
  const { error: iiErr } = await supabase.from('issue_items').delete().in('issue_id', issueIds);
  if (iiErr) {
    console.error('Error deleting issue items:', iiErr);
  } else {
    console.log('Issue items deleted successfully.');
  }

  // 4. Delete issues
  console.log('Deleting issues...');
  const { error: iErr } = await supabase.from('issues').delete().in('id', issueIds);
  if (iErr) {
    console.error('Error deleting issues:', iErr);
  } else {
    console.log('Issues deleted successfully.');
  }

  console.log('Done!');
}

run().catch(console.error);
