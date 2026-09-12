const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');

const ItemPriceTiersRepo = {
  /**
   * Get all active price tiers for a specific item (quantity > 0), ordered by creation date (FIFO)
   */
  async getActiveByItem(itemId) {
    const parsedId = Number(itemId);
    if (!parsedId) return [];

    if (isCloudEnabled()) {
      try {
        const { data, error } = await getSupabase()
          .from('item_price_tiers')
          .select('*')
          .eq('item_id', parsedId)
          .gt('quantity', 0)
          .order('created_at', { ascending: true });
        if (error) {
          console.warn('[ItemPriceTiersRepo] Supabase getActiveByItem error:', error.message);
          return [];
        }
        return data || [];
      } catch (e) {
        console.warn('[ItemPriceTiersRepo] Failed to fetch active tiers from cloud:', e.message);
        return [];
      }
    }

    try {
      return dbPrepare(
        'SELECT * FROM item_price_tiers WHERE item_id = ? AND quantity > 0 ORDER BY created_at ASC'
      ).all(parsedId);
    } catch (e) {
      console.warn('[ItemPriceTiersRepo] Local getActiveByItem error:', e.message);
      return [];
    }
  },

  /**
   * Fetch all active tiers (quantity > 0) grouped by item_id
   * Returns: { [itemId]: [tier1, tier2, ...] }
   */
  async getAllActiveGrouped() {
    const grouped = {};

    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data, error } = await supabase
            .from('item_price_tiers')
            .select('*')
            .gt('quantity', 0)
            .order('created_at', { ascending: true })
            .range(from, to);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < pageSize) break;
          page++;
        }

        allData.forEach(t => {
          if (!grouped[t.item_id]) grouped[t.item_id] = [];
          grouped[t.item_id].push(t);
        });
        return grouped;
      } catch (e) {
        console.warn('[ItemPriceTiersRepo] Supabase getAllActiveGrouped error:', e.message);
        return grouped;
      }
    }

    try {
      const rows = dbPrepare(
        'SELECT * FROM item_price_tiers WHERE quantity > 0 ORDER BY created_at ASC'
      ).all();
      rows.forEach(t => {
        if (!grouped[t.item_id]) grouped[t.item_id] = [];
        grouped[t.item_id].push(t);
      });
    } catch (e) {
      console.warn('[ItemPriceTiersRepo] Local getAllActiveGrouped error:', e.message);
    }
    return grouped;
  },

  /**
   * Add stock tier for restock / Stock IN.
   * If an active tier with matching unit_price and currency exists -> merges quantity into it.
   * If price is different -> creates a new price tier.
   */
  async addStockTier(itemId, quantity, unitPrice, currency = 'BDT', conversionRate = null) {
    const parsedId = Number(itemId);
    const numQty = Number(quantity);
    const numPrice = Number(unitPrice || 0);
    const curr = currency || 'BDT';
    const convRate = curr === 'USD' ? (Number(conversionRate) || null) : null;

    if (!parsedId || numQty <= 0) return null;

    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        // Check for an existing tier with the same price, currency, and conversion rate
        let query = supabase
          .from('item_price_tiers')
          .select('*')
          .eq('item_id', parsedId)
          .eq('unit_price', numPrice)
          .eq('currency', curr)
          .gt('quantity', 0);

        if (curr === 'USD') {
          if (convRate !== null) query = query.eq('conversion_rate', convRate);
          else query = query.is('conversion_rate', null);
        }

        const { data: existing, error: findErr } = await query
          .order('created_at', { ascending: false })
          .limit(1);

        if (!findErr && existing && existing.length > 0) {
          const tier = existing[0];
          const newQty = Number(tier.quantity) + numQty;
          const { error: updErr } = await supabase
            .from('item_price_tiers')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', tier.id);
          if (updErr) throw updErr;
          return tier.id;
        }

        // Insert new tier
        const { data: inserted, error: insErr } = await supabase
          .from('item_price_tiers')
          .insert([{
            item_id: parsedId,
            quantity: numQty,
            unit_price: numPrice,
            currency: curr,
            conversion_rate: convRate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        if (insErr) throw insErr;
        return inserted.id;
      } catch (e) {
        console.warn('[ItemPriceTiersRepo] Cloud addStockTier error:', e.message);
        return null;
      }
    }

    try {
      // Local SQLite
      let sql = 'SELECT * FROM item_price_tiers WHERE item_id = ? AND unit_price = ? AND currency = ? AND quantity > 0';
      const params = [parsedId, numPrice, curr];
      if (curr === 'USD') {
        if (convRate !== null) {
          sql += ' AND conversion_rate = ?';
          params.push(convRate);
        } else {
          sql += ' AND conversion_rate IS NULL';
        }
      }
      sql += ' ORDER BY created_at DESC LIMIT 1';
      const existing = dbPrepare(sql).get(...params);

      if (existing) {
        const newQty = Number(existing.quantity) + numQty;
        dbPrepare(
          'UPDATE item_price_tiers SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(newQty, existing.id);
        return existing.id;
      }

      const info = dbPrepare(
        'INSERT INTO item_price_tiers (item_id, quantity, unit_price, currency, conversion_rate) VALUES (?, ?, ?, ?, ?)'
      ).run(parsedId, numQty, numPrice, curr, convRate);
      return Number(info.lastInsertRowid);
    } catch (e) {
      console.warn('[ItemPriceTiersRepo] Local addStockTier error:', e.message);
      return null;
    }
  },

  /**
   * Deduct stock in FIFO order (oldest active tier first).
   * Used on Challan delivery, Stock OUT, Issue to factory, Requisitions.
   */
  async deductStockFIFO(itemId, quantity) {
    const parsedId = Number(itemId);
    let remaining = Number(quantity);
    if (!parsedId || remaining <= 0) return true;

    const tiers = await this.getActiveByItem(parsedId);
    if (!tiers || tiers.length === 0) return true;

    if (isCloudEnabled()) {
      try {
        const supabase = getSupabase();
        for (const tier of tiers) {
          if (remaining <= 0) break;
          const tierQty = Number(tier.quantity);
          if (tierQty <= remaining) {
            await supabase
              .from('item_price_tiers')
              .update({ quantity: 0, updated_at: new Date().toISOString() })
              .eq('id', tier.id);
            remaining -= tierQty;
          } else {
            const newQty = tierQty - remaining;
            await supabase
              .from('item_price_tiers')
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', tier.id);
            remaining = 0;
            break;
          }
        }
        return true;
      } catch (e) {
        console.warn('[ItemPriceTiersRepo] Cloud deductStockFIFO error:', e.message);
        return false;
      }
    }

    try {
      for (const tier of tiers) {
        if (remaining <= 0) break;
        const tierQty = Number(tier.quantity);
        if (tierQty <= remaining) {
          dbPrepare('UPDATE item_price_tiers SET quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(tier.id);
          remaining -= tierQty;
        } else {
          const newQty = tierQty - remaining;
          dbPrepare('UPDATE item_price_tiers SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, tier.id);
          remaining = 0;
          break;
        }
      }
      return true;
    } catch (e) {
      console.warn('[ItemPriceTiersRepo] Local deductStockFIFO error:', e.message);
      return false;
    }
  },

  /**
   * Adjust tiers when an absolute adjustment is made
   */
  async adjustStock(itemId, targetTotalQuantity, defaultUnitPrice, defaultCurrency = 'BDT') {
    const parsedId = Number(itemId);
    const targetQty = Number(targetTotalQuantity);
    if (!parsedId) return;

    const tiers = await this.getActiveByItem(parsedId);
    const currentTotal = tiers.reduce((sum, t) => sum + Number(t.quantity), 0);

    if (targetQty <= 0) {
      // Zero out all tiers
      if (isCloudEnabled()) {
        try {
          await getSupabase().from('item_price_tiers').update({ quantity: 0, updated_at: new Date().toISOString() }).eq('item_id', parsedId);
        } catch (e) {}
      } else {
        try {
          dbPrepare('UPDATE item_price_tiers SET quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?').run(parsedId);
        } catch (e) {}
      }
      return;
    }

    if (currentTotal > targetQty) {
      // Deduct difference via FIFO
      await this.deductStockFIFO(parsedId, currentTotal - targetQty);
    } else if (currentTotal < targetQty) {
      // Add difference to newest tier or create new tier with defaultUnitPrice
      const diff = targetQty - currentTotal;
      const latestTier = tiers[tiers.length - 1];
      const price = latestTier ? latestTier.unit_price : defaultUnitPrice;
      const curr = latestTier ? latestTier.currency : defaultCurrency;
      await this.addStockTier(parsedId, diff, price, curr);
    }
  }
};

module.exports = ItemPriceTiersRepo;
