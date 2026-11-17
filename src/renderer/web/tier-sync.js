// Keeps an item's FIFO price tiers in line with items.current_stock (web build).
// current_stock is the source of truth: tiers are topped up or drawn down FIFO, never the reverse.
export async function syncTiersToStock(supabase, itemId) {
  const id = Number(itemId);
  if (!supabase || !id) return;
  const { data: item, error } = await supabase.from('items').select('current_stock, unit_price, currency, conversion_rate').eq('id', id).maybeSingle();
  if (error || !item) return;
  const target = Math.max(0, Number(item.current_stock) || 0);
  const { data: tiers } = await supabase.from('item_price_tiers').select('*').eq('item_id', id).gt('quantity', 0).order('created_at', { ascending: true });
  const active = tiers || [];
  const sum = active.reduce((a, t) => a + Number(t.quantity || 0), 0);
  const now = new Date().toISOString();
  if (Math.abs(sum - target) <= 0.001) return;

  if (sum > target) {
    let remaining = sum - target;
    for (const t of active) {
      if (remaining <= 0) break;
      const q = Number(t.quantity);
      const take = Math.min(q, remaining);
      await supabase.from('item_price_tiers').update({ quantity: q - take, updated_at: now }).eq('id', t.id);
      remaining -= take;
    }
    return;
  }

  const diff = target - sum;
  const latest = active[active.length - 1];
  if (latest) {
    await supabase.from('item_price_tiers').update({ quantity: Number(latest.quantity) + diff, updated_at: now }).eq('id', latest.id);
  } else {
    await supabase.from('item_price_tiers').insert([{
      item_id: id, quantity: diff, unit_price: Number(item.unit_price || 0), currency: item.currency || 'BDT',
      conversion_rate: item.currency === 'USD' ? (item.conversion_rate ?? null) : null, created_at: now, updated_at: now,
    }]);
  }
}
