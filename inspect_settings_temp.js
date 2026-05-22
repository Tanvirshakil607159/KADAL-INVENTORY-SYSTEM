const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join('C:', 'Users', 'workh', 'AppData', 'Roaming', 'kadal-inventory', 'kadal.db');

async function run() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(dbPath)) {
    console.log('Database does not exist at ' + dbPath);
    return;
  }
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const settings = db.exec('SELECT key, value FROM settings');
  const getVal = (k) => {
    try {
      const res = db.exec(`SELECT value FROM settings WHERE key = '${k}'`);
      return res[0]?.values[0][0];
    } catch(e) { return null; }
  };
  const u = getVal('supabase_url');
  const k = getVal('supabase_key');
  db.close();

  if (u && k) {
    console.log('Connecting to Supabase at:', u);
    const supabase = createClient(u, k);
    const { data, error } = await supabase.from('settings').select('*');
    if (error) {
      console.error('Error fetching from Supabase:', error.message);
    } else {
      console.log('Keys in Supabase settings:', data.map(r => r.key).join(', '));
    }
  } else {
    console.log('No Supabase credentials found.');
  }
}

run().catch(console.error);
