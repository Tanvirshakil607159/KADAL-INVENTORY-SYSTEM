import { getSupabase } from './supabase-client';

export const challansApi = {
  getAll: async (filters = {}) => {
    const supabase = getSupabase();
    let query = supabase.from('challans').select(`
      *,
      items:challan_items(*),
      created_by_user:users!challans_created_by_fkey (full_name),
      cancelled_by_user:users!challans_cancelled_by_fkey (full_name)
    `).order('challan_date', { ascending: false });
    if (filters.receiverName) query = query.ilike('receiver_name', `%${filters.receiverName}%`);
    const { data, error } = await query.limit(50);
    if (error) throw error;
    if (data) {
      data.forEach(d => {
        d.created_by_name = d.created_by_user?.full_name;
        d.cancelled_by_name = d.cancelled_by_user?.full_name;
      });
    }
    return data;
  },
  getById: async (id) => {
    const { data, error } = await getSupabase().from('challans').select(`
      *,
      items:challan_items(*),
      created_by_user:users!challans_created_by_fkey (full_name),
      cancelled_by_user:users!challans_cancelled_by_fkey (full_name)
    `).eq('id', id).single();
    if (error) throw error;
    if (data) {
      data.created_by_name = data.created_by_user?.full_name;
      data.cancelled_by_name = data.cancelled_by_user?.full_name;
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
    // 1. Create challan
    const { data: challan, error } = await supabase.from('challans').insert([{
      challan_number: data.challanNumber,
      challan_date: data.challanDate,
      receiver_name: data.receiverName,
      receiver_contact: data.receiverContact,
      receiver_address: data.receiverAddress,
      notes: data.notes,
      total_items: data.items.length,
      status: 'DELIVERED'
    }]).select().single();
    if (error) throw error;

    // 2. Create challan items
    const challanItems = data.items.map(item => ({
      challan_id: challan.id,
      item_id: item.itemId,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes
    }));
    const { error: itemsErr } = await supabase.from('challan_items').insert(challanItems);
    if (itemsErr) throw itemsErr;

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
  }
};
