const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const { runMigrations } = require('./migrations/001-initial');
const bcrypt = require('bcryptjs');

let db = null;
let dbPath = null;
let skipSave = false;
let supabase = null;

function setRestoring(val) {
  skipSave = val;
}

function getDbPath() {
  if (!dbPath) {
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'kadal.db');
  }
  return dbPath;
}

async function initDatabase() {
  const filePath = getDbPath();
  console.log('[DB] Opening local settings database at:', filePath);

  const wasmPath = path.join(
    app.getAppPath(),
    'node_modules/sql.js/dist/sql-wasm.wasm'
  );

  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  try {
    // Load existing DB or create new (used for local settings and offline cache)
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`[DB] File size: ${stats.size} bytes`);
      
      const fileBuffer = fs.readFileSync(filePath);
      db = new SQL.Database(fileBuffer);
      
      // Try a simple operation to verify database integrity
      db.run('SELECT 1');
    } else {
      db = new SQL.Database();
    }

    // Enable WAL mode and foreign keys
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

  } catch (err) {
    console.error('[DB] CRITICAL: Failed to load database file:', err.message);
    
    if (fs.existsSync(filePath)) {
      const corruptBackup = `${filePath}.corrupt.${Date.now()}`;
      console.warn(`[DB] Renaming corrupted database to: ${corruptBackup}`);
      try {
        fs.renameSync(filePath, corruptBackup);
      } catch (renameErr) {
        console.error('[DB] Failed to rename corrupted file:', renameErr.message);
      }
    }

    console.info('[DB] Initializing a fresh local database...');
    db = new SQL.Database();
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
  }

  // Run migrations for local tables
  runMigrations(db);

  // Save after migrations
  saveDatabase();

  console.log('[DB] Local database initialized');

  // Initialize Supabase if credentials exist
  await initSupabase();

  // Ensure critical roles and users exist in the active DB (local or cloud)
  await seedCoreData();

  return db;
}

function initSupabase() {
  try {
    const url = dbPrepare('SELECT value FROM settings WHERE key = ?').get('supabase_url')?.value;
    const key = dbPrepare('SELECT value FROM settings WHERE key = ?').get('supabase_key')?.value;

    if (url && key) {
      console.log('[Cloud] Initializing Supabase client...');
      const WebSocket = require('ws');
      supabase = createClient(url, key, {
        auth: {
          persistSession: false
        },
        realtime: {
          transport: WebSocket
        }
      });
      console.log('[Cloud] Supabase initialized successfully');
    } else {
      console.log('[Cloud] Supabase not configured. Running in local-only mode.');
    }
  } catch (err) {
    console.error('[Cloud] Failed to initialize Supabase:', err.message);
  }
}

async function seedCoreData() {
  try {
    const isCloud = isCloudEnabled();
    console.log(`[DB] Seeding core data (${isCloud ? 'Cloud' : 'Local'})...`);

    const superAdminPerms = JSON.stringify({
      inventory: 'rw', challan: 'rw', reports: 'rw', users: 'rw', settings: 'rw', backup: 'rw', maintenance: 'rw'
    });

    if (isCloud) {
      // 1. Ensure Super Admin role exists in Supabase
      const { data: roles, error: rErr } = await supabase.from('roles').select('id').eq('name', 'Super Admin').maybeSingle();
      let roleId;
      if (rErr) throw rErr;

      if (!roles) {
        console.log('[Cloud] Creating Super Admin role...');
        const { data: newRole, error: nErr } = await supabase.from('roles').insert([{ name: 'Super Admin', permissions: superAdminPerms }]).select().single();
        if (nErr) throw nErr;
        roleId = newRole.id;
      } else {
        roleId = roles.id;
      }

      // 1.1 Ensure Monitoring role exists in Supabase
      const { data: mRole } = await supabase.from('roles').select('id').eq('name', 'Monitoring').maybeSingle();
      if (!mRole) {
        console.log('[Cloud] Creating Monitoring role...');
        const monitoringPerms = JSON.stringify({ 
          inventory: 'r', challan: 'r', reports: 'r', users: 'r', settings: 'r', backup: 'none', maintenance: 'none' 
        });
        await supabase.from('roles').insert([{ name: 'Monitoring', permissions: monitoringPerms }]);
      }

      // 2. Ensure superadmin user exists in Supabase
      const { data: user, error: uErr } = await supabase.from('users').select('id').eq('username', 'superadmin').maybeSingle();
      if (uErr) throw uErr;

      if (!user) {
        console.log('[Cloud] Creating superadmin user...');
        const hash = bcrypt.hashSync('superadmin', 10);
        const { error: iErr } = await supabase.from('users').insert([{
          username: 'superadmin',
          password_hash: hash,
          full_name: 'Super Administrator',
          role_id: roleId,
          is_active: true
        }]);
        if (iErr) throw iErr;
      }
    } else {
      // Local DB seeding is already handled by migrations, but let's double check here too
      // (This acts as a backup in case migrations were skipped)
      db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Super Admin', ?)", [superAdminPerms]);
      const roleRow = dbPrepare("SELECT id FROM roles WHERE name = 'Super Admin'").get();
      if (roleRow) {
        const hash = bcrypt.hashSync('superadmin', 10);
        db.run(`
          INSERT OR IGNORE INTO users (username, password_hash, full_name, role_id, is_active) 
          VALUES ('superadmin', ?, 'Super Administrator', ?, 1)
        `, [hash, roleRow.id]);
      }
    }
    console.log('[DB] Core data seeding complete');
  } catch (err) {
    console.error('[DB] Failed to seed core data:', err.message);
  }
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function getSupabase() {
  return supabase;
}

function isCloudEnabled() {
  return !!supabase;
}

function saveDatabase() {
  if (db && !skipSave) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(getDbPath(), buffer);
  }
}

function closeDatabase() {
  if (db) {
    console.log('[DB] Saving and closing database');
    saveDatabase();
    db.close();
    db = null;
  }
}

// Helper functions for local SQL (Settings, etc.)
function dbPrepare(sql) {
  return {
    run(...params) {
      db.run(sql, params);
      const result = db.exec('SELECT last_insert_rowid() as id, changes() as changes');
      const lastId = result.length > 0 ? result[0].values[0][0] : 0;
      const changes = result.length > 0 ? result[0].values[0][1] : 0;
      saveDatabase();
      return { lastInsertRowid: lastId, changes };
    },
    get(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        stmt.free();
        const row = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });
        return row;
      }
      stmt.free();
      return undefined;
    },
    all(...params) {
      const results = [];
      const stmt = db.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const row = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });
        results.push(row);
      }
      stmt.free();
      return results;
    },
  };
}

function dbExec(sql) {
  db.run(sql);
  saveDatabase();
}

function dbTransaction(fn) {
  return (...args) => {
    db.run('BEGIN TRANSACTION');
    try {
      const result = fn(...args);
      db.run('COMMIT');
      saveDatabase();
      return result;
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
  };
}

module.exports = {
  initDatabase, getDb, getSupabase, isCloudEnabled, initSupabase,
  closeDatabase, getDbPath, dbPrepare, dbExec, dbTransaction,
  saveDatabase, setRestoring
};
