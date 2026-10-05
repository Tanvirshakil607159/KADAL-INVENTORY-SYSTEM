const { dbPrepare, dbTransaction, getSupabase, isCloudEnabled } = require('../connection');

function extractPrefix(name) {
  if (!name) return 'KADAL';
  // Handle initials like "K.A. DESIGN WEAR LTD." -> tokens: K, A, DESIGN, WEAR, LTD
  const tokens = name.split(/[\s./\\_-]+/).filter(Boolean);
  if (tokens.length >= 2) {
    const letters = tokens.map(t => t[0].toUpperCase()).join('');
    if (letters.length >= 2 && letters.length <= 6) return letters;
  }
  return 'KADAL';
}

function ensureProformaInvoicesSchema() {
  try {
    const row = dbPrepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='proforma_invoices'").get();
    if (row && row.sql && row.sql.includes("CHECK(status IN ('ACTIVE', 'CANCELLED', 'PAID'))")) {
      console.warn('[FinanceRepo] Removing legacy restrictive CHECK constraint on proforma_invoices table...');
      const { dbExec } = require('../connection');
      dbExec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS proforma_invoices_v2;
        CREATE TABLE proforma_invoices_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pi_number TEXT NOT NULL UNIQUE,
          bill_number TEXT,
          pi_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          bill_date DATETIME,
          recipient_id INTEGER,
          applicant_name TEXT NOT NULL,
          applicant_address TEXT,
          beneficiary_name TEXT NOT NULL DEFAULT 'K.A. DESIGN ACCESSORIES LTD.',
          beneficiary_address TEXT DEFAULT '356/1, BLOCK-B, TEK KATHORA, SALNA, GAZIPUR-1703, BANGLADESH',
          beneficiary_bin TEXT DEFAULT '',
          bank_details TEXT DEFAULT 'UNITED COMMERCIAL BANK PLC.\nTONGI BRANCH\n18, S.K. MANNAN TOWER, CHERAG ALI\nGAZIPUR-1712, BANGLADESH\nSWIFT CODE: UCBLBDDHTNG',
          buyer TEXT,
          challan_ids TEXT,
          challan_numbers TEXT,
          currency TEXT DEFAULT 'USD',
          currency_symbol TEXT DEFAULT '$',
          total_quantity REAL DEFAULT 0,
          total_amount REAL DEFAULT 0,
          amount_in_words TEXT,
          net_weight TEXT DEFAULT '250 KGS',
          gross_weight TEXT DEFAULT '260 KGS',
          terms_conditions TEXT DEFAULT 'CASH ON DELIVERY.',
          prepared_by TEXT DEFAULT 'Md. Ariful Rahman\nAccounts & Admin\nK. A. Design Accessories Ltd.',
          authorized_by TEXT DEFAULT 'Maksudha Akter Kumu\nChairman\nK.A. DESIGN ACCESSORIES LTD.',
          accepted_by TEXT,
          status TEXT NOT NULL DEFAULT 'APPROVED',
          notes TEXT,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO proforma_invoices_v2 SELECT * FROM proforma_invoices;
        DROP TABLE proforma_invoices;
        ALTER TABLE proforma_invoices_v2 RENAME TO proforma_invoices;
        CREATE INDEX IF NOT EXISTS idx_pi_number ON proforma_invoices(pi_number);
        CREATE INDEX IF NOT EXISTS idx_pi_date ON proforma_invoices(pi_date);
        CREATE INDEX IF NOT EXISTS idx_pi_recipient ON proforma_invoices(recipient_id);
        PRAGMA foreign_keys = ON;
      `);
      console.log('[FinanceRepo] Table proforma_invoices recreated with full status support!');
    }
  } catch (err) {
    console.warn('[FinanceRepo] ensureProformaInvoicesSchema warning:', err.message);
  }
}

function normalizePiItem(it, idx) {
  const slNo = it.sl_no !== undefined ? it.sl_no : (it.slNo !== undefined ? it.slNo : idx + 1);
  const qty = Number(it.quantity !== undefined ? it.quantity : (it.order_quantity || 0));
  const desc = it.item_description || it.itemDescription || it.description || it.name || 'Custom Accessory Item';
  let poStyle = it.po_style_no || it.poStyleNo || '';
  const poVal = it.order_number || it.orderNumber || '';
  const styleVal = it.style_name || it.styleName || '';
  let purchaseVal = it.purchase_no || it.purchaseNo || it.purchase_number || it.purchaseNumber || '';

  // If purchaseVal not explicitly provided, extract from poStyle string
  if (!purchaseVal && poStyle) {
    const match = poStyle.match(/Purchase(?:\s*No)?\s*[:=]\s*([^/\n;]+)/i);
    if (match) purchaseVal = match[1].trim();
  }

  // Build clean poStyleClean for dedicated PO & Style column
  let poStyleClean = poStyle;
  if (poStyleClean && poStyleClean !== '-') {
    poStyleClean = poStyleClean.replace(/\s*\/\s*Purchase(?:\s*No)?\s*[:=]\s*[^/\n;]+/i, '').trim();
    if (poVal && !poStyleClean.toLowerCase().includes('po:') && !poStyleClean.includes(poVal)) {
      poStyleClean = `PO: ${poVal} / ` + poStyleClean.replace(/^Style:\s*/i, 'Style: ');
    }
  } else {
    const parts = [];
    if (poVal) parts.push(`PO: ${poVal}`);
    if (styleVal) parts.push(`Style: ${styleVal}`);
    poStyleClean = parts.length > 0 ? parts.join(' / ') : '-';
  }

  // Combined po_style_no for storage
  let combinedPoStyle = poStyleClean;
  if (purchaseVal && !combinedPoStyle.toLowerCase().includes('purchase')) {
    combinedPoStyle = combinedPoStyle !== '-'
      ? `${combinedPoStyle} / Purchase No: ${purchaseVal}`
      : `Purchase No: ${purchaseVal}`;
  }

  const unit = (it.unit || 'PCS').toUpperCase();
  const unitPrice = Number(it.unit_price !== undefined ? it.unit_price : (it.unitPrice !== undefined ? it.unitPrice : 0));
  const totalAmount = Number(it.total_amount !== undefined ? it.total_amount : (it.totalAmount !== undefined ? it.totalAmount : (qty * unitPrice).toFixed(2)));

  return {
    ...it,
    id: it.id,
    slNo,
    sl_no: slNo,
    challanId: it.challan_id || it.challanId || null,
    challan_id: it.challan_id || it.challanId || null,
    itemId: it.item_id || it.itemId || null,
    item_id: it.item_id || it.itemId || null,
    itemDescription: desc,
    item_description: desc,
    purchaseNo: purchaseVal,
    purchase_no: purchaseVal,
    poStyleNo: poStyleClean,
    po_style_no: combinedPoStyle,
    quantity: qty,
    unit,
    unitPrice,
    unit_price: unitPrice,
    totalAmount,
    total_amount: totalAmount,
    notes: it.notes || null
  };
}

function normalizePi(pi) {
  if (!pi) return null;
  const rawItems = pi.items || pi.proforma_invoice_items || [];
  const items = rawItems.map((it, idx) => normalizePiItem(it, idx));
  let piPurchase = pi.purchase_no || pi.purchaseNo || '';
  if (!piPurchase && pi.notes) {
    const match = pi.notes.match(/Purchase(?:\s*No)?\s*[:=]\s*([^/\n;]+)/i);
    if (match) piPurchase = match[1].trim();
  }
  if (!piPurchase && items.length > 0) {
    const itPurch = items.find(it => it.purchaseNo || it.purchase_no);
    if (itPurch) piPurchase = itPurch.purchaseNo || itPurch.purchase_no;
  }
  return {
    ...pi,
    purchase_no: piPurchase,
    purchaseNo: piPurchase,
    items,
    item_count: items.length,
    total_quantity: Number(pi.total_quantity !== undefined ? pi.total_quantity : items.reduce((s, i) => s + i.quantity, 0)),
    total_amount: Number(pi.total_amount !== undefined ? pi.total_amount : items.reduce((s, i) => s + i.totalAmount, 0))
  };
}

async function getTrackedSequence(seqKey) {
  let tracked = 0;
  if (isCloudEnabled()) {
    try {
      const { data } = await getSupabase()
        .from('settings')
        .select('value')
        .eq('key', seqKey)
        .maybeSingle();
      if (data && data.value) {
        const val = parseInt(data.value, 10);
        if (!isNaN(val) && val > tracked) tracked = val;
      }
    } catch (e) {
      console.warn('[FinanceRepo] Cloud getTrackedSequence warning:', e.message);
    }
  }

  try {
    const row = dbPrepare('SELECT value FROM settings WHERE key = ?').get(seqKey);
    if (row && row.value) {
      const val = parseInt(row.value, 10);
      if (!isNaN(val) && val > tracked) tracked = val;
    }
  } catch (e) {}

  return tracked;
}

async function saveTrackedSequence(seqKey, nextSeq) {
  const strVal = nextSeq.toString();

  // Local SQLite settings
  try {
    const existing = dbPrepare('SELECT id FROM settings WHERE key = ?').get(seqKey);
    if (existing) {
      dbPrepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(strVal, seqKey);
    } else {
      dbPrepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(seqKey, strVal);
    }
    const { saveDatabase } = require('../connection');
    if (typeof saveDatabase === 'function') saveDatabase();
  } catch (e) {
    console.warn('[FinanceRepo] Local saveTrackedSequence warning:', e.message);
  }

  // Cloud Supabase settings
  if (isCloudEnabled()) {
    try {
      await getSupabase().from('settings').upsert({
        key: seqKey,
        value: strVal,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[FinanceRepo] Cloud saveTrackedSequence warning:', e.message);
    }
  }
}

async function syncSavedSequence(piNumber, billNumber) {
  if (piNumber) {
    const parts = (piNumber || '').split('/');
    if (parts.length >= 4) {
      const prefix = parts[0];
      const year = parts[2];
      const seq = parseInt(parts[3], 10);
      if (!isNaN(seq) && prefix && year) {
        const seqKey = `seq:pi:${prefix}:${year}`;
        const current = await getTrackedSequence(seqKey);
        if (seq >= current) {
          await saveTrackedSequence(seqKey, seq);
        }
      }
    }
  }
  if (billNumber) {
    const parts = (billNumber || '').split('/');
    if (parts.length >= 4) {
      const prefix = parts[0];
      const year = parts[2];
      const seq = parseInt(parts[3], 10);
      if (!isNaN(seq) && prefix && year) {
        const seqKey = `seq:bill:${prefix}:${year}`;
        const current = await getTrackedSequence(seqKey);
        if (seq >= current) {
          await saveTrackedSequence(seqKey, seq);
        }
      }
    }
  }
}

const FinanceRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        let query = supabase.from('proforma_invoices').select(`
          *,
          users!proforma_invoices_created_by_fkey (full_name),
          recipients (name, receiver_address),
          proforma_invoice_items (*)
        `).order('pi_date', { ascending: false }).limit(500);

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.recipientId) query = query.eq('recipient_id', filters.recipientId);
        if (filters.dateFrom) query = query.gte('pi_date', filters.dateFrom);
        if (filters.dateTo) query = query.lte('pi_date', filters.dateTo + 'T23:59:59.999Z');

        const { data, error } = await query;
        if (error) throw error;

        const piIds = (data || []).map(p => p.id);
        let challanItemsData = [];
        if (piIds.length > 0) {
          try {
            // Batch sizes for IN queries to avoid URL length issues
            const batchSize = 100;
            for (let i = 0; i < piIds.length; i += batchSize) {
              const batchIds = piIds.slice(i, i + batchSize);
              const { data: ciData } = await supabase.from('challan_items').select(`
                quantity, received_quantity, challans!inner(pi_id, status)
              `).in('challans.pi_id', batchIds).eq('challans.status', 'ACTIVE');
              if (ciData) {
                challanItemsData.push(...ciData);
              }
            }
          } catch (e) {
            console.warn('[FinanceRepo] Cloud challan stats fetch failed:', e.message);
          }
        }

        let result = (data || []).map(pi => {
          const items = pi.proforma_invoice_items || [];
          const totalOrdered = Number(pi.total_quantity) || items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
          
          const piChallanItems = challanItemsData.filter(ci => ci.challans && ci.challans.pi_id === pi.id);
          const totalDispatched = piChallanItems.reduce((s, ci) => s + (Number(ci.quantity) || 0), 0);
          const totalReceived = piChallanItems.reduce((s, ci) => s + (Number(ci.received_quantity) || 0), 0);
          
          let allItemsFull = true;
          if (items.length > 0) {
            for (const item of items) {
              const orderQty = Number(item.quantity) || 0;
              let received = 0;
              const matchedRows = piChallanItems.filter(r => r.item_id === item.item_id || r.pi_item_id === item.id);
              matchedRows.forEach(r => { received += Number(r.received_quantity) || 0; });
              if (orderQty > 0 && received < orderQty) {
                allItemsFull = false;
              }
            }
          } else {
            allItemsFull = totalOrdered > 0 && totalReceived >= totalOrdered;
          }

          const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 100;

          return normalizePi({
            ...pi,
            created_by_name: pi.users?.full_name,
            items,
            total_ordered: totalOrdered,
            dispatched_quantity: totalDispatched,
            received_quantity: totalReceived,
            fulfillment_pct: pct,
            is_100_percent_received: (allItemsFull || totalReceived >= totalOrdered) && totalOrdered > 0,
            can_transfer_to_bill: (allItemsFull || totalReceived >= totalOrdered) && totalOrdered > 0 && pi.status !== 'BILLED'
          });
        });

        if (filters.search) {
          const s = filters.search.toLowerCase();
          result = result.filter(pi => 
            pi.pi_number?.toLowerCase().includes(s) ||
            pi.bill_number?.toLowerCase().includes(s) ||
            pi.applicant_name?.toLowerCase().includes(s) ||
            pi.buyer?.toLowerCase().includes(s) ||
            pi.challan_numbers?.toLowerCase().includes(s)
          );
        }

        return result;
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getAll failed, falling back to SQLite:', cloudErr.message);
      }
    }

    let where = [];
    let params = [];
    if (filters.status) { where.push('pi.status = ?'); params.push(filters.status); }
    if (filters.type === 'pi') {
      where.push("(pi.bill_number IS NULL OR pi.status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PRODUCTION', 'PARTIALLY_DELIVERED', 'DELIVERED', 'BILLED'))");
    } else if (filters.type === 'bill') {
      where.push("pi.bill_number IS NOT NULL");
    }
    if (filters.recipientId) { where.push('pi.recipient_id = ?'); params.push(filters.recipientId); }
    if (filters.dateFrom && filters.dateFrom.trim()) { where.push('pi.pi_date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo && filters.dateTo.trim()) { where.push('pi.pi_date <= ?'); params.push(filters.dateTo + 'T23:59:59.999Z'); }
    if (filters.search && filters.search.trim()) {
      where.push('(pi.pi_number LIKE ? OR pi.bill_number LIKE ? OR pi.applicant_name LIKE ? OR pi.buyer LIKE ? OR pi.challan_numbers LIKE ?)');
      const s = `%${filters.search.trim()}%`;
      params.push(s, s, s, s, s);
    }

    const w = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT 
        pi.*,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM proforma_invoice_items pii WHERE pii.pi_id = pi.id) as item_count
      FROM proforma_invoices pi
      LEFT JOIN users u ON pi.created_by = u.id
      ${w}
      ORDER BY pi.pi_date DESC, pi.id DESC
      LIMIT 500
    `;
    const rows = dbPrepare(sql).all(...params);

    // Fetch items for each PI and compute fulfillment
    return rows.map(pi => {
      const items = dbPrepare(`SELECT * FROM proforma_invoice_items WHERE pi_id = ? ORDER BY sl_no ASC, id ASC`).all(pi.id);
      
      const challanStats = dbPrepare(`
        SELECT 
          COALESCE(SUM(ci.quantity), 0) as dispatched_qty,
          COALESCE(SUM(ci.received_quantity), 0) as received_qty
        FROM challan_items ci
        JOIN challans c ON ci.challan_id = c.id
        WHERE c.pi_id = ? AND c.status = 'ACTIVE'
      `).get(pi.id) || { dispatched_qty: 0, received_qty: 0 };

      const totalOrdered = Number(pi.total_quantity) || items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      const totalDispatched = Number(challanStats.dispatched_qty) || 0;
      const totalReceived = Number(challanStats.received_qty) || 0;
      const fulfillmentPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : (pi.bill_number ? 100 : 0);
      const is100PercentReceived = totalOrdered > 0 && totalReceived >= totalOrdered;

      return normalizePi({
        ...pi,
        items,
        dispatched_quantity: totalDispatched,
        received_quantity: totalReceived,
        fulfillment_pct: fulfillmentPct,
        is_100_percent_received: is100PercentReceived,
        can_transfer_to_bill: is100PercentReceived && pi.status !== 'BILLED'
      });
    });
  },

  async getById(id) {
    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('proforma_invoices').select(`
          *,
          users!proforma_invoices_created_by_fkey (full_name),
          recipients (name, receiver_address),
          proforma_invoice_items (*)
        `).eq('id', id).maybeSingle();

        if (error) throw error;
        if (!data) return null;

        data.created_by_name = data.users?.full_name;
        data.items = (data.proforma_invoice_items || []).sort((a, b) => a.sl_no - b.sl_no);

        const { data: ciData } = await supabase.from('challan_items').select(`
          quantity, received_quantity, challans!inner(pi_id, status)
        `).eq('challans.pi_id', id).eq('challans.status', 'ACTIVE');
        
        const totalDispatched = (ciData || []).reduce((s, ci) => s + (Number(ci.quantity) || 0), 0);
        const totalReceived = (ciData || []).reduce((s, ci) => s + (Number(ci.received_quantity) || 0), 0);
        
        const totalOrdered = Number(data.total_quantity) || data.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        const fulfillmentPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : (data.bill_number ? 100 : 0);
        
        let allItemsFull = true;
        if (data.items.length > 0) {
          for (const item of data.items) {
            const orderQty = Number(item.quantity) || 0;
            let received = 0;
            const matchedRows = (ciData || []).filter(r => r.item_id === item.item_id || r.pi_item_id === item.id);
            matchedRows.forEach(r => { received += Number(r.received_quantity) || 0; });
            if (orderQty > 0 && received < orderQty) {
              allItemsFull = false;
            }
          }
        } else {
          allItemsFull = totalOrdered > 0 && totalReceived >= totalOrdered;
        }
        
        const is100PercentReceived = (allItemsFull || totalReceived >= totalOrdered) && totalOrdered > 0;

        data.dispatched_quantity = totalDispatched;
        data.received_quantity = totalReceived;
        data.fulfillment_pct = fulfillmentPct;
        data.is_100_percent_received = is100PercentReceived;
        data.can_transfer_to_bill = is100PercentReceived && data.status !== 'BILLED';

        return normalizePi(data);
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getById failed, falling back to SQLite:', cloudErr.message);
      }
    }

    const pi = dbPrepare(`
      SELECT pi.*, u.full_name as created_by_name
      FROM proforma_invoices pi
      LEFT JOIN users u ON pi.created_by = u.id
      WHERE pi.id = ?
    `).get(id);

    if (pi) {
      pi.items = dbPrepare(`SELECT * FROM proforma_invoice_items WHERE pi_id = ? ORDER BY sl_no ASC, id ASC`).all(id);
    }
    return normalizePi(pi);
  },

  async getByNumber(piNumber) {
    if (isCloudEnabled()) {
      try {
        const { data, error } = await getSupabase().from('proforma_invoices').select(`
          *,
          users!proforma_invoices_created_by_fkey (full_name),
          proforma_invoice_items (*)
        `).eq('pi_number', piNumber).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        data.items = (data.proforma_invoice_items || []).sort((a, b) => a.sl_no - b.sl_no);
        return normalizePi(data);
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getByNumber failed, falling back to SQLite:', cloudErr.message);
      }
    }

    const pi = dbPrepare(`
      SELECT pi.*, u.full_name as created_by_name
      FROM proforma_invoices pi
      LEFT JOIN users u ON pi.created_by = u.id
      WHERE pi.pi_number = ?
    `).get(piNumber);

    if (pi) {
      pi.items = dbPrepare(`SELECT * FROM proforma_invoice_items WHERE pi_id = ? ORDER BY sl_no ASC, id ASC`).all(pi.id);
    }
    return normalizePi(pi);
  },

  async create(data) {
    const {
      piNumber,
      billNumber,
      piDate,
      billDate,
      recipientId,
      applicantName,
      applicantAddress,
      beneficiaryName,
      beneficiaryAddress,
      beneficiaryBin,
      bankDetails,
      buyer,
      challanIds,
      challanNumbers,
      currency,
      currencySymbol,
      totalQuantity,
      totalAmount,
      amountInWords,
      netWeight,
      grossWeight,
      termsConditions,
      preparedBy,
      authorizedBy,
      acceptedBy,
      status,
      notes,
      createdBy,
      items
    } = data;

    const challanIdsJson = JSON.stringify(challanIds || []);
    const safeCurrency = currency || 'USD';
    const safeCurrencySymbol = currencySymbol || '$';
    const safeStatus = status || 'ACTIVE';
    const normalizedItems = (items || []).map((it, idx) => normalizePiItem(it, idx));

    let finalNotes = notes || '';
    const pNum = (data.purchaseNumber || data.purchaseNo || '').trim();
    if (pNum && !finalNotes.toLowerCase().includes('purchase no')) {
      finalNotes = finalNotes ? `${finalNotes} | Purchase No: ${pNum}` : `Purchase No: ${pNum}`;
    }

    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        const { data: insertedPi, error: piErr } = await supabase.from('proforma_invoices').insert([{
          pi_number: piNumber,
          bill_number: billNumber || null,
          pi_date: piDate || new Date().toISOString(),
          bill_date: billDate || null,
          recipient_id: recipientId || null,
          applicant_name: applicantName,
          applicant_address: applicantAddress || null,
          beneficiary_name: beneficiaryName || 'K.A. DESIGN ACCESSORIES LTD.',
          beneficiary_address: beneficiaryAddress || '356/1, BLOCK-B, TEK KATHORA, SALNA, GAZIPUR-1703, BANGLADESH',
          beneficiary_bin: beneficiaryBin || null,
          bank_details: bankDetails || null,
          buyer: buyer || null,
          challan_ids: challanIds || [],
          challan_numbers: challanNumbers || null,
          currency: safeCurrency,
          currency_symbol: safeCurrencySymbol,
          total_quantity: Number(totalQuantity) || 0,
          total_amount: Number(totalAmount) || 0,
          amount_in_words: amountInWords || null,
          net_weight: netWeight || '250 KGS',
          gross_weight: grossWeight || '260 KGS',
          terms_conditions: termsConditions || 'CASH ON DELIVERY.',
          prepared_by: preparedBy || 'Md. Ariful Rahman\nAccounts & Admin\nK. A. Design Accessories Ltd.',
          authorized_by: authorizedBy || 'Maksudha Akter Kumu\nChairman\nK.A. DESIGN ACCESSORIES LTD.',
          accepted_by: acceptedBy || null,
          status: safeStatus,
          notes: finalNotes || null,
          created_by: createdBy || null
        }]).select().single();

        if (piErr) throw piErr;

        const piId = insertedPi.id;

        if (normalizedItems.length > 0) {
          const itemRows = normalizedItems.map(it => ({
            pi_id: piId,
            sl_no: it.slNo,
            challan_id: it.challanId,
            item_id: it.itemId,
            item_description: it.itemDescription,
            po_style_no: it.po_style_no || it.poStyleNo || null,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unitPrice,
            total_amount: it.totalAmount,
            notes: it.notes || null
          }));

          const { error: itemsErr } = await supabase.from('proforma_invoice_items').insert(itemRows);
          if (itemsErr) throw itemsErr;
        }

        await syncSavedSequence(piNumber, billNumber);
        return { id: piId, piNumber };
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud create failed, falling back to SQLite:', cloudErr.message);
      }
    }

    // Local SQLite insert
    ensureProformaInvoicesSchema();

    let res;
    try {
      res = dbPrepare(`
        INSERT INTO proforma_invoices (
          pi_number, bill_number, pi_date, bill_date, recipient_id,
          applicant_name, applicant_address, beneficiary_name, beneficiary_address, beneficiary_bin,
          bank_details, buyer, challan_ids, challan_numbers, currency, currency_symbol,
          total_quantity, total_amount, amount_in_words, net_weight, gross_weight,
          terms_conditions, prepared_by, authorized_by, accepted_by, status, notes, created_by
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        piNumber,
        billNumber || null,
        piDate || new Date().toISOString(),
        billDate || null,
        recipientId || null,
        applicantName,
        applicantAddress || null,
        beneficiaryName || 'K.A. DESIGN ACCESSORIES LTD.',
        beneficiaryAddress || '356/1, BLOCK-B, TEK KATHORA, SALNA, GAZIPUR-1703, BANGLADESH',
        beneficiaryBin || null,
        bankDetails || null,
        buyer || null,
        challanIdsJson,
        challanNumbers || null,
        safeCurrency,
        safeCurrencySymbol,
        Number(totalQuantity) || 0,
        Number(totalAmount) || 0,
        amountInWords || null,
        netWeight || '250 KGS',
        grossWeight || '260 KGS',
        termsConditions || 'CASH ON DELIVERY.',
        preparedBy || 'Md. Ariful Rahman\nAccounts & Admin\nK. A. Design Accessories Ltd.',
        authorizedBy || 'Maksudha Akter Kumu\nChairman\nK.A. DESIGN ACCESSORIES LTD.',
        acceptedBy || null,
        safeStatus,
        finalNotes || null,
        createdBy || null
      );
    } catch (insertErr) {
      if (insertErr.message && insertErr.message.includes('CHECK constraint failed')) {
        console.warn('[FinanceRepo] Retrying insert with ACTIVE status due to legacy CHECK constraint...');
        res = dbPrepare(`
          INSERT INTO proforma_invoices (
            pi_number, bill_number, pi_date, bill_date, recipient_id,
            applicant_name, applicant_address, beneficiary_name, beneficiary_address, beneficiary_bin,
            bank_details, buyer, challan_ids, challan_numbers, currency, currency_symbol,
            total_quantity, total_amount, amount_in_words, net_weight, gross_weight,
            terms_conditions, prepared_by, authorized_by, accepted_by, status, notes, created_by
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
          )
        `).run(
          piNumber,
          billNumber || null,
          piDate || new Date().toISOString(),
          billDate || null,
          recipientId || null,
          applicantName,
          applicantAddress || null,
          beneficiaryName || 'K.A. DESIGN ACCESSORIES LTD.',
          beneficiaryAddress || '356/1, BLOCK-B, TEK KATHORA, SALNA, GAZIPUR-1703, BANGLADESH',
          beneficiaryBin || null,
          bankDetails || null,
          buyer || null,
          challanIdsJson,
          challanNumbers || null,
          safeCurrency,
          safeCurrencySymbol,
          Number(totalQuantity) || 0,
          Number(totalAmount) || 0,
          amountInWords || null,
          netWeight || '250 KGS',
          grossWeight || '260 KGS',
          termsConditions || 'CASH ON DELIVERY.',
          preparedBy || 'Md. Ariful Rahman\nAccounts & Admin\nK. A. Design Accessories Ltd.',
          authorizedBy || 'Maksudha Akter Kumu\nChairman\nK.A. DESIGN ACCESSORIES LTD.',
          acceptedBy || null,
          'ACTIVE',
          finalNotes || null,
          createdBy || null
        );
      } else {
        throw insertErr;
      }
    }

    const piId = res.lastInsertRowid;

    if (normalizedItems.length > 0) {
      for (const it of normalizedItems) {
        dbPrepare(`
          INSERT INTO proforma_invoice_items (
            pi_id, sl_no, challan_id, item_id, item_description,
            po_style_no, quantity, unit, unit_price, total_amount, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          piId,
          it.slNo,
          it.challanId,
          it.itemId,
          it.itemDescription,
          it.po_style_no || it.poStyleNo || null,
          it.quantity,
          it.unit,
          it.unitPrice,
          it.totalAmount,
          it.notes || null
        );
      }
    }

    await syncSavedSequence(piNumber, billNumber);
    return { id: piId, piNumber };
  },

  async update(id, data) {
    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        const updateData = {};
        if (data.billNumber !== undefined) updateData.bill_number = data.billNumber;
        if (data.piDate !== undefined) updateData.pi_date = data.piDate;
        if (data.billDate !== undefined) updateData.bill_date = data.billDate;
        if (data.buyer !== undefined) updateData.buyer = data.buyer;
        if (data.netWeight !== undefined) updateData.net_weight = data.netWeight;
        if (data.grossWeight !== undefined) updateData.gross_weight = data.grossWeight;
        if (data.termsConditions !== undefined) updateData.terms_conditions = data.termsConditions;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.challanIds !== undefined) updateData.challan_ids = typeof data.challanIds === 'string' ? data.challanIds : JSON.stringify(data.challanIds);
        if (data.challanNumbers !== undefined) updateData.challan_numbers = data.challanNumbers;
        if (data.totalAmount !== undefined) updateData.total_amount = Number(data.totalAmount);
        if (data.totalQuantity !== undefined) updateData.total_quantity = Number(data.totalQuantity);
        if (data.amountInWords !== undefined) updateData.amount_in_words = data.amountInWords;
        updateData.updated_at = new Date().toISOString();

        const { error } = await supabase.from('proforma_invoices').update(updateData).eq('id', id);
        if (error) throw error;
        return true;
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud update failed, falling back to SQLite:', cloudErr.message);
      }
    }

    const sets = [];
    const params = [];
    if (data.billNumber !== undefined) { sets.push('bill_number = ?'); params.push(data.billNumber); }
    if (data.piDate !== undefined) { sets.push('pi_date = ?'); params.push(data.piDate); }
    if (data.billDate !== undefined) { sets.push('bill_date = ?'); params.push(data.billDate); }
    if (data.buyer !== undefined) { sets.push('buyer = ?'); params.push(data.buyer); }
    if (data.challanIds !== undefined) {
      sets.push('challan_ids = ?');
      params.push(typeof data.challanIds === 'string' ? data.challanIds : JSON.stringify(data.challanIds));
    }
    if (data.challanNumbers !== undefined) { sets.push('challan_numbers = ?'); params.push(data.challanNumbers); }
    if (data.netWeight !== undefined) { sets.push('net_weight = ?'); params.push(data.netWeight); }
    if (data.grossWeight !== undefined) { sets.push('gross_weight = ?'); params.push(data.grossWeight); }
    if (data.termsConditions !== undefined) { sets.push('terms_conditions = ?'); params.push(data.termsConditions); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
    if (data.totalAmount !== undefined) { sets.push('total_amount = ?'); params.push(Number(data.totalAmount)); }
    if (data.totalQuantity !== undefined) { sets.push('total_quantity = ?'); params.push(Number(data.totalQuantity)); }
    if (data.amountInWords !== undefined) { sets.push('amount_in_words = ?'); params.push(data.amountInWords); }
    sets.push('updated_at = CURRENT_TIMESTAMP');

    params.push(id);
    dbPrepare(`UPDATE proforma_invoices SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return true;
  },

  async delete(id) {
    if (isCloudEnabled()) {
      try {
        const { error } = await getSupabase().from('proforma_invoices').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud delete failed, falling back to SQLite:', cloudErr.message);
      }
    }
    dbPrepare('DELETE FROM proforma_invoices WHERE id = ?').run(id);
    return true;
  },

  async getNextNumber(applicantName) {
    const year = new Date().getFullYear();
    const prefix = extractPrefix(applicantName); // e.g. KADWL
    const pattern = `${prefix}/KADAL/${year}/%`;
    const seqKey = `seq:pi:${prefix}:${year}`;

    let maxDbSeq = 0;
    if (isCloudEnabled()) {
      try {
        const { data } = await getSupabase()
          .from('proforma_invoices')
          .select('pi_number')
          .ilike('pi_number', pattern);

        (data || []).forEach(row => {
          const parts = (row.pi_number || '').split('/');
          if (parts.length >= 4) {
            const seq = parseInt(parts[3], 10);
            if (!isNaN(seq) && seq > maxDbSeq) maxDbSeq = seq;
          }
        });
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getNextNumber failed, falling back to SQLite:', cloudErr.message);
      }
    }

    try {
      const rows = dbPrepare(`SELECT pi_number FROM proforma_invoices WHERE pi_number LIKE ?`).all(pattern);
      rows.forEach(row => {
        const parts = (row.pi_number || '').split('/');
        if (parts.length >= 4) {
          const seq = parseInt(parts[3], 10);
          if (!isNaN(seq) && seq > maxDbSeq) maxDbSeq = seq;
        }
      });
    } catch (e) {}

    // Highest ever recorded sequence in persistent settings
    const trackedSeq = await getTrackedSequence(seqKey);

    // Candidates start strictly after the maximum ever generated or stored
    let nextSeq = Math.max(maxDbSeq, trackedSeq) + 1;

    // Safety loop: ensure uniqueness across both cloud and local DB
    let isUnique = false;
    while (!isUnique) {
      const candidate = `${prefix}/KADAL/${year}/${nextSeq}`;
      let exists = false;

      if (isCloudEnabled()) {
        try {
          const { data } = await getSupabase()
            .from('proforma_invoices')
            .select('id')
            .eq('pi_number', candidate)
            .limit(1);
          if (data && data.length > 0) exists = true;
        } catch (e) {}
      }

      if (!exists) {
        try {
          const row = dbPrepare('SELECT id FROM proforma_invoices WHERE pi_number = ?').get(candidate);
          if (row) exists = true;
        } catch (e) {}
      }

      if (!exists) {
        isUnique = true;
      } else {
        nextSeq++;
      }
    }

    // Persist immediately: once generated, this sequence number is reserved and will not generate again!
    await saveTrackedSequence(seqKey, nextSeq);

    return `${prefix}/KADAL/${year}/${nextSeq}`;
  },

  async getNextBillNumber(applicantName) {
    const year = new Date().getFullYear();
    const prefix = extractPrefix(applicantName);
    const pattern = `${prefix}/KADAL/${year}/%`;
    const seqKey = `seq:bill:${prefix}:${year}`;

    let maxDbSeq = 0;
    if (isCloudEnabled()) {
      try {
        const { data } = await getSupabase()
          .from('proforma_invoices')
          .select('bill_number')
          .not('bill_number', 'is', null)
          .ilike('bill_number', pattern);

        (data || []).forEach(row => {
          const parts = (row.bill_number || '').split('/');
          if (parts.length >= 4) {
            const seq = parseInt(parts[3], 10);
            if (!isNaN(seq) && seq > maxDbSeq) maxDbSeq = seq;
          }
        });
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getNextBillNumber failed, falling back to SQLite:', cloudErr.message);
      }
    }

    try {
      const rows = dbPrepare(`SELECT bill_number FROM proforma_invoices WHERE bill_number LIKE ?`).all(pattern);
      rows.forEach(row => {
        const parts = (row.bill_number || '').split('/');
        if (parts.length >= 4) {
          const seq = parseInt(parts[3], 10);
          if (!isNaN(seq) && seq > maxDbSeq) maxDbSeq = seq;
        }
      });
    } catch (e) {}

    const trackedSeq = await getTrackedSequence(seqKey);
    let nextSeq = Math.max(maxDbSeq, trackedSeq) + 1;

    let isUnique = false;
    while (!isUnique) {
      const candidate = `${prefix}/KADAL/${year}/${nextSeq}`;
      let exists = false;

      if (isCloudEnabled()) {
        try {
          const { data } = await getSupabase()
            .from('proforma_invoices')
            .select('id')
            .eq('bill_number', candidate)
            .limit(1);
          if (data && data.length > 0) exists = true;
        } catch (e) {}
      }

      if (!exists) {
        try {
          const row = dbPrepare('SELECT id FROM proforma_invoices WHERE bill_number = ?').get(candidate);
          if (row) exists = true;
        } catch (e) {}
      }

      if (!exists) {
        isUnique = true;
      } else {
        nextSeq++;
      }
    }

    // Persist immediately: once generated, this sequence number is reserved and will not generate again!
    await saveTrackedSequence(seqKey, nextSeq);

    return `${prefix}/KADAL/${year}/${nextSeq}`;
  },

  async getUsedChallanIds() {
    const used = new Set();
    if (isCloudEnabled()) {
      try {
        const { data } = await getSupabase()
          .from('proforma_invoices')
          .select('challan_ids')
          .neq('status', 'CANCELLED');

        (data || []).forEach(row => {
          try {
            const ids = typeof row.challan_ids === 'string' ? JSON.parse(row.challan_ids) : row.challan_ids;
            if (Array.isArray(ids)) {
              ids.forEach(id => used.add(Number(id)));
            }
          } catch (e) {}
        });
        return Array.from(used);
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getUsedChallanIds failed, falling back to SQLite:', cloudErr.message);
      }
    }

    const rows = dbPrepare(`SELECT challan_ids FROM proforma_invoices WHERE status != 'CANCELLED'`).all();
    rows.forEach(row => {
      try {
        const ids = typeof row.challan_ids === 'string' ? JSON.parse(row.challan_ids) : row.challan_ids;
        if (Array.isArray(ids)) {
          ids.forEach(id => used.add(Number(id)));
        }
      } catch (e) {}
    });
    return Array.from(used);
  },

  async getPiReconciliation(id) {
    const pi = await this.getById(id);
    if (!pi) return null;

    let challans = [];
    let chItemRowsAll = [];

    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        const { data: cData } = await supabase.from('challans')
          .select('id, challan_number, challan_date, receiver_name, received_status, received_at, received_by, received_notes')
          .eq('pi_id', id)
          .eq('status', 'ACTIVE')
          .order('challan_date', { ascending: false });
        challans = cData || [];

        const { data: ciData } = await supabase.from('challan_items')
          .select('quantity, received_quantity, item_id, pi_item_id, challans!inner(pi_id, status)')
          .eq('challans.pi_id', id)
          .eq('challans.status', 'ACTIVE');
        chItemRowsAll = ciData || [];
      } catch (e) {
        console.warn('[FinanceRepo] Cloud getPiReconciliation failed:', e.message);
      }
    } else {
      challans = dbPrepare(`
        SELECT c.id, c.challan_number, c.challan_date, c.receiver_name, c.received_status, c.received_at, c.received_by, c.received_notes
        FROM challans c
        WHERE c.pi_id = ? AND c.status = 'ACTIVE'
        ORDER BY c.challan_date DESC
      `).all(id);

      chItemRowsAll = dbPrepare(`
        SELECT ci.quantity, ci.received_quantity, ci.item_id, ci.pi_item_id
        FROM challan_items ci
        JOIN challans c ON ci.challan_id = c.id
        WHERE c.pi_id = ? AND c.status = 'ACTIVE'
      `).all(id);
    }

    // Get item breakdown
    const piItems = pi.items || [];
    let totalOrdered = 0;
    let totalDispatched = 0;
    let totalReceived = 0;

    const reconciledItems = piItems.map(item => {
      const orderQty = Number(item.quantity) || 0;
      totalOrdered += orderQty;

      let dispatched = 0;
      let received = 0;

      const matchedRows = chItemRowsAll.filter(r => r.item_id === item.item_id || r.pi_item_id === item.id);

      matchedRows.forEach(row => {
        dispatched += Number(row.quantity) || 0;
        received += Number(row.received_quantity) || 0;
      });

      totalDispatched += dispatched;
      totalReceived += received;

      const shortage = Math.max(0, dispatched - received);
      const remainingToReceive = Math.max(0, orderQty - received);
      const pct = orderQty > 0 ? Math.min(100, Math.round((received / orderQty) * 100)) : 100;

      return {
        ...item,
        orderQuantity: orderQty,
        dispatchedQuantity: dispatched,
        receivedQuantity: received,
        shortageQuantity: shortage,
        remainingToReceive,
        fulfillmentPct: pct,
        isFullyReceived: received >= orderQty && orderQty > 0
      };
    });

    const allItemsFull = reconciledItems.every(i => i.isFullyReceived);
    const is100PercentReceived = totalOrdered > 0 && (allItemsFull || totalReceived >= totalOrdered);
    const overallPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 100;

    return {
      pi,
      items: reconciledItems,
      challans,
      totalOrdered,
      totalDispatched,
      totalReceived,
      overallFulfillmentPct: overallPct,
      is100PercentReceived,
      canTransferToBill: is100PercentReceived && pi.status !== 'BILLED'
    };
  },

  async checkAndUpdatePiStatus(id) {
    const pi = await this.getById(id);
    if (!pi || pi.status === 'BILLED' || pi.status === 'CANCELLED') return;

    const recon = await this.getPiReconciliation(id);
    if (!recon) return;

    let newStatus = null;
    if (recon.is100PercentReceived) {
      newStatus = 'DELIVERED';
    } else if (recon.totalReceived > 0) {
      newStatus = 'PARTIALLY_DELIVERED';
    } else if (recon.totalDispatched > 0) {
      newStatus = 'IN_PRODUCTION';
    }

    if (newStatus) {
      if (isCloudEnabled()) {
        try {
          await getSupabase().from('proforma_invoices').update({ 
            status: newStatus, 
            updated_at: new Date().toISOString() 
          }).eq('id', id);
        } catch (e) {
          console.warn('[FinanceRepo] Cloud checkAndUpdatePiStatus failed:', e.message);
        }
      } else {
        dbPrepare(`UPDATE proforma_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newStatus, id);
      }
    }
  },

  async transferPiToBill(id) {
    const recon = await this.getPiReconciliation(id);
    if (!recon) throw new Error('Proforma Invoice not found');
    if (!recon.is100PercentReceived) {
      throw new Error('PI cannot be transferred to Bill: 100% of order quantities must be received from Recipient side first.');
    }
    if (recon.pi.status === 'BILLED' || recon.pi.bill_number) {
      throw new Error(`This PI has already been transferred to Bill (${recon.pi.bill_number}).`);
    }

    const nextBillNumber = await this.getNextBillNumber(recon.pi.applicant_name);
    const billDate = new Date().toISOString();
    const challanIds = recon.challans.map(c => c.id);
    const challanNumbers = recon.challans.map(c => c.challan_number).join(', ');

    await this.update(id, {
      billNumber: nextBillNumber,
      billDate,
      challanIds,
      challanNumbers,
      status: 'BILLED'
    });

    return {
      id,
      billNumber: nextBillNumber,
      billDate,
      challanNumbers
    };
  }
};

module.exports = FinanceRepo;
