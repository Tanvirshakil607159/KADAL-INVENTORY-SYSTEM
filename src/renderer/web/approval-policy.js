// Approval rules for the web build, mirroring the desktop services so a browser user is held
// to the same "needs Admin approval" settings as a desktop user.

export function getWebUser() {
  try {
    const raw = sessionStorage.getItem('kadal_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function isAdminUser(user) {
  const role = user?.roleName || user?.role_name;
  return role === 'Admin' || role === 'Super Admin';
}

export async function getSettingValue(supabase, key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

export async function queueApproval(supabase, type, data, user) {
  if (!user?.id) throw new Error('Session expired or user not found. Please log in again.');
  const { data: inserted, error } = await supabase.from('approvals').insert([{
    type,
    data: JSON.stringify(data),
    requested_by: user.id,
    status: 'PENDING',
  }]).select().single();
  if (error) throw error;
  return { success: true, pendingApproval: true, requestId: inserted.id };
}

// Total quantity of an item on ACTIVE challans (for the "over order quantity" rule)
export async function getTotalDelivered(supabase, itemId) {
  const { data: lines } = await supabase.from('challan_items').select('quantity, challan_id').eq('item_id', itemId);
  if (!lines || lines.length === 0) return 0;
  const ids = [...new Set(lines.map(l => l.challan_id))];
  const { data: active } = await supabase.from('challans').select('id').in('id', ids).eq('status', 'ACTIVE');
  const activeIds = new Set((active || []).map(c => c.id));
  return lines.filter(l => activeIds.has(l.challan_id)).reduce((s, l) => s + Number(l.quantity || 0), 0);
}

// Returns a module whose every method answers with a clear "desktop only" error instead of
// leaving the page to crash on `undefined`.
export function desktopOnly(label) {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      if (prop.startsWith('on')) return () => () => {};
      return () => Promise.resolve({ success: false, error: `${label} is only available in the KADAL desktop app.` });
    },
  });
}
