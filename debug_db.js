const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(dbPath)) return;
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const urlRow = db.exec("SELECT value FROM settings WHERE key = 'supabase_url'");
  const keyRow = db.exec("SELECT value FROM settings WHERE key = 'supabase_key'");
  const url = urlRow[0].values[0][0];
  const key = keyRow[0].values[0][0];
  db.close();

  const supabase = createClient(url, key);

  console.log('\n--- TARGET ITEMS (578, 579) ---');
  const { data, error } = await supabase.from('items').select('*').in('id', [578, 579]);
  if (error) console.error(error.message);
  else console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
