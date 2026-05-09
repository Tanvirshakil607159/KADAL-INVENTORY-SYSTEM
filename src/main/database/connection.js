const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const { runMigrations } = require('./migrations/001-initial');

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

  // Load existing DB or create new (used for local settings and offline cache)
  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode and foreign keys
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Run migrations for local tables
  runMigrations(db);

  // Save after migrations
  saveDatabase();

  console.log('[DB] Local database initialized');

  // Initialize Supabase if credentials exist
  initSupabase();

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
