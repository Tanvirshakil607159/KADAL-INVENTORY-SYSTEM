# KADAL Inventory Management System — Complete System Description

> **Purpose of this document:** This is a comprehensive technical description of the entire KADAL Inventory System codebase, intended to give another AI model full context about the system's architecture, data model, features, file structure, and conventions.

---

## 1. Overview

**KADAL** (named after **KA Design Accessories LTD**) is a full-featured **Inventory Management System** for a garment accessories/trims company. It is a **hybrid desktop + web application** built with:

- **Desktop App**: Electron (v33) + React 19 + Vite 6 — packaged as a Windows NSIS installer
- **Web App**: The same React frontend deployed to **Firebase Hosting**, operating in browser-only mode against **Supabase** (PostgreSQL cloud backend)
- **Local Database**: SQLite via `sql.js` (WebAssembly-based, runs in the Electron main process)
- **Cloud Database**: Supabase (PostgreSQL) — the primary data backend when configured

**Current Version**: 1.1.67  
**App ID**: `com.kadesign.kadal`  
**GitHub Repo**: `Tanvirshakil607159/KADAL-INVENTORY-SYSTEM`  
**License**: UNLICENSED (private)

---

## 2. Architecture

### 2.1 Dual-Mode Architecture (Desktop + Web)

The system operates in **two modes** from a single codebase:

#### Desktop Mode (Electron)
```
┌─────────────────────────────────────────────────────────┐
│ Electron Main Process (Node.js)                         │
│  ├── src/main/index.js (window creation, app lifecycle) │
│  ├── src/main/ipc-handlers.js (IPC bridge)              │
│  ├── src/main/services/*.js (business logic)            │
│  ├── src/main/database/connection.js (SQLite + Supabase)│
│  ├── src/main/database/repositories/*.js (data access)  │
│  └── src/main/utils/*.js (PDF/Excel generation)         │
├─────────────────────────────────────────────────────────┤
│ Preload Script: src/preload/index.js                    │
│  └── Exposes `window.kadal` API via contextBridge       │
├─────────────────────────────────────────────────────────┤
│ Renderer Process (Chromium)                             │
│  ├── React 19 SPA (Vite-bundled)                        │
│  ├── Zustand for state management                       │
│  └── Calls window.kadal.* → IPC → Main Process         │
└─────────────────────────────────────────────────────────┘
```

#### Web Mode (Browser)
```
┌─────────────────────────────────────────────────────────┐
│ Browser (Chrome, Firefox, etc.)                         │
│  ├── React 19 SPA (same renderer code)                  │
│  ├── src/renderer/web/web-bridge.js replaces IPC bridge │
│  │   └── Provides identical `window.kadal` API          │
│  │       but calls Supabase directly instead of IPC     │
│  ├── src/renderer/web/supabase-client.js                │
│  ├── src/renderer/web/inventory-api.js                  │
│  └── src/renderer/web/challans-api.js                   │
├─────────────────────────────────────────────────────────┤
│ Supabase (PostgreSQL Cloud)                             │
│  └── All data CRUD operations via Supabase JS SDK       │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: The renderer code checks `if (!window.kadal)` at startup. If `window.kadal` is not already injected by Electron's preload, it injects the `webBridge` object which provides the identical API surface but routes everything through Supabase REST instead of Electron IPC.

### 2.2 Data Flow

- **Desktop + Cloud configured**: Main process connects to both local SQLite AND Supabase. Data primarily goes through Supabase when cloud is enabled. Local SQLite stores settings and serves as an offline cache.
- **Desktop + Local only**: All data stored in local SQLite file (`kadal.db` in Electron's userData directory, or a user-selected custom path).
- **Web mode**: Everything goes through Supabase directly from the browser. No local SQLite.

### 2.3 IPC Communication Pattern

All IPC calls follow this pattern:
```
Renderer → window.kadal.{module}.{method}(args)
         → ipcRenderer.invoke('{module}:{method}', args)
         → ipcMain.handle('{module}:{method}', wrapHandler(fn))
         → Service/Repository layer
         → Returns { success: boolean, data?: any, error?: string }
```

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Shell** | Electron 33 |
| **Frontend Framework** | React 19 (JSX, no TypeScript) |
| **Build Tool** | Vite 6 with `@vitejs/plugin-react` |
| **State Management** | Zustand 5 |
| **Styling** | Vanilla CSS (single `index.css` file, ~32KB, dark theme) |
| **Icons** | Lucide React |
| **Local Database** | sql.js 1.11 (SQLite compiled to WebAssembly) |
| **Cloud Database** | Supabase (PostgreSQL via `@supabase/supabase-js` v2) |
| **Authentication** | Custom bcryptjs-based auth (NOT Supabase Auth) |
| **PDF Generation** | pdfmake |
| **Excel Generation** | exceljs |
| **Barcode/QR** | jsbarcode + qrcode |
| **Date Handling** | date-fns |
| **WebSocket** | ws (for Supabase real-time in Electron main process) |
| **Auto-Update** | electron-updater (GitHub releases) |
| **Packaging** | electron-builder (NSIS installer for Windows) |
| **Web Hosting** | Firebase Hosting |
| **Web Deployment** | Vercel (also configured) |

---

## 4. Project File Structure

```
d:\INVENTORY SYSTEM\
├── package.json                    # App config, scripts, dependencies, electron-builder config
├── vite.config.js                  # Vite config (root: src/renderer, aliases, port 5173)
├── firebase.json                   # Firebase Hosting config (SPA rewrite)
├── .firebaserc                     # Firebase project binding
├── .vercelignore                   # Vercel deployment ignores
│
├── assets/
│   └── logo.png                    # App icon (610KB)
│
├── scripts/
│   ├── copy-installer.js           # Post-build: copies installer to /installers
│   ├── generate-config.js          # Extracts Supabase credentials to dist/config.json for web
│   ├── generate-config-vercel.js   # Same for Vercel deploys
│   └── publish-update.js           # Auto-increment version, build, push GitHub release
│
├── src/
│   ├── main/                       # Electron Main Process
│   │   ├── index.js                # App entry: window creation, lifecycle, GPU cache fixes
│   │   ├── ipc-handlers.js         # ~880 lines: ALL IPC handler registrations
│   │   │
│   │   ├── database/
│   │   │   ├── connection.js       # SQLite init, Supabase client init, dbPrepare/dbExec/dbTransaction helpers
│   │   │   ├── migrations/
│   │   │   │   └── 001-initial.js  # ALL 26 migration functions in one file (001 through 026)
│   │   │   └── repositories/       # Data access layer (19 repository files)
│   │   │       ├── approvals.js
│   │   │       ├── audit-logs.js
│   │   │       ├── buyers.js
│   │   │       ├── categories.js
│   │   │       ├── challans.js         # ~28KB, largest repo
│   │   │       ├── gate-passes.js
│   │   │       ├── issues.js           # ~27KB
│   │   │       ├── items.js            # ~20KB
│   │   │       ├── production.js       # ~18KB
│   │   │       ├── recipients.js
│   │   │       ├── returns.js
│   │   │       ├── roles.js
│   │   │       ├── settings.js
│   │   │       ├── stock-transactions.js
│   │   │       ├── suppliers.js
│   │   │       ├── units.js
│   │   │       ├── users.js
│   │   │       ├── warehouse-bins.js
│   │   │       └── warehouses.js
│   │   │
│   │   ├── services/                # Business logic layer (13 service files)
│   │   │   ├── approval-service.js
│   │   │   ├── auth-service.js
│   │   │   ├── backup-service.js
│   │   │   ├── challan-service.js
│   │   │   ├── cloud-sync-service.js   # Supabase Realtime subscriptions
│   │   │   ├── gate-pass-service.js
│   │   │   ├── import-service.js       # Excel/Google Sheet import
│   │   │   ├── inventory-service.js
│   │   │   ├── issue-service.js
│   │   │   ├── report-service.js
│   │   │   ├── return-service.js
│   │   │   ├── update-service.js       # electron-updater integration
│   │   │   └── warehouse-service.js
│   │   │
│   │   └── utils/
│   │       ├── pdf-generator.js        # ~39KB pdfmake-based PDF generation
│   │       └── excel-generator.js      # exceljs-based Excel generation
│   │
│   ├── preload/
│   │   └── index.js                # contextBridge: exposes `window.kadal` with 25+ API namespaces
│   │
│   └── renderer/                   # React Frontend (runs in both Electron & browser)
│       ├── index.html              # HTML entry point
│       ├── main.jsx                # React entry: web-bridge injection, config pre-load
│       ├── App.jsx                 # Root component: routing, auth flow, verification page
│       │
│       ├── store/
│       │   └── useStore.js         # Zustand store: auth, navigation, toasts, modals, forms
│       │
│       ├── pages/                  # 16 page components
│       │   ├── DashboardPage.jsx
│       │   ├── InventoryPage.jsx
│       │   ├── PendingItemsPage.jsx
│       │   ├── WarehousePage.jsx
│       │   ├── ChallanPage.jsx
│       │   ├── ChallanHistoryPage.jsx
│       │   ├── ChallanVerificationPage.jsx  # ~38KB, public challan verification
│       │   ├── IssuePage.jsx                # ~42KB, largest page
│       │   ├── ProductionPage.jsx           # ~38KB
│       │   ├── GatePassPage.jsx
│       │   ├── ApprovalsPage.jsx
│       │   ├── ReportsPage.jsx              # ~30KB, multiple report types
│       │   ├── SettingsPage.jsx             # ~45KB, largest page overall
│       │   ├── BackupPage.jsx
│       │   ├── LoginPage.jsx
│       │   └── CloudSetupPage.jsx
│       │
│       ├── components/
│       │   ├── common/
│       │   │   ├── ConfirmDialog.jsx
│       │   │   ├── NotificationManager.jsx
│       │   │   ├── ToastContainer.jsx
│       │   │   └── UpdateProgress.jsx
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   └── TopBar.jsx
│       │   ├── modals/                 # 18 modal components
│       │   │   ├── ApprovalReviewModal.jsx
│       │   │   ├── BarcodeModal.jsx
│       │   │   ├── BinFormModal.jsx
│       │   │   ├── BinStockModal.jsx
│       │   │   ├── ChallanBrowserModal.jsx
│       │   │   ├── GlobalModalManager.jsx
│       │   │   ├── IssueBrowserModal.jsx
│       │   │   ├── ItemFormModal.jsx
│       │   │   ├── ProductionEntryModal.jsx
│       │   │   ├── RecipientFormModal.jsx
│       │   │   ├── StockMovementModal.jsx
│       │   │   ├── StockTransferModal.jsx
│       │   │   ├── SupplierFormModal.jsx
│       │   │   ├── TargetProductBrowserModal.jsx
│       │   │   ├── UserFormModal.jsx
│       │   │   ├── WarehouseFormModal.jsx
│       │   │   ├── WarehouseStockModal.jsx
│       │   │   └── ZoneFormModal.jsx
│       │   └── ui/
│       │       └── SuggestionInput.jsx   # Autocomplete input component
│       │
│       ├── styles/
│       │   └── index.css           # ~32KB, complete dark-themed CSS
│       │
│       ├── web/                    # Browser-mode (web bridge layer)
│       │   ├── web-bridge.js       # ~35KB: Full `window.kadal` replacement for browser
│       │   ├── supabase-client.js  # Supabase client init (URL params, localStorage, sessionStorage)
│       │   ├── inventory-api.js    # Inventory-specific Supabase queries
│       │   └── challans-api.js     # Challan-specific Supabase queries
│       │
│       └── public/                 # Static assets for web
│
├── DEPLOY_WEB.bat                  # One-click: build:web → firebase deploy
├── PUBLISH_UPDATE.bat              # One-click: version bump → build → GitHub release
├── build-portable.bat              # Portable build script
├── run.bat                         # Dev run script
│
├── supabase_setup_issues.sql       # SQL to create Issue module tables in Supabase
├── supabase_receivers_update.sql   # SQL for recipients table updates
├── supabase_warehouses_update.sql  # SQL for warehouse tables
├── supabase_wms_update.sql         # SQL for WMS zones/bins tables
│
├── *.js (root-level utility scripts)
│   ├── seed_cloud_settings.js      # Seeds settings into Supabase
│   ├── check_supabase.js           # Tests Supabase connection
│   ├── check_sqlite.js             # Inspects local SQLite DB
│   ├── find-challan.js             # Debug: find challan by number
│   ├── fix_imported_items.js       # Data migration/fix scripts
│   ├── inspect_all.js              # Debug: dump all tables
│   ├── scratch_*.js                # Various test/debug scripts
│   └── ...
│
├── dist/                           # Vite build output
├── release/                        # electron-builder output
└── installers/                     # Copied installer binaries
```

---

## 5. Database Schema

### 5.1 Core Tables

The database has been evolved through **26 sequential migrations** (all defined in `001-initial.js`). Here are all tables:

| Table | Purpose |
|-------|---------|
| `_migrations` | Tracks applied migration versions |
| `roles` | User roles with JSON permission objects |
| `users` | Users with bcrypt password hashes, role FK |
| `categories` | Item categories (Buttons, Zippers, Thread, etc.) |
| `suppliers` | Supplier companies with contact info |
| `buyers` | Buyer companies |
| `units` | Measurement units (pcs, yards, meters, kg, etc.) |
| `items` | **Central entity**: inventory items with stock levels |
| `stock_transactions` | Stock movement log (IN, OUT, ADJUSTMENT, TRANSFER) |
| `challans` | Delivery challans (shipment documents) |
| `challan_items` | Line items within challans |
| `gate_passes` | Gate passes bundling multiple challans |
| `approvals` | Pending approval queue for workflows |
| `audit_logs` | Action audit trail |
| `settings` | Key-value application settings |
| `recipients` | Factories and employees who receive issued items |
| `issues` | Material issue records (FACTORY or EMPLOYEE type) |
| `issue_items` | Line items within issues |
| `returns` | Return records against issues |
| `return_items` | Line items within returns |
| `factory_production` | Production records linked to issues |
| `warehouses` | Multiple warehouse locations |
| `warehouse_stock` | Stock per warehouse per item |
| `warehouse_zones` | Zones within warehouses |
| `warehouse_bins` | Bins within zones |
| `bin_stock` | Stock per bin per item |

### 5.2 Items Table (Central Entity)

The `items` table is the most important entity:
```sql
items (
  id, item_code (UNIQUE), name, category_id FK, size, color, unit,
  supplier_id FK, opening_stock, current_stock, min_stock_level,
  unit_price, currency (default 'BDT'),
  buyer_name, style_name, purchase_no, order_number, order_quantity,
  source_type (default 'SOURCE'), barcode_data,
  notes, is_active, created_at, updated_at
)
```

### 5.3 Role-Based Access Control (RBAC)

Roles store permissions as a JSON object:
```json
{
  "inventory": "rw",    // "rw", "r", or "none"
  "challan": "rw",
  "reports": "rw",
  "users": "rw",
  "settings": "rw",
  "backup": "rw",
  "maintenance": "rw"
}
```

**Built-in Roles**:
- **Super Admin**: Full access to everything including maintenance (system clear, DB management)
- **Admin**: Full access except maintenance
- **Operator**: Inventory + Challan RW, Reports read-only
- **Inventory**: Inventory RW, Reports read-only
- **Challan**: Challan RW, Reports read-only
- **Monitoring**: Read-only access to everything except backup/maintenance
- **Merchandiser**: Inventory RW, Reports read-only

Users can also have `custom_permissions` that override role defaults.

**Default Credentials**:
- `superadmin` / `superadmin` (Super Admin role)
- `admin` / `admin123` (Admin role)

---

## 6. Application Modules (Features)

### 6.1 Authentication & Session
- Custom auth (NOT Supabase Auth): username/password with bcrypt
- 30-minute inactivity auto-logout
- Session stored in `sessionStorage` (renderer) and main process memory
- Session sync between renderer and main on page reload

### 6.2 Dashboard
- Total items count, total stock, total inventory value (BDT/USD)
- Low stock alerts count
- Today's challans count
- Challans waiting for gate pass
- Recent challans list
- Issue/return statistics

### 6.3 Inventory Management
- Full CRUD for items with auto-generated item codes
- Categories, suppliers, buyers, units management
- Stock movements: IN, OUT, ADJUSTMENT
- Stock transactions history with detailed logging
- Per-item barcode/QR code generation (QR default)
- Excel/Google Sheets import with template download
- Field suggestions and autocomplete for search
- Items have garment-specific fields: `buyer_name`, `style_name`, `purchase_no`, `order_number`, `order_quantity`, `size`, `color`
- `source_type` field: 'SOURCE' (raw material) vs other types

### 6.4 Challan (Delivery Note) System
- Create challans with receiver info, multiple items, quantities
- Auto-generated challan numbers with configurable prefix (default "KA")
- Stock automatically deducted on challan creation
- Stock restored on challan cancellation
- Challan history with search, filters, date range
- PDF and Excel export for individual challans
- Challan verification page (public web URL for receivers to verify delivery)
- Field suggestions with blacklist capability

### 6.5 Gate Pass System
- Bundle multiple challans into a single gate pass
- Track packaging: poly bags, cartons, plastic bags
- Auto-generated gate pass numbers
- PDF export
- Tracks which challan IDs have been used in gate passes

### 6.6 Issue & Return Module
- Issue materials to **Factories** (production) or **Employees**
- Tracks: issued quantity, returned, damaged, rejected, consumed
- Recipients management (FACTORY/EMPLOYEE types)
- Returns processing against issues with item-level tracking
- Outstanding items tracking
- Auto-generated issue IDs with configurable prefix
- Factory issues can be linked to a "produced item" for production tracking
- Configurable returnability per issue
- PDF and Excel export

### 6.7 Production Module
- Track factory production against issued materials
- Production records linked to issues
- Product item linkage (what item is being produced)
- Consumed items tracking (JSON field)
- Wastage and balance quantity tracking

### 6.8 Warehouse Management System (WMS)
- Multiple warehouses with codes (WH-01, WH-02, etc.)
- Default warehouse for new stock
- Per-warehouse stock tracking (`warehouse_stock` junction table)
- Stock transfer between warehouses
- **Zones** within warehouses (storage areas)
- **Bins** within zones (individual storage locations with barcodes)
- Bin-level stock tracking

### 6.9 Approval Workflow
- Configurable approval requirements for:
  - Challans (`require_challan_approval`)
  - Inventory stock movements (`require_inventory_approval`)
  - Gate passes (`require_gate_pass_approval`)
  - Returns (`require_return_approval`)
- Pending approvals queue with approve/reject actions
- Approval data editable before final approval
- Linked to entities via `entity_id` and `entity_number`

### 6.10 Reports
Multiple report types with PDF and Excel export:
- **Stock Report**: Current stock levels with values
- **Movement Report**: IN/OUT totals per item in a date range
- **Low Stock Report**: Items below minimum stock level
- **Challan History**: Detailed challan records with shipped/balance tracking
- **Daily Summary**: Stock movements for a specific date
- **Monthly Summary**: Aggregated monthly view
- **Issue Report**: All issues with item details
- **Return Report**: All returns
- **Factory Production Report**: Production records
- **Employee Outstanding Report**: Unreturned items per employee
- **Issue/Return Summary**: Combined view

### 6.11 Settings
- Company info: name, address, phone, email
- Challan prefix, issue prefix
- Low stock threshold
- Auto backup toggle and backup path
- Theme setting (dark)
- Public web URL for challan verification
- Supabase URL and key configuration
- Barcode format setting (QR/CODE128)
- Default warehouse ID
- Cross-module access controls:
  - `allow_challan_to_issue`: Let challan users access issue module
  - `allow_inventory_to_produce`: Let inventory users access production
- Approval toggles (challan, inventory, gate pass, return)
- Suggestion blacklist (JSON)

### 6.12 Backup & Restore
- SQLite database backup (desktop only)
- Backup history tracking
- File-based restore with app relaunch
- Custom database file selection/creation

### 6.13 User Management
- CRUD for users with role assignment
- Custom permissions override per user
- Account activation/deactivation
- Password management (change, reset)

### 6.14 Audit Logging
- Tracks: user, action, entity type, entity ID, old/new values
- Filterable audit log viewer

### 6.15 Cloud Sync (Real-time)
- Supabase Realtime Postgres Changes subscriptions
- Monitors: items, stock_transactions, challans, approvals, gate_passes
- Sends change notifications to renderer for live UI updates

### 6.16 Auto-Update (Desktop)
- electron-updater with GitHub releases provider
- Download progress notifications
- One-click publish workflow (`PUBLISH_UPDATE.bat`)

---

## 7. API Surface (`window.kadal`)

The complete API exposed to the renderer (both via IPC preload and web-bridge):

```
window.kadal = {
  auth:       { login, logout, changePassword, getCurrentUser, register, syncSession }
  users:      { getAll, create, update, toggleActive, delete }
  roles:      { getAll }
  buyers:     { getAll, create, delete }
  categories: { getAll, create, update, delete }
  units:      { getAll, create, delete }
  suppliers:  { getAll, create, update, delete, getFieldSuggestions }
  items:      { getAll, getById, create, update, delete, search, getDistinctValues, getNextCode }
  stock:      { addMovement, getTransactions, getFieldSuggestions }
  challans:   { getAll, getById, getByNumber, create, cancel, getNextNumber, getFieldSuggestions,
                exportPdf, exportExcel, getTotalDelivered, delete, clearHistory, deleteSuggestion }
  reports:    { stockReport, movementReport, lowStockReport, challanHistory, detailedChallanHistory,
                dailySummary, monthlySummary, exportExcel, exportPdf,
                issueReport, returnReport, factoryProductionReport, employeeOutstandingReport, issueReturnSummary }
  approvals:  { getAll, getById, approve, reject, updateData }
  gatePass:   { getAll, getById, create, delete, exportPdf, getNextNumber, getUsedChallanIds, clearHistory }
  issues:     { getAll, getById, create, getNextId, getOutstandingItems, delete, exportPdf, exportExcel }
  returns:    { getAll, getById, create }
  recipients: { getAll, create, update, delete }
  production: { getAll, create, delete }
  backup:     { create, restore, getHistory, selectFile, selectDirectory, download }
  settings:   { getAll, get, set, setBulk }
  dashboard:  { getStats }
  audit:      { getLogs }
  import:     { selectFile, parseExcel, parseGoogleSheet, importItems, downloadTemplate }
  update:     { check, onDownloadProgress, onUpdateAvailable, onUpdateError }
  system:     { clearData, getVersion, getCurrentDbPath, selectDatabase, createDatabase }
  warehouses: { getAll, getById, create, update, delete, getStockByItem, getStockByWarehouse,
                transferStock, getNextCode }
  warehouseZones: { getByWarehouse, create, delete }
  warehouseBins:  { getByZone, getByWarehouse, create, delete }
  binStock:       { getByBin, adjust }
}
```

All API calls return: `{ success: boolean, data?: any, error?: string }`

---

## 8. State Management (Zustand Store)

Single Zustand store (`useStore.js`) managing:

- **Auth**: `user`, `isLoggedIn`, `setUser`, `logout`
- **Navigation**: `currentPage`, `setPage` — simple string-based routing (no react-router)
- **Toasts**: `toasts[]`, `addToast(type, message)` — auto-dismiss after 4 seconds
- **Confirm Dialog**: Promise-based `showConfirm(config)` / `closeConfirm(result)`
- **Loading**: `loading`, `setLoading`
- **Cache**: `categories[]`, `suppliers[]`, `units[]`, `roles[]`, `warehouses[]`
- **Notification Dots**: `notificationDots{}` for sidebar badges
- **Global Modal**: `modal { type, data, isMinimized }`, `openModal/closeModal/setModalMinimized`
- **Challan Form State**: `challanForm`, `challanItems`, `clearChallan` — persistent across module navigation
- **Issue Form State**: `issueForm`, `issueItems`, `clearIssue`

**Routing** is handled via simple switch-case on `currentPage` string in `App.jsx`. No URL-based routing — it's a single-page app with page switching via Zustand state.

---

## 9. Styling

- Single CSS file: `src/renderer/styles/index.css` (~32KB)
- **Dark theme** by default (background: `#0f1117`)
- Custom design system with CSS custom properties
- Responsive layout with sidebar + main content area
- All components styled with vanilla CSS class names
- No CSS framework (no Tailwind, no CSS modules)

---

## 10. Build & Deployment

### Desktop
```bash
npm run dev          # Concurrently: vite dev server (port 5173) + electron in dev mode
npm run build        # Vite production build to dist/
npm run dist         # Build + electron-builder → NSIS installer → release/ + installers/
npm run release      # Build + electron-builder --publish always (GitHub release)
```

### Web
```bash
npm run build:web    # generate-config.js → vite build with base /
DEPLOY_WEB.bat       # build:web → firebase deploy --only hosting
```

### Auto-Update Publishing
```bash
PUBLISH_UPDATE.bat   # Runs publish-update.js → version bump → build → GitHub release
```

---

## 11. Key Conventions & Patterns

1. **Every IPC handler** is wrapped with `wrapHandler()` which catches errors and returns `{ success, data/error }`
2. **Every web-bridge call** is wrapped with `wrap()` which does the same for Supabase calls
3. **Database operations**: Repositories handle dual-mode (local SQLite vs Supabase) with `isCloudEnabled()` check
4. **Migrations**: All 26 migrations live in a single file, applied sequentially on startup
5. **No TypeScript**: Entire codebase is plain JavaScript (`.js` and `.jsx`)
6. **No router library**: Navigation is Zustand state-based (`currentPage` string)
7. **Session management**: `sessionStorage` for user data in renderer, main process has in-memory state
8. **PDF generation**: Uses pdfmake with table definitions, company headers, and signatures
9. **Excel generation**: Uses exceljs with styled headers, auto-width columns
10. **Security**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` in Electron
11. **Real-time sync**: Supabase Postgres Changes via WebSocket in main process
12. **Single-instance lock**: Only one Electron window allowed at a time
13. **Garment industry terminology**: Items have buyer, style, purchase number, order number/quantity — these are fashion/garment industry standard fields
14. **Currency**: Supports BDT (Bangladeshi Taka) as default, with USD option for unit prices
15. **Challan Verification**: Public web page at `/challan/{challanNumber}` — accessible without login for receivers to verify deliveries

---

## 12. Supabase Cloud Setup

The cloud backend requires manual table creation in Supabase SQL editor using the provided SQL files:
- `supabase_setup_issues.sql` — Issue, Return, Production tables
- `supabase_receivers_update.sql` — Recipients table updates
- `supabase_warehouses_update.sql` — Warehouse tables
- `supabase_wms_update.sql` — WMS zones/bins tables

Row Level Security (RLS) is enabled with basic policies. The app uses the Supabase **anon key** for all operations (no server-side auth).

Connection credentials are stored in:
- **Desktop**: Local SQLite `settings` table (`supabase_url`, `supabase_key`)
- **Web**: `localStorage` or URL parameters (`?u=URL&k=KEY`) or `config.json` pre-loaded at startup

---

## 13. Important Notes for AI Context

- The app is built for **KA Design Accessories LTD**, a Bangladeshi garment accessories company
- All development is done on **Windows** (batch files, NSIS installer)
- The codebase is actively maintained at version **1.1.67** with frequent updates
- The **web-bridge** (`web-bridge.js` at ~35KB) essentially reimplements the entire backend API surface for browser-only mode — this is one of the most complex files
- The **SettingsPage** (~45KB) and **IssuePage** (~42KB) are the most complex UI pages
- The **PDF generator** (~39KB) handles multiple document types: challans, issues, gate passes, reports
- Data imports support both **Excel files** and **Google Sheets URLs** (public sharing links)
- The system tracks **order fulfillment**: order quantity → shipped per challan → total shipped → balance remaining
