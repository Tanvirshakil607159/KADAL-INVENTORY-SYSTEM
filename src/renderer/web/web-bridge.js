import { getSupabase, isCloudEnabled } from './supabase-client';
import bcrypt from 'bcryptjs';
import { inventoryApi, fetchAll } from './inventory-api';
import { challansApi } from './challans-api';

function parseId(id) {
  if (id === undefined || id === null || id === 'undefined' || id === 'null') return null;
  if (typeof id === 'object') {
    if (id.id !== undefined) id = id.id; // handle case where object is passed
    else return null;
  }
  const val = Number(id);
  if (isNaN(val) || val <= 0) return null;
  return val;
}

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

// Helper to parse JSON fields safely that might already be parsed objects (Supabase client auto-parses JSON columns)
function safeParseJSON(val, fallback = {}) {
  if (typeof val === 'object' && val !== null) {
    return val;
  }
  try {
    return val ? JSON.parse(val) : fallback;
  } catch (err) {
    console.error('[WebBridge] JSON parse failed:', err, 'for value:', val);
    return fallback;
  }
}

function formatBridgePoStyle(it) {
  if (!it) return { poStyle: '-', purchaseNo: '', combined: '-' };
  let val = it.po_style_no || it.poStyleNo || '';
  const po = it.order_number || it.orderNumber || '';
  const style = it.style_name || it.styleName || '';
  let purchase = it.purchase_no || it.purchaseNo || it.purchase_number || it.purchaseNumber || '';

  if (!purchase && val) {
    const match = val.match(/Purchase(?:\s*No)?\s*[:=]\s*([^\n;]+)/i);
    if (match) purchase = match[1].trim();
  }

  let cleanVal = val;
  if (cleanVal && cleanVal !== '-') {
    cleanVal = cleanVal.replace(/\s*\/\s*Purchase(?:\s*No)?\s*[:=]\s*[^\n;]+/i, '').trim();
    if (po && !cleanVal.toLowerCase().includes('order:') && !cleanVal.toLowerCase().includes('po:') && !cleanVal.includes(po)) {
      cleanVal = `Order: ${po} / ` + cleanVal.replace(/^Style:\s*/i, 'Style: ');
    }
    cleanVal = cleanVal.replace(/^PO:\s*/i, 'Order: ').replace(/\s*\/\s*PO:\s*/gi, ' / Order: ');
  } else {
    const parts = [];
    if (po) parts.push(`Order: ${po}`);
    if (style) parts.push(`Style: ${style}`);
    cleanVal = parts.length > 0 ? parts.join(' / ') : '-';
  }

  let combinedVal = cleanVal;
  if (purchase && !combinedVal.toLowerCase().includes('purchase')) {
    combinedVal = combinedVal !== '-'
      ? `${combinedVal} / Purchase No: ${purchase}`
      : `Purchase No: ${purchase}`;
  }

  return {
    poStyle: cleanVal || '-',
    purchaseNo: purchase || '',
    combined: combinedVal || '-'
  };
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
        permissions: safeParseJSON(user.custom_permissions || user.roles?.permissions || '{}'),
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
    updateTier: (tierId, data) => wrap(() => inventoryApi.items.updateTier(tierId, data)),
    getDistinctValues: () => wrap(inventoryApi.items.getDistinctValues),
  },

  // Stock
  stock: {
    addMovement: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data: item, error: itemErr } = await supabase.from('items').select('current_stock, unit_price, currency, conversion_rate').eq('id', data.itemId).single();
      if (itemErr) throw itemErr;
      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      // Duplicate prevention (Idempotency within 60s)
      const OneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const { data: duplicates } = await supabase.from('stock_transactions')
        .select('id, stock_after')
        .eq('item_id', data.itemId)
        .eq('type', data.type)
        .eq('quantity', data.quantity)
        .eq('created_by', user?.id || null)
        .gte('created_at', OneMinuteAgo);
        
      if (duplicates && duplicates.length > 0) {
        console.warn('[WebBridge] Duplicate transaction blocked for item', data.itemId);
        return { success: true, stockAfter: duplicates[0].stock_after };
      }

      const stockBefore = item.current_stock || 0;
      let stockAfter = stockBefore;
      const restockPrice = data.unitPrice !== undefined && data.unitPrice !== null && data.unitPrice !== '' ? Number(data.unitPrice) : Number(item.unit_price || 0);
      const curr = data.currency || item.currency || 'BDT';
      const convRate = data.conversionRate !== undefined ? data.conversionRate : item.conversion_rate;

      if (data.type === 'IN') {
        stockAfter = stockBefore + data.quantity;
        try {
          let tierQuery = supabase.from('item_price_tiers')
            .select('*')
            .eq('item_id', data.itemId)
            .eq('unit_price', restockPrice)
            .eq('currency', curr)
            .gt('quantity', 0);

          if (curr === 'USD') {
            if (convRate !== null && convRate !== undefined) tierQuery = tierQuery.eq('conversion_rate', convRate);
            else tierQuery = tierQuery.is('conversion_rate', null);
          }

          const { data: existingTiers } = await tierQuery
            .order('created_at', { ascending: false })
            .limit(1);

          if (existingTiers && existingTiers.length > 0) {
            await supabase.from('item_price_tiers')
              .update({ quantity: Number(existingTiers[0].quantity) + data.quantity, updated_at: new Date().toISOString() })
              .eq('id', existingTiers[0].id);
          } else {
            await supabase.from('item_price_tiers').insert([{
              item_id: data.itemId,
              quantity: data.quantity,
              unit_price: restockPrice,
              currency: curr,
              conversion_rate: convRate
            }]);
          }
        } catch (e) {}
      } else if (data.type === 'OUT') {
        stockAfter = stockBefore - data.quantity;
        if (stockAfter < 0) {
          throw new Error(`Insufficient stock. Available: ${stockBefore}, Requested: ${data.quantity}`);
        }
        try {
          const { data: tiers } = await supabase.from('item_price_tiers')
            .select('*')
            .eq('item_id', data.itemId)
            .gt('quantity', 0)
            .order('created_at', { ascending: true });
          if (tiers) {
            let rem = data.quantity;
            for (const t of tiers) {
              if (rem <= 0) break;
              const tQty = Number(t.quantity);
              if (tQty <= rem) {
                await supabase.from('item_price_tiers').update({ quantity: 0, updated_at: new Date().toISOString() }).eq('id', t.id);
                rem -= tQty;
              } else {
                await supabase.from('item_price_tiers').update({ quantity: tQty - rem, updated_at: new Date().toISOString() }).eq('id', t.id);
                rem = 0;
                break;
              }
            }
          }
        } catch (e) {}
      } else if (data.type === 'ADJUSTMENT') {
        stockAfter = data.quantity;
      } else {
        throw new Error('Invalid movement type');
      }

      const itemUpdates = { current_stock: stockAfter, updated_at: new Date().toISOString() };
      if (data.type === 'IN' && curr === 'USD' && convRate !== null && convRate !== undefined) {
        itemUpdates.conversion_rate = convRate;
      }
      await supabase.from('items').update(itemUpdates).eq('id', data.itemId);

      const { error: txErr } = await supabase.from('stock_transactions').insert([{
        item_id: data.itemId,
        type: data.type,
        quantity: data.quantity,
        stock_before: stockBefore,
        stock_after: stockAfter,
        unit_price: data.type === 'IN' ? restockPrice : item.unit_price,
        currency: curr,
        conversion_rate: convRate,
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
    receive: (id, receiptData) => wrap(() => challansApi.receive(id, receiptData)),
    getPendingReceipt: (filters) => wrap(() => challansApi.getPendingReceipt(filters)),
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
      const parsedId = parseId(id);
      if (!parsedId) return null;
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase.from('warehouses').select('*').eq('id', parsedId).single();
      if (error) throw error;
      return data;
    }),
    create: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { name, code, address, is_default = 0 } = data;
      let finalCode = code;
      if (!finalCode) {
        const { data: list } = await supabase.from('warehouses').select('code').like('code', 'WH-%');
        const codes = (list || []).map(w => w.code);
        let maxSeq = 0;
        codes.forEach(c => {
          const parts = c.split('-');
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          if (!isNaN(num) && /^\d+$/.test(lastPart)) {
            if (num > maxSeq) maxSeq = num;
          }
        });
        finalCode = `WH-${(maxSeq + 1).toString().padStart(2, '0')}`;
      }
      const { data: inserted, error } = await supabase.from('warehouses').insert([{ name, code: finalCode, address, is_default, is_active: 1 }]).select().single();
      if (error) throw error;
      return inserted.id;
    }),
    update: (id, data) => wrap(async () => {
      const parsedId = parseId(id);
      if (!parsedId) throw new Error('Invalid warehouse ID');
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { name, code, address, is_default } = data;
      const updateData = { name, code, address };
      if (is_default !== undefined) updateData.is_default = is_default;
      const { error } = await supabase.from('warehouses').update(updateData).eq('id', parsedId);
      if (error) throw error;
      return true;
    }),
    delete: (id) => wrap(async () => {
      const parsedId = parseId(id);
      if (!parsedId) throw new Error('Invalid warehouse ID');
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.from('warehouses').update({ is_active: 0 }).eq('id', parsedId).eq('is_default', 0);
      if (error) throw error;
      return true;
    }),
    getStockByItem: (itemId) => wrap(async () => {
      const parsedItemId = parseId(itemId);
      if (!parsedItemId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select('*, warehouses(name, code)')
        .eq('item_id', parsedItemId)
        .limit(10000);
      if (error) throw error;
      return data.map(d => ({
        ...d,
        warehouse_name: d.warehouses?.name,
        warehouse_code: d.warehouses?.code
      }));
    }),
    getStockByWarehouse: (warehouseId) => wrap(async () => {
      const parsedWarehouseId = parseId(warehouseId);
      if (!parsedWarehouseId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const data = await fetchAll(supabase
        .from('warehouse_stock')
        .select('*, items(name, item_code, current_stock, unit)')
        .eq('warehouse_id', parsedWarehouseId));
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
      const parsedFromWh = parseId(fromWarehouseId);
      const parsedToWh = parseId(toWarehouseId);
      const parsedItemId = parseId(itemId);
      if (!parsedFromWh || !parsedToWh || !parsedItemId || !quantity || quantity <= 0) {
        throw new Error('Invalid transfer details');
      }
      if (parsedFromWh === parsedToWh) {
        throw new Error('Cannot transfer to the same warehouse');
      }
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');

      // 1. Verify source stock
      const { data: sourceStockList, error: listErr } = await supabase
        .from('warehouse_stock')
        .select('*, warehouses(name, code)')
        .eq('item_id', parsedItemId)
        .limit(10000);
      if (listErr) throw listErr;
      const sourceStockEntry = sourceStockList.find(s => s.warehouse_id === Number(parsedFromWh));
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
      await adjustStock(parsedFromWh, parsedItemId, -quantity);
      await adjustStock(parsedToWh, parsedItemId, quantity);

      // 3. Log transaction
      const { data: whFrom } = await supabase.from('warehouses').select('*').eq('id', parsedFromWh).single();
      const { data: whTo } = await supabase.from('warehouses').select('*').eq('id', parsedToWh).single();

      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      await supabase.from('stock_transactions').insert([{
        item_id: parsedItemId,
        type: 'TRANSFER',
        quantity,
        stock_before: sourceStockEntry.quantity,
        stock_after: sourceStockEntry.quantity - quantity,
        reference: `Transfer from ${whFrom.code} to ${whTo.code}`,
        notes: notes || `Transferred ${quantity} from ${whFrom.name} to ${whTo.name}`,
        created_by: user?.id || null
      }]);

      return true;
    }),
    getNextCode: () => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return 'WH-01';
      const { data, error } = await supabase
        .from('warehouses')
        .select('code')
        .like('code', 'WH-%');
      if (error) throw error;
      
      const codes = (data || []).map(w => w.code);
      let maxSeq = 0;
      codes.forEach(code => {
        const parts = code.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && /^\d+$/.test(lastPart)) {
          if (num > maxSeq) maxSeq = num;
        }
      });
      return `WH-${(maxSeq + 1).toString().padStart(2, '0')}`;
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
      const items = await fetchAll(supabase.from('items').select('current_stock, unit_price, currency, conversion_rate').eq('is_active', true));
      let totalBDT = 0;
      let totalUSD = 0;
      let tiersCalculated = false;
      try {
        const { data: tiers } = await supabase.from('item_price_tiers').select('quantity, unit_price, currency, conversion_rate').gt('quantity', 0);
        if (tiers && tiers.length > 0) {
          tiers.forEach(t => {
            const qty = Number(t.quantity) || 0;
            const price = Number(t.unit_price) || 0;
            const val = qty * price;
            if (t.currency === 'USD') {
              totalUSD += val;
              totalBDT += val * (Number(t.conversion_rate) || 1);
            } else {
              totalBDT += val;
            }
          });
          tiersCalculated = true;
        }
      } catch (e) {}

      if (!tiersCalculated) {
        items?.forEach(i => {
          const stock = Number(i.current_stock) || 0;
          const price = Number(i.unit_price) || 0;
          const val = stock * price;
          if (i.currency === 'USD') {
            totalUSD += val;
            totalBDT += val * (Number(i.conversion_rate) || 1);
          } else {
            totalBDT += val;
          }
        });
      }
      const stats = {
        totalItems: items?.length || 0,
        totalStock: items?.reduce((s, i) => s + (i.current_stock || 0), 0) || 0,
        totalValue: { BDT: totalBDT, USD: totalUSD },
        lowStockCount: 0
      };
      return stats;
    })
  },

  // Zones
  warehouseZones: {
    getByWarehouse: (warehouseId) => wrap(async () => {
      const parsedId = parseId(warehouseId);
      if (!parsedId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase.from('warehouse_zones').select('*').eq('warehouse_id', parsedId).order('name');
      if (error) throw error;
      return data;
    }),
    create: (data) => wrap(async () => {
      const parsedWarehouseId = parseId(data.warehouse_id);
      if (!parsedWarehouseId) throw new Error('Invalid warehouse_id');
      const supabase = getSupabase();
      const { data: inserted, error } = await supabase.from('warehouse_zones').insert([{
        warehouse_id: parsedWarehouseId,
        name: data.name,
        type: data.type
      }]).select().single();
      if (error) throw error;
      return inserted.id;
    }),
    delete: (id) => wrap(async () => {
      const parsedId = parseId(id);
      if (!parsedId) throw new Error('Invalid zone ID');
      const supabase = getSupabase();
      const { error } = await supabase.from('warehouse_zones').delete().eq('id', parsedId);
      if (error) throw error;
      return true;
    }),
  },

  // Bins
  warehouseBins: {
    getByZone: (zoneId) => wrap(async () => {
      const parsedZoneId = parseId(zoneId);
      if (!parsedZoneId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase.from('warehouse_bins').select('*').eq('zone_id', parsedZoneId).order('name');
      if (error) throw error;
      return data;
    }),
    getByWarehouse: (warehouseId) => wrap(async () => {
      const parsedId = parseId(warehouseId);
      if (!parsedId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase.from('warehouse_bins').select('*, warehouse_zones!inner(warehouse_id)').eq('warehouse_zones.warehouse_id', parsedId);
      if (error) throw error;
      return data;
    }),
    create: (data) => wrap(async () => {
      const parsedZoneId = parseId(data.zone_id);
      if (!parsedZoneId) throw new Error('Invalid zone_id');
      const supabase = getSupabase();
      const { data: inserted, error } = await supabase.from('warehouse_bins').insert([{
        zone_id: parsedZoneId,
        barcode: data.barcode,
        name: data.name,
        capacity: data.capacity || 0
      }]).select().single();
      if (error) throw error;
      return inserted.id;
    }),
    delete: (id) => wrap(async () => {
      const parsedId = parseId(id);
      if (!parsedId) throw new Error('Invalid bin ID');
      const supabase = getSupabase();
      const { error } = await supabase.from('warehouse_bins').delete().eq('id', parsedId);
      if (error) throw error;
      return true;
    }),
  },

  // Bin Stock
  binStock: {
    getByBin: (binId) => wrap(async () => {
      const parsedBinId = parseId(binId);
      if (!parsedBinId) return [];
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase.from('bin_stock').select('*, items(name, item_code, unit)').eq('bin_id', parsedBinId);
      if (error) throw error;
      return data.map(d => ({
        ...d,
        item_name: d.items?.name,
        item_code: d.items?.item_code,
        unit: d.items?.unit
      }));
    }),
    adjust: (binId, itemId, delta) => wrap(async () => {
      const parsedBinId = parseId(binId);
      const parsedItemId = parseId(itemId);
      const numericDelta = Number(delta);
      if (!parsedBinId || !parsedItemId || isNaN(numericDelta)) {
        throw new Error('Invalid parameters for adjusting bin stock');
      }
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data: current } = await supabase.from('bin_stock').select('quantity').eq('bin_id', parsedBinId).eq('item_id', parsedItemId).maybeSingle();
      const newQty = (current?.quantity || 0) + numericDelta;
      if (newQty <= 0) {
        await supabase.from('bin_stock').delete().eq('bin_id', parsedBinId).eq('item_id', parsedItemId);
      } else {
        await supabase.from('bin_stock').upsert({ bin_id: parsedBinId, item_id: parsedItemId, quantity: newQty }, { onConflict: 'bin_id,item_id' });
      }
      return true;
    }),
  },

  // Production (Web)
  production: {
    getAll: (filters) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const data = await fetchAll(supabase.from('factory_production').select(`
        *,
        issues (issue_id, recipient_name, issue_date)
      `).order('created_at', { ascending: false }));

      // Extract distinct target product item IDs
      const productItemIds = [...new Set((data || []).map(r => r.product_item_id).filter(Boolean))];
      const itemsMap = {};

      if (productItemIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < productItemIds.length; i += chunkSize) {
          const chunk = productItemIds.slice(i, i + chunkSize);
          const { data: itemsChunk, error: iErr } = await supabase
            .from('items')
            .select('id, item_code, name, style_name, purchase_no, order_number, size, color, buyer_name, unit')
            .in('id', chunk);
          if (iErr) throw iErr;
          (itemsChunk || []).forEach(it => {
            itemsMap[it.id] = it;
          });
        }
      }

      return data.map(r => {
        const prodItem = itemsMap[r.product_item_id];
        return {
          ...r,
          issue_id: r.issues?.issue_id,
          recipient_name: r.issues?.recipient_name,
          issue_date: r.issues?.issue_date,
          product_code: prodItem?.item_code || '',
          product_name: r.product_name || prodItem?.name || '',
          style_name: prodItem?.style_name || '',
          purchase_no: prodItem?.purchase_no || '',
          order_number: prodItem?.order_number || '',
          size: prodItem?.size || '',
          color: prodItem?.color || '',
          buyer_name: prodItem?.buyer_name || '',
          unit: prodItem?.unit || 'pcs'
        };
      });
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
    createBatch: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      
      const { issueId, producedProducts, items, remarks, createdBy } = data;
      const consumedItemsStr = JSON.stringify(items || []);
      const OneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      let firstProdId = null;

      for (let i = 0; i < (producedProducts || []).length; i++) {
        const p = producedProducts[i];
        
        const { data: duplicates } = await supabase.from('factory_production')
          .select('id')
          .eq('issue_id', issueId)
          .eq('product_item_id', p.productItemId)
          .eq('production_quantity', p.productionQuantity)
          .gte('created_at', OneMinuteAgo);
          
        if (duplicates && duplicates.length > 0) {
          if (i === 0) firstProdId = duplicates[0].id;
          continue;
        }

        const { data: prod, error: pErr } = await supabase.from('factory_production').insert([{
          issue_id: issueId,
          product_item_id: p.productItemId,
          product_name: p.productName,
          production_quantity: Number(p.productionQuantity),
          wastage_quantity: Number(p.wastageQuantity),
          balance_quantity: Number(p.productionQuantity),
          consumed_items: i === 0 ? consumedItemsStr : '[]'
        }]).select().single();
        if (pErr) throw pErr;

        if (i === 0) firstProdId = prod.id;

        if (Number(p.productionQuantity) > 0) {
          const { data: itemRow, error: iErr } = await supabase.from('items').select('current_stock').eq('id', p.productItemId).single();
          if (iErr) throw iErr;
          const stockBefore = itemRow?.current_stock || 0;
          const stockAfter = stockBefore + Number(p.productionQuantity);
          await supabase.from('items').update({ current_stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', p.productItemId);

          await supabase.from('stock_transactions').insert([{
            item_id: p.productItemId,
            type: 'IN',
            quantity: Number(p.productionQuantity),
            stock_before: stockBefore,
            stock_after: stockAfter,
            reference: `Production: PRD-${prod.id}`,
            notes: remarks || `Produced from Issue #${issueId}`,
            created_by: createdBy
          }]);
        }
      }

      for (const item of (items || [])) {
        const { data: issueItem, error: fErr } = await supabase.from('issue_items').select('item_id, consumed_quantity, returned_quantity, damage_quantity').eq('id', item.issueItemId).single();
        if (fErr) throw fErr;
        
        const newConsumed = (issueItem?.consumed_quantity || 0) + Number(item.consumedQty);
        const newWastage = (issueItem?.damage_quantity || 0) + Number(item.wastageQty || 0);
        const newReturned = (issueItem?.returned_quantity || 0) + Number(item.returnQty || 0);
        
        await supabase.from('issue_items').update({ 
          consumed_quantity: newConsumed,
          damage_quantity: newWastage,
          returned_quantity: newReturned 
        }).eq('id', item.issueItemId);

        const retQty = Number(item.returnQty || 0);
        if (retQty > 0) {
          const { data: rawItem, error: riErr } = await supabase.from('items').select('current_stock').eq('id', issueItem.item_id).single();
          if (riErr) throw riErr;
          
          const stockBefore = rawItem?.current_stock || 0;
          const stockAfter = stockBefore + retQty;
          
          await supabase.from('items').update({ 
            current_stock: stockAfter, 
            updated_at: new Date().toISOString() 
          }).eq('id', issueItem.item_id);

          await supabase.from('stock_transactions').insert([{
            item_id: issueItem.item_id,
            type: 'IN',
            quantity: retQty,
            stock_before: stockBefore,
            stock_after: stockAfter,
            reference: firstProdId ? `Production Return: PRD-${firstProdId}` : `Production Return`,
            notes: firstProdId ? `Returned from Factory under Production Batch PRD-${firstProdId}` : 'Returned from Factory Production',
            created_by: createdBy
          }]);
        }
      }

      return { success: true };
    }),
    delete: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data: prod } = await supabase.from('factory_production').select('*').eq('id', id).single();
      if (!prod) throw new Error('Production record not found');
      const consumedItems = safeParseJSON(prod.consumed_items, []);

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

  // Requisitions
  requisitions: {
    getAll: (filters = {}) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      let query = supabase.from('requisitions').select(`
        *,
        recipients (name),
        users!requisitions_created_by_fkey (full_name),
        requisition_items (id, item_id, requested_quantity, approved_quantity, issued_quantity, items (name, item_code))
      `).order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.recipientId) query = query.eq('recipient_id', filters.recipientId);
      if (filters.dateFrom) query = query.gte('requisition_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('requisition_date', filters.dateTo + 'T23:59:59.999Z');
      if (filters.search) {
        query = query.or(`requisition_no.ilike.%${filters.search}%,requester_name.ilike.%${filters.search}%,department.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data.map(r => ({
        ...r,
        created_by_name: r.users?.full_name,
        recipient_name: r.recipients?.name,
        item_count: (r.requisition_items || []).length,
        total_requested: (r.requisition_items || []).reduce((s, i) => s + (i.requested_quantity || 0), 0),
      }));
    }),

    getById: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data: req, error } = await supabase.from('requisitions').select(`
        *,
        users!requisitions_created_by_fkey (full_name),
        recipients (name, type)
      `).eq('id', id).single();
      if (error) throw error;
      if (req) {
        const { data: items, error: iErr } = await supabase.from('requisition_items').select(`
          *, items (name, item_code, unit, current_stock, buyer_name, size, color, style_name, purchase_no, order_number)
        `).eq('requisition_id', id);
        if (iErr) throw iErr;
        req.items = items.map(i => ({
          ...i,
          item_name: i.items?.name,
          item_code: i.items?.item_code,
          item_unit: i.items?.unit,
          current_stock: i.items?.current_stock,
          buyer_name: i.items?.buyer_name || '-',
          size: i.items?.size || '-',
          color: i.items?.color || '-',
          style_name: i.items?.style_name || '-',
          purchase_no: i.items?.purchase_no || '-',
          order_number: i.items?.order_number || '-',
        }));
        req.created_by_name = req.users?.full_name;
        req.recipient_name = req.recipients?.name;
      }
      return req;
    }),

    create: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      // Get next number
      const { data: existing, error: nErr } = await supabase.from('requisitions')
        .select('requisition_no').like('requisition_no', `${data.prefix || 'REQ'}-%`).order('requisition_no', { ascending: false });
      if (nErr) throw nErr;
      let max = 0;
      (existing || []).forEach(r => {
        const parts = r.requisition_no.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > max) max = num;
      });
      const requisitionNo = `${data.prefix || 'REQ'}-${(max + 1).toString().padStart(4, '0')}`;

      const { data: req, error } = await supabase.from('requisitions').insert([{
        requisition_no: requisitionNo,
        recipient_id: data.recipientId || null,
        requester_name: data.requesterName || null,
        department: data.department || null,
        purpose: data.purpose || null,
        notes: data.notes || null,
        status: 'PENDING',
        requisition_date: data.requisitionDate || new Date().toISOString(),
        created_by: user?.id,
      }]).select().single();
      if (error) throw error;

      const reqItems = data.items.map(item => ({
        requisition_id: req.id,
        item_id: item.itemId,
        requested_quantity: item.quantity,
        approved_quantity: 0,
        issued_quantity: 0,
        notes: item.notes || null,
      }));
      const { error: iErr } = await supabase.from('requisition_items').insert(reqItems);
      if (iErr) throw iErr;
      return { success: true, id: req.id, requisitionNo };
    }),

    approve: (id, notes) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;
      const { error } = await supabase.from('requisitions').update({
        status: 'APPROVED',
        approved_by: user?.fullName || user?.full_name || 'Admin',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      return { success: true };
    }),

    reject: (id, notes) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.from('requisitions').update({
        status: 'REJECTED', updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return { success: true };
    }),

    cancel: (id, notes) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.from('requisitions').update({
        status: 'CANCELLED', updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return { success: true };
    }),

    fulfill: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const userRaw = sessionStorage.getItem('kadal_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      const { data: req, error: rErr } = await supabase.from('requisitions').select('*').eq('id', id).single();
      if (rErr) throw rErr;
      if (!['PENDING', 'APPROVED'].includes(req.status)) throw new Error(`Cannot fulfill a requisition with status: ${req.status}`);

      const { data: reqItems, error: iErr } = await supabase.from('requisition_items').select('*, items(current_stock, name)').eq('requisition_id', id);
      if (iErr) throw iErr;
      if (!reqItems || reqItems.length === 0) throw new Error('Requisition has no items');

      const fulfillItems = reqItems.map(item => ({
        ...item,
        fulfillQty: (req.status === 'APPROVED' && item.approved_quantity > 0) ? item.approved_quantity : item.requested_quantity,
      })).filter(i => i.fulfillQty > 0);

      // Validate stock
      for (const item of fulfillItems) {
        if (item.items.current_stock < item.fulfillQty) {
          throw new Error(`Insufficient stock for "${item.items.name}". Available: ${item.items.current_stock}, Requested: ${item.fulfillQty}`);
        }
      }

      // Deduct stock and log transactions
      for (const item of fulfillItems) {
        const { data: freshItem } = await supabase.from('items').select('current_stock').eq('id', item.item_id).single();
        const stockBefore = freshItem?.current_stock || 0;
        const stockAfter = stockBefore - item.fulfillQty;
        await supabase.from('items').update({ current_stock: stockAfter }).eq('id', item.item_id);
        await supabase.from('stock_transactions').insert([{
          item_id: item.item_id,
          type: 'OUT',
          quantity: item.fulfillQty,
          stock_before: stockBefore,
          stock_after: stockAfter,
          reference: `Requisition: ${req.requisition_no}`,
          notes: `Fulfilled from requisition`,
          created_by: user?.id || null,
        }]);
        await supabase.from('requisition_items').update({ issued_quantity: item.fulfillQty }).eq('id', item.id);
      }

      const { error: upErr } = await supabase.from('requisitions').update({
        status: 'FULFILLED',
        approved_by: user?.fullName || user?.full_name || 'Store',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (upErr) throw upErr;
      return { success: true };
    }),

    delete: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      await supabase.from('requisition_items').delete().eq('requisition_id', id);
      const { error } = await supabase.from('requisitions').delete().eq('id', id);
      if (error) throw error;
      return true;
    }),

    getNextNumber: () => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data: prefixSetting } = await supabase.from('settings').select('value').eq('key', 'requisition_prefix').single();
      const prefix = prefixSetting?.value || 'REQ';
      const { data, error } = await supabase.from('requisitions').select('requisition_no').like('requisition_no', `${prefix}-%`).order('requisition_no', { ascending: false });
      if (error) throw error;
      let max = 0;
      (data || []).forEach(r => {
        const parts = r.requisition_no.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > max) max = num;
      });
      return `${prefix}-${(max + 1).toString().padStart(4, '0')}`;
    }),

    getFieldSuggestions: (field, query) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const validFields = ['requester_name', 'department', 'purpose'];
      if (!validFields.includes(field)) return [];
      const { data, error } = await supabase.from('requisitions').select(field).ilike(field, `%${query}%`).not(field, 'is', null).limit(20);
      if (error) throw error;
      return [...new Set(data.map(r => r[field]))].sort();
    }),

    exportPdf: (id) => wrap(async () => { throw new Error('PDF export not available in web version'); }),
    exportExcel: (id) => wrap(async () => { throw new Error('Excel export not available in web version'); }),
  },

  // System
  system: {
    getVersion: () => wrap(async () => '1.1.41-web'),
    clearData: () => wrap(async () => { throw new Error('Not available in web version'); }),
  },

  // Finance (Proforma Invoices)
  finance: {
    getAll: (filters = {}) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
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

      const normalizePiItem = (it, idx) => {
        const slNo = it.sl_no !== undefined ? it.sl_no : (it.slNo !== undefined ? it.slNo : idx + 1);
        const desc = it.item_description || it.itemDescription || it.item_name || it.name || '';
        const { poStyle, purchaseNo: itPurch, combined } = formatBridgePoStyle(it);
        const qty = Number(it.quantity || 0);
        const unit = (it.unit || 'PCS').toUpperCase();
        const unitPrice = Number(it.unit_price !== undefined ? it.unit_price : (it.unitPrice !== undefined ? it.unitPrice : 0));
        const totalAmount = Number(it.total_amount !== undefined ? it.total_amount : (it.totalAmount !== undefined ? it.totalAmount : (qty * unitPrice).toFixed(2)));
        return {
          ...it,
          slNo,
          sl_no: slNo,
          challanId: it.challan_id || it.challanId || null,
          challan_id: it.challan_id || it.challanId || null,
          itemId: it.item_id || it.itemId || null,
          item_id: it.item_id || it.itemId || null,
          itemDescription: desc,
          item_description: desc,
          purchaseNo: itPurch,
          purchase_no: itPurch,
          poStyleNo: poStyle,
          po_style_no: combined,
          quantity: qty,
          unit,
          unitPrice,
          unit_price: unitPrice,
          totalAmount,
          total_amount: totalAmount,
        };
      };

      let result = (data || []).map(pi => {
        const items = (pi.proforma_invoice_items || []).map((it, idx) => normalizePiItem(it, idx));
        let piPurchase = pi.purchase_no || pi.purchaseNo || '';
        if (!piPurchase && pi.notes) {
          const match = pi.notes.match(/Purchase(?:\s*No)?\s*[:=]\s*([^\n;]+)/i);
          if (match) piPurchase = match[1].trim();
        }
        if (!piPurchase && items.length > 0) {
          const itPurch = items.find(it => it.purchaseNo || it.purchase_no);
          if (itPurch) piPurchase = itPurch.purchaseNo || itPurch.purchase_no;
        }
        const totalOrdered = Number(pi.total_quantity) || items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        return {
          ...pi,
          created_by_name: pi.users?.full_name,
          purchaseNo: piPurchase,
          purchase_no: piPurchase,
          items,
          item_count: items.length,
          total_quantity: totalOrdered,
          fulfillment_pct: pi.bill_number ? 100 : (pi.fulfillment_pct || 0),
          is_100_percent_received: pi.bill_number ? true : (pi.is_100_percent_received || false),
          can_transfer_to_bill: pi.status !== 'BILLED' && (pi.is_100_percent_received || false)
        };
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
    }),

    getById: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase.from('proforma_invoices').select(`
        *,
        users!proforma_invoices_created_by_fkey (full_name),
        recipients (name, receiver_address),
        proforma_invoice_items (*)
      `).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      data.created_by_name = data.users?.full_name;
      data.items = (data.proforma_invoice_items || []).sort((a, b) => a.sl_no - b.sl_no).map((it, idx) => {
        const slNo = it.sl_no !== undefined ? it.sl_no : (it.slNo !== undefined ? it.slNo : idx + 1);
        const desc = it.item_description || it.itemDescription || it.item_name || it.name || '';
        const { poStyle, purchaseNo: itPurch, combined } = formatBridgePoStyle(it);
        const qty = Number(it.quantity || 0);
        const unit = (it.unit || 'PCS').toUpperCase();
        const unitPrice = Number(it.unit_price !== undefined ? it.unit_price : (it.unitPrice !== undefined ? it.unitPrice : 0));
        const totalAmount = Number(it.total_amount !== undefined ? it.total_amount : (it.totalAmount !== undefined ? it.totalAmount : (qty * unitPrice).toFixed(2)));
        return {
          ...it,
          slNo, sl_no: slNo,
          itemDescription: desc, item_description: desc,
          purchaseNo: itPurch, purchase_no: itPurch,
          poStyleNo: poStyle, po_style_no: combined,
          quantity: qty, unit, unitPrice, unit_price: unitPrice,
          totalAmount, total_amount: totalAmount
        };
      });
      return data;
    }),

    getByNumber: (piNumber) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase.from('proforma_invoices').select(`
        *,
        users!proforma_invoices_created_by_fkey (full_name),
        proforma_invoice_items (*)
      `).eq('pi_number', piNumber).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      data.items = (data.proforma_invoice_items || []).sort((a, b) => a.sl_no - b.sl_no).map((it, idx) => {
        const slNo = it.sl_no !== undefined ? it.sl_no : (it.slNo !== undefined ? it.slNo : idx + 1);
        const desc = it.item_description || it.itemDescription || it.item_name || it.name || '';
        const { poStyle, purchaseNo: itPurch, combined } = formatBridgePoStyle(it);
        const qty = Number(it.quantity || 0);
        const unit = (it.unit || 'PCS').toUpperCase();
        const unitPrice = Number(it.unit_price !== undefined ? it.unit_price : (it.unitPrice !== undefined ? it.unitPrice : 0));
        const totalAmount = Number(it.total_amount !== undefined ? it.total_amount : (it.totalAmount !== undefined ? it.totalAmount : (qty * unitPrice).toFixed(2)));
        return {
          ...it,
          slNo, sl_no: slNo,
          itemDescription: desc, item_description: desc,
          purchaseNo: itPurch, purchase_no: itPurch,
          poStyleNo: poStyle, po_style_no: combined,
          quantity: qty, unit, unitPrice, unit_price: unitPrice,
          totalAmount, total_amount: totalAmount
        };
      });
      return data;
    }),

    create: (data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Database not connected');
      const currentUser = JSON.parse(sessionStorage.getItem('kadal_user') || '{}');

      let finalNotes = data.notes || '';
      const pNum = (data.purchaseNumber || data.purchaseNo || '').trim();
      if (pNum && !finalNotes.toLowerCase().includes('purchase no')) {
        finalNotes = finalNotes ? `${finalNotes} | Purchase No: ${pNum}` : `Purchase No: ${pNum}`;
      }

      const { data: inserted, error: piErr } = await supabase.from('proforma_invoices').insert([{
        pi_number: data.piNumber,
        bill_number: data.billNumber || null,
        pi_date: data.piDate || new Date().toISOString(),
        bill_date: data.billDate || null,
        recipient_id: data.recipientId || null,
        applicant_name: data.applicantName,
        applicant_address: data.applicantAddress || null,
        beneficiary_name: data.beneficiaryName || 'K.A. DESIGN ACCESSORIES LTD.',
        beneficiary_address: data.beneficiaryAddress || '356/1, BLOCK-B, TEK KATHORA, SALNA, GAZIPUR-1703, BANGLADESH',
        beneficiary_bin: data.beneficiaryBin || '009212306-1201',
        bank_details: data.bankDetails || null,
        buyer: data.buyer || null,
        challan_ids: data.challanIds || [],
        challan_numbers: data.challanNumbers || null,
        currency: data.currency || 'USD',
        currency_symbol: data.currencySymbol || '$',
        total_quantity: Number(data.totalQuantity) || 0,
        total_amount: Number(data.totalAmount) || 0,
        amount_in_words: data.amountInWords || null,
        net_weight: data.netWeight || '250 KGS',
        gross_weight: data.grossWeight || '260 KGS',
        terms_conditions: data.termsConditions || 'CASH ON DELIVERY.',
        prepared_by: data.preparedBy || null,
        authorized_by: data.authorizedBy || null,
        accepted_by: data.acceptedBy || null,
        status: data.status || 'ACTIVE',
        notes: finalNotes || null,
        created_by: currentUser.id || null
      }]).select().single();

      if (piErr) throw piErr;

      if (data.items && data.items.length > 0) {
        const itemRows = data.items.map((it, idx) => {
          const desc = it.itemDescription || it.item_description || it.item_name || it.name || '';
          const { combined } = formatBridgePoStyle(it);
          const rate = Number(it.unitPrice !== undefined ? it.unitPrice : it.unit_price) || 0;
          const lineTotal = Number(it.totalAmount !== undefined ? it.totalAmount : (it.total_amount !== undefined ? it.total_amount : 0));
          return {
            pi_id: inserted.id,
            sl_no: it.slNo || it.sl_no || idx + 1,
            challan_id: it.challanId || it.challan_id || null,
            item_id: it.itemId || it.item_id || null,
            item_description: desc,
            po_style_no: combined,
            quantity: Number(it.quantity) || 0,
            unit: (it.unit || 'PCS').toUpperCase(),
            unit_price: rate,
            total_amount: lineTotal,
            notes: it.notes || null
          };
        });
        const { error: itemsErr } = await supabase.from('proforma_invoice_items').insert(itemRows);
        if (itemsErr) throw itemsErr;
      }

      return { id: inserted.id, piNumber: data.piNumber };
    }),

    update: (id, data) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Database not connected');
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
    }),

    delete: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Database not connected');

      // Fetch PI details first
      const { data: pi } = await supabase
        .from('proforma_invoices')
        .select('*, proforma_invoice_items(*)')
        .eq('id', id)
        .maybeSingle();

      const itemIds = (pi?.proforma_invoice_items || []).map(i => i.id);

      // Unlink challans
      await supabase.from('challans').update({ pi_id: null }).eq('pi_id', id);
      if (itemIds.length > 0) {
        await supabase.from('challan_items').update({ pi_item_id: null }).in('pi_item_id', itemIds);
      }
      // Delete child items
      await supabase.from('proforma_invoice_items').delete().eq('pi_id', id);
      // Delete PI
      const { error } = await supabase.from('proforma_invoices').delete().eq('id', id);
      if (error) throw error;

      // Restore sequence if needed
      if (pi?.pi_number) {
        const parts = pi.pi_number.split('/');
        if (parts.length >= 4) {
          const prefix = parts[0];
          const year = parts[2];
          const deletedSeq = parseInt(parts[3], 10);
          const pattern = `${prefix}/KADAL/${year}/%`;
          const seqKey = `seq:pi:${prefix}:${year}`;

          let maxSeq = 0;
          const { data: remaining } = await supabase
            .from('proforma_invoices')
            .select('pi_number')
            .ilike('pi_number', pattern);
          (remaining || []).forEach(row => {
            const p = (row.pi_number || '').split('/');
            if (p.length >= 4) {
              const s = parseInt(p[3], 10);
              if (!isNaN(s) && s > maxSeq) maxSeq = s;
            }
          });

          // Check setting
          const { data: seqSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', seqKey)
            .maybeSingle();
          const tracked = parseInt(seqSetting?.value || '0', 10);
          if (deletedSeq >= tracked || tracked > maxSeq) {
            await supabase.from('settings').upsert({
              key: seqKey,
              value: maxSeq.toString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
          }
        }
      }

      return true;
    }),

    resetAll: () => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return true; // Only cloud needs this manual web-bridge reset, local DB not supported via web-bridge
      
      // Delete all PI items
      await supabase.from('proforma_invoice_items').delete().neq('id', 0);
      
      // Unlink challans
      await supabase.from('challans').update({ pi_id: null }).neq('id', 0);
      await supabase.from('challan_items').update({ pi_item_id: null }).neq('id', 0);
      
      // Delete all PIs
      await supabase.from('proforma_invoices').delete().neq('id', 0);
      
      // Reset sequences
      await supabase.from('settings').delete().or('key.ilike.seq:pi:%,key.ilike.seq:bill:%');
      
      return true;
    }),

    getNextNumber: (applicantName) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return 'PI-001';
      const year = new Date().getFullYear();
      let prefix = 'KADAL';
      if (applicantName) {
        const tokens = applicantName.split(/[\s./\\_-]+/).filter(Boolean);
        if (tokens.length >= 2) {
          const letters = tokens.map(t => t[0].toUpperCase()).join('');
          if (letters.length >= 2 && letters.length <= 6) prefix = letters;
        }
      }
      const pattern = `${prefix}/KADAL/${year}/%`;
      const seqKey = `seq:pi:${prefix}:${year}`;

      let maxSeq = 0;
      const { data } = await supabase.from('proforma_invoices').select('pi_number').ilike('pi_number', pattern);
      (data || []).forEach(row => {
        const parts = (row.pi_number || '').split('/');
        if (parts.length >= 4) {
          const seq = parseInt(parts[3], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });

      // Tracked sequence
      let tracked = 0;
      try {
        const { data: sRow } = await supabase.from('settings').select('value').eq('key', seqKey).maybeSingle();
        if (sRow && sRow.value) {
          const val = parseInt(sRow.value, 10);
          if (!isNaN(val) && val > tracked) tracked = val;
        }
      } catch (e) {}

      let nextSeq = Math.max(maxSeq, tracked) + 1;

      // Ensure uniqueness
      let isUnique = false;
      while (!isUnique) {
        const candidate = `${prefix}/KADAL/${year}/${nextSeq}`;
        const { data: exist } = await supabase.from('proforma_invoices').select('id').eq('pi_number', candidate).limit(1);
        if (!exist || exist.length === 0) {
          isUnique = true;
        } else {
          nextSeq++;
        }
      }

      // Persist immediately
      try {
        await supabase.from('settings').upsert({
          key: seqKey,
          value: nextSeq.toString(),
          updated_at: new Date().toISOString()
        });
      } catch (e) {}

      return `${prefix}/KADAL/${year}/${nextSeq}`;
    }),

    getNextBillNumber: (applicantName) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return 'BILL-001';
      const year = new Date().getFullYear();
      let prefix = 'KADAL';
      if (applicantName) {
        const tokens = applicantName.split(/[\s./\\_-]+/).filter(Boolean);
        if (tokens.length >= 2) {
          const letters = tokens.map(t => t[0].toUpperCase()).join('');
          if (letters.length >= 2 && letters.length <= 6) prefix = letters;
        }
      }
      const pattern = `${prefix}/KADAL/${year}/%`;
      const seqKey = `seq:bill:${prefix}:${year}`;

      let maxSeq = 0;
      const { data } = await supabase.from('proforma_invoices').select('bill_number').not('bill_number', 'is', null).ilike('bill_number', pattern);
      (data || []).forEach(row => {
        const parts = (row.bill_number || '').split('/');
        if (parts.length >= 4) {
          const seq = parseInt(parts[3], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });

      let tracked = 0;
      try {
        const { data: sRow } = await supabase.from('settings').select('value').eq('key', seqKey).maybeSingle();
        if (sRow && sRow.value) {
          const val = parseInt(sRow.value, 10);
          if (!isNaN(val) && val > tracked) tracked = val;
        }
      } catch (e) {}

      let nextSeq = Math.max(maxSeq, tracked) + 1;

      let isUnique = false;
      while (!isUnique) {
        const candidate = `${prefix}/KADAL/${year}/${nextSeq}`;
        const { data: exist } = await supabase.from('proforma_invoices').select('id').eq('bill_number', candidate).limit(1);
        if (!exist || exist.length === 0) {
          isUnique = true;
        } else {
          nextSeq++;
        }
      }

      try {
        await supabase.from('settings').upsert({
          key: seqKey,
          value: nextSeq.toString(),
          updated_at: new Date().toISOString()
        });
      } catch (e) {}

      return `${prefix}/KADAL/${year}/${nextSeq}`;
    }),

    getUsedChallanIds: () => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data } = await supabase.from('proforma_invoices').select('challan_ids').neq('status', 'CANCELLED');
      const used = new Set();
      (data || []).forEach(row => {
        try {
          const ids = typeof row.challan_ids === 'string' ? JSON.parse(row.challan_ids) : row.challan_ids;
          if (Array.isArray(ids)) ids.forEach(id => used.add(Number(id)));
        } catch (e) {}
      });
      return Array.from(used);
    }),

    exportPdf: (id) => wrap(async () => {
      throw new Error('Please use the browser Print button in the web version for high quality direct printing or saving as PDF');
    }),

    getPiReconciliation: (id) => wrap(async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data: pi, error: pErr } = await supabase.from('proforma_invoices').select('*, items:proforma_invoice_items(*)').eq('id', id).single();
      if (pErr) throw pErr;

      const { data: challans } = await supabase.from('challans').select('*').eq('pi_id', id).eq('status', 'ACTIVE');
      const piItems = pi.items || [];
      let totalOrdered = 0;
      let totalDispatched = 0;
      let totalReceived = 0;

      const chIds = (challans || []).map(c => c.id);
      let chItems = [];
      if (chIds.length > 0) {
        const { data: ciData } = await supabase.from('challan_items').select('*').in('challan_id', chIds);
        chItems = ciData || [];
      }

      const reconciledItems = piItems.map(item => {
        const orderQty = Number(item.quantity) || 0;
        totalOrdered += orderQty;
        let dispatched = 0;
        let received = 0;
        chItems.filter(ci => ci.item_id === item.item_id || ci.pi_item_id === item.id).forEach(row => {
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
        challans: challans || [],
        totalOrdered,
        totalDispatched,
        totalReceived,
        overallFulfillmentPct: overallPct,
        is100PercentReceived,
        canTransferToBill: is100PercentReceived && pi.status !== 'BILLED'
      };
    }),

    transferToBill: (id) => wrap(async () => {
      const recon = await webBridge.finance.getPiReconciliation(id);
      if (!recon?.data) throw new Error('PI not found or reconciliation failed');
      if (!recon.data.is100PercentReceived) {
        throw new Error('PI cannot be transferred to Bill: 100% of order quantities must be received from Recipient side first.');
      }
      const pi = recon.data.pi;
      if (pi.status === 'BILLED' || pi.bill_number) {
        throw new Error(`This PI has already been transferred to Bill (${pi.bill_number}).`);
      }

      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');

      const nextBillNumber = await webBridge.finance.getNextBillNumber(pi.applicant_name);
      const billDate = new Date().toISOString();
      const challanIds = (recon.data.challans || []).map(c => c.id);
      const challanNumbers = (recon.data.challans || []).map(c => c.challan_number).join(', ');

      const { error: upErr } = await supabase.from('proforma_invoices').update({
        bill_number: nextBillNumber.data || nextBillNumber,
        bill_date: billDate,
        challan_ids: challanIds,
        challan_numbers: challanNumbers,
        status: 'BILLED'
      }).eq('id', id);
      if (upErr) throw upErr;

      return { id, billNumber: nextBillNumber.data || nextBillNumber, billDate, challanNumbers };
    })
  },

  // Update (Mocked for web)
  update: {
    check: () => wrap(async () => { console.log('Update check mocked in web'); return true; }),
    onDownloadProgress: () => () => {},
    onUpdateAvailable: () => () => {},
    onUpdateError: () => () => {},
  }
};
