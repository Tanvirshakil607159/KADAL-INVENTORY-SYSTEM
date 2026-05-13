const { getDb, initDatabase, isCloudEnabled, getSupabase } = require('./src/main/database/connection');
const path = require('path');
const fs = require('fs');

async function findChallan(targetId) {
  // We need to mock Electron's app for the connection script to work
  // Or we just find the Kadal.db file
  // Since we are running in the workspace, Kadal.db might be in AppData.
  
  console.log('--- FIND CHALLAN ' + targetId + ' ---');
  
  // Since we can't easily get AppData in raw node, let's look at approvals and gate_passes via service/repo logic if possible
  // or just look for the db file in common locations.
  
  // Try to find the db path by looking at what getDbPath does
  // On Windows: %APPDATA%\kadal\kadal.db
  const appData = process.env.APPDATA;
  const dbPath = path.join(appData, 'kadal-inventory', 'kadal.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found at:', dbPath);
    return;
  }

  const initSqlJs = require('sql.js');
  const wasmPath = path.join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const data = fs.readFileSync(dbPath);
  const db = new SQL.Database(data);

  console.log('\nChecking Gate Passes...');
  const gps = db.prepare("SELECT id, gate_pass_number, challan_ids FROM gate_passes").get();
  const gpRows = [];
  const stmt = db.prepare("SELECT id, gate_pass_number, challan_ids FROM gate_passes");
  while(stmt.step()) gpRows.push(stmt.getAsObject());
  
  gpRows.forEach(row => {
    try {
      const ids = JSON.parse(row.challan_ids);
      if (ids.includes(Number(targetId)) || ids.includes(String(targetId))) {
        console.log('Found in Gate Pass:', row);
      }
    } catch(e) {}
  });

  console.log('\nChecking Approvals...');
  const appRows = [];
  const astmt = db.prepare("SELECT id, type, status, data FROM approvals WHERE status = 'PENDING'");
  while(astmt.step()) appRows.push(astmt.getAsObject());
  
  appRows.forEach(row => {
    try {
      const data = JSON.parse(row.data);
      if (data.challanIds && (data.challanIds.includes(Number(targetId)) || data.challanIds.includes(String(targetId)))) {
        console.log('Found in Pending Approval:', row);
      }
    } catch(e) {}
  });

  db.close();
}

const target = process.argv[2] || 12;
findChallan(target).catch(console.error);
