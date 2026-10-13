// AUTO-GENERATED from the Banglish SOP source (KADAL/SOP/INV/01, Rev 00).
// Block types: h2, p, steps, bullets, img, table, note, warn. Inline **bold**.
// img.f is a file name (without extension) in src/renderer/assets/guide/.
const guideSections = [
 {
  "id": "document-control",
  "group": "start",
  "badge": "i",
  "label": "Document Control",
  "title": "Document Control",
  "blocks": [
   {
    "t": "table",
    "head": [
     "বিষয়",
     "বিবরণ"
    ],
    "rows": [
     [
      "Document No.",
      "KADAL/SOP/INV/01 (Banglish)"
     ],
     [
      "Revision",
      "Rev 00"
     ],
     [
      "Software Version",
      "KADAL Inventory v1.1.145 (Desktop App)"
     ],
     [
      "প্রতিষ্ঠান",
      "KA Design Accessories LTD"
     ],
     [
      "প্রস্তুতকারী",
      "IT Department"
     ],
     [
      "পর্যালোচনাকারী",
      "Store / Inventory In-charge"
     ],
     [
      "অনুমোদনকারী",
      "Management"
     ],
     [
      "পর্যালোচনার সময়",
      "প্রতি ৬ মাসে একবার, অথবা software-এর বড় update-এর পর"
     ]
    ]
   },
   {
    "t": "note",
    "x": "এই SOP-এর সব screenshot **demo (নমুনা) data** দিয়ে তৈরি। ছবিতে থাকা item-এর নাম, পরিমাণ ও PI number শুধুমাত্র উদাহরণ, আসল record নয়।"
   },
   {
    "t": "p",
    "x": "**কীভাবে পড়বেন:** প্রতিটি screenshot-এ লাল বৃত্তের ভেতরে নম্বর (1, 2, 3...) দেওয়া আছে। ছবির নিচের ধাপগুলোর নম্বর ঠিক ঐ লাল নম্বরের সাথে মিলে যায়। Button, menu ও field-এর নাম software-এ যেভাবে লেখা আছে, ঠিক সেভাবেই **bold** করে English-এ রাখা হয়েছে।"
   }
  ]
 },
 {
  "id": "part-1",
  "group": "start",
  "badge": "1",
  "label": "উদ্দেশ্য, পরিধি ও Role",
  "title": "1. উদ্দেশ্য, পরিধি ও Role",
  "blocks": [
   {
    "t": "p",
    "x": "**উদ্দেশ্য:** Store, Dispatch, Merchandising ও Finance-এর প্রত্যেক user যেন একই নিয়মে stock-এর হিসাব রাখেন, যাতে system-এর stock আর তাকের (shelf) আসল stock সবসময় সমান থাকে।"
   },
   {
    "t": "p",
    "x": "**পরিধি:** KADAL Inventory-এর সব ১৬টি module: item তৈরি, stock movement, warehouse, delivery challan, receipt, proforma invoice ও bill, approval, gate pass, requisition, issue ও return, production, report, settings এবং backup।"
   },
   {
    "t": "p",
    "x": "**কে কী দেখবেন:** বাম পাশের menu-তে শুধু সেই module-গুলোই দেখা যায় যেগুলো আপনার role-এ অনুমতি আছে। এই SOP-এর কোনো module আপনার menu-তে না থাকলে বুঝবেন আপনার access নেই। Admin-কে জানান; কখনো অন্যের login ব্যবহার করবেন না।"
   },
   {
    "t": "table",
    "head": [
     "Role",
     "মূল কাজ",
     "সাধারণত যে Module দেখা যায়"
    ],
    "rows": [
     [
      "Super Admin",
      "System owner (IT)",
      "সব module, Backup & Restore এবং সব Delete button সহ"
     ],
     [
      "Admin",
      "Store / Factory Manager",
      "সব module; Approvals-এ request অনুমোদন করেন; Backup শুধু অনুমতি দেওয়া থাকলে"
     ],
     [
      "Inventory",
      "Store Keeper",
      "Dashboard, Inventory, Stock In & Out (শুধু Stock IN), Pending Items, Warehouses, Challan Receipt, Requisition, Approvals (দেখা), Reports, Settings; Admin অনুমতি দিলে Production"
     ],
     [
      "Challan",
      "Dispatch / Delivery Desk",
      "Dashboard, Create Challan, Challan Receipt, Finance, Gate Pass, Approvals (দেখা), Reports, Settings; Admin অনুমতি দিলে Issue"
     ],
     [
      "Merchandiser",
      "Order / Item তৈরি",
      "Dashboard, Inventory, Stock In & Out, Warehouses, Requisition (দেখা), Reports, Settings"
     ],
     [
      "Operator",
      "সাধারণ Data Entry",
      "Inventory ও Challan-এর কাজ, Reports (দেখা)"
     ],
     [
      "Monitoring",
      "Audit / Management View",
      "সব জায়গায় শুধু দেখা (Read-only)"
     ]
    ]
   },
   {
    "t": "p",
    "x": "Admin চাইলে কোনো একজন user-কে আলাদা (custom) permission দিতে পারেন (Settings > Users)। সেক্ষেত্রে উপরের role-এর default access-এর বদলে সেই permission কাজ করবে।"
   }
  ]
 },
 {
  "id": "part-2",
  "group": "start",
  "badge": "2",
  "label": "এক নজরে মালামালের প্রবাহ",
  "title": "2. এক নজরে মালামালের প্রবাহ",
  "blocks": [
   {
    "t": "p",
    "x": "এই SOP-এর প্রতিটি module নিচের প্রবাহের একেকটি ধাপ। Stock-এর পরিমাণ শুধু **নীল ৫টি ধাপে** বাড়ে বা কমে; Approval, Gate Pass, Receipt ও Bill শুধু রেকর্ড রাখে বা নিয়ন্ত্রণ করে।"
   },
   {
    "t": "img",
    "f": "flow",
    "cap": "চিত্র: KADAL-এ মালামালের প্রবাহ (৩টি ধাপ-সারি, ১১টি কাজ)",
    "h": 958,
    "w": 1400
   },
   {
    "t": "p",
    "x": "কেনা (Source) item, Stock IN-এর পর production ছাড়াই সরাসরি challan-এ যেতে পারে।"
   }
  ]
 },
 {
  "id": "part-3",
  "group": "start",
  "badge": "3",
  "label": "শুরু করা",
  "title": "3. শুরু করা",
  "blocks": [
   {
    "t": "warn",
    "x": "প্রতিদিনের কাজে **KADAL Inventory Desktop App** ব্যবহার করুন। Browser (web) version-এ Issue, Approvals, Pending Items ও Gate Pass চলে না, এবং PDF/Excel export হয় না।"
   },
   {
    "t": "h2",
    "x": "3.1 App খোলা"
   },
   {
    "t": "img",
    "f": "01_landing",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Desktop-এর **KADAL Inventory** icon-এ double-click করুন। প্রথমে কোম্পানির showcase page খুলবে।",
     "উপরে ডানে **Open App** অথবা মাঝখানের **Access Inventory System** button-এ click করুন; Login screen আসবে।"
    ]
   },
   {
    "t": "note",
    "x": "Showcase page-এর উপরের menu-তে **User Guideline**-এ click করলে এই নির্দেশিকাটি app-এর ভেতরেই খুলবে। এটি পড়তে Login লাগে না।"
   },
   {
    "t": "h2",
    "x": "3.2 Login করা"
   },
   {
    "t": "img",
    "f": "02_login",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "IT থেকে দেওয়া **Username** লিখুন।",
     "**Password** লিখুন। ঠিক লিখেছেন কিনা দেখতে চোখের (eye) icon-এ click করুন।",
     "**Remember Me** শুধু নিজের computer-এ tick দিন। (Admin-এর password কখনো save হয় না।)",
     "**Sign In** click করুন। সবুজ \"Welcome back\" message দেখলে বুঝবেন login হয়েছে।"
    ]
   },
   {
    "t": "p",
    "x": "নতুন কর্মী **Don't have an account? Create one** দিয়ে account খুলতে পারেন, কিন্তু Admin activate করে role না দেওয়া পর্যন্ত সেটি কাজ করবে না। **Reconfigure Cloud** কখনো চাপবেন না; এটি database থেকে app-কে বিচ্ছিন্ন করে দেয়, শুধু IT ব্যবহার করবে।"
   },
   {
    "t": "h2",
    "x": "3.3 Screen চেনা"
   },
   {
    "t": "img",
    "f": "03_dashboard",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**বাম পাশের Menu**: আপনি যে module-গুলো ব্যবহার করতে পারবেন। নীল বিন্দু (dot) মানে নতুন কিছু অপেক্ষা করছে (যেমন Approvals-এ request)। Settings ও Backup পেতে menu scroll করুন।",
     "**Top Bar**: Light/Dark mode, Home (showcase), Refresh (পুরো app reload) এবং আপনার নাম ও role।",
     "**Stock-এর হিসাব**: মোট item, বর্তমান stock, এবং BDT ও USD-তে stock-এর মূল্য।",
     "**Today's activity**: আজ যেগুলোতে নজর দিতে হবে (Module 1-এ বিস্তারিত)।",
     "**Refresh overview**: শুধু Dashboard-এর সংখ্যাগুলো reload করে।"
    ]
   },
   {
    "t": "h2",
    "x": "3.4 Logout করা"
   },
   {
    "t": "bullets",
    "x": [
     "Desk ছেড়ে যাওয়ার সময় বাম menu-এর নিচে **Logout** click করুন।",
     "Mouse বা keyboard **৩০ মিনিট** ব্যবহার না হলে app নিজে থেকেই logout করে দেয়। তখন save না করা form-এর data হারিয়ে যায়, তাই বিরতির আগে save করুন।",
     "Logout-এর নিচে app-এর version (যেমন v1.1.145) লেখা থাকে। কোনো সমস্যা জানানোর সময় version নম্বর উল্লেখ করুন।"
    ]
   }
  ]
 },
 {
  "id": "module-1",
  "group": "modules",
  "badge": "M1",
  "label": "Dashboard",
  "title": "Module 1 – Dashboard",
  "blocks": [
   {
    "t": "p",
    "x": "Login-এর পর প্রথম page হলো Dashboard (ছবি 3.3-এ দেখুন)। এখানে কিছু পরিবর্তন করা যায় না, শুধু দেখা যায়। প্রতি shift-এর শুরুতে ও শেষে একবার দেখে নিন।"
   },
   {
    "t": "table",
    "head": [
     "Widget",
     "অর্থ",
     "শূন্য না হলে করণীয়"
    ],
    "rows": [
     [
      "Low stock alerts",
      "Min Stock Level-এর সমান বা কম stock থাকা item",
      "Purchase বা production request দিন"
     ],
     [
      "Today's challans",
      "আজ তৈরি হওয়া delivery challan",
      "মাল বের হওয়ার আগে প্রতিটির gate pass আছে কিনা দেখুন"
     ],
     [
      "Waiting for gate pass",
      "যে active challan এখনো gate pass-এ ওঠেনি",
      "Gate pass তৈরি করুন (Module 10)"
     ],
     [
      "Pending returns",
      "যে issue পুরোপুরি ফেরত বা consume হয়নি",
      "Factory বা কর্মীর সাথে follow-up করুন"
     ],
     [
      "Overdue returns",
      "Expected return date পার হওয়া issue",
      "Store In-charge-কে জানান"
     ],
     [
      "Damaged / rejected",
      "Damaged বা rejected হিসেবে ফেরত আসা পরিমাণ",
      "কারণ খুঁজে report করুন"
     ]
    ]
   },
   {
    "t": "p",
    "x": "**Recent challans** table-এ শেষ ৫টি challan দেখা যায়; **Low stock alerts**-এ minimum level-এর নিচে থাকা সর্বোচ্চ ৮টি item লাল সংখ্যায় দেখায়।"
   }
  ]
 },
 {
  "id": "module-2",
  "group": "modules",
  "badge": "M2",
  "label": "Inventory (Item Master)",
  "title": "Module 2 – Inventory (Item Master)",
  "blocks": [
   {
    "t": "p",
    "x": "Inventory হলো প্রতিটি item-এর (raw material বা তৈরি accessory) তালিকা, যেখানে order-এর তথ্য, stock ও মূল্য থাকে। Search বা filter না দেওয়া পর্যন্ত তালিকা খালি থাকে; এতে screen দ্রুত চলে।"
   },
   {
    "t": "h2",
    "x": "M2.1 Item খোঁজা"
   },
   {
    "t": "img",
    "f": "04_inventory_list",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Search box-এ item-এর নাম, item code, style, order no. বা purchase no. লিখে **Search** click করুন।",
     "অথবা **Category, Style, Order, Purchase No** filter দিয়ে তালিকা ছোট করুন। Filter-এর ভেতরে টাইপ করলে দ্রুত value পাওয়া যায়; \"All...\" বাছলে filter মুছে যায়।",
     "**Add Item**: নতুন item তৈরি করে (Inventory-তে লেখার অনুমতি থাকা user)।",
     "প্রতি row-এর **Action icon**: Print Barcode (সবাই); Edit Item Details ও Edit Stock-In Info / price tier (শুধু Admin ও Super Admin); Delete (শুধু Super Admin)।"
    ]
   },
   {
    "t": "p",
    "x": "**Row কীভাবে পড়বেন:** **Stock** লাল হলে বুঝবেন minimum level-এর সমান বা নিচে। একই item ভিন্ন দামে বা ভিন্ন USD rate-এ এলে **Unit Price**-এ একাধিক badge দেখায় (প্রতিটি badge = একটি price tier)। USD item-এর **Total Value**-তে বন্ধনীতে BDT মূল্যও দেখায়। যেকোনো column header-এ click করলে sort হয়।"
   },
   {
    "t": "h2",
    "x": "M2.2 নতুন Item যোগ করা"
   },
   {
    "t": "img",
    "f": "05_item_form",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Item Origin** বাছুন: কেনা/import করা item হলে **Source**, আমাদের factory-তে তৈরি হলে **Production**।",
     "**Item Code** system নিজে তৈরি করে (KADAL-xxxx)। নিজে লেখার চেষ্টা করবেন না।",
     "**Category** বাছুন, তারপর **Size** ও **Color** লিখুন (box আগের ব্যবহৃত value suggest করে; একই বানান বাছুন)।",
     "**Buyer** বাছুন, তারপর **Style Name, Purchase No, Order Number ও Order Quantity** buyer PO-তে যেমন আছে হুবহু লিখুন।",
     "**Unit, Supplier (বা Factory), Min Stock Level, Opening Stock** (শুধু Source item) এবং currency সহ **Unit Price** দিন। USD হলে **Conversion Rate** (১ USD = কত BDT) দিন। তারপর **Create Item** click করুন।"
    ]
   },
   {
    "t": "p",
    "x": "* চিহ্নিত সব field বাধ্যতামূলক; কোনোটি বাদ গেলে লাল হয়ে যায় এবং item save হয় না। Approval চালু থাকলে \"Changes submitted for Admin approval\" message আসবে, আর Admin Approvals-এ অনুমোদন দেওয়ার পরই item Inventory-তে দেখা যাবে।"
   },
   {
    "t": "note",
    "x": "**Merchandiser user:** আপনার Source item-এ Opening Stock চাওয়া হয় না। Item প্রথমে **Pending Items**-এ যায়, store সেখানে opening stock দেয়, তারপর Admin-এর অনুমোদনে যায় (Module 4)। Production item সরাসরি Admin-এর অনুমোদনে যায়।"
   },
   {
    "t": "h2",
    "x": "M2.3 Item-এর Barcode / QR Label Print"
   },
   {
    "t": "p",
    "x": "Item row-এর printer icon-এ click করুন, **Barcode (1D)** অথবা **QR Code (2D)** বাছুন, **Copies to Print** লিখুন, তারপর **Print Labels** click করুন (বা ছবি save করতে download icon)।"
   }
  ]
 },
 {
  "id": "module-3",
  "group": "modules",
  "badge": "M3",
  "label": "Stock In & Out",
  "title": "Module 3 – Stock In & Out",
  "blocks": [
   {
    "t": "p",
    "x": "হাতে-কলমে প্রতিটি মাল গ্রহণ (Stock IN) বা কমানোর (Stock OUT) জন্য এই screen ব্যবহার করুন। Customer-কে delivery হয় Challan দিয়ে, আর factory-তে পাঠানো হয় Issue দিয়ে; এগুলো কখনো এখানে Stock OUT হিসেবে দেবেন না।"
   },
   {
    "t": "h2",
    "x": "M3.1 Item খোঁজা ও History দেখা"
   },
   {
    "t": "img",
    "f": "07_stock_inout",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Item code, নাম, style, order no., purchase no., color বা size দিয়ে search করে **Search** click করুন। প্রথম ফলাফলটি নিজে থেকেই খুলে যায়।",
     "যেকোনো row-এ click করে সেটি select করুন (রঙিন row)।",
     "Select করা item-এর **Stock IN / Stock OUT** button।",
     "**Movement History**: প্রতিটি IN/OUT-এর তারিখ, পরিমাণ, দাম, আগের ও পরের stock, reference এবং কে post করেছেন।"
    ]
   },
   {
    "t": "p",
    "x": "Inventory role-এর user শুধু **Stock IN** দেখেন। Stock OUT Admin পর্যায়ের user-দের জন্য।"
   },
   {
    "t": "h2",
    "x": "M3.2 Stock IN দেওয়া"
   },
   {
    "t": "img",
    "f": "08_stock_in_modal",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Quantity**: গুনে পাওয়া পরিমাণ (০-এর বেশি পূর্ণ সংখ্যা)।",
     "**Unit Price**: দাম না বদলালে বর্তমান দামই রাখুন। USD item হলে **Conversion Rate**-ও দেখুন। নিচের লাইন জানিয়ে দেয়: \"Same price & rate - will merge into one stock tier\" (একই tier-এ যোগ হবে) অথবা \"Different price - will track separately\" (আলাদা tier হবে)।",
     "**Reference**: GRN, supplier PO, delivery note বা production batch no. (সবসময় দিন; auditor এটি দিয়েই stock খোঁজেন)। প্রয়োজনে **Notes** লিখুন।",
     "**Confirm Stock IN** click করুন।"
    ]
   },
   {
    "t": "p",
    "x": "Stock OUT একইভাবে কাজ করে, তবে দামের field থাকে না। বর্তমান stock-এর চেয়ে বেশি Stock OUT system গ্রহণ করে না। \"Require Admin Approval for Stock Movements\" চালু থাকলে non-admin user-এর entry Approvals-এ অপেক্ষা করে, আর অনুমোদনের পরই stock বদলায়।"
   }
  ]
 },
 {
  "id": "module-4",
  "group": "modules",
  "badge": "M4",
  "label": "Pending Items",
  "title": "Module 4 – Pending Items",
  "blocks": [
   {
    "t": "p",
    "x": "Pending Items হলো Merchandiser-দের পাঠানো নতুন item-এর জন্য store-এর inbox। Store আসল opening stock দেয়, তারপর item চূড়ান্ত অনুমোদনের জন্য Admin-এর কাছে যায়।"
   },
   {
    "t": "img",
    "f": "09_pending_items",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Process**: merchandiser-এর দেওয়া তথ্যসহ item form খোলে।",
     "**Reject** (লাল X): request বাতিল করে (pop-up-এ confirm করুন)। Duplicate বা ভুল তথ্যের ক্ষেত্রে ব্যবহার করুন এবং merchandiser-কে কারণ জানান।"
    ]
   },
   {
    "t": "img",
    "f": "10_pending_process",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "প্রতিটি field buyer PO-এর সাথে মিলিয়ে নিন, ভুল থাকলে ঠিক করুন, এবং হাতে গুনে পাওয়া **Opening Stock** দিন।",
     "**Update** click করুন। \"Sent to Admin for final approval\" message আসবে; Admin **Approvals**-এ অনুমোদন দিলেই item তৈরি হবে।"
    ]
   }
  ]
 },
 {
  "id": "module-5",
  "group": "modules",
  "badge": "M5",
  "label": "Warehouses",
  "title": "Module 5 – Warehouses",
  "blocks": [
   {
    "t": "p",
    "x": "Warehouses জানায় stock **কোথায়** রাখা আছে: Warehouse > Zone (aisle/rack) > Bin (তাকের নির্দিষ্ট জায়গা)। এক warehouse থেকে আরেকটিতে মাল সরালে item-এর মোট stock বদলায় না।"
   },
   {
    "t": "h2",
    "x": "M5.1 Warehouse তালিকা"
   },
   {
    "t": "img",
    "f": "11_warehouses",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Add Warehouse**: নাম ও location দিন; code (WH-01, WH-02...) নিজে তৈরি হয়। শুধু একটি warehouse **Default** থাকে; নতুন stock সেখানেই জমা হয়।",
     "**Transfer Stock**: এক warehouse থেকে আরেকটিতে পরিমাণ সরান (M5.3 দেখুন)।",
     "**Total Stock**: ঐ warehouse-এ কোন item কত আছে।",
     "**Manage Layout**: ঐ warehouse-এর zone ও bin।"
    ]
   },
   {
    "t": "p",
    "x": "Pencil icon দিয়ে warehouse edit করা যায়, bin icon দিয়ে delete। Default warehouse এবং যে warehouse-এ এখনো stock আছে, সেগুলো delete করা যায় না।"
   },
   {
    "t": "h2",
    "x": "M5.2 Zone ও Bin"
   },
   {
    "t": "img",
    "f": "12_warehouse_layout",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Add Zone**: যেমন \"Aisle A - Threads\" (আগে zone তৈরি করুন)।",
     "**Add Bin**: zone-এর ভেতরে bin-এর নাম, barcode ও capacity।",
     "কোনো **bin card**-এ click করলে সেখানে কোন item রাখা আছে দেখা যায়। উপরে **Grid Map** ও **List View**-এর মধ্যে বদলানো যায়।"
    ]
   },
   {
    "t": "h2",
    "x": "M5.3 Warehouse-এর মধ্যে Stock Transfer"
   },
   {
    "t": "img",
    "f": "13_stock_transfer",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Item search করে select করুন।",
     "**From** warehouse (সেখানে কত আছে দেখায়) ও **To** warehouse বাছুন।",
     "পরিমাণ লিখুন (যা আছে তার বেশি নয়) এবং **Transfer Stock** click করুন।",
     "একই সময়ে মালও সরিয়ে ফেলুন, যাতে system আর তাক সমান থাকে।"
    ]
   }
  ]
 },
 {
  "id": "module-6",
  "group": "modules",
  "badge": "M6",
  "label": "Create Challan ও Challan History",
  "title": "Module 6 – Create Challan ও Challan History",
  "blocks": [
   {
    "t": "p",
    "x": "Delivery challan হলো store থেকে মাল বের হওয়ার আইনগত কাগজ। Challan save করলেই সাথে সাথে stock কমে যায় এবং buyer order-এর বিপরীতে delivered পরিমাণ রেকর্ড হয়।"
   },
   {
    "t": "h2",
    "x": "M6.1 Challan পূরণ করা"
   },
   {
    "t": "img",
    "f": "14_challan_form",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Link to Proforma Invoice (PI)**: মাল কোনো PI-এর বিপরীতে গেলে PI বাছুন। Delivery-টি Challan Receipt-এ এবং পরে Commercial Bill-এ আনতে হলে এটি বাধ্যতামূলক। সাধারণ dispatch হলে শুধু \"No PI Linked\" রাখুন।",
     "**Import Items from PI**: PI-এর item-গুলো এনে দেয় এবং receiver নিজে থেকে বসিয়ে দেয়।",
     "**Select Receiver**: managed receiver তালিকা থেকে factory বা কর্মী বাছুন। Contact ও address নিজে বসে; দরকার হলে ঠিক করুন।",
     "**Browse Inventory**: আরো item যোগ করুন (M6.2 দেখুন)।",
     "**Quantity**: প্রতিটি লাইনে কত deliver হবে লিখুন। Column গুলো মিলিয়ে নিন: **Order Qty**, **Delivered** (এই challan সহ), **Stock** ও **Balance** (order qty থেকে delivered বাদ)। Balance লাল মানে order-এর চেয়ে বেশি deliver করছেন।",
     "**Preview Challan**: print-এর চেহারা দেখুন (M6.3)।",
     "**Create Challan**: save করে। Save-এর আগে উপরের **Notes**-এ PI no., lot, carton-এর তথ্য লিখুন।"
    ]
   },
   {
    "t": "p",
    "x": "অন্য module-এ গেলেও form-এ লেখা তথ্য থেকে যায়; নতুন করে শুরু করতে **Clear Form** ব্যবহার করুন।"
   },
   {
    "t": "h2",
    "x": "M6.2 Inventory থেকে Item যোগ করা"
   },
   {
    "t": "img",
    "f": "15_challan_browser",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "নাম, code, style, order বা purchase no. দিয়ে search করুন, অথবা Category/Buyer/Style/Order/Size/Color filter ব্যবহার করুন।",
     "প্রতিটি item-এর **+ Add** click করুন। প্রতিটি লাইন quantity 1 দিয়ে যোগ হয়; form-এ গিয়ে পরিমাণ বদলান। শূন্য stock-এর item যোগ করা যায় না; **Pending Approval** লেখা item আগেই অনুমোদনের অপেক্ষায় থাকা কোনো challan-এ আছে।",
     "**Done** click করুন।"
    ]
   },
   {
    "t": "h2",
    "x": "M6.3 Preview, Print ও Confirm"
   },
   {
    "t": "img",
    "f": "16_challan_preview",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Print Challan**: preview সরাসরি print করে।",
     "**Edit More**: ফিরে গিয়ে form বদলান।",
     "**Confirm & Create Challan**: challan save করে।"
    ]
   },
   {
    "t": "warn",
    "x": "হলুদ লাইন \"It seems items are duplicate\" আসে যখন দুইটি লাইনের item-এর নাম ও size একই (যেমন একই drawstring দুই রঙে)। ভালো করে দেখে নিন; দুটি লাইনই সঠিক হলে তবেই confirm করুন।"
   },
   {
    "t": "p",
    "x": "Column/row-এর border টেনে বা Compact / Normal / Spacious বেছে print-এর মাপ ঠিক করা যায়। Save-এর পর: আপনি Admin হলে challan number (যেমন KA-00249) তৈরি হয়, PDF খোলে এবং Challan History আসে। \"Require Admin Approval for all Challans\" চালু থাকলে এবং আপনি Admin না হলে \"Request submitted for Admin approval\" message আসে, আর অনুমোদনের পরই stock কমে।"
   },
   {
    "t": "h2",
    "x": "M6.4 Challan History"
   },
   {
    "t": "note",
    "x": "Challan History বাম menu-তে নেই। Challan save করার পর এটি নিজে থেকে খোলে। পুরনো challan যেকোনো সময় দেখতে **Reports > Challan History** ব্যবহার করুন (Module 14)।"
   },
   {
    "t": "img",
    "f": "17_challan_history",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Challan no. বা receiver দিয়ে search করুন; status (Active / Inactive) দিয়ে filter করুন।",
     "তারিখের quick filter: **Today**, কোনো **Month**, **This Year**, অথবা from-to তারিখ।",
     "Filter করা তালিকা **Excel** বা **PDF**-এ export করুন।",
     "Row action: View, PDF download, Delete (শুধু Super Admin)।"
    ]
   },
   {
    "t": "img",
    "f": "18_challan_detail",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Export PDF**: challan আবার print করুন (এতে QR code থাকে, scan করলে online verification page খোলে)।",
     "**Cancel**: pop-up-এ কারণ লিখে confirm করুন। Challan Inactive হয়ে যায় এবং **stock ফেরত আসে**। ভুল challan ঠিক করতে সবসময় Cancel ব্যবহার করুন।"
    ]
   },
   {
    "t": "warn",
    "x": "**Delete** (শুধু Super Admin) record স্থায়ীভাবে মুছে দেয় এবং stock **ফেরত দেয় না**। এটি শুধু data পরিষ্কারের জন্য, ভুল সংশোধনের জন্য কখনো নয়।"
   }
  ]
 },
 {
  "id": "module-7",
  "group": "modules",
  "badge": "M7",
  "label": "Challan Receipt",
  "title": "Module 7 – Challan Receipt",
  "blocks": [
   {
    "t": "p",
    "x": "গ্রহণকারী পক্ষ (যেমন K.A. Design Wear-এর store) এখানে নিশ্চিত করে আসলে কী পৌঁছেছে। শুধু PI-এর সাথে link করা challan এখানে আসে। গৃহীত পরিমাণ PI reconciliation-এ যায়, তাই PI-এর সব মাল ১০০% গৃহীত হওয়ার পরই bill করা যায়।"
   },
   {
    "t": "h2",
    "x": "M7.1 গ্রহণের জন্য Challan খোঁজা"
   },
   {
    "t": "img",
    "f": "19_challan_receipt",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "সারসংক্ষেপ card: **Awaiting Receipt, Fully Received, Shortages / Discrepancies, Total Dispatched**।",
     "Status tab: **Pending Receipt, Fully Received, Shortage, All**। Challan no., receiver, PI no. বা style দিয়ে search করুন।",
     "**Receive Goods**: pending challan-এর জন্য (shortage challan-এ **Update Qty**)।",
     "চোখের icon: **Receipt Slip** দেখা ও print করা।"
    ]
   },
   {
    "t": "h2",
    "x": "M7.2 মাল গ্রহণ করা"
   },
   {
    "t": "img",
    "f": "20_receive_goods",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "আগে মাল গুনে নিন। সব মিলে গেলে **Set All Received = Shipped Qty** click করুন।",
     "না মিললে প্রতিটি লাইনে আসল **Received Qty** লিখুন; **Shortage** column নিজে হিসাব করে লাল দেখায়।",
     "**Received By** (আপনার নাম/পদবি) ও **Receiving Date** দিন। ক্ষতি বা ঘাটতি **Receiver Remarks**-এ লিখুন।",
     "**Confirm Receipt & Update Status** click করুন। সব লাইন মিললে status **Received**, কোনো লাইনে কম হলে **Shortage** হয়।"
    ]
   },
   {
    "t": "p",
    "x": "Shortage challan, Shortage tab-এ থেকে যায়। বাকি মাল পৌঁছালে **Update Qty** দিয়ে খুলে নতুন গৃহীত পরিমাণ লিখুন।"
   }
  ]
 },
 {
  "id": "module-8",
  "group": "modules",
  "badge": "M8",
  "label": "Finance (Proforma Invoice ও Commercial Bill)",
  "title": "Module 8 – Finance (Proforma Invoice ও Commercial Bill)",
  "blocks": [
   {
    "t": "p",
    "x": "Finance একটি order-কে দাম ঠিক করা থেকে bill পর্যন্ত অনুসরণ করে: **PI তৈরি > PI-linked challan-এ delivery > গ্রহীতার receipt নিশ্চিত > PI ১০০% > Commercial Bill-এ transfer**। Permission অনুযায়ী কেউ শুধু PI অংশ বা শুধু Bills অংশ দেখতে পারেন।"
   },
   {
    "t": "h2",
    "x": "M8.1 Proforma Invoice (PI) তৈরি"
   },
   {
    "t": "p",
    "x": "**Finance > Proforma Invoices (PI) > Create Proforma Invoice** খুলুন।"
   },
   {
    "t": "img",
    "f": "25_finance_create_pi",
    "h": 875,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Recipient / Applicant Factory** বাছুন; ঠিকানা নিজে বসে যায়। তারপর **PI Date, Buyer Name** ও **Currency** (USD, BDT বা EUR) দিন।",
     "**Proforma Invoice No.** নিজে suggest হয় (যেমন KADWL/KADAL/2026/16)। Management নির্দিষ্ট নম্বর দিলে তবেই নিজে লিখুন; **Auto-Generate** আবার suggest করা নম্বর ফিরিয়ে আনে।",
     "**Load from Order / Load from Purchase Order**: order no. বা purchase no. দিয়ে inventory থেকে item লাইন আনে (নিচে দেখুন)।",
     "**Add Line Item**: হাতে লাইন যোগ করুন; ঐ লাইনের **Link Item** দিয়ে inventory item-এর সাথে যুক্ত করুন। প্রতিটি লাইনের **Order Qty** ও **Unit Price** মিলিয়ে নিন; total ও **Amount in Words** নিজে হিসাব হয়।",
     "**Preview Proforma Invoice**: print হওয়া PI দেখে নিন।",
     "**Confirm & Approve Proforma Invoice**: PI save করে, status হয় Approved / In Production।"
    ]
   },
   {
    "t": "p",
    "x": "Confirm-এর আগে **Net Weight, Gross Weight, Terms and Conditions** ও **Beneficiary BIN** মিলিয়ে নিন।"
   },
   {
    "t": "img",
    "f": "24_finance_load_order",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "তালিকা থেকে order number (বা purchase order) বাছুন, অথবা টাইপ করে Enter চাপুন।",
     "যে item নিতে চান সেগুলোতে tick দিন (**Select All**-ও আছে)।",
     "**Add to PI** click করুন, তারপর **Close Modal**।"
    ]
   },
   {
    "t": "h2",
    "x": "M8.2 PI অনুসরণ ও Reconcile"
   },
   {
    "t": "img",
    "f": "21_finance_pi_list",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Proforma Invoices (PI)** tab: সব PI, order qty, received qty এবং **Receipt Match** bar সহ। Status: **Production** (পুরো গৃহীত হয়নি), **Ready to Bill** (১০০% গৃহীত), **Billed**।",
     "**Create Proforma Invoice**: M8.1-এর form খোলে।",
     "**Reconcile**: item ধরে ধরে ordered, dispatched ও received মিলিয়ে দেখা।",
     "**Commercial Bills & Invoices** tab (M8.4)।"
    ]
   },
   {
    "t": "p",
    "x": "Row-এর অন্য icon: View, Print, Edit PI Number, Export PDF, Delete। Delete শুধু bill হওয়ার আগে করা যায়; এতে PI-এর challan-গুলোর link খুলে যায়।"
   },
   {
    "t": "img",
    "f": "22_finance_reconcile",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "প্রতিটি লাইনে **Matched** এবং উপরের banner-এ ১০০% received দেখালে **Transfer to Commercial Bill** click করুন। তার আগে button লুকানো থাকে এবং কেন, তা সতর্কবার্তায় লেখা থাকে।"
    ]
   },
   {
    "t": "h2",
    "x": "M8.3 Commercial Bill-এ Transfer"
   },
   {
    "t": "img",
    "f": "23_finance_transfer",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "PI, applicant, buyer ও amount মিলিয়ে নিন।",
     "Suggest করা **Commercial Bill Number** রাখুন (অথবা accounts-এর অনুমোদিত নম্বর লিখুন)।",
     "**Commercial Bill Date** দিয়ে **Confirm & Transfer to Bill** click করুন। PI-এর status হয় **Billed**।"
    ]
   },
   {
    "t": "h2",
    "x": "M8.4 Commercial Bills"
   },
   {
    "t": "img",
    "f": "26_finance_bills",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**View / Print**: কোম্পানির letterhead-এ bill খোলে।",
     "**Edit Bill #**: accounts চাইলে bill নম্বর ঠিক করুন। **PDF** দিয়ে copy save করুন।"
    ]
   },
   {
    "t": "img",
    "f": "27_finance_bill_print",
    "h": 833,
    "w": 1400
   },
   {
    "t": "p",
    "x": "Preview-তে **Print Bill** বা **Export PDF** ব্যবহার করুন। PI-এর সাথে link করা challan নম্বরগুলো bill-এ নিজে থেকে ছাপা হয়।"
   }
  ]
 },
 {
  "id": "module-9",
  "group": "modules",
  "badge": "M9",
  "label": "Approvals",
  "title": "Module 9 – Approvals",
  "blocks": [
   {
    "t": "p",
    "x": "কোনো approval নিয়ম চালু থাকলে (Settings > Company), non-admin user-এর কাজ এখানে অপেক্ষা করে, আর Admin বা Super Admin অনুমোদন না দেওয়া পর্যন্ত stock-এ কিছুই বদলায় না। অন্য user-রা নিজের request-এর অবস্থা দেখতে এই page খুলতে পারেন; Approve ও Reject button শুধু Admin দেখেন।"
   },
   {
    "t": "table",
    "head": [
     "Request (Module column)",
     "কোথা থেকে আসে",
     "\"Approve & Execute\" কী করে"
    ],
    "rows": [
     [
      "Inventory (নতুন/পরিবর্তিত item)",
      "Inventory, Pending Items",
      "Item তৈরি বা update করে"
     ],
     [
      "Stock",
      "Stock In & Out",
      "Stock movement post করে"
     ],
     [
      "Challan",
      "Create Challan",
      "Challan তৈরি করে ও stock কমায়"
     ],
     [
      "Gate Pass",
      "Gate Pass",
      "Gate pass তৈরি করে"
     ],
     [
      "Issue / Reissue",
      "Issue",
      "Issue তৈরি করে (বা item যোগ করে) ও stock কমায়"
     ]
    ]
   },
   {
    "t": "img",
    "f": "28_approvals",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Pending Approvals**: সিদ্ধান্তের অপেক্ষায় থাকা request (সংখ্যা tab-এ দেখায়; menu-তে নীল dot আসে)।",
     "**Recent History**: অনুমোদিত ও বাতিল request, admin-এর note এবং তৈরি হওয়া document সহ।",
     "**Review Details**: request খোলে।"
    ]
   },
   {
    "t": "img",
    "f": "29_approval_review",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Request-এর তথ্য (receiver, item, পরিমাণ) পড়ুন। কারণ **Decision Notes**-এ লিখুন; এটি request দাতা দেখতে পান।",
     "**Reject Request**: কিছুই post হয় না। বাতিল challan বা gate pass \"-REJ\" নম্বর দিয়ে রেকর্ড থাকে, যাতে নম্বরের ধারাবাহিকতা ঠিক থাকে।",
     "**Approve & Execute**: transaction post করে। Challan-এর দুইটি লাইন duplicate মনে হলে system আবার সতর্ক করে।"
    ]
   },
   {
    "t": "p",
    "x": "Item request-এর ক্ষেত্রে Admin অনুমোদনের আগে **Edit Data** দিয়ে তথ্য ঠিক করতে পারেন। **Later** সিদ্ধান্ত ছাড়াই window বন্ধ করে। Request অনুমোদিত বা বাতিল হলে request দাতা pop-up message পান।"
   }
  ]
 },
 {
  "id": "module-10",
  "group": "modules",
  "badge": "M10",
  "label": "Gate Pass",
  "title": "Module 10 – Gate Pass",
  "blocks": [
   {
    "t": "p",
    "x": "Gate pass ছাড়া কোনো মাল গেট পার হবে না। একই গাড়িতে যাওয়া একাধিক challan একটি gate pass-এ যায়, সাথে থাকে packaging-এর সংখ্যা যা security guard মিলিয়ে দেখেন।"
   },
   {
    "t": "h2",
    "x": "M10.1 Gate Pass তৈরি"
   },
   {
    "t": "img",
    "f": "30_gatepass_create",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Search Challan Number** box-এ click করুন (সাম্প্রতিক challan আসে) অথবা challan no. টাইপ করুন, তারপর গাড়িতে থাকা প্রতিটি challan-এর **Add +** click করুন। শুধু active এবং অন্য gate pass-এ না থাকা challan দেখায়।",
     "**Selected Challans Preview**: তালিকা মিলিয়ে নিন; ভুলটি লাল bin দিয়ে সরান।",
     "Packaging-এর সংখ্যা দিন: **Poly Bags, Cartoon Boxes, Plastic Bags**। Preview-তে মোট challan ও package দেখায়।",
     "**Create & Print Gate Pass** click করুন। PDF print-এর জন্য খোলে (gate pass approval চালু থাকলে request Approvals-এ যায়)।"
    ]
   },
   {
    "t": "p",
    "x": "ছাপা gate pass-এ সই করে মালের সাথে security-কে দিন। কাগজের package সংখ্যা আর system-এর সংখ্যা অবশ্যই মিলতে হবে।"
   },
   {
    "t": "h2",
    "x": "M10.2 Gate Pass History"
   },
   {
    "t": "img",
    "f": "31_gatepass_history",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Print**: যেকোনো gate pass আবার print করুন। **-REJ** দিয়ে শেষ হওয়া নম্বর বাতিল হয়েছে; ওগুলো দিয়ে মাল বের করা যাবে না।"
    ]
   },
   {
    "t": "p",
    "x": "শুধু Super Admin gate pass delete করতে পারেন; delete করলে এর challan-গুলো নতুন gate pass-এর জন্য মুক্ত হয়।"
   }
  ]
 },
 {
  "id": "module-11",
  "group": "modules",
  "badge": "M11",
  "label": "Requisition",
  "title": "Module 11 – Requisition",
  "blocks": [
   {
    "t": "p",
    "x": "Requisition হলো store থেকে মালের অভ্যন্তরীণ চাহিদাপত্র (যেমন machine maintenance-এর thread বা merchandising-এর sample)। Status চলে **Pending > Approved > Fulfilled**, অথবা শেষ হয় Rejected / Cancelled হয়ে। শুধু **Fulfill**-এর সময় stock কমে।"
   },
   {
    "t": "h2",
    "x": "M11.1 Requisition তালিকা"
   },
   {
    "t": "img",
    "f": "32_requisition_list",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**New Requisition**: Admin, Operator ও Inventory user তৈরি করতে পারেন।",
     "বিস্তারিত দেখতে **Req. No** (যেমন REQ-0012) click করুন।",
     "সবুজ tick: **Approve** (শুধু Admin / Super Admin, Pending request-এ)।",
     "তীর (arrow) icon: **Fulfill**, প্রতিটি লাইনের stock কমায়।"
    ]
   },
   {
    "t": "p",
    "x": "উপরে status ও তারিখ দিয়ে filter করুন; PDF ও Excel icon requisition slip print করে।"
   },
   {
    "t": "h2",
    "x": "M11.2 Requisition তৈরি"
   },
   {
    "t": "img",
    "f": "33_requisition_form",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Requester Name** (বাধ্যতামূলক), **Department** ও **Requisition Date**।",
     "**Recipient / Section**: কে মাল পাবেন (ঐচ্ছিক)। **Purpose** পরিষ্কার করে লিখুন।",
     "**Browse Inventory**: search করে প্রতিটি item-এর **+ Add** click করুন (নিচের ছবি), তারপর window বন্ধ করুন।",
     "**Req. Qty**: প্রতিটি লাইনে কত লাগবে; পাশে **In Stock** দেখে নিন।",
     "**Submit Requisition** click করুন। নম্বর (REQ-xxxx) নিজে থেকে বসে।"
    ]
   },
   {
    "t": "img",
    "f": "33a_requisition_browser",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Item টাইপ করে search করুন।",
     "**+ Add** click করুন। শূন্য stock-এর item যোগ করা যায় না।"
    ]
   },
   {
    "t": "h2",
    "x": "M11.3 Approve ও Fulfill"
   },
   {
    "t": "img",
    "f": "34_requisition_detail",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Approve**: Admin request নিশ্চিত করেন।",
     "**Fulfill (Deduct Stock)**: মাল হাতে দেওয়ার সময়ই এটি click করুন। Approved quantity দেওয়া থাকলে সেটি, না থাকলে requested quantity ব্যবহার হয়। কোনো লাইনে stock কম থাকলে কিছুই কাটা হয় না।",
     "**Reject** (Admin) অথবা **Cancel**: stock না কেটে request বন্ধ করে।",
     "**PDF / Excel**: গ্রহীতার সইয়ের জন্য slip print করুন।"
    ]
   },
   {
    "t": "p",
    "x": "শুধু Super Admin requisition delete করতে পারেন; fulfilled requisition delete করলে stock ফেরত আসে।"
   }
  ]
 },
 {
  "id": "module-12",
  "group": "modules",
  "badge": "M12",
  "label": "Issue ও Returns",
  "title": "Module 12 – Issue ও Returns",
  "blocks": [
   {
    "t": "p",
    "x": "Issue দিয়ে store থেকে raw material কোনো **Factory** section-এ (finished product বানাতে) বা কোনো **Employee**-কে (tools, thread, spare item) পাঠানো হয়। Issue-এর সময়ই stock কমে। যা ফেরত আসে তার সব **Returns**-এ entry দিতে হয়।"
   },
   {
    "t": "h2",
    "x": "M12.1 Issue তালিকা"
   },
   {
    "t": "img",
    "f": "35_issue_list",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "Tab: **Issue Entry, Returns, Reports**।",
     "**New Issue**: issue form খোলে। Approvals-এ issue request অপেক্ষায় থাকলে হলুদ লাইনে সতর্ক করে।",
     "সম্পূর্ণ বিবরণ দেখতে **Issue ID** (ISS-xxxx) click করুন।",
     "Row icon: PDF issue paper, Excel, Delete (Admin; stock ফেরত আসে)।"
    ]
   },
   {
    "t": "p",
    "x": "Status-এর রঙ: **Pending** = এখনো কিছু ফেরত বা consume হয়নি, **Partial** = কিছু নিষ্পত্তি হয়েছে, **Returned** = পুরোপুরি নিষ্পত্তি।"
   },
   {
    "t": "h2",
    "x": "M12.2 Issue তৈরি"
   },
   {
    "t": "img",
    "f": "36_issue_form",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Recipient** বাছুন। Employee হলে **Returnable** অথবা **Non-Returnable**-ও বাছুন।",
     "**Expected Return Date**: যে তারিখে বাকি মাল ফেরত আসার কথা (non-returnable-এ লাগে না)।",
     "শুধু Factory issue-এ: **Add Target Product**, অর্থাৎ এই মাল দিয়ে কোন finished item তৈরি হবে (নিচের ছবি)। এই link বাধ্যতামূলক; পরে Production এটি ব্যবহার করে।",
     "**Browse Inventory**: raw material যোগ করুন।",
     "**Qty**: কত issue হবে; দেখানো **Stock**-এর বেশি হবে না।",
     "**Remarks** (lot, buyer) লিখে **Create Issue** click করুন। Issue approval চালু থাকলে এটি Approvals-এ অপেক্ষা করবে।"
    ]
   },
   {
    "t": "img",
    "f": "36a_target_product",
    "h": 833,
    "w": 1400
   },
   {
    "t": "p",
    "x": "Finished product search করে প্রতিটির **Add** click করুন, তারপর **Done**।"
   },
   {
    "t": "h2",
    "x": "M12.3 Issue-এর বিবরণ ও Re-issue"
   },
   {
    "t": "img",
    "f": "37_issue_detail",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Reissue Items**: একই issue-তে আরো মাল যোগ করুন (যেমন অতিরিক্ত yarn)। Default নিয়মে re-issue-তে Admin-এর অনুমোদন লাগে।",
     "**Print PDF**: গ্রহীতার সইয়ের জন্য issue paper।"
    ]
   },
   {
    "t": "p",
    "x": "বিবরণে প্রতিটি material-এর issued, returned, consumed (production-এ) ও **outstanding** পরিমাণ এবং এই issue থেকে তৈরি finished goods দেখা যায়।"
   },
   {
    "t": "h2",
    "x": "M12.4 Return Entry"
   },
   {
    "t": "img",
    "f": "38_issue_return",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Select Issue**: শুধু Pending ও Partial issue দেখায়। **Return Date** ও Remarks দিন।",
     "**Good Qty**: ব্যবহারযোগ্য ফেরত মাল; এটি **stock-এ যোগ হয়**।",
     "**Damaged**: রেকর্ড হয়, stock-এ যোগ হয় না।",
     "**Rejected**: রেকর্ড হয়, stock-এ যোগ হয় না।",
     "**Process Return** click করুন। Good + Damaged + Rejected মিলে **Remaining**-এর বেশি হতে পারবে না।"
    ]
   },
   {
    "t": "p",
    "x": "**Reports** tab-এ Issue Report, Return Report, Employee Outstanding এবং Issue vs Return Summary পাওয়া যায়, প্রতিটি Excel/PDF-এ export করা যায়।"
   }
  ]
 },
 {
  "id": "module-13",
  "group": "modules",
  "badge": "M13",
  "label": "Production",
  "title": "Module 13 – Production",
  "blocks": [
   {
    "t": "p",
    "x": "Production-এ লেখা হয় কোনো factory section একটি issue থেকে কত finished goods তৈরি করেছে। Batch log করলে **finished product stock-এ যোগ হয়**, আর final reconciliation-এ ঐ issue-এর raw material-এর হিসাব মিটে যায়। Admin ব্যবহার করেন; \"Allow Inventory Role Users to access Production\" চালু থাকলে Inventory user-ও পারেন।"
   },
   {
    "t": "h2",
    "x": "M13.1 Production Batch Log করা"
   },
   {
    "t": "img",
    "f": "40_production_entry",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Fractional (Output Only)**: order চলাকালীন প্রতিদিনের উৎপাদনের জন্য। শুধু finished quantity দেওয়া হয়; raw material outstanding থেকে যায়।",
     "**Final Reconciliation (Consume Materials)**: order শেষ হলে একবার ব্যবহার করুন। প্রতিটি raw material-এর **Consume Qty** ও **Wastage Qty** দিন; **Return Qty** নিজে হিসাব হয় (remaining - consumed - wastage) এবং stock-এ ফেরত যায়। Consumed + wastage, remaining-এর বেশি হতে পারবে না।",
     "**Active Factory Issue**: issue (ISS-xxxx) বাছুন। ডানে এর target finished product আসে। কিছু না এলে বুঝবেন issue-তে target product নেই; আগে issue ঠিক করুন।",
     "প্রতিটি finished product-এর **Production Quantity** (ভালো তৈরি পিস) ও **Wastage Quantity** দিন।",
     "**Production Remarks** লিখে **Log Batch Production & Stock In** click করুন।"
    ]
   },
   {
    "t": "h2",
    "x": "M13.2 History ও Report"
   },
   {
    "t": "img",
    "f": "41_production_history",
    "h": 833,
    "w": 1400
   },
   {
    "t": "p",
    "x": "**Production History** প্রতিটি batch (PRD-xx) দেখায়: issue, factory, item, buyer, produced ও wastage পরিমাণ। তারিখ (Today, This Month, This Year, কোনো মাস বা range), factory, product, buyer, category, style, order বা purchase no. দিয়ে filter করে Excel বা PDF-এ export করুন। শুধু Super Admin batch delete করতে পারেন, এতে finished stock কমে এবং material consumption উল্টে যায়।"
   },
   {
    "t": "img",
    "f": "42_production_report",
    "h": 833,
    "w": 1400
   },
   {
    "t": "p",
    "x": "**Production Report** বাছাই করা factory, product, category ও তারিখের জন্য মোট উৎপাদন, মোট wastage ও finished item-এর সংখ্যা দেখায়।"
   }
  ]
 },
 {
  "id": "module-14",
  "group": "modules",
  "badge": "M14",
  "label": "Reports",
  "title": "Module 14 – Reports",
  "blocks": [
   {
    "t": "p",
    "x": "Report শুধু দেখার জন্য; meeting ও audit-এর জন্য প্রতিটি Excel বা PDF-এ export করা যায়।"
   },
   {
    "t": "img",
    "f": "43_reports_stock",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Report tab**: report বাছুন (নিচের table)। Monthly Report ও Audit Report পেতে tab-এর সারি ডানে scroll করুন।",
     "**Filter**: search, Buyer, Style, Order, Purchase No, Category; challan report-এ Status, Recipient ও তারিখও আছে।",
     "**Excel**: screen-এ যা filter করা আছে ঠিক তাই export করে।",
     "**PDF**: একই, print-যোগ্য PDF হিসেবে।"
    ]
   },
   {
    "t": "table",
    "head": [
     "Report",
     "ব্যবহার"
    ],
    "rows": [
     [
      "Current Stock",
      "প্রতিটি item-এর stock, price tier ও মূল্য"
     ],
     [
      "Stock Movement",
      "Item অনুযায়ী মোট IN / OUT এবং order quantity-এর বিপরীতে balance"
     ],
     [
      "Low Stock",
      "Minimum level-এর সমান বা নিচে থাকা item (purchase planning)"
     ],
     [
      "Challan History",
      "প্রতিটি challan লাইন; প্রয়োজনে এখান থেকে challan cancel"
     ],
     [
      "Item Wise Challan Report",
      "একটি item-এর সব delivery"
     ],
     [
      "Daily Delivery Report",
      "একদিনের delivery, buyer অনুযায়ী BDT / USD মূল্যসহ"
     ],
     [
      "Item / Category Wise Delivery Summary",
      "Item বা category অনুযায়ী delivered পরিমাণ ও মূল্য"
     ],
     [
      "Monthly Report",
      "এক মাসের delivery (তারিখ সীমা দিন)"
     ],
     [
      "Audit Report",
      "নির্দিষ্ট তারিখে হাতে থাকা stock: Working Process (issued, এখনো ফেরত আসেনি), Finished Goods, Raw Material, মূল্যসহ"
     ]
    ]
   },
   {
    "t": "img",
    "f": "44_reports_challan",
    "h": 833,
    "w": 1400
   },
   {
    "t": "p",
    "x": "Reports-এর Challan History-তে প্রতিটি challan লাইন আলাদা row-তে দেখায়: order quantity, shipped, total out ও balance (লাল = order-এর বেশি পাঠানো)।"
   },
   {
    "t": "img",
    "f": "45_reports_audit",
    "h": 833,
    "w": 1400
   },
   {
    "t": "p",
    "x": "Audit Report-এ **Report Date** (যেমন মাসের শেষ দিন) দিন, তারপর কোনো card-এ click করে ঐ অংশের item তালিকা দেখুন ও export করুন।"
   }
  ]
 },
 {
  "id": "module-15",
  "group": "modules",
  "badge": "M15",
  "label": "Settings",
  "title": "Module 15 – Settings",
  "blocks": [
   {
    "t": "p",
    "x": "Settings-এ থাকে কোম্পানির তথ্য, approval-এর নিয়ম, user এবং master list যা অন্য সব module ব্যবহার করে। বেশিরভাগ user শুধু **Appearance** ও **System Update** দেখেন; বাকি tab Admin-দের জন্য।"
   },
   {
    "t": "h2",
    "x": "M15.1 Company ও Approval-এর নিয়ম"
   },
   {
    "t": "img",
    "f": "46_settings_company",
    "h": 1083,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Tab**: Company, Appearance, Users, Categories, Units, Suppliers, Buyers, Import Store Data, Cloud Sync, Receivers, System Update।",
     "**Approval Module Settings**: tick দিলে non-admin-এর challan, stock movement, gate pass, issue বা re-issue Admin-এর অনুমোদনের অপেক্ষায় থাকবে।",
     "**Access Control Override**: Challan user-কে Issue, বা Inventory user-কে Production ব্যবহারের অনুমতি দেয়।",
     "**Save Settings**: save না করা পর্যন্ত কিছুই বদলায় না।"
    ]
   },
   {
    "t": "p",
    "x": "একই tab-এ challan-এ ছাপা কোম্পানির নাম, logo ও ঠিকানা, **Challan Prefix**, **Low Stock Threshold**, **Public Web URL** এবং challan-এর **Barcode Format** (QR পরামর্শ দেওয়া হয়) ঠিক করা হয়।"
   },
   {
    "t": "h2",
    "x": "M15.2 User ও Permission"
   },
   {
    "t": "img",
    "f": "47_settings_users",
    "h": 822,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Add User**: username, পূর্ণ নাম, password ও role।",
     "Pencil icon: role বা permission বদলান। চাকরি ছেড়ে যাওয়া কর্মীর জন্য **Deactivate** ব্যবহার করুন; এতে history না হারিয়ে login বন্ধ হয়। Delete-এর বদলে এটিই ব্যবহার করুন।"
    ]
   },
   {
    "t": "img",
    "f": "48_user_form",
    "h": 1083,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**User Role**: default access ঠিক করে (অংশ 1 দেখুন)।",
     "**Access Permissions**: ঐ ব্যক্তির যে module লাগবে শুধু সেগুলোতে tick দিন। Finance-কে PI ও Commercial Bill-এ ভাগ করা যায়।",
     "**Settings Modules Access**: ব্যক্তি Settings-এর কোন tab খুলতে পারবেন।",
     "**Update** click করুন। পরিবর্তন দেখতে user-কে logout করে আবার login করতে হবে।"
    ]
   },
   {
    "t": "h2",
    "x": "M15.3 Master List"
   },
   {
    "t": "p",
    "x": "**Categories, Units, Suppliers ও Buyers** item form-এর drop-down-এ আসে। Item তৈরির আগে প্রতিটি value একবার, সঠিক বানানে যোগ করুন; একই buyer বা supplier-এর দ্বিতীয় বানান কখনো তৈরি করবেন না।"
   },
   {
    "t": "img",
    "f": "49_settings_receivers",
    "h": 649,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Add Receiver**: নাম, type (**FACTORY** বা **EMPLOYEE**), contact ও ঠিকানা। Receiver ব্যবহার হয় Challan, Issue, Requisition ও Finance-এ।"
    ]
   },
   {
    "t": "h2",
    "x": "M15.4 Import Store Data (একসাথে অনেক Item)"
   },
   {
    "t": "img",
    "f": "51_settings_import",
    "h": 736,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Sourcing Template** (কেনা item) বা **Production Template** download করে পূরণ করুন।",
     "**Excel File** বেছে **Select Excel File** click করুন (অথবা public **Google Sheet** link দিয়ে **Load Sheet**)।",
     "Preview ও mapped column মিলিয়ে নিয়ে **Import N Items** click করুন।"
    ]
   },
   {
    "t": "p",
    "x": "Column-গুলো header-এর নাম দেখে মেলানো হয়; গ্রহণযোগ্য header-এর নাম screen-এ দেওয়া আছে।"
   },
   {
    "t": "h2",
    "x": "M15.5 System Update ও Maintenance"
   },
   {
    "t": "img",
    "f": "52_settings_system",
    "h": 1083,
    "w": 1400
   },
   {
    "t": "warn",
    "x": "**Check for Updates** নতুন app version download করে install করে। লাল **Clear History** ও **Database Maintenance (Factory Reset)** button স্থায়ীভাবে data মুছে দেয়; শুধু Super Admin, management-এর লিখিত অনুমোদন এবং নতুন backup নেওয়ার পরই ব্যবহার করবেন। **Cloud Sync**-এ database connection থাকে; শুধু IT এটি বদলাবে।"
   }
  ]
 },
 {
  "id": "module-16",
  "group": "modules",
  "badge": "M16",
  "label": "Backup & Restore",
  "title": "Module 16 – Backup & Restore",
  "blocks": [
   {
    "t": "p",
    "x": "Backup, desktop app-এর local database file-এর পূর্ণ copy রাখে। Super Admin (এবং Backup permission পাওয়া user) দেখেন; শুধু desktop app-এ চলে।"
   },
   {
    "t": "img",
    "f": "53_backup",
    "h": 833,
    "w": 1400
   },
   {
    "t": "steps",
    "x": [
     "**Create Backup**: card-এ click করুন; নতুন file সাইজ ও সময়সহ Backup History-তে আসে।",
     "**Restore Backup**: backup file বাছুন। এটি **বর্তমান database-কে প্রতিস্থাপন করে** এবং app restart করতে হয়। শুধু IT / management-এর অনুমোদনে ব্যবহার করুন।",
     "**Download**: backup-এর copy অন্য drive বা USB-তে রাখুন।"
    ]
   },
   {
    "t": "p",
    "x": "IT-এর নিয়মিত কাজ: প্রতিটি software update-এর আগে backup নিন এবং সপ্তাহে একটি copy এই computer-এর বাইরে রাখুন।"
   }
  ]
 },
 {
  "id": "golden-rules",
  "group": "end",
  "badge": "★",
  "label": "সোনালী নিয়ম ও সমস্যা সমাধান",
  "title": "সোনালী নিয়ম, সমস্যা সমাধান ও শব্দকোষ",
  "blocks": [
   {
    "t": "h2",
    "x": "প্রত্যেক user-এর জন্য সোনালী নিয়ম"
   },
   {
    "t": "steps",
    "x": [
     "শুধু নিজের login ব্যবহার করুন। Desk ছাড়ার সময় logout করুন।",
     "প্রতিটি movement যেদিন হয় সেদিনই post করুন, Reference (GRN, PO, batch no.) সহ।",
     "Challan ছাড়া delivery নয়; gate pass ছাড়া মাল বের নয়।",
     "ভুল challan ঠিক করুন **Cancel** দিয়ে (stock ফেরত আসে), কখনো Delete দিয়ে নয়।",
     "Item তৈরির আগে search করুন: এক item, এক code, buyer/color/size-এর এক বানান।",
     "গুনে পাওয়া আসল পরিমাণ লিখুন, অনুমানের পরিমাণ নয়।",
     "প্রতিটি challan, gate pass, issue ও requisition-এর সই করা PDF print করে file করুন।",
     "Stock না মিললে সেদিনই Store In-charge-কে জানান।"
    ]
   },
   {
    "t": "h2",
    "x": "সমস্যা সমাধান (Troubleshooting)"
   },
   {
    "t": "table",
    "head": [
     "সমস্যা",
     "করণীয়"
    ],
    "rows": [
     [
      "Menu-তে কোনো module নেই",
      "আপনার role-এ নেই। Admin-কে permission update করতে বলুন।"
     ],
     [
      "Inventory page খালি",
      "স্বাভাবিক; আগে search দিন বা filter বাছুন।"
     ],
     [
      "Add Item-এ \"Please fill in all fields\"",
      "লাল box গুলো বাকি আছে; USD item-এ conversion rate-ও লাগবে।"
     ],
     [
      "Challan-এ item যোগ হচ্ছে না",
      "Stock শূন্য, অথবা item আগে থেকেই অনুমোদনের অপেক্ষায় থাকা challan-এ আছে।"
     ],
     [
      "\"Insufficient stock\"",
      "পরিমাণ stock-এর বেশি। Stock In & Out history দেখুন; আগে stock গ্রহণ করুন।"
     ],
     [
      "Challan save হলো কিন্তু history-তে নেই",
      "এটি Approvals-এ গেছে; Admin-এর অনুমোদনের অপেক্ষা করুন।"
     ],
     [
      "Challan Receipt-এ challan নেই",
      "Challan PI-এর সাথে link করা হয়নি। শুধু PI-linked challan আসে।"
     ],
     [
      "\"Transfer to Commercial Bill\" দেখা যাচ্ছে না",
      "PI ১০০% গৃহীত হয়নি। Reconcile-এ বাকি লাইন দেখুন।"
     ],
     [
      "Production-এ \"No Linked Target Products\"",
      "Issue-তে target finished product নেই। Issue ঠিক করুন।"
     ],
     [
      "হঠাৎ logout হয়ে গেল",
      "৩০ মিনিট কোনো কাজ হয়নি। আবার login করুন; save না করা কাজ আবার দিতে হবে।"
     ],
     [
      "Screen-এ পুরনো সংখ্যা দেখাচ্ছে",
      "Top bar-এর Refresh click করুন।"
     ],
     [
      "অন্য যেকোনো error",
      "সময়, screen ও message লিখে রাখুন, screenshot নিন এবং app version সহ IT-কে পাঠান।"
     ]
    ]
   },
   {
    "t": "h2",
    "x": "শব্দকোষ (Glossary)"
   },
   {
    "t": "table",
    "head": [
     "শব্দ",
     "অর্থ"
    ],
    "rows": [
     [
      "Item code",
      "System-এর দেওয়া item-এর code, যেমন KADAL-0101"
     ],
     [
      "Source item",
      "কেনা বা import করা মাল"
     ],
     [
      "Production item",
      "আমাদের factory-তে তৈরি finished accessory"
     ],
     [
      "Price tier",
      "একই item-এর ভিন্ন দামে বা ভিন্ন USD rate-এ আসা lot"
     ],
     [
      "Challan",
      "Delivery-এর কাগজ; stock কমায় (যেমন KA-00248)"
     ],
     [
      "PI",
      "Proforma Invoice: উৎপাদনের আগে ঠিক করা order ও দাম"
     ],
     [
      "Commercial Bill",
      "১০০% গৃহীত PI থেকে তৈরি চূড়ান্ত bill"
     ],
     [
      "Gate pass",
      "এক বা একাধিক challan-এর মাল বের হওয়ার অনুমতি (যেমন GP-0031)"
     ],
     [
      "Issue",
      "Factory section বা কর্মীকে পাঠানো মাল (যেমন ISS-0057)"
     ],
     [
      "Target product",
      "Issue-এর মাল দিয়ে যে finished item তৈরি হবে"
     ],
     [
      "Requisition",
      "অভ্যন্তরীণ মালের চাহিদাপত্র (যেমন REQ-0012)"
     ],
     [
      "-REJ",
      "বাতিল challan বা gate pass নম্বরের শেষে যুক্ত অংশ"
     ],
     [
      "Min Stock Level",
      "যে পরিমাণে পৌঁছালে item low stock দেখায়"
     ]
    ]
   }
  ]
 }
];

export default guideSections;
