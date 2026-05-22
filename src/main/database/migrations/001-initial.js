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
  // NEW MIGRATION: 011-update-roles
  const applied11 = db.exec("SELECT * FROM _migrations WHERE name = '011-update-roles'");
  if (applied11.length === 0 || applied11[0].values.length === 0) {
    console.log('[DB] Running migration: 011-update-roles');
    applyEleventhMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('011-update-roles')");
    console.log('[DB] Migration 011-update-roles applied successfully');
  }
  // NEW MIGRATION: 012-add-super-admin-user
  const applied12 = db.exec("SELECT * FROM _migrations WHERE name = '012-add-super-admin-user'");
  if (applied12.length === 0 || applied12[0].values.length === 0) {
    console.log('[DB] Running migration: 012-add-super-admin-user');
    applyTwelfthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('012-add-super-admin-user')");
    console.log('[DB] Migration 012-add-super-admin-user applied successfully');
  }
  // NEW MIGRATION: 013-fix-superadmin-login
  const applied13 = db.exec("SELECT * FROM _migrations WHERE name = '013-fix-superadmin-login'");
  if (applied13.length === 0 || applied13[0].values.length === 0) {
    console.log('[DB] Running migration: 013-fix-superadmin-login');
    applyThirteenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('013-fix-superadmin-login')");
    console.log('[DB] Migration 013-fix-superadmin-login applied successfully');
  }
  // NEW MIGRATION: 014-finalize-super-admin-rbac
  const applied14 = db.exec("SELECT * FROM _migrations WHERE name = '014-finalize-super-admin-rbac'");
  if (applied14.length === 0 || applied14[0].values.length === 0) {
    console.log('[DB] Running migration: 014-finalize-super-admin-rbac');
    applyFourteenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('014-finalize-super-admin-rbac')");
    console.log('[DB] Migration 014-finalize-super-admin-rbac applied successfully');
  }
  // NEW MIGRATION: 015-add-monitoring-role
  const applied15 = db.exec("SELECT * FROM _migrations WHERE name = '015-add-monitoring-role'");
  if (applied15.length === 0 || applied15[0].values.length === 0) {
    console.log('[DB] Running migration: 015-add-monitoring-role');
    applyFifteenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('015-add-monitoring-role')");
    console.log('[DB] Migration 015-add-monitoring-role applied successfully');
  }
  // NEW MIGRATION: 016-add-issue-module
  const applied16 = db.exec("SELECT * FROM _migrations WHERE name = '016-add-issue-module'");
  if (applied16.length === 0 || applied16[0].values.length === 0) {
    console.log('[DB] Running migration: 016-add-issue-module');
    applySixteenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('016-add-issue-module')");
    console.log('[DB] Migration 016-add-issue-module applied successfully');
  }
  // NEW MIGRATION: 017-enhance-issue-module
  const applied17 = db.exec("SELECT * FROM _migrations WHERE name = '017-enhance-issue-module'");
  if (applied17.length === 0 || applied17[0].values.length === 0) {
    console.log('[DB] Running migration: 017-enhance-issue-module');
    applySeventeenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('017-enhance-issue-module')");
    console.log('[DB] Migration 017-enhance-issue-module applied successfully');
  }
  // NEW MIGRATION: 018-add-approval-links
  const applied18 = db.exec("SELECT * FROM _migrations WHERE name = '018-add-approval-links'");
  if (applied18.length === 0 || applied18[0].values.length === 0) {
    console.log('[DB] Running migration: 018-add-approval-links');
    applyEighteenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('018-add-approval-links')");
    console.log('[DB] Migration 018-add-approval-links applied successfully');
  }

  // NEW MIGRATION: 019-enhance-issues-for-production
  const applied19 = db.exec("SELECT * FROM _migrations WHERE name = '019-enhance-issues-for-production'");
  if (applied19.length === 0 || applied19[0].values.length === 0) {
    console.log('[DB] Running migration: 019-enhance-issues-for-production');
    applyNineteenthMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('019-enhance-issues-for-production')");
    console.log('[DB] Migration 019-enhance-issues-for-production applied successfully');
  }

  // NEW MIGRATION: 020-add-produced-item-to-issues
  const applied20 = db.exec("SELECT * FROM _migrations WHERE name = '020-add-produced-item-to-issues'");
  if (applied20.length === 0 || applied20[0].values.length === 0) {
    console.log('[DB] Running migration: 020-add-produced-item-to-issues');
    applyTwentiethMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('020-add-produced-item-to-issues')");
    console.log('[DB] Migration 020-add-produced-item-to-issues applied successfully');
  }

  // NEW MIGRATION: 021-add-source-type-to-items
  const applied21 = db.exec("SELECT * FROM _migrations WHERE name = '021-add-source-type-to-items'");
  if (applied21.length === 0 || applied21[0].values.length === 0) {
    console.log('[DB] Running migration: 021-add-source-type-to-items');
    applyTwentyFirstMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('021-add-source-type-to-items')");
    console.log('[DB] Migration 021-add-source-type-to-items applied successfully');
  }

  // NEW MIGRATION: 022-add-access-control-settings
  const applied22 = db.exec("SELECT * FROM _migrations WHERE name = '022-add-access-control-settings'");
  if (applied22.length === 0 || applied22[0].values.length === 0) {
    console.log('[DB] Running migration: 022-add-access-control-settings');
    applyTwentySecondMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('022-add-access-control-settings')");
    console.log('[DB] Migration 022-add-access-control-settings applied successfully');
  }

  // NEW MIGRATION: 023-add-warehouses-and-barcodes
  const applied23 = db.exec("SELECT * FROM _migrations WHERE name = '023-add-warehouses-and-barcodes'");
  if (applied23.length === 0 || applied23[0].values.length === 0) {
    console.log('[DB] Running migration: 023-add-warehouses-and-barcodes');
    applyTwentyThirdMigration(db);
    db.run("INSERT INTO _migrations (name) VALUES ('023-add-warehouses-and-barcodes')");
    console.log('[DB] Migration 023-add-warehouses-and-barcodes applied successfully');
  }
}

function applyTwentyFirstMigration(db) {
  try { db.run(`ALTER TABLE items ADD COLUMN source_type TEXT NOT NULL DEFAULT 'SOURCE'`); } catch (e) {}
}

function applyTwentySecondMigration(db) {
  try {
    db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('allow_challan_to_issue', 'false', 'Allow Challan users to use Issue module')");
    db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('allow_inventory_to_produce', 'false', 'Allow Inventory users to use Production module')");
  } catch (e) {}
}

function applyNineteenthMigration(db) {
  try { db.run(`ALTER TABLE issues ADD COLUMN is_returnable INTEGER NOT NULL DEFAULT 1`); } catch (e) {}
  try { db.run(`ALTER TABLE issues ADD COLUMN produced_item_id INTEGER REFERENCES items(id)`); } catch (e) {}
  try { db.run(`ALTER TABLE factory_production ADD COLUMN product_item_id INTEGER REFERENCES items(id)`); } catch (e) {}
  try { db.run(`ALTER TABLE factory_production ADD COLUMN consumed_items TEXT`); } catch (e) {}
}

function applyTwentiethMigration(db) {
  try { db.run(`ALTER TABLE issues ADD COLUMN produced_item_id INTEGER REFERENCES items(id)`); } catch (e) {}
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

function applyEleventhMigration(db) {
  const superAdminPerms = JSON.stringify({ 
    inventory: 'rw', challan: 'rw', reports: 'rw', users: 'rw', settings: 'rw', backup: 'rw', maintenance: 'rw' 
  });
  const adminPerms = JSON.stringify({ 
    inventory: 'rw', challan: 'rw', reports: 'rw', users: 'rw', settings: 'rw', backup: 'rw', maintenance: 'none' 
  });

  // Insert Super Admin role
  db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Super Admin', ?)", [superAdminPerms]);
  
  // Update Admin role permissions
  db.run("UPDATE roles SET permissions = ? WHERE name = 'Admin'", [adminPerms]);

  // Update existing 'admin' user to Super Admin role
  db.run(`
    UPDATE users 
    SET role_id = (SELECT id FROM roles WHERE name = 'Super Admin') 
    WHERE username = 'admin' OR username = 'Admin'
  `);
}

function applyTwelfthMigration(db) {
  const hash = bcrypt.hashSync('superadmin', 10);
  db.run(`
    INSERT OR IGNORE INTO users (username, password_hash, full_name, role_id, is_active) 
    SELECT 'superadmin', ?, 'Super Administrator', id, 1 FROM roles WHERE name = 'Super Admin'
  `, [hash]);
}

function applyThirteenthMigration(db) {
  const hash = bcrypt.hashSync('superadmin', 10);
  // Ensure the role exists first (it should from 011)
  const superAdminPerms = JSON.stringify({ 
    inventory: 'rw', challan: 'rw', reports: 'rw', users: 'rw', settings: 'rw', backup: 'rw', maintenance: 'rw' 
  });
  db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Super Admin', ?)", [superAdminPerms]);

  // Force update superadmin user
  db.run(`
    UPDATE users 
    SET password_hash = ?, 
        role_id = (SELECT id FROM roles WHERE name = 'Super Admin'),
        is_active = 1
    WHERE username = 'superadmin'
  `, [hash]);

  // Also ensure it exists if UPDATE failed because it didn't exist
  db.run(`
    INSERT OR IGNORE INTO users (username, password_hash, full_name, role_id, is_active) 
    SELECT 'superadmin', ?, 'Super Administrator', id, 1 FROM roles WHERE name = 'Super Admin'
  `, [hash]);
}

function applyFourteenthMigration(db) {
  const superAdminPerms = JSON.stringify({ 
    inventory: 'rw', challan: 'rw', reports: 'rw', users: 'rw', settings: 'rw', backup: 'rw', maintenance: 'rw' 
  });
  const adminPerms = JSON.stringify({ 
    inventory: 'rw', challan: 'rw', reports: 'rw', users: 'rw', settings: 'rw', backup: 'rw', maintenance: 'none' 
  });

  // Ensure roles exist with correct perms
  db.run("UPDATE roles SET permissions = ? WHERE name = 'Super Admin'", [superAdminPerms]);
  db.run("UPDATE roles SET permissions = ? WHERE name = 'Admin'", [adminPerms]);

  // Ensure 'superadmin' user is Super Admin
  db.run(`
    UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Super Admin')
    WHERE username = 'superadmin'
  `);

  // Ensure 'admin' user is Admin (NOT Super Admin anymore)
  db.run(`
    UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Admin')
    WHERE username = 'admin' OR username = 'Admin'
  `);
}

function applyFifteenthMigration(db) {
  const monitoringPerms = JSON.stringify({ 
    inventory: 'r', challan: 'r', reports: 'r', users: 'r', settings: 'r', backup: 'none', maintenance: 'none' 
  });
  db.run("INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Monitoring', ?)", [monitoringPerms]);
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_stock_min ON items(current_stock, min_stock_level)`);

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
  db.run(`CREATE INDEX IF NOT EXISTS idx_challan_items_item ON challan_items(item_id)`);

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
    ['public_web_url', '', 'Public Web URL'],
  ];
  settings.forEach(([k, v, d]) => db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)", [k, v, d]));
}

function applySixteenthMigration(db) {
  // 1. Recipients Table
  db.run(`CREATE TABLE IF NOT EXISTS recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    type TEXT NOT NULL CHECK(type IN ('FACTORY', 'EMPLOYEE')),
    contact_info TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. Issues Table
  db.run(`CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id TEXT NOT NULL UNIQUE,
    issue_type TEXT NOT NULL CHECK(issue_type IN ('FACTORY', 'EMPLOYEE')),
    recipient_id INTEGER NOT NULL REFERENCES recipients(id),
    recipient_name TEXT NOT NULL,
    issue_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_return_date DATETIME,
    remarks TEXT,
    attachment_path TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PARTIAL', 'RETURNED')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 3. Issue Items Table
  db.run(`CREATE TABLE IF NOT EXISTS issue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity REAL NOT NULL CHECK(quantity > 0),
    returned_quantity REAL NOT NULL DEFAULT 0,
    damage_quantity REAL NOT NULL DEFAULT 0,
    rejected_quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    style_no TEXT,
    order_number TEXT,
    purchase_no TEXT,
    notes TEXT
  )`);
  db.run("CREATE INDEX IF NOT EXISTS idx_issue_items_item ON issue_items(item_id)");

  // 4. Returns Table
  db.run(`CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES issues(id),
    return_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 5. Return Items Table
  db.run(`CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    issue_item_id INTEGER NOT NULL REFERENCES issue_items(id),
    returned_quantity REAL NOT NULL DEFAULT 0,
    damage_quantity REAL NOT NULL DEFAULT 0,
    rejected_quantity REAL NOT NULL DEFAULT 0,
    notes TEXT
  )`);

  // 6. Factory Production Table
  db.run(`CREATE TABLE IF NOT EXISTS factory_production (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES issues(id),
    product_name TEXT NOT NULL,
    production_quantity REAL NOT NULL DEFAULT 0,
    wastage_quantity REAL NOT NULL DEFAULT 0,
    balance_quantity REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed some example recipients
  db.run("INSERT OR IGNORE INTO recipients (name, type) VALUES ('Factory A', 'FACTORY')");
  db.run("INSERT OR IGNORE INTO recipients (name, type) VALUES ('Factory B', 'FACTORY')");
  db.run("INSERT OR IGNORE INTO recipients (name, type) VALUES ('John Doe', 'EMPLOYEE')");
  db.run("INSERT OR IGNORE INTO recipients (name, type) VALUES ('Jane Smith', 'EMPLOYEE')");
}

function applySeventeenthMigration(db) {
  // Add consumed_quantity for factory production reconciliation
  try { db.run(`ALTER TABLE issue_items ADD COLUMN consumed_quantity REAL NOT NULL DEFAULT 0`); } catch (e) {}
  // Add approval fields to returns
  try { db.run(`ALTER TABLE returns ADD COLUMN approved_by INTEGER REFERENCES users(id)`); } catch (e) {}
  try { db.run(`ALTER TABLE returns ADD COLUMN approval_status TEXT DEFAULT 'PENDING'`); } catch (e) {}
  // Issue module settings
  db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('issue_prefix', 'ISS', 'Issue ID prefix')");
  db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('require_return_approval', 'false', 'Require admin approval for returns')");
}

function applyEighteenthMigration(db) {
  try { db.run(`ALTER TABLE approvals ADD COLUMN entity_id INTEGER`); } catch (e) {}
  try { db.run(`ALTER TABLE approvals ADD COLUMN entity_number TEXT`); } catch (e) {}
}

module.exports = { runMigrations };

function applyTwentyThirdMigration(db) {
  // Warehouses Table
  db.run(`CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Warehouse Stock Junction Table
  db.run(`CREATE TABLE IF NOT EXISTS warehouse_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity REAL NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, item_id)
  )`);

  // Seed Default Warehouse
  db.run("INSERT OR IGNORE INTO warehouses (name, code, address, is_default, is_active) VALUES ('Main Warehouse', 'WH-MAIN', 'Main Office', 1, 1)");

  // Get default warehouse ID
  const defaultWh = db.exec("SELECT id FROM warehouses WHERE is_default = 1");
  const whId = (defaultWh.length > 0 && defaultWh[0].values.length > 0) ? defaultWh[0].values[0][0] : 1;

  // Populate warehouse_stock for all existing items with their current_stock
  const items = db.exec("SELECT id, current_stock FROM items");
  if (items.length > 0) {
    db.run("BEGIN TRANSACTION");
    try {
      items[0].values.forEach(row => {
        const [itemId, currentStock] = row;
        db.run("INSERT OR IGNORE INTO warehouse_stock (warehouse_id, item_id, quantity) VALUES (?, ?, ?)", [whId, itemId, currentStock]);
      });
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      console.error('[DB] Failed to seed warehouse stock:', e);
    }
  }

  // Add barcode column to items
  try { db.run(`ALTER TABLE items ADD COLUMN barcode_data TEXT`); } catch (e) {}

  // Add Settings
  db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('barcode_format', 'QR', 'Format for generated barcodes (CODE128 or QR)')");
  db.run("INSERT OR IGNORE INTO settings (key, value, description) VALUES ('default_warehouse_id', ?, 'Default warehouse for new stock')", [whId]);
  
  // Migrate existing barcode settings to QR
  try {
    db.run("UPDATE settings SET value = 'QR' WHERE key = 'barcode_format' AND value = 'CODE128'");
  } catch (e) {
    console.error('[DB] Failed to migrate barcode_format settings to QR:', e.message);
  }
}
