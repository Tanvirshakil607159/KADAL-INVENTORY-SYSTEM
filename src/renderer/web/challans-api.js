import { getSupabase } from './supabase-client';

export const challansApi = {
  getAll: async (filters = {}) => {
    const supabase = getSupabase();
    let query = supabase.from('challans').select(`
      *,
      challan_items:challan_items(quantity, items(name, buyer_name, style_name, order_number, purchase_no, unit_price, currency)),
      created_by_user:users!challans_created_by_fkey (full_name),
      cancelled_by_user:users!challans_cancelled_by_fkey (full_name)
    `).order('challan_date', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.receivedStatus) query = query.eq('received_status', filters.receivedStatus);
    if (filters.piId) query = query.eq('pi_id', filters.piId);
    if (filters.onlyWithPi) query = query.not('pi_id', 'is', null);
    if (filters.receiverName) query = query.ilike('receiver_name', `%${filters.receiverName}%`);
    if (filters.dateFrom) query = query.gte('challan_date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('challan_date', filters.dateTo + 'T23:59:59.999Z');

    const limit = filters.limit || 2000;
    const { data, error } = await query.limit(limit);
    if (error) throw error;
    if (data) {
      data.forEach(d => {
        d.created_by_name = d.created_by_user?.full_name;
        d.cancelled_by_name = d.cancelled_by_user?.full_name;
        const ci = d.challan_items || [];
        d.item_count = ci.length;
        d.total_quantity = ci.reduce((sum, item) => sum + (item.quantity || 0), 0);
        d.item_names = ci.map(item => item.items?.name).filter(Boolean).join(', ');
        d.buyer_names = [...new Set(ci.map(item => item.items?.buyer_name).filter(Boolean))].join(', ');
        d.style_names = [...new Set(ci.map(item => item.items?.style_name).filter(Boolean))].join(', ');
        d.order_numbers = [...new Set(ci.map(item => item.items?.order_number).filter(Boolean))].join(', ');
        d.purchase_nos = [...new Set(ci.map(item => item.items?.purchase_no).filter(Boolean))].join(', ');
      });

      if (filters.search) {
        const s = filters.search.toLowerCase();
        return data.filter(d => 
          (d.challan_number && d.challan_number.toLowerCase().includes(s)) ||
          (d.receiver_name && d.receiver_name.toLowerCase().includes(s)) ||
          (d.buyer_names && d.buyer_names.toLowerCase().includes(s)) ||
          (d.item_names && d.item_names.toLowerCase().includes(s)) ||
          (d.style_names && d.style_names.toLowerCase().includes(s)) ||
          (d.order_numbers && d.order_numbers.toLowerCase().includes(s)) ||
          (d.purchase_nos && d.purchase_nos.toLowerCase().includes(s))
        );
      }
    }
    return data;
  },
  getById: async (id) => {
    const { data, error } = await getSupabase().from('challans').select(`
      *,
      items:challan_items(*, items(*)),
      created_by_user:users!challans_created_by_fkey (full_name),
      cancelled_by_user:users!challans_cancelled_by_fkey (full_name)
    `).eq('id', id).single();
    if (error) throw error;
    if (data) {
      data.created_by_name = data.created_by_user?.full_name;
      data.cancelled_by_name = data.cancelled_by_user?.full_name;
      data.items = (data.items || []).map(ci => {
        const item = ci.items || {};
        return {
          ...ci,
          item_name: item.name,
          item_code: item.item_code,
          size: item.size,
          color: item.color,
          buyer_name: item.buyer_name,
          style_name: item.style_name,
          purchase_no: item.purchase_no,
          order_quantity: item.order_quantity,
          current_stock: item.current_stock,
          order_number: item.order_number,
          unit_price: item.unit_price,
          currency: item.currency,
        };
      });
    }
    return data;
  },
  getByNumber: async (number) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    const { data: challan, error } = await supabase.from('challans').select(`
      *,
      created_by_user:users!challans_created_by_fkey (full_name),
      cancelled_by_user:users!challans_cancelled_by_fkey (full_name)
    `).eq('challan_number', number).maybeSingle();
    if (error) throw error;
    if (!challan) return null;

    challan.created_by_name = challan.created_by_user?.full_name;
    challan.cancelled_by_name = challan.cancelled_by_user?.full_name;

    const { data: items, error: itemsErr } = await supabase.from('challan_items').select('*, items(*)').eq('challan_id', challan.id);
    if (itemsErr) throw itemsErr;

    challan.items = (items || []).map(ci => {
      const item = ci.items || {};
      return {
        ...ci,
        item_name: item.name,
        item_code: item.item_code,
        size: item.size,
        color: item.color,
        buyer_name: item.buyer_name,
        style_name: item.style_name,
        purchase_no: item.purchase_no,
        order_quantity: item.order_quantity,
        current_stock: item.current_stock,
        order_number: item.order_number
      };
    });
    return challan;
  },
  create: async (data) => {
    const supabase = getSupabase();
    let linkedPiId = data.piId || data.pi_id || null;

    // Policy: If any item belongs to a specific active PI, automatically link this challan to that PI
    if (!linkedPiId && data.items && data.items.length > 0) {
      const itemIds = data.items.map(it => it.itemId || it.item_id).filter(Boolean);
      if (itemIds.length > 0) {
        try {
          const { data: piItems, error: piiErr } = await supabase
            .from('proforma_invoice_items')
            .select('id, pi_id, item_id, proforma_invoices!inner(id, status)')
            .in('item_id', itemIds)
            .neq('proforma_invoices.status', 'CANCELLED')
            .order('pi_id', { ascending: false });

          if (!piiErr && piItems && piItems.length > 0) {
            linkedPiId = piItems[0].pi_id;
          }
        } catch (err) {
          console.warn('[challansApi] Error auto-detecting PI for challan items:', err.message);
        }
      }
    }

    let piItemMap = {};
    if (linkedPiId) {
      try {
        const { data: pItems } = await supabase
          .from('proforma_invoice_items')
          .select('id, item_id')
          .eq('pi_id', linkedPiId);
        if (pItems) {
          pItems.forEach(piIt => {
            if (piIt.item_id) piItemMap[piIt.item_id] = piIt.id;
          });
        }
      } catch (err) {
        console.warn('[challansApi] Error fetching PI items for mapping:', err.message);
      }
    }

    // 1. Create challan
    const challanInsert = {
      challan_number: data.challanNumber,
      challan_date: data.challanDate,
      receiver_name: data.receiverName,
      receiver_contact: data.receiverContact || null,
      receiver_address: data.receiverAddress || null,
      notes: data.notes || null,
      total_items: data.items.length,
      status: 'ACTIVE'
    };
    if (linkedPiId) {
      challanInsert.pi_id = linkedPiId;
      challanInsert.received_status = 'PENDING';
    }

    const { data: challan, error } = await supabase.from('challans').insert([challanInsert]).select().single();
    if (error) throw error;

    // 2. Create challan items
    const challanItems = data.items.map(item => {
      const itemId = item.itemId || item.item_id;
      const piItem = item.piItemId || item.pi_item_id || piItemMap[itemId];
      const obj = {
        challan_id: challan.id,
        item_id: itemId,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes || null
      };
      if (piItem) obj.pi_item_id = piItem;
      if (linkedPiId) obj.received_quantity = 0;
      return obj;
    });
    const { error: itemsErr } = await supabase.from('challan_items').insert(challanItems);
    if (itemsErr) throw itemsErr;

    // Update PI records
    if (linkedPiId) {
      try {
        const { data: allLinked } = await supabase
          .from('challans')
          .select('id, challan_number')
          .eq('pi_id', linkedPiId)
          .eq('status', 'ACTIVE');
        const ids = (allLinked || []).map(c => c.id);
        const numbers = (allLinked || []).map(c => c.challan_number).join(', ');
        await supabase
          .from('proforma_invoices')
          .update({ challan_ids: ids, challan_numbers: numbers, updated_at: new Date().toISOString() })
          .eq('id', linkedPiId);
      } catch (e) {
        console.warn('[challansApi] Error updating PI challan records:', e.message);
      }
    }

    // 3. Update stock (simplified for web) and write stock transactions
    const userRaw = sessionStorage.getItem('kadal_user');
    const user = userRaw ? JSON.parse(userRaw) : null;

    for (const item of data.items) {
      const { data: currentItem } = await supabase.from('items').select('current_stock').eq('id', item.itemId).single();
      const stockBefore = currentItem?.current_stock || 0;
      const newStock = stockBefore - item.quantity;
      await supabase.from('items').update({ current_stock: newStock }).eq('id', item.itemId);

      // Log transaction
      await supabase.from('stock_transactions').insert([{
        item_id: item.itemId,
        type: 'OUT',
        quantity: item.quantity,
        stock_before: stockBefore,
        stock_after: newStock,
        challan_id: challan.id,
        reference: `Challan: ${data.challanNumber}`,
        notes: `Delivered to ${data.receiverName}`,
        created_by: user?.id || null
      }]);
    }

    return challan.id;
  },
  getNextNumber: async () => {
    const { data, error } = await getSupabase().from('challans').select('challan_number').order('challan_number', { ascending: false }).limit(1);
    if (error) throw error;
    const last = data[0]?.challan_number || 'CH-0000';
    const num = parseInt(last.replace('CH-', '')) + 1;
    return `CH-${num.toString().padStart(4, '0')}`;
  },
  receive: async (id, receiptData) => {
    const supabase = getSupabase();
    const { receivedBy, receivedAt, receivedNotes, items } = receiptData;
    const dateVal = receivedAt || new Date().toISOString();

    if (items && Array.isArray(items)) {
      for (const it of items) {
        await supabase.from('challan_items').update({
          received_quantity: Number(it.receivedQuantity) || 0,
          rejection_quantity: Number(it.rejectionQuantity) || 0
        }).eq('id', it.id);
      }
    }

    let finalStatus = 'RECEIVED';
    if (items && items.some(it => (Number(it.receivedQuantity) || 0) < (Number(it.quantity) || 0))) {
      finalStatus = 'PARTIAL';
    }

    const { error } = await supabase.from('challans').update({
      received_status: finalStatus,
      received_at: dateVal,
      received_by: receivedBy || 'Recipient',
      received_notes: receivedNotes || null,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) throw error;
    return { success: true, receivedStatus: finalStatus };
  },
  getPendingReceipt: async (filters = {}) => {
    return challansApi.getAll({ ...filters, onlyWithPi: true, receivedStatus: filters.receivedStatus || 'PENDING' });
  }
};
