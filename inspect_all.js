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

  const localSettings = {};
  const settingsRows = db.exec('SELECT key, value FROM settings');
  if (settingsRows.length > 0) {
    settingsRows[0].values.forEach(row => {
      localSettings[row[0]] = row[1];
    });
  }
  console.log('--- LOCAL SQLITE SETTINGS ---');
  console.log(JSON.stringify(localSettings, null, 2));

  const u = localSettings['supabase_url'];
  const k = localSettings['supabase_key'];
  db.close();

  if (u && k) {
    console.log('Connecting to Supabase at:', u);
    const supabase = createClient(u, k);
    const { data, error } = await supabase.from('settings').select('*');
    if (error) {
      console.error('Error fetching from Supabase:', error.message);
    } else {
      console.log('--- CLOUD SUPABASE SETTINGS ---');
      const cloudSettings = {};
      data.forEach(r => {
        cloudSettings[r.key] = r.value;
      });
      console.log(JSON.stringify(cloudSettings, null, 2));
    }
  } else {
    console.log('No Supabase credentials found.');
  }
}

run().catch(console.error);
