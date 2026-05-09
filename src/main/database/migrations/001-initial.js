const bcrypt = require('bcryptjs');

function runMigrations(db) {
  // Check if migrations table exists
  const check = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'");
  
  if (check.length === 0) {
    db.run(`CREATE TABLE _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }

  // Check if initial migration applied
  const applied = db.exec("SELECT * FROM _migrations WHERE name = '001-initial'");
  if (applied.length === 0 || applied[0].values.length === 0) {
    console.log('[DB] Running migration: 001-initial');
    applyInitialMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('001-initial')");
    console.log('[DB] Migration 001-initial applied successfully');
  }

  // NEW MIGRATION: 002-add-buyers-and-item-fields
  const applied2 = db.exec("SELECT * FROM _migrations WHERE name = '002-add-buyers-and-item-fields'");
  if (applied2.length === 0 || applied2[0].values.length === 0) {
    console.log('[DB] Running migration: 002-add-buyers-and-item-fields');
    applySecondMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('002-add-buyers-and-item-fields')");
    console.log('[DB] Migration 002-add-buyers-and-item-fields applied successfully');
  }
  // NEW MIGRATION: 003-add-unit-price
  const applied3 = db.exec("SELECT * FROM _migrations WHERE name = '003-add-unit-price'");
  if (applied3.length === 0 || applied3[0].values.length === 0) {
    console.log('[DB] Running migration: 003-add-unit-price');
    applyThirdMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('003-add-unit-price')");
    console.log('[DB] Migration 003-add-unit-price applied successfully');
  }

  // NEW MIGRATION: 004-add-units-and-currency
  const applied4 = db.exec("SELECT * FROM _migrations WHERE name = '004-add-units-and-currency'");
  if (applied4.length === 0 || applied4[0].values.length === 0) {
    console.log('[DB] Running migration: 004-add-units-and-currency');
    applyFourthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('004-add-units-and-currency')");
    console.log('[DB] Migration 004-add-units-and-currency applied successfully');
  }

  // NEW MIGRATION: 005-add-user-permissions
  const applied5 = db.exec("SELECT * FROM _migrations WHERE name = '005-add-user-permissions'");
  if (applied5.length === 0 || applied5[0].values.length === 0) {
    console.log('[DB] Running migration: 005-add-user-permissions');
    applyFifthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('005-add-user-permissions')");
    console.log('[DB] Migration 005-add-user-permissions applied successfully');
  }

  // NEW MIGRATION: 006-add-approvals
  const applied6 = db.exec("SELECT * FROM _migrations WHERE name = '006-add-approvals'");
  if (applied6.length === 0 || applied6[0].values.length === 0) {
    console.log('[DB] Running migration: 006-add-approvals');
    applySixthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('006-add-approvals')");
    console.log('[DB] Migration 006-add-approvals applied successfully');
  }

  // NEW MIGRATION: 007-add-order-fields
  const applied7 = db.exec("SELECT * FROM _migrations WHERE name = '007-add-order-fields'");
  if (applied7.length === 0 || applied7[0].values.length === 0) {
    console.log('[DB] Running migration: 007-add-order-fields');
    applySeventhMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('007-add-order-fields')");
    console.log('[DB] Migration 007-add-order-fields applied successfully');
  }

  // NEW MIGRATION: 008-add-gate-passes
  const applied8 = db.exec("SELECT * FROM _migrations WHERE name = '008-add-gate-passes'");
  if (applied8.length === 0 || applied8[0].values.length === 0) {
    console.log('[DB] Running migration: 008-add-gate-passes');
    applyEighthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('008-add-gate-passes')");
    console.log('[DB] Migration 008-add-gate-passes applied successfully');
  }
  // NEW MIGRATION: 009-add-approval-settings
  const applied9 = db.exec("SELECT * FROM _migrations WHERE name = '009-add-approval-settings'");
  if (applied9.length === 0 || applied9[0].values.length === 0) {
    console.log('[DB] Running migration: 009-add-approval-settings');
    applyNinthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('009-add-approval-settings')");
    console.log('[DB] Migration 009-add-approval-settings applied successfully');
  }
  // NEW MIGRATION: 010-add-gate-pass-approval
  const applied10 = db.exec("SELECT * FROM _migrations WHERE name = '010-add-gate-pass-approval'");
  if (applied10.length === 0 || applied10[0].values.length === 0) {
    console.log('[DB] Running migration: 010-add-gate-pass-approval');
    applyTenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('010-add-gate-pass-approval')");
    console.log('[DB] Migration 010-add-gate-pass-approval applied successfully');
  }
}

function applyEighthMigration(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS gate_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gate_pass_number TEXT UNIQUE NOT NULL,
      challan_ids TEXT NOT NULL, -- JSON array
      poly_bags INTEGER DEFAULT 0,
      cartons INTEGER DEFAULT 0,
      plastic_bags INTEGER DEFAULT 0,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function applyNinthMigration(db) {
  db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('require_challan_approval', 'false', 'Require admin approval for all challans')");
  db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('require_inventory_approval', 'false', 'Require admin approval for stock movements')");
}

function applyTenthMigration(db) {
  db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('require_gate_pass_approval', 'false', 'Require admin approval for all gate passes')");
}

function applySeventhMigration(db) {
  try { db.run(`ALTER TABLE items ADD COLUMN order_number TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE items ADD COLUMN order_quantity REAL NOT NULL DEFAULT 0`); } catch (e) {}
}

function applySixthMigration(db) {
  db.run(`CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

function applyFifthMigration(db) {
  try { db.run(`ALTER TABLE users ADD COLUMN custom_permissions TEXT`); } catch (e) {}
}

function applyFourthMigration(db) {
  // Create units table
  db.run(`CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed default units
  const defaultUnits = ['pcs', 'yards', 'meters', 'kg', 'sets', 'dozen', 'rolls', 'bundles'];
  defaultUnits.forEach(u => db.run("INSERT OR IGNORE INTO units (name) VALUES (?)", [u]));

  // Add currency to items
  try { db.run(`ALTER TABLE items ADD COLUMN currency TEXT NOT NULL DEFAULT 'BDT'`); } catch (e) {}
}

function applyThirdMigration(db) {
  try { db.run(`ALTER TABLE items ADD COLUMN unit_price REAL NOT NULL DEFAULT 0`); } catch (e) {}
}

function applySecondMigration(db) {
  db.run(`CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  try { db.run(`ALTER TABLE items ADD COLUMN buyer_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE items ADD COLUMN style_name TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE items ADD COLUMN purchase_no TEXT`); } catch (e) {}

  const invPerms = JSON.stringify({ inventory: 'rw', challan: 'none', reports: 'r', users: 'none', settings: 'none', backup: 'none' });
  const chalPerms = JSON.stringify({ inventory: 'none', challan: 'rw', reports: 'r', users: 'none', settings: 'none', backup: 'none' });

  db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Inventory', ?)", [invPerms]);
  db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Challan', ?)", [chalPerms]);
}


function applyInitialMigration(db) {
  // --- TABLES ---
  db.run(`CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id), is_active INTEGER NOT NULL DEFAULT 1,
    last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact_person TEXT,
    phone TEXT, email TEXT, address TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL, category_id INTEGER REFERENCES categories(id),
    size TEXT, color TEXT, unit TEXT NOT NULL DEFAULT 'pcs',
    supplier_id INTEGER REFERENCES suppliers(id), opening_stock REAL NOT NULL DEFAULT 0,
    current_stock REAL NOT NULL DEFAULT 0, min_stock_level REAL NOT NULL DEFAULT 0,
    notes TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_supplier ON items(supplier_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_code ON items(item_code)`);

  db.run(`CREATE TABLE IF NOT EXISTS challans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, challan_number TEXT NOT NULL UNIQUE,
    receiver_name TEXT NOT NULL, receiver_contact TEXT, receiver_address TEXT,
    notes TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'CANCELLED')),
    created_by INTEGER REFERENCES users(id), cancelled_by INTEGER REFERENCES users(id),
    cancel_reason TEXT, challan_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_challans_number ON challans(challan_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_challans_date ON challans(challan_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_challans_status ON challans(status)`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL REFERENCES items(id),
    type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity REAL NOT NULL, stock_before REAL NOT NULL, stock_after REAL NOT NULL,
    challan_id INTEGER REFERENCES challans(id), reference TEXT, notes TEXT,
    created_by INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_item ON stock_transactions(item_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON stock_transactions(created_at)`);

  db.run(`CREATE TABLE IF NOT EXISTS challan_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challan_id INTEGER NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity REAL NOT NULL CHECK(quantity > 0), unit TEXT NOT NULL, notes TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON challan_items(challan_id)`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER,
    old_value TEXT, new_value TEXT, ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at)`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE,
    value TEXT, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // --- SEED DATA ---
  const adminPerms = JSON.stringify({ inventory: 'rw', challan: 'rw', reports: 'rw', users: 'rw', settings: 'rw', backup: 'rw' });
  const opPerms = JSON.stringify({ inventory: 'rw', challan: 'rw', reports: 'r', users: 'none', settings: 'none', backup: 'none' });

  db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Admin', ?)", [adminPerms]);
  db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Operator', ?)", [opPerms]);

  const hash = bcrypt.hashSync('admin123', 10);
  db.run("INSERT OR IGNORE INTO users (username, password_hash, full_name, role_id) VALUES ('admin', ?, 'System Administrator', 1)", [hash]);

  const cats = ['Buttons', 'Zippers', 'Thread', 'Labels', 'Packaging', 'Elastic', 'Ribbon', 'Hook & Eye', 'Buckle', 'Other'];
  cats.forEach(c => db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [c]));

  const settings = [
    ['company_name', 'KA Design Accessories LTD', 'Company name'],
    ['company_address', '', 'Company address'],
    ['company_phone', '', 'Company phone'],
    ['company_email', '', 'Company email'],
    ['challan_prefix', 'KA', 'Challan number prefix'],
    ['low_stock_threshold', '10', 'Low stock threshold'],
    ['auto_backup', 'true', 'Auto backup enabled'],
    ['backup_path', '', 'Backup directory'],
    ['theme', 'dark', 'UI theme'],
  ];
  settings.forEach(([k, v, d]) => db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)", [k, v, d]));
}

module.exports = { runMigrations };
