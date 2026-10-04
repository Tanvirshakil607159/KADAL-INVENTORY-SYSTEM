import { getSupabase } from './supabase-client';

// Canonical buyer names — the "correct" format for each known buyer
const CANONICAL_BUYERS = [
  'REGATTA', 'INTERSPORTS', 'REEBOK', 'UMBRO', 'SPORTISIMO',
  'TEXTISS SAS', 'MEXICO DC', 'DARE2B', 'RAW GROUP',
  'PWT BRANDS', 'XCEL BASPOKED LTD',
];

// Known typos/aliases that map to canonical names
const BUYER_ALIASES = {
  'SPROTISIMO': 'SPORTISIMO',
};

/**
 * Normalize a buyer name to its canonical format.
 * Matching: exact (case-insensitive), alias/typo, prefix match, or fallback to UPPERCASE.
 */
function normalizeBuyerName(input) {
  if (!input || typeof input !== 'string') return input;
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const upper = trimmed.toUpperCase();
  const exactMatch = CANONICAL_BUYERS.find(b => b === upper);
  if (exactMatch) return exactMatch;
  if (BUYER_ALIASES[upper]) return BUYER_ALIASES[upper];
  const sortedBuyers = [...CANONICAL_BUYERS].sort((a, b) => b.length - a.length);
  for (const canonical of sortedBuyers) {
    if (upper.startsWith(canonical + ' ') || upper.startsWith(canonical + '-')) {
      return canonical;
    }
  }
  return upper;
}

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
      if (filters.orderNumber) query = query.eq('order_number', filters.orderNumber);
      if (filters.styleName) query = query.eq('style_name', filters.styleName);
      if (filters.purchaseNo) query = query.eq('purchase_no', filters.purchaseNo);
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,color.ilike.%${filters.search}%,buyer_name.ilike.%${filters.search}%,style_name.ilike.%${filters.search}%,purchase_no.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%`);
      }
      let tiersMap = {};
      let issueMap = {};
      try {
        const [tiersRes, issueItemsData, targetIssuesData] = await Promise.all([
          supabase.from('item_price_tiers').select('*').gt('quantity', 0).order('created_at', { ascending: true }),
          fetchAll(supabase.from('issue_items').select('item_id, issues!inner(issue_id)')).catch(() => []),
          fetchAll(supabase.from('issues').select('issue_id, produced_item_id, remarks')).catch(() => [])
        ]);
        if (tiersRes.data) {
          tiersRes.data.forEach(t => {
            if (!tiersMap[t.item_id]) tiersMap[t.item_id] = [];
            tiersMap[t.item_id].push(t);
          });
        }
        if (Array.isArray(issueItemsData)) {
          issueItemsData.forEach(ii => {
            const issueNum = ii.issues?.issue_id;
            if (issueNum && ii.item_id) {
              if (!issueMap[ii.item_id]) issueMap[ii.item_id] = new Set();
              issueMap[ii.item_id].add(issueNum);
            }
          });
        }
        if (Array.isArray(targetIssuesData)) {
          targetIssuesData.forEach(iss => {
            if (!iss.issue_id) return;
            const prodIds = new Set();
            if (iss.produced_item_id) prodIds.add(Number(iss.produced_item_id));
            if (iss.remarks) {
              const match = String(iss.remarks).match(/\[PRODUCED_ITEM_IDS:([0-9,\s]+)\]/);
              if (match && match[1]) {
                match[1].split(',').map(s => Number(s.trim())).filter(Boolean).forEach(id => prodIds.add(id));
              }
            }
            prodIds.forEach(id => {
              if (!issueMap[id]) issueMap[id] = new Set();
              issueMap[id].add(iss.issue_id);
            });
          });
        }
      } catch (e) {}

      const data = await fetchAll(query.order('name'));
      return data.map(i => {
        const itemTiers = tiersMap[i.id] || [];
        const itemIssues = issueMap[i.id];
        return {
          ...i,
          category_name: i.categories?.name,
          supplier_name: i.suppliers?.name,
          issue_numbers: itemIssues && itemIssues.size > 0 
            ? [...itemIssues].sort((a, b) => a.localeCompare(undefined, { numeric: true, sensitivity: 'base' })).join(', ') 
            : null,
          price_tiers: itemTiers.length > 0 ? itemTiers : (Number(i.current_stock) > 0 ? [{ quantity: i.current_stock, unit_price: i.unit_price, currency: i.currency, conversion_rate: i.conversion_rate }] : [])
        };
      });
    },
    getById: async (id) => {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('items').select('*, categories(name), suppliers(name)').eq('id', id).single();
      if (error) throw error;
      let itemTiers = [];
      try {
        const { data: tiers } = await supabase.from('item_price_tiers').select('*').eq('item_id', id).gt('quantity', 0).order('created_at', { ascending: true });
        if (tiers) itemTiers = tiers;
      } catch (e) {}
      return {
        ...data,
        category_name: data.categories?.name,
        supplier_name: data.suppliers?.name,
        price_tiers: itemTiers.length > 0 ? itemTiers : (Number(data.current_stock) > 0 ? [{ quantity: data.current_stock, unit_price: data.unit_price, currency: data.currency, conversion_rate: data.conversion_rate }] : [])
      };
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
        buyer_name: data.buyerName ? normalizeBuyerName(data.buyerName) : null,
        style_name: data.styleName || null,
        purchase_no: data.purchaseNo || null,
        order_number: data.orderNumber || null,
        order_quantity: data.orderQuantity || 0,
        unit_price: data.unitPrice || 0,
        currency: data.currency || 'BDT',
        conversion_rate: data.currency === 'USD' ? (Number(data.conversionRate) || null) : null,
        source_type: data.sourceType || 'SOURCE'
      };
      const supabase = getSupabase();
      const { data: inserted, error } = await supabase.from('items').insert([mapped]).select().single();
      if (error) throw error;

      const insertedId = inserted.id;

      if (data.openingStock && Number(data.openingStock) > 0) {
        try {
          await supabase.from('item_price_tiers').insert([{
            item_id: insertedId,
            quantity: Number(data.openingStock),
            unit_price: Number(data.unitPrice || 0),
            currency: data.currency || 'BDT',
            conversion_rate: data.currency === 'USD' ? (Number(data.conversionRate) || null) : null
          }]);
        } catch (e) {}

        try {
          const userRaw = sessionStorage.getItem('kadal_user');
          const user = userRaw ? JSON.parse(userRaw) : null;

          await supabase.from('stock_transactions').insert([{
            item_id: insertedId,
            type: 'IN',
            quantity: Number(data.openingStock),
            stock_before: 0,
            stock_after: Number(data.openingStock),
            unit_price: Number(data.unitPrice || 0),
            currency: data.currency || 'BDT',
            conversion_rate: data.currency === 'USD' ? (Number(data.conversionRate) || null) : null,
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
        buyer_name: data.buyerName ? normalizeBuyerName(data.buyerName) : null,
        style_name: data.styleName || null,
        purchase_no: data.purchaseNo || null,
        order_number: data.orderNumber || null,
        order_quantity: data.orderQuantity || 0,
        unit_price: data.unitPrice || 0,
        currency: data.currency || 'BDT',
        conversion_rate: data.currency === 'USD' ? (Number(data.conversionRate) || null) : null,
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
    },
    getDistinctValues: async () => {
      const supabase = getSupabase();
      const data = await fetchAll(
        supabase.from('items')
          .select('name, color, size, style_name, purchase_no, order_number, buyer_name, notes')
          .eq('is_active', true)
      );
      const res = { names: new Set(), colors: new Set(), sizes: new Set(), styles: new Set(), purchases: new Set(), orders: new Set(), buyers: new Set(), notes: new Set() };
      data.forEach(i => {
        if (i.name) res.names.add(i.name);
        if (i.color) res.colors.add(i.color);
        if (i.size) res.sizes.add(i.size);
        if (i.style_name) res.styles.add(i.style_name);
        if (i.purchase_no) res.purchases.add(i.purchase_no);
        if (i.order_number) res.orders.add(i.order_number);
        if (i.buyer_name) res.buyers.add(i.buyer_name);
        if (i.notes) res.notes.add(i.notes);
      });
      const cData = await fetchAll(
        supabase.from('challans')
          .select('receiver_name')
          .not('receiver_name', 'is', null)
          .neq('receiver_name', '')
      ).catch(() => []);
      const receivers = new Set();
      if (cData) cData.forEach(c => receivers.add(c.receiver_name));

      return {
        names: [...res.names].sort(),
        colors: [...res.colors].sort(),
        sizes: [...res.sizes].sort(),
        styles: [...res.styles].sort(),
        purchases: [...res.purchases].sort(),
        orders: [...res.orders].sort(),
        buyers: [...res.buyers].sort(),
        notes: [...res.notes].sort(),
        receivers: [...receivers].sort(),
      };
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
