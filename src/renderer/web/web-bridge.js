import { getSupabase, isCloudEnabled } from './supabase-client';
import bcrypt from 'bcryptjs';
import { inventoryApi, fetchAll } from './inventory-api';
import { challansApi } from './challans-api';

// Helper to wrap Supabase calls in the same response format as IPC
async function wrap(fn) {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    console.error('[WebBridge Error]', err.message);
    return { success: false, error: err.message };
  }
}

export const webBridge = {
  // Auth
  auth: {
    login: (username, password) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');

      const { data: user, error } = await supabase
        .from('users')
        .select('*, roles(name, permissions)')
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;
      if (!user) throw new Error('Invalid username or password');
      if (!user.is_active) throw new Error('Account is deactivated');

      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) throw new Error('Invalid username or password');

      // Update last login
      await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

      const currentUser = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        roleId: user.role_id,
        roleName: user.roles?.name,
        permissions: JSON.parse(user.roles?.permissions || user.permissions || '{}'),
      };
      
      sessionStorage.setItem('kadal_user', JSON.stringify(currentUser));
      return currentUser;
    }),
    logout: () => wrap(async () => {
      sessionStorage.removeItem('kadal_user');
      return true;
    }),
    getCurrentUser: () => wrap(async () => {
      const saved = sessionStorage.getItem('kadal_user');
      return saved ? JSON.parse(saved) : null;
    }),
    syncSession: (user) => wrap(async () => {
      sessionStorage.setItem('kadal_user', JSON.stringify(user));
      return true;
    }),
    changePassword: (userId, oldPw, newPw) => wrap(async () => {
      const supabase = getSupabase();
      const { data: user, error } = await supabase.from('users').select('password_hash').eq('id', userId).single();
      if (error) throw error;
      if (!bcrypt.compareSync(oldPw, user.password_hash)) throw new Error('Current password incorrect');
      const hash = bcrypt.hashSync(newPw, 10);
      await supabase.from('users').update({ password_hash: hash }).eq('id', userId);
      return true;
    })
  },

  // Settings
  settings: {
    getAll: () => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) {
        // Return local storage settings as fallback
        const settings = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          settings[key] = localStorage.getItem(key);
        }
        return settings;
      }
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      const settings = {};
      data.forEach(s => { settings[s.key] = s.value; });
      // Merge with localStorage (for URL/Key)
      settings.supabase_url = localStorage.getItem('supabase_url');
      settings.supabase_key = localStorage.getItem('supabase_key');
      return settings;
    }),
    get: (key) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return localStorage.getItem(key);
      const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
      if (error) throw error;
      return data?.value || localStorage.getItem(key);
    }),
    set: (key, value) => wrap(async () => {
      localStorage.setItem(key, value);
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('settings').upsert({ key, value });
      }
      return true;
    }),
    setBulk: (settings) => wrap(async () => {
      const supabase = getSupabase();
      const entries = Object.entries(settings);
      for (const [key, value] of entries) {
        localStorage.setItem(key, value);
        if (supabase) await supabase.from('settings').upsert({ key, value });
      }
      return true;
    })
  },

  // Users
  users: {
    getAll: () => wrap(async () => {
      const { data, error } = await getSupabase().from('users').select('*, roles(name)').order('full_name');
      if (error) throw error;
      return data.map(u => ({ ...u, roleName: u.roles?.name }));
    }),
    create: (data) => wrap(async () => {
      const hash = bcrypt.hashSync(data.password, 10);
      const { data: inserted, error } = await getSupabase().from('users').insert([{
        username: data.username,
        password_hash: hash,
        full_name: data.fullName,
        role_id: data.roleId,
        is_active: true
      }]).select().single();
      if (error) throw error;
      return inserted.id;
    }),
  },

  // Buyers
  buyers: {
    getAll: () => wrap(async () => {
      const { data, error } = await getSupabase().from('buyers').select('*').order('name');
      if (error) throw error;
      return data;
    }),
  },

  // Categories
  categories: {
    getAll: () => wrap(inventoryApi.categories.getAll),
    create: (data) => wrap(() => inventoryApi.categories.create(data)),
    delete: (id) => wrap(() => inventoryApi.categories.delete(id)),
  },
  
  units: {
    getAll: () => wrap(async () => {
      const { data, error } = await getSupabase().from('units').select('*').order('name');
      if (error) throw error;
      return data;
    }),
  },
  
  suppliers: {
    getAll: () => wrap(inventoryApi.suppliers.getAll),
    create: (data) => wrap(() => inventoryApi.suppliers.create(data)),
  },
  
  items: {
    getAll: (filters) => wrap(() => inventoryApi.items.getAll(filters)),
    getById: (id) => wrap(() => inventoryApi.items.getById(id)),
    create: (data) => wrap(() => inventoryApi.items.create(data)),
    update: (id, data) => wrap(() => inventoryApi.items.update(id, data)),
    delete: (id) => wrap(() => inventoryApi.items.delete(id)),
    getNextCode: () => wrap(inventoryApi.items.getNextCode),
  },

  // Stock
  stock: {
    addMovement: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data: item, error: itemErr } = await supabase.from('items').select('current_stock').eq('id', data.itemId).single();
      if (itemErr) throw itemErr;

      const stockBefore = item.current_stock || 0;
      let stockAfter = stockBefore;
      if (data.type === 'IN') {
        stockAfter = stockBefore + data.quantity;
      } else if (data.type === 'OUT') {
        stockAfter = stockBefore - data.quantity;
        if (stockAfter < 0) {
          throw new Error(`Insufficient stock. Available: ${stockBefore}, Requested: ${data.quantity}`);
        }
      } else if (data.type === 'ADJUSTMENT') {
        stockAfter = data.quantity;
      } else {
        throw new Error('Invalid movement type');
      }

      await supabase.from('items').update({ current_stock: stockAfter }).eq('id', data.itemId);

      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      const { error: txErr } = await supabase.from('stock_transactions').insert([{
        item_id: data.itemId,
        type: data.type,
        quantity: data.quantity,
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference: data.reference || null,
        notes: data.notes || null,
        created_by: user?.id || null
      }]);
      if (txErr) throw txErr;

      return { success: true, stockAfter };
    }),
    getTransactions: (filters = {}) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      let query = supabase
        .from('stock_transactions')
        .select(`
          *,
          items (
            name, item_code, unit, unit_price, currency, 
            style_name, purchase_no, order_number, order_quantity, size, color, buyer_name
          ),
          users (full_name),
          challans (challan_number)
        `);

      if (filters.itemId) query = query.eq('item_id', filters.itemId);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59.999Z');

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;

      return data.map(st => ({
        ...st,
        item_name: st.items?.name,
        item_code: st.items?.item_code,
        item_unit: st.items?.unit,
        unit_price: st.items?.unit_price,
        currency: st.items?.currency,
        style_name: st.items?.style_name,
        purchase_no: st.items?.purchase_no,
        order_number: st.items?.order_number,
        size: st.items?.size,
        color: st.items?.color,
        buyer_name: st.items?.buyer_name,
        created_by_name: st.users?.full_name,
        challan_number: st.challans?.challan_number
      }));
    }),
  },

  // Challans
  challans: {
    getAll: (filters) => wrap(() => challansApi.getAll(filters)),
    getById: (id) => wrap(() => challansApi.getById(id)),
    getByNumber: (number) => wrap(() => challansApi.getByNumber(number)),
    create: (data) => wrap(() => challansApi.create(data)),
    getNextNumber: () => wrap(challansApi.getNextNumber),
    cancel: (id, reason) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data: challan, error: cErr } = await supabase.from('challans').select('*, items:challan_items(*)').eq('id', id).single();
      if (cErr) throw cErr;
      if (challan.status === 'CANCELLED') throw new Error('Already cancelled');

      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      const { error: updateErr } = await supabase.from('challans')
        .update({ status: 'CANCELLED', cancelled_by: user?.id || null, cancel_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateErr) throw updateErr;

      for (const item of (challan.items || [])) {
        const { data: dbItem } = await supabase.from('items').select('current_stock').eq('id', item.item_id).single();
        if (dbItem) {
          const stockBefore = dbItem.current_stock || 0;
          const stockAfter = stockBefore + item.quantity;
          await supabase.from('items').update({ current_stock: stockAfter }).eq('id', item.item_id);

          await supabase.from('stock_transactions').insert([{
            item_id: item.item_id,
            type: 'IN',
            quantity: item.quantity,
            stock_before: stockBefore,
            stock_after: stockAfter,
            challan_id: id,
            reference: `Challan Cancelled: ${challan.challan_number}`,
            notes: `Stock reversed. Reason: ${reason}`,
            created_by: user?.id || null
          }]);
        }
      }
      return true;
    }),
    delete: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data: challan, error: cErr } = await supabase.from('challans').select('*, items:challan_items(*)').eq('id', id).single();
      if (cErr) throw cErr;

      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      if (challan.status !== 'CANCELLED') {
        for (const item of (challan.items || [])) {
          const { data: dbItem } = await supabase.from('items').select('current_stock').eq('id', item.item_id).single();
          if (dbItem) {
            const stockBefore = dbItem.current_stock || 0;
            const stockAfter = stockBefore + item.quantity;
            await supabase.from('items').update({ current_stock: stockAfter }).eq('id', item.item_id);

            await supabase.from('stock_transactions').insert([{
              item_id: item.item_id,
              type: 'IN',
              quantity: item.quantity,
              stock_before: stockBefore,
              stock_after: stockAfter,
              reference: `Challan Deleted: ${challan.challan_number}`,
              notes: `Stock reversed due to permanent deletion.`,
              created_by: user?.id || null
            }]);
          }
        }
      }

      await supabase.from('stock_transactions').delete().eq('challan_id', id);
      await supabase.from('challan_items').delete().eq('challan_id', id);
      const { error: delErr } = await supabase.from('challans').delete().eq('id', id);
      if (delErr) throw delErr;

      return true;
    }),
    exportPdf: () => wrap(async () => { alert('PDF Export coming soon to web version'); return true; }),
    exportExcel: () => wrap(async () => { alert('Excel Export coming soon to web version'); return true; }),
  },

  // Warehouses
  warehouses: {
    getAll: (includeInactive = false) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      let query = supabase.from('warehouses').select('*');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query.order('name').limit(10000);
      if (error) throw error;
      return data;
    }),
    getById: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase.from('warehouses').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }),
    create: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { name, code, address, is_default = 0 } = data;
      const { data: inserted, error } = await supabase.from('warehouses').insert([{ name, code, address, is_default, is_active: 1 }]).select().single();
      if (error) throw error;
      return inserted.id;
    }),
    update: (id, data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { name, code, address, is_default } = data;
      const updateData = { name, code, address };
      if (is_default !== undefined) updateData.is_default = is_default;
      const { error } = await supabase.from('warehouses').update(updateData).eq('id', id);
      if (error) throw error;
      return true;
    }),
    delete: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.from('warehouses').update({ is_active: 0 }).eq('id', id).eq('is_default', 0);
      if (error) throw error;
      return true;
    }),
    getStockByItem: (itemId) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select('*, warehouses(name, code)')
        .eq('item_id', itemId)
        .limit(10000);
      if (error) throw error;
      return data.map(d => ({
        ...d,
        warehouse_name: d.warehouses?.name,
        warehouse_code: d.warehouses?.code
      }));
    }),
    getStockByWarehouse: (warehouseId) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const data = await fetchAll(supabase
        .from('warehouse_stock')
        .select('*, items(name, item_code, current_stock, unit)')
        .eq('warehouse_id', warehouseId));
      return data.map(d => ({
        ...d,
        item_name: d.items?.name,
        item_code: d.items?.item_code,
        global_stock: d.items?.current_stock,
        unit: d.items?.unit
      }));
    }),
    transferStock: (data) => wrap(async () => {
      const { fromWarehouseId, toWarehouseId, itemId, quantity, notes } = data;
      if (!fromWarehouseId || !toWarehouseId || !itemId || !quantity || quantity <= 0) {
        throw new Error('Invalid transfer details');
      }
      if (fromWarehouseId === toWarehouseId) {
        throw new Error('Cannot transfer to the same warehouse');
      }
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');

      // 1. Verify source stock
      const { data: sourceStockList, error: listErr } = await supabase
        .from('warehouse_stock')
        .select('*, warehouses(name, code)')
        .eq('item_id', itemId)
        .limit(10000);
      if (listErr) throw listErr;
      const sourceStockEntry = sourceStockList.find(s => s.warehouse_id === Number(fromWarehouseId));
      if (!sourceStockEntry || sourceStockEntry.quantity < quantity) {
        throw new Error('Insufficient stock in source warehouse');
      }

      // Helper to adjust stock
      const adjustStock = async (whId, itId, delta) => {
        const { data: current } = await supabase.from('warehouse_stock').select('quantity').eq('warehouse_id', whId).eq('item_id', itId).maybeSingle();
        const newQty = (current?.quantity || 0) + delta;
        const { error } = await supabase
          .from('warehouse_stock')
          .upsert({ warehouse_id: whId, item_id: itId, quantity: newQty, updated_at: new Date().toISOString() }, { onConflict: 'warehouse_id,item_id' });
        if (error) throw error;
      };

      // 2. Deduct from source & add to destination
      await adjustStock(fromWarehouseId, itemId, -quantity);
      await adjustStock(toWarehouseId, itemId, quantity);

      // 3. Log transaction
      const { data: whFrom } = await supabase.from('warehouses').select('*').eq('id', fromWarehouseId).single();
      const { data: whTo } = await supabase.from('warehouses').select('*').eq('id', toWarehouseId).single();

      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      await supabase.from('stock_transactions').insert([{
        item_id: itemId,
        type: 'TRANSFER',
        quantity,
        stock_before: sourceStockEntry.quantity,
        stock_after: sourceStockEntry.quantity - quantity,
        reference: `Transfer from ${whFrom.code} to ${whTo.code}`,
        notes: notes || `Transferred ${quantity} from ${whFrom.name} to ${whTo.name}`,
        created_by: user?.id || null
      }]);

      return true;
    })
  },

  // Reports
  reports: {
    stockReport: (filters) => wrap(() => inventoryApi.items.getAll(filters)),
    movementReport: (filters = {}) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];

      let itemsQuery = supabase.from('items').select('*, categories(name)').eq('is_active', true).order('name');
      if (filters.search) {
        itemsQuery = itemsQuery.or(`name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,style_name.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%,purchase_no.ilike.%${filters.search}%`);
      }
      if (filters.styleName) itemsQuery = itemsQuery.eq('style_name', filters.styleName);
      if (filters.orderNumber) itemsQuery = itemsQuery.eq('order_number', filters.orderNumber);
      if (filters.purchaseNo) itemsQuery = itemsQuery.eq('purchase_no', filters.purchaseNo);
      if (filters.buyerName) itemsQuery = itemsQuery.eq('buyer_name', filters.buyerName);

      const items = await fetchAll(itemsQuery);

      let txQuery = supabase.from('stock_transactions').select('item_id, type, quantity');
      if (filters.dateFrom) txQuery = txQuery.gte('created_at', filters.dateFrom);
      if (filters.dateTo) txQuery = txQuery.lte('created_at', filters.dateTo + 'T23:59:59.999Z');

      const txs = await fetchAll(txQuery);

      return items.map(i => {
        const itemTxs = (txs || []).filter(t => Number(t.item_id) === Number(i.id));
        const total_in = itemTxs.filter(t => t.type === 'IN').reduce((sum, t) => sum + (t.quantity || 0), 0);
        const total_out = itemTxs.filter(t => t.type === 'OUT').reduce((sum, t) => sum + (t.quantity || 0), 0);
        return {
          ...i,
          item_name: i.name,
          total_in,
          total_out
        };
      });
    }),
    lowStockReport: (filters = {}) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      let query = supabase
        .from('items')
        .select('*, categories(name)')
        .eq('is_active', true);
      
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
      if (filters.buyerName) query = query.eq('buyer_name', filters.buyerName);
      if (filters.styleName) query = query.eq('style_name', filters.styleName);
      if (filters.orderNumber) query = query.eq('order_number', filters.orderNumber);
      if (filters.purchaseNo) query = query.eq('purchase_no', filters.purchaseNo);

      const data = await fetchAll(query);
      return data
        .filter(i => i.current_stock <= i.min_stock_level && i.min_stock_level > 0)
        .map(i => ({ ...i, category_name: i.categories?.name }))
        .sort((a, b) => (a.current_stock - a.min_stock_level) - (b.current_stock - b.min_stock_level));
    }),
    exportPdf: () => wrap(async () => { alert('PDF Report Export coming soon'); return true; }),
    exportExcel: () => wrap(async () => { alert('Excel Report Export coming soon'); return true; }),
  },

  // Roles
  roles: {
    getAll: () => wrap(async () => {
      const { data, error } = await getSupabase().from('roles').select('*').order('name');
      if (error) throw error;
      return data;
    }),
  },

  // Dashboard
  dashboard: {
    getStats: () => wrap(async () => {
      const supabase = getSupabase();
      const items = await fetchAll(supabase.from('items').select('current_stock, unit_price').eq('is_active', true));
      const stats = {
        totalItems: items?.length || 0,
        totalStock: items?.reduce((s, i) => s + (i.current_stock || 0), 0) || 0,
        totalValue: { BDT: items?.reduce((s, i) => s + (i.current_stock * i.unit_price || 0), 0) || 0, USD: 0 },
        lowStockCount: 0
      };
      return stats;
    })
  },

  // Production (Mocked for web)
  production: {
    getAll: (filters) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const data = await fetchAll(supabase.from('factory_production').select(`
        *,
        issues (issue_id, recipient_name, issue_date)
      `).order('created_at', { ascending: false }));

      // Fetch items separately to prevent PostgREST schema cache relationship exceptions
      const allItems = await fetchAll(supabase.from('items').select('id, item_code, name'));
      const itemsMap = {};
      (allItems || []).forEach(it => {
        itemsMap[it.id] = it;
      });

      return data.map(r => ({
        ...r,
        issue_id: r.issues?.issue_id,
        recipient_name: r.issues?.recipient_name,
        issue_date: r.issues?.issue_date,
        product_code: itemsMap[r.product_item_id]?.item_code || '',
        product_name: r.product_name || itemsMap[r.product_item_id]?.name || ''
      }));
    }),
    create: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data: prod, error: pErr } = await supabase.from('factory_production').insert([{
        issue_id: data.issueId,
        product_item_id: data.productItemId,
        product_name: data.productName,
        production_quantity: Number(data.productionQuantity),
        wastage_quantity: Number(data.wastageQuantity),
        balance_quantity: Number(data.productionQuantity),
        consumed_items: JSON.stringify(data.items)
      }]).select().single();
      if (pErr) throw pErr;

      for (const item of data.items) {
        const { data: currItem } = await supabase.from('issue_items').select('consumed_quantity').eq('id', item.issueItemId).single();
        const newConsumed = (currItem?.consumed_quantity || 0) + Number(item.consumedQty);
        await supabase.from('issue_items').update({ consumed_quantity: newConsumed }).eq('id', item.issueItemId);
      }

      const { data: itemRow } = await supabase.from('items').select('current_stock').eq('id', data.productItemId).single();
      const stockBefore = itemRow?.current_stock || 0;
      const stockAfter = stockBefore + Number(data.productionQuantity);
      await supabase.from('items').update({ current_stock: stockAfter }).eq('id', data.productItemId);

      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      await supabase.from('stock_transactions').insert([{
        item_id: data.productItemId,
        type: 'IN',
        quantity: Number(data.productionQuantity),
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference: `Production: PRD-${prod.id}`,
        notes: data.remarks || `Produced from Issue #${data.issueId}`,
        created_by: user?.id || null
      }]);

      return prod.id;
    }),
    delete: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data: prod } = await supabase.from('factory_production').select('*').eq('id', id).single();
      if (!prod) throw new Error('Production record not found');
      const consumedItems = prod.consumed_items ? JSON.parse(prod.consumed_items) : [];

      const { data: itemRow } = await supabase.from('items').select('current_stock').eq('id', prod.product_item_id).single();
      const stockBefore = itemRow?.current_stock || 0;
      const stockAfter = Math.max(0, stockBefore - Number(prod.production_quantity));
      await supabase.from('items').update({ current_stock: stockAfter }).eq('id', prod.product_item_id);

      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      await supabase.from('stock_transactions').insert([{
        item_id: prod.product_item_id,
        type: 'OUT',
        quantity: Number(prod.production_quantity),
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference: `Production Deleted`,
        notes: `Reversed stock for deleted Production ID: PRD-${id}`,
        created_by: user?.id || null
      }]);

      for (const item of consumedItems) {
        const { data: currItem } = await supabase.from('issue_items').select('consumed_quantity').eq('id', item.issueItemId).single();
        if (currItem) {
          const newConsumed = Math.max(0, (currItem.consumed_quantity || 0) - Number(item.consumedQty));
          await supabase.from('issue_items').update({ consumed_quantity: newConsumed }).eq('id', item.issueItemId);
        }
      }

      await supabase.from('factory_production').delete().eq('id', id);
      return true;
    })
  },

  // System
  system: {
    getVersion: () => wrap(async () => '1.1.41-web'),
    clearData: () => wrap(async () => { throw new Error('Not available in web version'); }),
  },
  
  // Update (Mocked for web)
  update: {
    check: () => wrap(async () => { console.log('Update check mocked in web'); return true; }),
    onDownloadProgress: () => () => {},
    onUpdateAvailable: () => () => {},
    onUpdateError: () => () => {},
  }
};
