# KADAL Inventory Management System — Complete System Description

> **Purpose of this document:** A comprehensive technical description of the entire KADAL Inventory System codebase, written to give an AI model (or a new developer) full context about the system's architecture, data model, features, file structure, and conventions.
>
> **Doc revision:** 2026-09-08 — verified against the working tree at `E:\INVENTORY SYSTEM` (package version **1.1.108**, **30** migrations).

---

## 1. Overview

**KADAL** (named after **KA Design Accessories LTD**) is a full-featured **Inventory Management System** for a garment accessories/trims company. It is a **hybrid desktop + web application**:

- **Desktop App**: Electron 33 + React 19 + Vite 6 — packaged as a Windows NSIS installer
- **Web App**: The same React frontend deployed to **Firebase Hosting** (Vercel also configured), running browser-only against **Supabase** (PostgreSQL)
- **Local Database**: SQLite via `sql.js` (WebAssembly), in the Electron main process
- **Cloud Database**: Supabase (PostgreSQL) — the primary backend whenever credentials are configured

| | |
|---|---|
| **Version** | 1.1.108 (`package.json`) |
| **App ID** | `com.kadesign.kadal` |
| **Product name** | KADAL Inventory |
| **GitHub repo** | `Tanvirshakil607159/KADAL-INVENTORY-SYSTEM` |
| **Working copy** | `E:\INVENTORY SYSTEM` (Windows) |
| **License** | UNLICENSED (private) |

---

## 2. Architecture

### 2.1 Dual-mode (Desktop + Web) from one codebase

#### Desktop mode (Electron)
```
Electron Main Process (Node.js)
 ├── src/main/index.js            window creation, lifecycle, single-instance lock, GPU-cache switches
 ├── src/main/ipc-handlers.js     ~145 IPC channels, all wrapped
 ├── src/main/services/*.js       business logic (15 services)
 ├── src/main/database/connection.js   SQLite init + Supabase client + dbPrepare/dbExec/dbTransaction
 ├── src/main/database/repositories/*.js  data access (21 repositories)
 └── src/main/utils/*.js          PDF / Excel generation, buyer normalizer
        ↕
Preload: src/preload/index.js  →  contextBridge exposes `window.kadal`
        ↕
Renderer (Chromium): React 19 SPA, Zustand state, calls window.kadal.* → IPC
```

#### Web mode (browser)
```
Browser
 ├── Same React SPA
 ├── src/renderer/web/web-bridge.js   injects a `window.kadal` replacement that hits Supabase directly
 ├── src/renderer/web/supabase-client.js
 ├── src/renderer/web/inventory-api.js
 └── src/renderer/web/challans-api.js
        ↕
Supabase (PostgreSQL) via the JS SDK
```

**Key mechanism** (`src/renderer/main.jsx`): on boot, if `window.kadal` is absent (i.e. not Electron), `webBridge` is assigned to it. Before React mounts, the web build also pre-loads `/config.json` into `sessionStorage` unless Supabase credentials already came from URL params (`?u=…&k=…`) or `localStorage`.

### 2.2 Data flow

- **Desktop + cloud configured** → repositories check `isCloudEnabled()` and go to Supabase; local SQLite holds settings and acts as an offline shell.
- **Desktop, local only** → everything in `kadal.db` (Electron `userData`, or a user-chosen custom path recorded in `db-config.json`).
- **Web** → Supabase only, straight from the browser.

### 2.3 IPC call convention
```
window.kadal.{module}.{method}(args)
  → ipcRenderer.invoke('{module}:{method}', args)
  → ipcMain.handle('{module}:{method}', wrapHandler(fn))
  → Service → Repository → SQLite or Supabase
  → { success: boolean, data?: any, error?: string }
```
The web bridge mirrors this with its own `wrap()` helper, so the renderer never knows which backend it is talking to.

---

## 3. Technology stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| Frontend | React 19 (JSX, no TypeScript) |
| Build | Vite 6 + `@vitejs/plugin-react`, root `src/renderer`, out `dist/`, **dev port 5175 (strict)** |
| State | Zustand 5 |
| Styling | Vanilla CSS, single `src/renderer/styles/index.css` (~46KB), dark theme |
| Icons | Lucide React |
| Local DB | sql.js 1.11 (SQLite → WASM) |
| Cloud DB | Supabase (`@supabase/supabase-js` v2) |
| Auth | Custom bcryptjs auth — **not** Supabase Auth |
| PDF | pdfmake (`src/main/utils/pdf-generator.js`, ~52KB) |
| Excel | exceljs |
| Barcode / QR | jsbarcode + qrcode (QR is the default format) |
| Dates | date-fns |
| Realtime | Supabase Postgres Changes over `ws` in the main process |
| Auto-update | electron-updater against GitHub releases |
| Packaging | electron-builder → NSIS (Windows) |
| Web hosting | Firebase Hosting (`firebase.json`), Vercel configured |
| Bengali text | `@fontsource/noto-sans-bengali` + bundled `NotoSansBengali-{Regular,Bold}.ttf` |

---

## 4. Project layout

```
E:\INVENTORY SYSTEM\
├── package.json                 scripts, deps, electron-builder + GitHub publish config
├── vite.config.js               root src/renderer, base './', outDir ../../dist, port 5175
├── firebase.json / .firebaserc  SPA rewrite, long cache on js/css, no-cache on index.html
├── .github/workflows/build-and-release.yml   tag-triggered build + release
│
├── assets/logo.png              app icon
│
├── scripts/
│   ├── copy-installer.js        post-build: copy NSIS installer into /installers
│   ├── generate-config.js       reads supabase_url/key out of the local kadal.db → src/renderer/public/config.json
│   ├── generate-config-vercel.js
│   └── publish-update.js        bump patch version → git add/commit/tag → push tag then main
│
├── src/
│   ├── main/
│   │   ├── index.js
│   │   ├── ipc-handlers.js                   (~57KB)
│   │   ├── database/
│   │   │   ├── connection.js
│   │   │   ├── migrations/001-initial.js     ALL 30 migrations in one file (~44KB)
│   │   │   └── repositories/                 21 files
│   │   │       approvals · audit-logs · buyers · categories · challans (31KB)
│   │   │       gate-passes · issues (34KB) · items (22KB) · production (29KB)
│   │   │       recipients · requisitions · returns · roles · settings
│   │   │       stock-transactions · suppliers · units · users
│   │   │       warehouse-bins · warehouses
│   │   ├── services/                          15 files
│   │   │       approval · auth · backup · challan · cloud-sync · gate-pass
│   │   │       import (21KB) · inventory · issue · report (17KB) · requisition
│   │   │       return · update · warehouse
│   │   ├── scripts/delete-items.js
│   │   └── utils/
│   │       ├── pdf-generator.js     (~52KB) challans, issues, gate passes, requisitions, reports
│   │       ├── excel-generator.js
│   │       └── buyer-normalizer.js  canonicalises buyer name spellings
│   │
│   ├── preload/index.js          contextBridge → `window.kadal`, 30 namespaces
│   │
│   └── renderer/
│       ├── main.jsx              web-bridge injection + config.json pre-load
│       ├── App.jsx               landing gate → cloud-setup gate → login gate → switch-case router
│       ├── store/useStore.js     Zustand store
│       ├── pages/                18 pages (see §6)
│       ├── components/
│       │   ├── common/   ConfirmDialog · NotificationManager · ToastContainer · UpdateProgress
│       │   ├── layout/   Sidebar · TopBar
│       │   ├── modals/   19 modals (Item, StockMovement, StockTransfer, Barcode, Approval,
│       │   │             Bin/Zone/Warehouse forms, Challan & Issue browsers, User, Supplier,
│       │   │             Recipient, ProductionEntry, TargetProductBrowser, GlobalModalManager)
│       │   ├── ui/SuggestionInput.jsx
│       │   └── WarehouseDetail.jsx
│       ├── styles/index.css
│       ├── web/                  web-bridge.js (52KB) · supabase-client.js · inventory-api.js · challans-api.js
│       └── public/               config.json (Supabase creds for the web build) · slide/*.png
│
├── supabase_setup_issues.sql        issues / returns / production / recipients tables
├── supabase_requisitions.sql        requisitions + requisition_items + settings
├── supabase_receivers_update.sql
├── supabase_warehouses_update.sql
├── supabase_wms_update.sql
│
├── DEPLOY_WEB.bat · PUBLISH_UPDATE.bat · build-portable.bat · run.bat
├── check_* / inspect_* / scratch_* / fix_* .js    one-off DB debug and repair scripts (gitignored)
└── dist/ · release/ · installers/ · exports/
```

---

## 5. Database

### 5.1 Migrations

All 30 migrations live in `src/main/database/migrations/001-initial.js`, each guarded by a name lookup in `_migrations` and applied in order on every startup:

| # | Name |
|---|---|
| 001 | initial |
| 002 | add-buyers-and-item-fields |
| 003 | add-unit-price |
| 004 | add-units-and-currency |
| 005 | add-user-permissions |
| 006 | add-approvals |
| 007 | add-order-fields |
| 008 | add-gate-passes |
| 009 | add-approval-settings |
| 010 | add-gate-pass-approval |
| 011 | update-roles |
| 012 | add-super-admin-user |
| 013 | fix-superadmin-login |
| 014 | finalize-super-admin-rbac |
| 015 | add-monitoring-role |
| 016 | add-issue-module |
| 017 | enhance-issue-module |
| 018 | add-approval-links |
| 019 | enhance-issues-for-production |
| 020 | add-produced-item-to-issues |
| 021 | add-source-type-to-items |
| 022 | add-access-control-settings |
| 023 | add-warehouses-and-barcodes |
| 024 | add-wms-zones-and-bins |
| 025 | add-merchandiser-role |
| 026 | add-address-to-recipients |
| 027 | add-requisitions |
| 028 | add-requisition-settings |
| 029 | add-produced-item-ids-to-issues |
| 030 | normalize-buyer-names |

> The helper functions are named in English ordinals (`applyThirtiethMigration`) and are **not** in file order. Migration 031 = add `applyThirtyFirstMigration`, call it from the guarded block at the bottom of `runMigrations`, and mirror the DDL in a `supabase_*.sql` file for the cloud.

### 5.2 Tables (27)

`_migrations` · `roles` · `users` · `categories` · `suppliers` · `buyers` · `units` · `items` ·
`stock_transactions` · `challans` · `challan_items` · `gate_passes` · `approvals` · `audit_logs` ·
`settings` · `recipients` · `issues` · `issue_items` · `returns` · `return_items` ·
`requisitions` · `requisition_items` · `factory_production` ·
`warehouses` · `warehouse_stock` · `warehouse_zones` · `warehouse_bins` · `bin_stock`

### 5.3 `items` — the central entity

```sql
items (
  id, item_code UNIQUE, name, category_id FK, size, color, unit,
  supplier_id FK, opening_stock, current_stock, min_stock_level,
  unit_price, currency DEFAULT 'BDT',
  buyer_name, style_name, purchase_no, order_number, order_quantity,
  source_type DEFAULT 'SOURCE',        -- 'SOURCE' | 'PRODUCTION' | import
  barcode_data, notes, is_active, created_at, updated_at
)
```
`buyer_name`, `style_name`, `purchase_no`, `order_number`, `order_quantity` are garment-industry fields; the system tracks order fulfilment as **order quantity → shipped per challan → total shipped → balance**.

### 5.4 `requisitions` / `requisition_items`

```sql
requisitions (id, requisition_no UNIQUE, recipient_id FK, requester_name, department,
              purpose, status, requested_by, approved_by, notes, requisition_date,
              created_by FK, created_at, updated_at, is_active)
  status ∈ PENDING | APPROVED | REJECTED | FULFILLED | CANCELLED

requisition_items (id, requisition_id FK CASCADE, item_id FK,
                   requested_quantity, approved_quantity, issued_quantity, notes)
```

### 5.5 RBAC

`roles.permissions` is a JSON object; values are `"rw"`, `"r"`, or `"none"`:

```json
{ "inventory": "rw", "challan": "rw", "requisition": "rw", "reports": "rw",
  "users": "rw", "settings": "rw", "backup": "rw", "maintenance": "rw" }
```

Built-in roles and their requisition access:

| Role | Scope | `requisition` |
|---|---|---|
| Super Admin | everything, incl. maintenance (clear data, DB management, requisition delete) | rw |
| Admin | everything except maintenance | rw |
| Operator | inventory + challan rw, reports read | rw |
| Inventory | inventory rw, reports read; optionally production | rw |
| Challan | challan rw, reports read; optionally issue | none |
| Monitoring | read-only everywhere except backup/maintenance | r |
| Merchandiser | inventory rw, reports read | r |

A user row may carry `custom_permissions` that override the role. The Sidebar applies explicit per-user permissions first, then falls back to role-name allow-lists (see `Sidebar.jsx`).

**Default credentials**: `superadmin` / `superadmin`, `admin` / `admin123`.

### 5.6 Settings (seeded defaults)

| Key | Default |
|---|---|
| `company_name` | `KA Design Accessories LTD` |
| `company_address` / `company_phone` / `company_email` | `''` |
| `challan_prefix` | `KA` |
| `issue_prefix` | `ISS` |
| `requisition_prefix` | `REQ` |
| `low_stock_threshold` | `10` |
| `auto_backup` | `true` |
| `backup_path` | `''` |
| `theme` | `dark` |
| `barcode_format` | `QR` |
| `public_web_url` | `''` |
| `require_challan_approval` | `false` |
| `require_inventory_approval` | `false` |
| `require_gate_pass_approval` | `false` |
| `require_return_approval` | `false` |
| `require_requisition_approval` | `false` |
| `allow_challan_to_issue` | `false` |
| `allow_inventory_to_produce` | `false` |
| plus | `supabase_url`, `supabase_key`, `default_warehouse_id`, suggestion blacklist (JSON) |

---

## 6. Pages and modules

`App.jsx` gates in this order: **`/challan/{number}` verification route → landing page → cloud-setup (no Supabase creds) → login → app shell**. Routing inside the shell is a `switch` on `currentPage` (no react-router). 30-minute inactivity auto-logout is wired to mouse/key/scroll/touch events.

| `currentPage` | Page | Notes |
|---|---|---|
| `dashboard` | DashboardPage | counts, stock value, low-stock, today's challans, challans awaiting gate pass |
| `inventory` | InventoryPage | item CRUD, codes, import, barcodes |
| `stock-in-out` | **StockInOutPage** | search-first stock IN/OUT screen with per-item transaction history and sortable columns |
| `pending-items` | **PendingItemsPage** | queue of `PENDING_ITEM` approvals — Inventory adds opening stock, then forwards to Admin |
| `warehouses` | WarehousePage (+ WarehouseDetail) | warehouses, zones, bins, bin stock, transfers |
| `challan` | ChallanPage | create delivery challan |
| `challan-history` | ChallanHistoryPage | search/filter/export |
| `approvals` | ApprovalsPage | pending approval queue |
| `gate-pass` | GatePassPage | bundle challans, packaging counts |
| `requisition` | **RequisitionPage** | internal material requisitions |
| `issue` | IssuePage (44KB) | issue to factory/employee |
| `production` | ProductionPage (43KB) | factory production against issues |
| `reports` | ReportsPage (76KB) | all report types |
| `settings` | SettingsPage (48KB) | company, prefixes, approvals, cloud, users, masters |
| `backup` | BackupPage | backup/restore (desktop) |
| — | LoginPage · CloudSetupPage · LandingPage · ChallanVerificationPage | outside the shell |

### 6.1 Approval workflow

`ApprovalService.createRequest(type, data)` parks a payload in `approvals`; `approve()` dispatches by type:

| Type | On approve |
|---|---|
| `CREATE_ITEM` | `InventoryService._executeCreate` |
| `PENDING_ITEM` | re-raises a `CREATE_ITEM` request (two-stage: Inventory → Admin) |
| `UPDATE_ITEM` | `InventoryService._executeUpdate` |
| `STOCK_MOVEMENT` | `InventoryService._executeStockMovement` |
| `CREATE_CHALLAN` | `ChallanService._executeCreate` |
| `CREATE_GATE_PASS` | `GatePassService._executeCreate` |
| `CREATE_REQUISITION` | `RequisitionService._executeCreate` |

Rejections are not silent: a rejected challan is written to challan history as `<next-number>-REJ` and immediately cancelled; a rejected gate pass is stored with a `-REJ` suffix. Approval payloads are editable (`approvals:updateData`) before the final approve.

**Merchandiser special case** (`InventoryService.create`): a Merchandiser never writes items directly. `sourceType === 'PRODUCTION'` → straight to `CREATE_ITEM` (Admin). Anything else → `PENDING_ITEM`, which lands on the Pending Items page for Inventory to fill in opening stock, then goes to Admin. The item code is stripped and only generated at execution time; `_executeCreate` retries up to 10 times on code collision.

### 6.2 Requisition module (newest)

Flow: **create → (optional approval) → PENDING → APPROVED → FULFILLED**, with REJECTED / CANCELLED as terminal states.

- `create` routes into the approval queue when `require_requisition_approval` is `true`.
- `fulfill` uses `approved_quantity` when the requisition is APPROVED and the value is set, otherwise `requested_quantity`; it validates availability, re-reads each item before deducting, and **rolls back every completed deduction** if any line fails. It then writes `issued_quantity` per line, flips status to FULFILLED, and logs one `OUT` stock transaction per item referencing the requisition number.
- `delete` is Super Admin only, and reverses issued stock with matching `IN` transactions when the requisition was FULFILLED.
- Every transition writes an audit log.

### 6.3 Stock movements

`InventoryService._executeStockMovement` handles `IN` (add), `OUT` (subtract, refuses to go negative), `ADJUSTMENT` (set absolute). It updates `items.current_stock`, syncs `warehouse_stock` for the target or default warehouse (computing a delta for adjustments), and writes a `stock_transactions` row with before/after values.

### 6.4 Issue / Return / Production

Issues go to **FACTORY** or **EMPLOYEE** recipients, tracking issued / returned / damaged / rejected / consumed quantities, expected return date, returnability, and (for factory issues) linked produced items (`produced_item_id`, `produced_item_ids`). Returns post against issues at line level. Production records consumption (JSON), wastage and balance against an issue; `production:createBatch` inserts multiple records at once, and Excel import has its own production template (`import:downloadProductionTemplate`, `import:importProductionItems`).

### 6.5 Reports

`stockReport` · `movementReport` · `lowStockReport` · `challanHistory` · `detailedChallanHistory` · `dailySummary` · `monthlySummary` · `issueReport` · `returnReport` · `factoryProductionReport` · `employeeOutstandingReport` · `issueReturnSummary` · **`auditReport`** — each with PDF (`reports:exportPdf`) and Excel (`reports:exportExcel`) export.

### 6.6 Cloud sync, auto-update, backup

- `CloudSyncService` subscribes to Supabase Postgres Changes on `items`, `stock_transactions`, `challans`, `approvals`, `gate_passes` and forwards them to the renderer as `cloud:data-changed`.
- `UpdateService.checkOnStartup` drives electron-updater; the renderer listens through `window.kadal.update.on*`.
- Backup/restore is SQLite-file based and desktop-only (custom DB path support via `system:selectDatabase` / `system:createDatabase`).

---

## 7. `window.kadal` API surface

30 namespaces, identical shape in Electron and (where implemented) web:

```
auth        login, logout, changePassword, getCurrentUser, register, syncSession
users       getAll, create, update, toggleActive, delete
roles       getAll
buyers      getAll, create, delete
categories  getAll, create, update, delete
units       getAll, create, delete
suppliers   getAll, create, update, delete, getFieldSuggestions
items       getAll, getById, create, update, delete, search, getDistinctValues, getNextCode
stock       addMovement, getTransactions, getFieldSuggestions
challans    getAll, getById, getByNumber, create, cancel, getNextNumber, getFieldSuggestions,
            exportPdf, exportExcel, getTotalDelivered, delete, clearHistory, deleteSuggestion
reports     stockReport, movementReport, lowStockReport, challanHistory, detailedChallanHistory,
            dailySummary, monthlySummary, exportExcel, exportPdf, issueReport, returnReport,
            factoryProductionReport, employeeOutstandingReport, issueReturnSummary, auditReport
approvals   getAll, getById, approve, reject, updateData
gatePass    getAll, getById, create, delete, exportPdf, getNextNumber, getUsedChallanIds, clearHistory
issues      getAll, getById, create, getNextId, getOutstandingItems, delete, exportPdf, exportExcel
returns     getAll, getById, create
recipients  getAll, create, update, delete
production  getAll, create, createBatch, delete
requisitions getAll, getById, create, approve, reject, cancel, fulfill, delete,
             getNextNumber, getFieldSuggestions, exportPdf, exportExcel
backup      create, restore, getHistory, selectFile, selectDirectory, download
settings    getAll, get, set, setBulk
dashboard   getStats
audit       getLogs
import      selectFile, parseExcel, parseGoogleSheet, importItems, downloadTemplate,
            downloadProductionTemplate, importProductionItems
update      check, onDownloadProgress, onUpdateAvailable, onUpdateError
system      clearData, getVersion, getCurrentDbPath, selectDatabase, createDatabase
warehouses  getAll, getById, create, update, delete, getStockByItem, getStockByWarehouse,
            transferStock, getNextCode
warehouseZones getByWarehouse, create, delete
warehouseBins  getByZone, getByWarehouse, create, delete
binStock       getByBin, adjust
```

Every call resolves to `{ success, data? , error? }` — never throws across the bridge.

### 7.1 Web-bridge coverage (important)

`web-bridge.js` implements only: `auth`, `settings`, `users`, `buyers`, `categories`, `units`, `suppliers`, `items`, `stock`, `challans`, `warehouses`, `warehouseZones`, `warehouseBins`, `binStock`, `reports`, `roles`, `dashboard`, `production`, `requisitions`, `system`, `update`.

**Not implemented in web mode:** `issues`, `returns`, `recipients`, `approvals`, `gatePass`, `import`, `backup`, `audit`. Pages that call those namespaces (Issue, Approvals, Pending Items, Gate Pass) will throw `Cannot read properties of undefined` in the browser build. PDF/Excel export is stubbed to throw in web mode, and `system.getVersion` returns a hard-coded string.

---

## 8. State management

One Zustand store (`src/renderer/store/useStore.js`):

- **Auth** — `user`, `isLoggedIn`, hydrated from `sessionStorage['kadal_user']`
- **Landing / navigation** — `showLanding` (defaults to **true**, so both web and desktop open on the showcase), `goHome`, `openApp`, `currentPage`, `setPage`
- **Toasts** — `addToast(type, message)`, auto-dismiss after 4s
- **Confirm dialog** — promise-based `showConfirm(config)` / `closeConfirm(result)`
- **Loading**
- **Caches** — `categories`, `suppliers`, `units`, `roles`, `warehouses`
- **Sidebar notification dots** — `notificationDots`, also mirrored into `localStorage['unseen_dots']`
- **Global modal** — `modal { type, data, isMinimized }`, driven by `GlobalModalManager`
- **Cross-page form state** — `challanForm`/`challanItems` and `issueForm`/`issueItems` survive navigation

---

## 9. Build, deploy, release

```bash
npm run dev        # vite dev (5175) + electron in dev mode, concurrently
npm run build      # vite build → dist/
npm run build:web  # generate-config.js → vite build --base /
npm run dist       # build + electron-builder → release/ → copy-installer.js → installers/
npm run release    # build + electron-builder --publish always (GitHub release)
```

| Batch file | Does |
|---|---|
| `run.bat` | dev run |
| `DEPLOY_WEB.bat` | `build:web` then `firebase deploy --only hosting` |
| `PUBLISH_UPDATE.bat` | `publish-update.js`: bump patch → `git add .` → commit `chore: release vX.Y.Z` → tag → push tag then `main` → GitHub Actions builds and publishes |
| `build-portable.bat` | portable build |

electron-builder publishes to GitHub (`owner: Tanvirshakil607159`, `repo: KADAL-INVENTORY-SYSTEM`), NSIS non-one-click installer, `deleteAppDataOnUninstall: false`.

---

## 10. Supabase setup

Tables are created by hand in the Supabase SQL editor from `supabase_setup_issues.sql`, `supabase_requisitions.sql`, `supabase_receivers_update.sql`, `supabase_warehouses_update.sql`, `supabase_wms_update.sql`.

Credentials live in:
- **Desktop** — local SQLite `settings` (`supabase_url`, `supabase_key`)
- **Web** — `localStorage`, URL params `?u=…&k=…`, or `src/renderer/public/config.json` (generated from the desktop DB by `scripts/generate-config.js` and shipped with the web build)

The app authenticates users itself with bcrypt and **never signs in to Supabase Auth**, so every request carries the **anon** role.

---

## 11. Conventions

1. Every IPC handler goes through `wrapHandler()`; every web-bridge call through `wrap()` — both return `{ success, data/error }`.
2. Repositories branch on `isCloudEnabled()`: a Supabase query first, a `dbPrepare(...)` SQLite query as the local fallback. Supabase reads that can exceed 1000 rows are paged through a local `fetchAll` helper.
3. Services own the rules (approval routing, stock math, audit logging); repositories only touch data.
4. Circular dependencies are avoided by `require()`-ing sibling services **inside** methods, not at module top level.
5. All migrations in one file, guarded by name, applied on every boot.
6. Plain JavaScript throughout — no TypeScript.
7. No router library; navigation is Zustand state.
8. Session: `sessionStorage` in the renderer, an in-memory `currentUser` in the main process, reconciled by `auth:syncSession` after a reload.
9. Electron security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`; single-instance lock; F5 reload and F12 devtools wired manually.
10. Numbering: challan `KA…`, issue `ISS…`, requisition `REQ…`, warehouse `WH-01…` — all prefix-configurable in settings.
11. Buyer names are canonicalised through `utils/buyer-normalizer.js` (migration 030 back-filled existing rows).
12. Money: BDT by default, USD supported per unit price.
13. Public challan verification lives at `/challan/{challanNumber}` and needs no login.
14. Root-level `scratch_*`, `fix_*`, `check_*`, `inspect_*` scripts are throwaway DB tools and are gitignored (`scratch_*`, `fix_*`).

---

## 12. Known gaps and risks

1. **Web mode is partial.** Eight `window.kadal` namespaces are missing from `web-bridge.js` (§7.1); the Issue, Approvals, Pending Items and Gate Pass pages cannot work in the browser build.
2. **Supabase RLS vs. the anon key.** The shipped SQL enables RLS with policies of the form `USING (auth.role() = 'authenticated')`, but the app only ever presents the **anon** key. Either those policies block the app entirely, or RLS has been turned off on the live project — in which case the anon key published in `config.json` and served with the web app grants full read/write to the whole database. Worth verifying in the Supabase dashboard and replacing with anon-scoped policies or an authenticated server path.
3. **Credentials in the repo.** `src/renderer/public/config.json` is not gitignored and contains the live Supabase URL and anon key.
4. **A "TEMPORARY PATCH" block runs on every startup** in `connection.js`, rewriting challan/recipient receiver names to `K.A. DESIGN WEAR LTD.`. It is unconditional and unbounded — it should be a migration, not a boot-time loop.
5. **`web-bridge.js` reports version `1.1.41-web`**, hard-coded and long out of date.
6. **`scripts/generate-config.js` falls back to a hard-coded Windows user path** (`C:\Users\workh\AppData\Roaming`) when `APPDATA` is unset.
7. **`AuthService.register` assigns `roleId: 2`** by position with a comment admitting the role is only "typically" Operator.
8. **The one-file migration approach** (44KB, ordinal-named functions in arbitrary order) is at its practical limit.
9. **No automated tests** anywhere in the tree; verification is manual plus ad-hoc root scripts.
