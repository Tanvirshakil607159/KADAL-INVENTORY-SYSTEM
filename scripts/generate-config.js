const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const appData = process.env.APPDATA || path.join('C:', 'Users', 'workh', 'AppData', 'Roaming');
const dbPath = path.join(appData, 'kadal-inventory', 'kadal.db');
const publicDir = path.join(__dirname, '../src/renderer/public');
const configPath = path.join(publicDir, 'config.json');

async function run() {
  console.log('[Config Generator] Reading settings from SQLite database:', dbPath);
  
  if (!fs.existsSync(dbPath)) {
    console.warn('[Config Generator] SQLite database not found at:', dbPath, '. Writing empty config.json.');
    writeConfig('', '');
    return;
  }

  try {
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const getVal = (key) => {
      try {
        const res = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
        return res[0]?.values[0][0];
      } catch { return null; }
    };

    const sUrl = getVal('supabase_url') || '';
    const sKey = getVal('supabase_key') || '';
    db.close();

    writeConfig(sUrl, sKey);
  } catch (err) {
    console.error('[Config Generator] Failed to read database:', err.message);
    writeConfig('', '');
  }
}

function writeConfig(url, key) {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const configData = {
    supabase_url: url,
    supabase_key: key
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log('[Config Generator] Successfully wrote config.json to:', configPath);
}

run().catch(err => {
  console.error('[Config Generator] Failed:', err);
  process.exit(1);
});
