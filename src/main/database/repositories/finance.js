const { dbPrepare, dbTransaction, getSupabase, isCloudEnabled } = require('../connection');

function extractPrefix(name) {
  if (!name) return 'PI';
  // If name has common words like "K.A. DESIGN WEAR LTD." -> KADWL
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const letters = words.map(w => w[0].toUpperCase()).join('');
    if (letters.length >= 2 && letters.length <= 6) return letters;
  }
  return 'PI';
}

function normalizePiItem(it, idx) {
  const slNo = it.sl_no !== undefined ? it.sl_no : (it.slNo !== undefined ? it.slNo : idx + 1);
  const desc = it.item_description || it.itemDescription || it.item_name || it.name || '';
  const poStyle = it.po_style_no || it.poStyleNo || it.style_name || it.order_number || it.purchase_no || '-';
  const qty = Number(it.quantity || 0);
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
    poStyleNo: poStyle,
    po_style_no: poStyle,
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
  return {
    ...pi,
    items,
    item_count: items.length,
    total_quantity: Number(pi.total_quantity !== undefined ? pi.total_quantity : items.reduce((s, i) => s + i.quantity, 0)),
    total_amount: Number(pi.total_amount !== undefined ? pi.total_amount : items.reduce((s, i) => s + i.totalAmount, 0))
  };
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

        let result = (data || []).map(pi => {
          return normalizePi({
            ...pi,
            created_by_name: pi.users?.full_name,
            items: pi.proforma_invoice_items || [],
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

    // Fetch items for each PI
    return rows.map(pi => {
      const items = dbPrepare(`SELECT * FROM proforma_invoice_items WHERE pi_id = ? ORDER BY sl_no ASC, id ASC`).all(pi.id);
      return normalizePi({
        ...pi,
        items
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
          notes: notes || null,
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
            po_style_no: it.poStyleNo || null,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unitPrice,
            total_amount: it.totalAmount,
            notes: it.notes || null
          }));

          const { error: itemsErr } = await supabase.from('proforma_invoice_items').insert(itemRows);
          if (itemsErr) throw itemsErr;
        }

        return { id: piId, piNumber };
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud create failed, falling back to SQLite:', cloudErr.message);
      }
    }

    // Local SQLite insert
    const res = dbPrepare(`
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
      notes || null,
      createdBy || null
    );

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
          it.poStyleNo || null,
          it.quantity,
          it.unit,
          it.unitPrice,
          it.totalAmount,
          it.notes || null
        );
      }
    }

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

    let maxSeq = 0;
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
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        });
        const nextSeq = maxSeq + 1;
        return `${prefix}/KADAL/${year}/${nextSeq}`;
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getNextNumber failed, falling back to SQLite:', cloudErr.message);
      }
    }

    const rows = dbPrepare(`SELECT pi_number FROM proforma_invoices WHERE pi_number LIKE ?`).all(pattern);
    rows.forEach(row => {
      const parts = (row.pi_number || '').split('/');
      if (parts.length >= 4) {
        const seq = parseInt(parts[3], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}/KADAL/${year}/${nextSeq}`;
  },

  async getNextBillNumber(applicantName) {
    const year = new Date().getFullYear();
    const prefix = extractPrefix(applicantName);
    const pattern = `${prefix}/KADAL/${year}/%`;

    let maxSeq = 0;
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
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        });
        const nextSeq = maxSeq + 1;
        return `${prefix}/KADAL/${year}/${nextSeq}`;
      } catch (cloudErr) {
        console.warn('[FinanceRepo] Cloud getNextBillNumber failed, falling back to SQLite:', cloudErr.message);
      }
    }

    const rows = dbPrepare(`SELECT bill_number FROM proforma_invoices WHERE bill_number LIKE ?`).all(pattern);
    rows.forEach(row => {
      const parts = (row.bill_number || '').split('/');
      if (parts.length >= 4) {
        const seq = parseInt(parts[3], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });

    const nextSeq = maxSeq + 1;
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
  }
};

module.exports = FinanceRepo;
