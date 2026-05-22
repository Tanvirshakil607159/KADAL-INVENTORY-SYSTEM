import { getSupabase } from './supabase-client';

export async function fetchAll(query, pageSize = 1000) {
  let allData = [];
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await query.range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return allData;
}

export const inventoryApi = {
  // Items
  items: {
    getAll: async (filters = {}) => {
      const supabase = getSupabase();
      let query = supabase.from('items').select('*, categories(name), suppliers(name)').eq('is_active', true);
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
      if (filters.buyerName) query = query.eq('buyer_name', filters.buyerName);
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,color.ilike.%${filters.search}%,buyer_name.ilike.%${filters.search}%,style_name.ilike.%${filters.search}%,purchase_no.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%`);
      }
      const data = await fetchAll(query.order('name'));
      return data.map(i => ({ ...i, category_name: i.categories?.name, supplier_name: i.suppliers?.name }));
    },
    getById: async (id) => {
      const { data, error } = await getSupabase().from('items').select('*, categories(name), suppliers(name)').eq('id', id).single();
      if (error) throw error;
      return { ...data, category_name: data.categories?.name, supplier_name: data.suppliers?.name };
    },
    create: async (data) => {
      const mapped = {
        item_code: data.itemCode,
        name: data.name,
        category_id: data.categoryId || null,
        size: data.size || null,
        color: data.color || null,
        unit: data.unit || 'pcs',
        supplier_id: data.supplierId || null,
        opening_stock: data.openingStock || 0,
        current_stock: data.openingStock || 0,
        min_stock_level: data.minStockLevel || 0,
        notes: data.notes || null,
        buyer_name: data.buyerName || null,
        style_name: data.styleName || null,
        purchase_no: data.purchaseNo || null,
        order_number: data.orderNumber || null,
        order_quantity: data.orderQuantity || 0,
        unit_price: data.unitPrice || 0,
        currency: data.currency || 'BDT',
        source_type: data.sourceType || 'SOURCE'
      };
      const supabase = getSupabase();
      const { data: inserted, error } = await supabase.from('items').insert([mapped]).select().single();
      if (error) throw error;

      const insertedId = inserted.id;

      if (data.openingStock && Number(data.openingStock) > 0) {
        try {
          const userRaw = sessionStorage.getItem('kadal_user');
          const user = userRaw ? JSON.parse(userRaw) : null;

          await supabase.from('stock_transactions').insert([{
            item_id: insertedId,
            type: 'IN',
            quantity: Number(data.openingStock),
            stock_before: 0,
            stock_after: Number(data.openingStock),
            reference: 'Opening Stock',
            notes: 'Initial stock entry',
            created_by: user?.id || null
          }]);
        } catch (txErr) {
          console.error('[InventoryApi] Failed to log opening stock transaction:', txErr.message);
        }

        try {
          // Find default warehouse
          const { data: defaultWh } = await supabase
            .from('warehouses')
            .select('id')
            .eq('is_default', true)
            .maybeSingle();
          let whId = defaultWh?.id;
          if (!whId) {
            const { data: firstWh } = await supabase
              .from('warehouses')
              .select('id')
              .limit(1);
            whId = firstWh?.[0]?.id || 1;
          }

          await supabase
            .from('warehouse_stock')
            .upsert({
              warehouse_id: whId,
              item_id: insertedId,
              quantity: Number(data.openingStock),
              updated_at: new Date().toISOString()
            }, { onConflict: 'warehouse_id,item_id' });
        } catch (whErr) {
          console.error('[InventoryApi] Failed to set warehouse stock:', whErr.message);
        }
      }

      return insertedId;
    },
    update: async (id, data) => {
      const mapped = {
        name: data.name,
        category_id: data.categoryId || null,
        size: data.size || null,
        color: data.color || null,
        unit: data.unit || 'pcs',
        supplier_id: data.supplierId || null,
        min_stock_level: data.minStockLevel || 0,
        notes: data.notes || null,
        buyer_name: data.buyerName || null,
        style_name: data.styleName || null,
        purchase_no: data.purchaseNo || null,
        order_number: data.orderNumber || null,
        order_quantity: data.orderQuantity || 0,
        unit_price: data.unitPrice || 0,
        currency: data.currency || 'BDT',
        source_type: data.sourceType || 'SOURCE'
      };
      const { error } = await getSupabase().from('items').update(mapped).eq('id', id);
      if (error) throw error;
      return true;
    },
    delete: async (id) => {
      const { error } = await getSupabase().from('items').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      return true;
    },
    getNextCode: async () => {
      const { data, error } = await getSupabase().from('items').select('item_code').order('item_code', { ascending: false }).limit(1);
      if (error) throw error;
      const last = data[0]?.item_code || 'KADAL-0000';
      const num = parseInt(last.split('-')[1]) + 1;
      return `KADAL-${num.toString().padStart(4, '0')}`;
    }
  },

  // Categories
  categories: {
    getAll: async () => {
      return fetchAll(getSupabase().from('categories').select('*').order('name'));
    },
    create: async (data) => {
      const { data: inserted, error } = await getSupabase().from('categories').insert([data]).select().single();
      if (error) throw error;
      return inserted.id;
    },
    delete: async (id) => {
      const { error } = await getSupabase().from('categories').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  },

  // Suppliers
  suppliers: {
    getAll: async () => {
      return fetchAll(getSupabase().from('suppliers').select('*').order('name'));
    },
    create: async (data) => {
      const { data: inserted, error } = await getSupabase().from('suppliers').insert([data]).select().single();
      if (error) throw error;
      return inserted.id;
    }
  }
};
