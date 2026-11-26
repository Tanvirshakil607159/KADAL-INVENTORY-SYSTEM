const LOCKED_PI_STATUSES = new Set([
  'BILLED',
  'IN_PRODUCTION',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CANCELLED',
]);

function hasChallanIds(raw) {
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

/** Return true once a PI has entered reconciliation (challans/deliveries) or been billed. */
export function isPiLockedForItemSync(pi, activeChallanPiIds = null) {
  if (!pi) return true;
  const status = String(pi.status || '').toUpperCase();
  if (pi.bill_number || LOCKED_PI_STATUSES.has(status)) return true;
  if (activeChallanPiIds && activeChallanPiIds.has(String(pi.id))) return true;
  if (hasChallanIds(pi.challan_ids)) return true;
  const items = pi.proforma_invoice_items || pi.items || [];
  if (items.some((line) => Boolean(line.challan_id || line.challanId))) return true;
  return false;
}

/**
 * Shared helpers to propagate edited inventory item fields to linked
 * unlocked (non-billed, pre-reconciliation) Proforma Invoices and pending CREATE_PI payloads.
 */

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripColorFromDescription(desc) {
  return String(desc ?? '').replace(/\s*\(Color:\s*[^)]*\)/gi, '').trim();
}

export function buildItemPoStyle(item) {
  const orderNumber = String(item?.orderNumber ?? item?.order_number ?? '').trim();
  const styleName = String(item?.styleName ?? item?.style_name ?? '').trim();
  const purchaseNo = String(item?.purchaseNo ?? item?.purchase_no ?? '').trim();

  const parts = [];
  if (orderNumber) parts.push(`Order: ${orderNumber}`);
  if (styleName) parts.push(`Style: ${styleName}`);
  const poStyleClean = parts.length > 0 ? parts.join(' / ') : '-';
  const combinedPoStyle = purchaseNo
    ? (poStyleClean !== '-' ? `${poStyleClean} / Purchase No: ${purchaseNo}` : `Purchase No: ${purchaseNo}`)
    : poStyleClean;

  return { orderNumber, styleName, purchaseNo, poStyleClean, combinedPoStyle };
}

function hasPoStyleFields(item) {
  if (!item || typeof item !== 'object') return false;
  return (
    'orderNumber' in item ||
    'order_number' in item ||
    'styleName' in item ||
    'style_name' in item ||
    'purchaseNo' in item ||
    'purchase_no' in item
  );
}

export function buildPiLineFieldsFromItem(updatedItem, existingPiItem, oldItem = null) {
  const rawDesc = updatedItem?.name !== undefined
    ? updatedItem.name
    : (existingPiItem.item_description || existingPiItem.itemDescription || 'Custom Accessory Item');
  const itemDescription = stripColorFromDescription(rawDesc) || 'Custom Accessory Item';

  const poMeta = buildItemPoStyle(updatedItem);
  const updatePoStyle = hasPoStyleFields(updatedItem);
  const poStyleNo = updatePoStyle
    ? poMeta.combinedPoStyle
    : (existingPiItem.po_style_no || existingPiItem.poStyleNo || '-');

  const unit = updatedItem?.unit !== undefined
    ? (String(updatedItem.unit || 'PCS').trim().toUpperCase() || 'PCS')
    : (String(existingPiItem.unit || 'PCS').trim().toUpperCase() || 'PCS');

  const hasUnitPrice = updatedItem && (updatedItem.unitPrice !== undefined || updatedItem.unit_price !== undefined);
  const unitPrice = hasUnitPrice
    ? (Number(updatedItem.unitPrice ?? updatedItem.unit_price) || 0)
    : (Number(existingPiItem.unit_price ?? existingPiItem.unitPrice) || 0);

  const currentPiQty = Number(existingPiItem.quantity) || 0;
  const oldOrderQty = oldItem ? (Number(oldItem.orderQuantity ?? oldItem.order_quantity) || 0) : null;
  const hasNewOrderQty = updatedItem && (updatedItem.orderQuantity !== undefined || updatedItem.order_quantity !== undefined);
  const newOrderQty = hasNewOrderQty ? (Number(updatedItem.orderQuantity ?? updatedItem.order_quantity) || 0) : null;
  const hasChallanLink = Boolean(existingPiItem.challan_id || existingPiItem.challanId);

  // Sync quantity only when the PI line mirrored the previous order quantity cleanly.
  let quantity = currentPiQty;
  if (
    !hasChallanLink &&
    newOrderQty !== null &&
    newOrderQty > 0 &&
    oldOrderQty !== null &&
    newOrderQty !== oldOrderQty &&
    currentPiQty === oldOrderQty
  ) {
    quantity = newOrderQty;
  }

  const totalAmount = Number((quantity * unitPrice).toFixed(2)) || 0;

  return {
    item_description: itemDescription,
    po_style_no: poStyleNo,
    poStyleClean: updatePoStyle ? poMeta.poStyleClean : (existingPiItem.poStyleNo || existingPiItem.po_style_no || '-'),
    orderNumber: updatePoStyle ? poMeta.orderNumber : (existingPiItem.orderNumber || existingPiItem.order_number || ''),
    styleName: updatePoStyle ? poMeta.styleName : (existingPiItem.styleName || existingPiItem.style_name || ''),
    purchaseNo: updatePoStyle ? poMeta.purchaseNo : (existingPiItem.purchaseNo || existingPiItem.purchase_no || ''),
    quantity,
    unit,
    unit_price: unitPrice,
    total_amount: totalAmount,
  };
}

export function computePiHeaderTotals(items, currency = 'USD', numberToWordsFn = null) {
  const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalAmount = Number(
    items.reduce((sum, it) => sum + (Number(it.total_amount ?? it.totalAmount) || 0), 0).toFixed(2)
  ) || 0;

  let amountInWords = 'ZERO ONLY';
  if (totalAmount > 0 && typeof numberToWordsFn === 'function') {
    amountInWords = `IN WORDS: ${numberToWordsFn(totalAmount, currency || 'USD')}`;
  }

  return { total_quantity: totalQuantity, total_amount: totalAmount, amount_in_words: amountInWords };
}

export function updateNotesPurchaseNo(notes, oldPurchaseNo, newPurchaseNo) {
  if (!notes || !oldPurchaseNo || oldPurchaseNo === newPurchaseNo) return notes;
  const pattern = new RegExp(`Purchase(?:\\s*No)?\\s*[:=]\\s*${escapeRegex(oldPurchaseNo)}(?=$|\\s*[|;\\n])`, 'i');
  if (!pattern.test(notes)) return notes;

  if (newPurchaseNo) {
    return notes.replace(pattern, `Purchase No: ${newPurchaseNo}`);
  }
  return notes
    .replace(pattern, '')
    .replace(/\s*[|;]\s*[|;]\s*/g, ' | ')
    .replace(/^[\s|;]+|[\s|;]+$/g, '') || null;
}

export function syncPendingCreatePiPayload(rawPayload, itemId, updatedItem, oldItem = null, numberToWordsFn = null) {
  if (!rawPayload || !Array.isArray(rawPayload.items)) return { changed: false, payload: rawPayload };

  let changed = false;
  const oldPurchaseNo = oldItem ? String(oldItem.purchaseNo ?? oldItem.purchase_no ?? '').trim() : '';
  const newPurchaseNo = updatedItem?.purchaseNo !== undefined || updatedItem?.purchase_no !== undefined
    ? String(updatedItem.purchaseNo ?? updatedItem.purchase_no ?? '').trim()
    : oldPurchaseNo;

  const nextItems = rawPayload.items.map((it) => {
    const itItemId = it.itemId ?? it.item_id;
    if (itItemId === null || itItemId === undefined || String(itItemId) !== String(itemId)) {
      return it;
    }
    changed = true;
    const synced = buildPiLineFieldsFromItem(updatedItem, it, oldItem);
    return {
      ...it,
      itemDescription: synced.item_description,
      item_description: synced.item_description,
      orderNumber: synced.orderNumber,
      order_number: synced.orderNumber,
      styleName: synced.styleName,
      style_name: synced.styleName,
      purchaseNo: synced.purchaseNo,
      purchase_no: synced.purchaseNo,
      poStyleNo: synced.poStyleClean,
      po_style_no: synced.po_style_no,
      quantity: synced.quantity,
      unit: synced.unit,
      unitPrice: synced.unit_price,
      unit_price: synced.unit_price,
      totalAmount: synced.total_amount,
      total_amount: synced.total_amount,
    };
  });

  if (!changed) return { changed: false, payload: rawPayload };

  const totals = computePiHeaderTotals(nextItems, rawPayload.currency || 'USD', numberToWordsFn);
  const nextPayload = {
    ...rawPayload,
    items: nextItems,
    totalQuantity: totals.total_quantity,
    total_quantity: totals.total_quantity,
    totalAmount: totals.total_amount,
    total_amount: totals.total_amount,
    amountInWords: totals.amount_in_words,
    amount_in_words: totals.amount_in_words,
  };

  if (oldPurchaseNo && oldPurchaseNo !== newPurchaseNo) {
    if (String(rawPayload.purchaseNo || '').trim() === oldPurchaseNo) nextPayload.purchaseNo = newPurchaseNo || null;
    if (String(rawPayload.purchaseNumber || '').trim() === oldPurchaseNo) nextPayload.purchaseNumber = newPurchaseNo || null;
    if (rawPayload.notes) {
      nextPayload.notes = updateNotesPurchaseNo(rawPayload.notes, oldPurchaseNo, newPurchaseNo);
    }
  }

  return { changed: true, payload: nextPayload };
}

export async function syncItemToSupabasePis(supabase, itemId, updatedItem, oldItem = null, numberToWordsFn = null) {
  if (!supabase || !itemId) return;

  const oldPurchaseNo = oldItem ? String(oldItem.purchaseNo ?? oldItem.purchase_no ?? '').trim() : '';
  const newPurchaseNo = updatedItem?.purchaseNo !== undefined || updatedItem?.purchase_no !== undefined
    ? String(updatedItem.purchaseNo ?? updatedItem.purchase_no ?? '').trim()
    : oldPurchaseNo;

  // 1. Sync linked non-BILLED Proforma Invoices
  const { data: matchedRows, error: matchErr } = await supabase
    .from('proforma_invoice_items')
    .select('id, pi_id')
    .eq('item_id', itemId);
  if (matchErr) throw matchErr;

  const piIds = [...new Set((matchedRows || []).map(r => r.pi_id).filter(Boolean))];
  if (piIds.length > 0) {
    const [{ data: pis, error: piErr }, { data: activeChallans, error: chErr }] = await Promise.all([
      supabase
        .from('proforma_invoices')
        .select('id, status, bill_number, challan_ids, currency, notes, proforma_invoice_items(*)')
        .in('id', piIds),
      supabase
        .from('challans')
        .select('pi_id')
        .in('pi_id', piIds)
        .eq('status', 'ACTIVE'),
    ]);
    if (piErr) throw piErr;
    if (chErr) throw chErr;

    const activeChallanPiIds = new Set((activeChallans || []).map((c) => String(c.pi_id)).filter(Boolean));

    for (const pi of pis || []) {
      if (isPiLockedForItemSync(pi, activeChallanPiIds)) continue;

      const allItems = pi.proforma_invoice_items || [];
      const updatedItems = [];

      for (const line of allItems) {
        if (String(line.item_id) !== String(itemId)) {
          updatedItems.push(line);
          continue;
        }
        const synced = buildPiLineFieldsFromItem(updatedItem, line, oldItem);
        const lineUpdate = {
          item_description: synced.item_description,
          po_style_no: synced.po_style_no,
          quantity: synced.quantity,
          unit: synced.unit,
          unit_price: synced.unit_price,
          total_amount: synced.total_amount,
        };
        const { error: upLineErr } = await supabase
          .from('proforma_invoice_items')
          .update(lineUpdate)
          .eq('id', line.id);
        if (upLineErr) throw upLineErr;

        updatedItems.push({ ...line, ...lineUpdate });
      }

      const headerTotals = computePiHeaderTotals(updatedItems, pi.currency || 'USD', numberToWordsFn);
      const headerUpdate = {
        ...headerTotals,
        updated_at: new Date().toISOString(),
      };
      const nextNotes = updateNotesPurchaseNo(pi.notes, oldPurchaseNo, newPurchaseNo);
      if (nextNotes !== pi.notes) headerUpdate.notes = nextNotes;

      const { error: upPiErr } = await supabase
        .from('proforma_invoices')
        .update(headerUpdate)
        .eq('id', pi.id);
      if (upPiErr) throw upPiErr;
    }
  }

  // 2. Sync pending CREATE_PI approval requests
  const { data: pendingApprovals, error: appErr } = await supabase
    .from('approvals')
    .select('id, data')
    .eq('type', 'CREATE_PI')
    .eq('status', 'PENDING');
  if (appErr) throw appErr;

  for (const app of pendingApprovals || []) {
    let parsed = app.data;
    const wasString = typeof app.data === 'string';
    if (wasString) {
      try { parsed = JSON.parse(app.data); } catch { continue; }
    }
    const { changed, payload } = syncPendingCreatePiPayload(parsed, itemId, updatedItem, oldItem, numberToWordsFn);
    if (!changed) continue;

    const { error: upAppErr } = await supabase
      .from('approvals')
      .update({ data: wasString ? JSON.stringify(payload) : payload })
      .eq('id', app.id);
    if (upAppErr) throw upAppErr;
  }
}
