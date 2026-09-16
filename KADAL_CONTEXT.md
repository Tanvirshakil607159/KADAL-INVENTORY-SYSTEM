# KADAL project reference

Reviewed on 2026-09-16 against the working tree, package version **1.1.111**, HEAD `43d2106`. This is a source-reading reference for future work, not a live-system test report. The original `SKILL.md` contains the longer system description; use current source when it differs from that guide.

## Business model

KADAL serves KA Design Accessories LTD, a garment accessories business. Items combine ordinary inventory fields with buyer, style, purchase number, order number, order quantity, color, size, supplier, and source/production classification. Delivery reporting connects order quantities to challan quantities and remaining balances.

The core workflows are:

- **Item setup and approval:** Merchandiser source items enter `PENDING_ITEM` for Inventory to complete, then `CREATE_ITEM` for final approval. Merchandiser production items go directly to `CREATE_ITEM`. Other inventory operations can require approval through settings. Codes are allocated or corrected at execution time.
- **Stock:** IN increases stock, OUT reduces it, and ADJUSTMENT sets an absolute quantity. The stock movement service also updates warehouse quantities and creates transaction records with before/after balances. Its current positive-quantity validation prevents an adjustment to zero.
- **Pricing:** `item_price_tiers` stores quantities at prices, currencies, and conversion rates. Restocking adds/merges tiers; several outgoing flows deduct tiers in FIFO order. USD conversion rates contribute to BDT valuation. Item totals, tiers, warehouse stock, bin stock, and movement records are separate stored representations.
- **Delivery:** Challan creation checks availability, deducts stock, creates delivery lines, and records OUT movements. Cancellation or deletion of an active challan restores stock. Non-admin deliveries can need approval through settings or when cumulative deliveries exceed order quantity.
- **Gate pass:** Groups challans with packaging counts. Creation checks whether selected challans are already used, including the approval flow's own exclusion handling. Gate passes have a separate optional approval setting.
- **Issue and return:** Materials go to FACTORY or EMPLOYEE recipients. Issue lines track consumed, good returned, damaged, and rejected quantities. Good returns add inventory stock; damaged/rejected returns do not. Return validation subtracts all of those categories from the original issue quantity.
- **Production:** Links finished goods to an issue, records consumption/wastage/returned raw material, adds finished stock, and updates issue status. Batch creation consumes the shared material list once across multiple produced products. Much of this business logic lives in the production repository itself.
- **Requisition:** Creation can first enter the general approval queue. The resulting requisition has its own PENDING/APPROVED/FULFILLED/REJECTED/CANCELLED lifecycle. Current fulfillment accepts PENDING or APPROVED; it uses a positive approved quantity where available, otherwise requested quantity. Fulfillment deducts inventory and logs movements. Super Admin deletion restores quantities for fulfilled requisitions.
- **Warehouse:** Warehouses contain zones and bins. Transfers move warehouse quantities and log a TRANSFER without changing the item's overall stock total.

## Application structure

Desktop uses Electron 33, React 19, Vite 6, Zustand, and sql.js SQLite. Repositories generally select Supabase when cloud configuration is active, otherwise local SQLite. The browser uses the same React pages with a separate Supabase implementation.

Desktop call path:

`React page -> window.kadal -> preload IPC -> ipc-handlers -> service/repository -> database`

Browser call path:

`React page -> window.kadal replacement in web-bridge.js -> Supabase`

Both wrappers return `{ success, data }` or `{ success: false, error }`. Some services also return a success/error object inside `data`; caller checks must account for that nesting.

Navigation uses Zustand `currentPage` and a switch in `App.jsx`. Public challan verification is handled before the ordinary landing/setup/login gates. The app shell currently requires cloud configuration even though repositories have local branches. There is a 30-minute inactivity logout.

Authentication uses custom bcrypt password checks and an in-memory desktop session, with a renderer session in sessionStorage. Roles and custom permissions affect access. Sidebar rules and individual handler/service checks must be read together; permission labels alone do not describe every actual behavior.

## Source map

| Area | Primary files/directories |
| --- | --- |
| Startup and database selection | `src/main/index.js`, `src/main/database/connection.js` |
| Desktop API contract | `src/preload/index.js`, `src/main/ipc-handlers.js` |
| Browser API | `src/renderer/web/web-bridge.js`, `inventory-api.js`, `challans-api.js`, `supabase-client.js` |
| UI and navigation | `src/renderer/App.jsx`, `pages/`, `components/`, `store/useStore.js` |
| Stock and pricing | `src/main/services/inventory-service.js`, `src/main/database/repositories/items.js`, `item-price-tiers.js`, `stock-transactions.js` |
| Approvals | `src/main/services/approval-service.js`, `src/main/database/repositories/approvals.js`, approval/pending-item pages |
| Deliveries | Challan and gate-pass services, repositories, and pages |
| Factory material lifecycle | Issue/return services, `src/main/database/repositories/production.js`, Issue/Production pages |
| Requisitions and warehouses | Corresponding services, repositories, pages, and warehouse modals |
| Reports and output | `src/main/services/report-service.js`, `src/main/utils/pdf-generator.js`, `excel-generator.js` |
| Database evolution | `src/main/database/migrations/001-initial.js`, root `supabase_*.sql` files |

## Verified differences from the older guide

- Package version is 1.1.111. The migration file contains **32 migrations** and **29 table creation statements**, including the migration tracking table. The source has **21 repository files**, **14 service files**, and **19 page components**.
- Price tiers and conversion rates are active implementation concerns, beyond the guide's older headline counts.
- Browser API namespaces still omit `issues`, `returns`, `recipients`, `approvals`, `gatePass`, `import`, `backup`, and `audit`. Shared UI does not imply full browser functionality.
- Browser challan/report export methods currently show placeholder alerts and return success; requisition export methods return errors. The browser version label is still hard-coded to `1.1.41-web`.
- Database initialization runs migrations, core-data seeding, and a receiver-name normalization patch. Launching desktop is therefore not a purely read-only inspection.
- Settings `get()` reads locally and synchronously; `getAll()` can fetch selected global settings from cloud and write them into the local settings cache.
- Stock reversal code exists, but several workflows consist of multiple writes and partial compensation. Do not infer complete transaction rollback or concurrent-update protection from comments. A local SQLite transaction does not enclose remote Supabase writes.

## Working and validation context

### Searchable filters (added 2026-09-16)

The 35 dropdown filters in Inventory, Reports, Challan History, Issue history, production categories, Requisition history, and the Challan/Issue/Target Product browsers use `src/renderer/components/ui/SearchableSelect.jsx`. Existing option values and filtering handlers are preserved through `onValueChange(value)`. Typing narrows choices without applying a partial value; exact and prefix matches come first, followed by other matches, with natural alphabetical/numeric sorting. Click or Enter selects; Escape and Tab preserve the prior selection. The empty-value “All…” option clears the filter. Menus render in a portal so dialog overflow does not clip them, and use the current light/dark palette. Form-entry selectors and date inputs retain their existing behavior.

### Appearance (added 2026-09-16)

The original palette is Dark Mode and remains the default. Light Mode overrides live in `src/renderer/styles/themes.css`, selected by `data-theme` on the HTML element. The Zustand store exposes `theme` and `setTheme`; `src/renderer/theme.js` applies and saves the device preference under `localStorage.kadal_theme`. An early script in `index.html` restores the preference before rendering, and `main.jsx` listens for cross-tab storage changes. This preference is independent of shared company/database settings.

The shared `ThemeToggle` is available in the top bar, showcase, login/cloud setup, and public verification screens. Settings > Appearance provides two preview choices. The verification palette is scoped to its page. Printed challans, generated PDFs, and barcode artwork retain their existing output colors. Build and browser checks with isolated sample data cover switching, persistence, appearance selection, and cross-tab synchronization.

The development server uses port 5175. `npm run dev` starts Vite plus Electron. `npm run build` builds the renderer. `npm run build:web` first generates backend configuration from the local database. Desktop packaging/release uses electron-builder, and GitHub Actions publishes on version tags. The release helper also changes version/git state. No test script is defined in package.json; root scratch/fix scripts are not a general test suite.

At the start of this review, existing uncommitted edits were present in the approvals repository, Approvals page, Gate Pass page, and item deletion script. Gate-pass related edits add receiver/challan details to approval data and presentation. Those edits were left intact.

This review read documentation and source only. It did not launch the app, query production records, run database repair scripts, build, deploy, or validate live cloud policies. Future changes should be verified against the affected desktop/browser paths and relevant stock/accounting records in an appropriate test environment.
