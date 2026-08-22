const { dbPrepare, getSupabase, isCloudEnabled } = require('../connection');
const IssuesRepo = require('./issues');

const ProductionRepo = {
  async getAll(filters = {}) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let query = supabase.from('factory_production').select(`
        *,
        issues (issue_id, recipient_name, issue_date)
      `).order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Fetch items separately to map item codes, avoiding join errors if relationship is not fully indexed in PostgREST
      const { data: allItems } = await supabase.from('items').select('id, item_code, name, style_name, purchase_no, order_number, size, color, buyer_name, unit');
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
        product_name: r.product_name || itemsMap[r.product_item_id]?.name || '',
        style_name: itemsMap[r.product_item_id]?.style_name || '',
        purchase_no: itemsMap[r.product_item_id]?.purchase_no || '',
        order_number: itemsMap[r.product_item_id]?.order_number || '',
        size: itemsMap[r.product_item_id]?.size || '',
        color: itemsMap[r.product_item_id]?.color || '',
        buyer_name: itemsMap[r.product_item_id]?.buyer_name || '',
        unit: itemsMap[r.product_item_id]?.unit || 'pcs'
      }));
    }

    return dbPrepare(`
      SELECT fp.*, iss.issue_id, iss.recipient_name, iss.issue_date, it.name as product_name, it.item_code as product_code,
        it.style_name, it.purchase_no, it.order_number, it.size, it.color, it.buyer_name, it.unit
      FROM factory_production fp
      JOIN issues iss ON fp.issue_id = iss.id
      LEFT JOIN items it ON fp.product_item_id = it.id
      ORDER BY fp.created_at DESC
    `).all();
  },

  async getById(id) {
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('factory_production').select(`
        *,
        issues (issue_id, recipient_name, issue_date)
      `).eq('id', id).single();
      if (error) throw error;

      let productCode = '';
      let productName = data.product_name;
      let styleName = '';
      let purchaseNo = '';
      let orderNumber = '';
      let size = '';
      let color = '';
      let buyerName = '';
      let unit = 'pcs';
      if (data.product_item_id) {
        const { data: itemRow } = await supabase.from('items').select('item_code, name, style_name, purchase_no, order_number, size, color, buyer_name, unit').eq('id', data.product_item_id).single();
        if (itemRow) {
          productCode = itemRow.item_code;
          if (!productName) productName = itemRow.name;
          styleName = itemRow.style_name || '';
          purchaseNo = itemRow.purchase_no || '';
          orderNumber = itemRow.order_number || '';
          size = itemRow.size || '';
          color = itemRow.color || '';
          buyerName = itemRow.buyer_name || '';
          unit = itemRow.unit || 'pcs';
        }
      }

      return {
        ...data,
        issue_id: data.issues?.issue_id,
        recipient_name: data.issues?.recipient_name,
        issue_date: data.issues?.issue_date,
        product_code: productCode,
        product_name: productName,
        style_name: styleName,
        purchase_no: purchaseNo,
        order_number: orderNumber,
        size: size,
        color: color,
        buyer_name: buyerName,
        unit: unit
      };
    }
    return dbPrepare(`
      SELECT fp.*, iss.issue_id, iss.recipient_name, iss.issue_date, it.name as product_name, it.item_code as product_code,
        it.style_name, it.purchase_no, it.order_number, it.size, it.color, it.buyer_name, it.unit
      FROM factory_production fp
      JOIN issues iss ON fp.issue_id = iss.id
      LEFT JOIN items it ON fp.product_item_id = it.id
      WHERE fp.id = ?
    `).get(id);
  },

  async create({ issueId, productItemId, productName, productionQuantity, wastageQuantity, items, remarks, createdBy }) {
    const consumedItemsStr = JSON.stringify(items); // items is [{ issueItemId, consumedQty }]
    const OneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    if (isCloudEnabled()) {
      const supabase = getSupabase();

      // Duplicate check for production
      const { data: duplicates } = await supabase.from('factory_production')
        .select('id')
        .eq('issue_id', issueId)
        .eq('product_item_id', productItemId)
        .eq('production_quantity', productionQuantity)
        .gte('created_at', OneMinuteAgo);
        
      if (duplicates && duplicates.length > 0) {
        console.warn(`[ProductionRepo] Duplicate production blocked for issue ${issueId}`);
        return duplicates[0].id;
      }

      // 1. Insert production record
      const { data: prod, error: pErr } = await supabase.from('factory_production').insert([{
        issue_id: issueId,
        product_item_id: productItemId,
        product_name: productName,
        production_quantity: Number(productionQuantity),
        wastage_quantity: Number(wastageQuantity),
        balance_quantity: Number(productionQuantity),
        consumed_items: consumedItemsStr
      }]).select().single();
      if (pErr) throw pErr;

      // 2. Consume raw materials, record wastage, and process returns
      for (const item of items) {
        const { data: issueItem, error: fErr } = await supabase.from('issue_items').select('item_id, consumed_quantity, returned_quantity, damage_quantity').eq('id', item.issueItemId).single();
        if (fErr) throw fErr;
        
        const newConsumed = (issueItem?.consumed_quantity || 0) + Number(item.consumedQty);
        const newWastage = (issueItem?.damage_quantity || 0) + Number(item.wastageQty || 0);
        const newReturned = (issueItem?.returned_quantity || 0) + Number(item.returnQty || 0);
        
        const { error: uErr } = await supabase.from('issue_items').update({ 
          consumed_quantity: newConsumed,
          damage_quantity: newWastage,
          returned_quantity: newReturned 
        }).eq('id', item.issueItemId);
        if (uErr) throw uErr;

        // Adjust stock if returnQty > 0
        const retQty = Number(item.returnQty || 0);
        if (retQty > 0) {
          const { data: rawItem, error: riErr } = await supabase.from('items').select('current_stock').eq('id', issueItem.item_id).single();
          if (riErr) throw riErr;
          
          const stockBefore = rawItem?.current_stock || 0;
          const stockAfter = stockBefore + retQty;
          
          const { error: stockErr } = await supabase.from('items').update({ 
            current_stock: stockAfter, 
            updated_at: new Date().toISOString() 
          }).eq('id', issueItem.item_id);
          if (stockErr) throw stockErr;

          // Record stock transaction for returned raw material
          const { error: tErr } = await supabase.from('stock_transactions').insert([{
            item_id: issueItem.item_id,
            type: 'IN',
            quantity: retQty,
            stock_before: stockBefore,
            stock_after: stockAfter,
            reference: `Production Return: PRD-${prod.id}`,
            notes: `Returned from Factory under Production Batch PRD-${prod.id}`,
            created_by: createdBy
          }]);
          if (tErr) throw tErr;
        }
      }

      // 3. Increment stock of finished product
      if (Number(productionQuantity) > 0) {
        const { data: itemRow, error: iErr } = await supabase.from('items').select('current_stock').eq('id', productItemId).single();
        if (iErr) throw iErr;
        const stockBefore = itemRow?.current_stock || 0;
        const stockAfter = stockBefore + Number(productionQuantity);
        const { error: stockErr } = await supabase.from('items').update({ current_stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', productItemId);
        if (stockErr) throw stockErr;

        // 4. Record stock transaction
        const { error: tErr } = await supabase.from('stock_transactions').insert([{
          item_id: productItemId,
          type: 'IN',
          quantity: Number(productionQuantity),
          stock_before: stockBefore,
          stock_after: stockAfter,
          reference: `Production: PRD-${prod.id}`,
          notes: remarks || `Produced from Issue #${issueId}`,
          created_by: createdBy
        }]);
        if (tErr) throw tErr;
      }

      // 5. Update issue status
      await IssuesRepo.updateStatus(issueId);

      return prod.id;
    }

    // Local SQLite fallback
    const dup = dbPrepare(`SELECT id FROM factory_production WHERE issue_id = ? AND product_item_id = ? AND production_quantity = ? AND created_at >= ? LIMIT 1`).get(issueId, productItemId, productionQuantity, OneMinuteAgo);
    if (dup) {
      console.warn(`[ProductionRepo] Duplicate local production blocked for issue ${issueId}`);
      return dup.id;
    }

    // 1. Insert production
    const r = dbPrepare(`
      INSERT INTO factory_production (issue_id, product_item_id, product_name, production_quantity, wastage_quantity, balance_quantity, consumed_items)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(issueId, productItemId, productName, Number(productionQuantity), Number(wastageQuantity), Number(productionQuantity), consumedItemsStr);
    const prodId = r.lastInsertRowid;

    // 2. Consume raw materials, record wastage, and process returns
    for (const item of items) {
      const issueItem = dbPrepare('SELECT item_id, returned_quantity FROM issue_items WHERE id = ?').get(item.issueItemId);
      if (issueItem) {
        // Update consumed, damage (wastage), and returned quantities on issue_items
        dbPrepare(`
          UPDATE issue_items 
          SET consumed_quantity = consumed_quantity + ?, 
              damage_quantity = damage_quantity + ?, 
              returned_quantity = returned_quantity + ? 
          WHERE id = ?
        `).run(Number(item.consumedQty), Number(item.wastageQty || 0), Number(item.returnQty || 0), item.issueItemId);

        // Adjust raw material inventory stock if returnQty > 0
        const retQty = Number(item.returnQty || 0);
        if (retQty > 0) {
          const rawItem = dbPrepare('SELECT current_stock FROM items WHERE id = ?').get(issueItem.item_id);
          if (rawItem) {
            const stockBefore = rawItem.current_stock;
            const stockAfter = stockBefore + retQty;
            dbPrepare('UPDATE items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(stockAfter, issueItem.item_id);
            
            // Record IN stock transaction for raw material
            dbPrepare(`
              INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, reference, notes, created_by)
              VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
            `).run(
              issueItem.item_id, 
              retQty, 
              stockBefore, 
              stockAfter, 
              `Production Return: PRD-${prodId}`, 
              `Returned from Factory under Production Batch PRD-${prodId}`, 
              createdBy
            );
          }
        }
      }
    }

    // 3. Increment stock of finished product
    if (Number(productionQuantity) > 0) {
      const currentItem = dbPrepare('SELECT current_stock FROM items WHERE id = ?').get(productItemId);
      const stockBefore = currentItem ? currentItem.current_stock : 0;
      const stockAfter = stockBefore + Number(productionQuantity);
      dbPrepare('UPDATE items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(stockAfter, productItemId);

      // 4. Record stock transaction
      dbPrepare(`
        INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, reference, notes, created_by)
        VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
      `).run(productItemId, Number(productionQuantity), stockBefore, stockAfter, `Production: PRD-${prodId}`, remarks || `Produced from Issue #${issueId}`, createdBy);
    }

    // 5. Update issue status
    await IssuesRepo.updateStatus(issueId);

    return prodId;
  },

  async createBatch({ issueId, producedProducts, items, remarks, createdBy }) {
    const consumedItemsStr = JSON.stringify(items);
    const OneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    if (isCloudEnabled()) {
      const supabase = getSupabase();
      let firstProdId = null;

      // 1. Insert production records & increment finished products stock
      for (let i = 0; i < producedProducts.length; i++) {
        const p = producedProducts[i];
        
        // Duplicate check
        const { data: duplicates } = await supabase.from('factory_production')
          .select('id')
          .eq('issue_id', issueId)
          .eq('product_item_id', p.productItemId)
          .eq('production_quantity', p.productionQuantity)
          .gte('created_at', OneMinuteAgo);
          
        if (duplicates && duplicates.length > 0) {
          console.warn(`[ProductionRepo] Duplicate production blocked for issue ${issueId}`);
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

        // Increment stock of finished product
        if (Number(p.productionQuantity) > 0) {
          const { data: itemRow, error: iErr } = await supabase.from('items').select('current_stock').eq('id', p.productItemId).single();
          if (iErr) throw iErr;
          const stockBefore = itemRow?.current_stock || 0;
          const stockAfter = stockBefore + Number(p.productionQuantity);
          const { error: stockErr } = await supabase.from('items').update({ current_stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', p.productItemId);
          if (stockErr) throw stockErr;

          const { error: tErr } = await supabase.from('stock_transactions').insert([{
            item_id: p.productItemId,
            type: 'IN',
            quantity: Number(p.productionQuantity),
            stock_before: stockBefore,
            stock_after: stockAfter,
            reference: `Production: PRD-${prod.id}`,
            notes: remarks || `Produced from Issue #${issueId}`,
            created_by: createdBy
          }]);
          if (tErr) throw tErr;
        }
      }

      // 2. Consume raw materials, record wastage, and process returns ONCE
      for (const item of items) {
        const { data: issueItem, error: fErr } = await supabase.from('issue_items').select('item_id, consumed_quantity, returned_quantity, damage_quantity').eq('id', item.issueItemId).single();
        if (fErr) throw fErr;
        
        const newConsumed = (issueItem?.consumed_quantity || 0) + Number(item.consumedQty);
        const newWastage = (issueItem?.damage_quantity || 0) + Number(item.wastageQty || 0);
        const newReturned = (issueItem?.returned_quantity || 0) + Number(item.returnQty || 0);
        
        const { error: uErr } = await supabase.from('issue_items').update({ 
          consumed_quantity: newConsumed,
          damage_quantity: newWastage,
          returned_quantity: newReturned 
        }).eq('id', item.issueItemId);
        if (uErr) throw uErr;

        // Adjust stock if returnQty > 0
        const retQty = Number(item.returnQty || 0);
        if (retQty > 0) {
          const { data: rawItem, error: riErr } = await supabase.from('items').select('current_stock').eq('id', issueItem.item_id).single();
          if (riErr) throw riErr;
          
          const stockBefore = rawItem?.current_stock || 0;
          const stockAfter = stockBefore + retQty;
          
          const { error: stockErr } = await supabase.from('items').update({ 
            current_stock: stockAfter, 
            updated_at: new Date().toISOString() 
          }).eq('id', issueItem.item_id);
          if (stockErr) throw stockErr;

          const { error: tErr } = await supabase.from('stock_transactions').insert([{
            item_id: issueItem.item_id,
            type: 'IN',
            quantity: retQty,
            stock_before: stockBefore,
            stock_after: stockAfter,
            reference: firstProdId ? `Production Return: PRD-${firstProdId}` : `Production Return`,
            notes: firstProdId ? `Returned from Factory under Production Batch PRD-${firstProdId}` : 'Returned from Factory Production',
            created_by: createdBy
          }]);
          if (tErr) throw tErr;
        }
      }

      // 3. Update issue status
      await IssuesRepo.updateStatus(issueId);
      return { success: true };
    }

    // Local SQLite Fallback
    let firstProdId = null;
    for (let i = 0; i < producedProducts.length; i++) {
      const p = producedProducts[i];
      
      const dup = dbPrepare(`SELECT id FROM factory_production WHERE issue_id = ? AND product_item_id = ? AND production_quantity = ? AND created_at >= ? LIMIT 1`).get(issueId, p.productItemId, p.productionQuantity, OneMinuteAgo);
      if (dup) {
        console.warn(`[ProductionRepo] Duplicate local production blocked for issue ${issueId}`);
        if (i === 0) firstProdId = dup.id;
        continue;
      }

      const r = dbPrepare(`
        INSERT INTO factory_production (issue_id, product_item_id, product_name, production_quantity, wastage_quantity, balance_quantity, consumed_items)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(issueId, p.productItemId, p.productName, Number(p.productionQuantity), Number(p.wastageQuantity), Number(p.productionQuantity), i === 0 ? consumedItemsStr : '[]');
      const prodId = r.lastInsertRowid;
      if (i === 0) firstProdId = prodId;

      if (Number(p.productionQuantity) > 0) {
        const currentItem = dbPrepare('SELECT current_stock FROM items WHERE id = ?').get(p.productItemId);
        const stockBefore = currentItem ? currentItem.current_stock : 0;
        const stockAfter = stockBefore + Number(p.productionQuantity);
        dbPrepare('UPDATE items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(stockAfter, p.productItemId);

        dbPrepare(`
          INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, reference, notes, created_by)
          VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
        `).run(p.productItemId, Number(p.productionQuantity), stockBefore, stockAfter, `Production: PRD-${prodId}`, remarks || `Produced from Issue #${issueId}`, createdBy);
      }
    }

    // Consume raw materials ONCE
    for (const item of items) {
      const issueItem = dbPrepare('SELECT item_id, returned_quantity FROM issue_items WHERE id = ?').get(item.issueItemId);
      if (issueItem) {
        dbPrepare(`
          UPDATE issue_items 
          SET consumed_quantity = consumed_quantity + ?, 
              damage_quantity = damage_quantity + ?, 
              returned_quantity = returned_quantity + ? 
          WHERE id = ?
        `).run(Number(item.consumedQty), Number(item.wastageQty || 0), Number(item.returnQty || 0), item.issueItemId);

        const retQty = Number(item.returnQty || 0);
        if (retQty > 0) {
          const rawItem = dbPrepare('SELECT current_stock FROM items WHERE id = ?').get(issueItem.item_id);
          if (rawItem) {
            const stockBefore = rawItem.current_stock;
            const stockAfter = stockBefore + retQty;
            dbPrepare('UPDATE items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(stockAfter, issueItem.item_id);
            
            dbPrepare(`
              INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, reference, notes, created_by)
              VALUES (?, 'IN', ?, ?, ?, ?, ?, ?)
            `).run(
              issueItem.item_id, 
              retQty, 
              stockBefore, 
              stockAfter, 
              firstProdId ? `Production Return: PRD-${firstProdId}` : `Production Return`, 
              firstProdId ? `Returned from Factory under Production Batch PRD-${firstProdId}` : 'Returned from Factory Production', 
              createdBy
            );
          }
        }
      }
    }

    await IssuesRepo.updateStatus(issueId);
    return { success: true };
  },

  async delete(id) {
    const prod = await this.getById(id);
    if (!prod) throw new Error('Production record not found');

    const consumedItems = prod.consumed_items ? JSON.parse(prod.consumed_items) : [];

    let internalIssueId;
    if (isCloudEnabled()) {
      const supabase = getSupabase();
      const { data } = await supabase.from('factory_production').select('issue_id').eq('id', id).single();
      internalIssueId = data.issue_id;


      // 1. Reverse finished product stock
      const { data: itemRow, error: iErr } = await supabase.from('items').select('current_stock').eq('id', prod.product_item_id).single();
      if (iErr) throw iErr;
      const stockBefore = itemRow?.current_stock || 0;
      const stockAfter = Math.max(0, stockBefore - Number(prod.production_quantity));
      const { error: stockErr } = await supabase.from('items').update({ current_stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', prod.product_item_id);
      if (stockErr) throw stockErr;

      // 2. Record reverse transaction
      const { error: tErr } = await supabase.from('stock_transactions').insert([{
        item_id: prod.product_item_id,
        type: 'OUT',
        quantity: Number(prod.production_quantity),
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference: `Production Deleted`,
        notes: `Reversed stock for deleted Production ID: PRD-${id}`
      }]);
      if (tErr) throw tErr;

      // 3. Reverse raw material consumption, returns, and wastage
      for (const item of consumedItems) {
        const { data: currItem, error: fErr } = await supabase.from('issue_items').select('item_id, consumed_quantity, returned_quantity, damage_quantity').eq('id', item.issueItemId).single();
        if (!fErr && currItem) {
          const newConsumed = Math.max(0, (currItem.consumed_quantity || 0) - Number(item.consumedQty));
          const newWastage = Math.max(0, (currItem.damage_quantity || 0) - Number(item.wastageQty || 0));
          const newReturned = Math.max(0, (currItem.returned_quantity || 0) - Number(item.returnQty || 0));
          await supabase.from('issue_items').update({ 
            consumed_quantity: newConsumed,
            damage_quantity: newWastage,
            returned_quantity: newReturned
          }).eq('id', item.issueItemId);

          // Reverse raw material stock if there was a returnQty
          const retQty = Number(item.returnQty || 0);
          if (retQty > 0) {
            const { data: rawItem, error: riErr } = await supabase.from('items').select('current_stock').eq('id', currItem.item_id).single();
            if (!riErr && rawItem) {
              const stockBefore = rawItem.current_stock;
              const stockAfter = Math.max(0, stockBefore - retQty);
              await supabase.from('items').update({ 
                current_stock: stockAfter, 
                updated_at: new Date().toISOString() 
              }).eq('id', currItem.item_id);

              await supabase.from('stock_transactions').insert([{
                item_id: currItem.item_id,
                type: 'OUT',
                quantity: retQty,
                stock_before: stockBefore,
                stock_after: stockAfter,
                reference: `Production Deleted`,
                notes: `Reversed raw material return for deleted Production ID: PRD-${id}`
              }]);
            }
          }
        }
      }

      // 4. Delete production record
      const { error: dErr } = await supabase.from('factory_production').delete().eq('id', id);
      if (dErr) throw dErr;

      // 5. Update issue status
      await IssuesRepo.updateStatus(internalIssueId);
      return true;
    }

    // Local SQLite fallback
    if (!internalIssueId) {
      internalIssueId = dbPrepare('SELECT issue_id FROM factory_production WHERE id = ?').get(id).issue_id;
    }
    
    // 1. Reverse finished product stock
    const currentItem = dbPrepare('SELECT current_stock FROM items WHERE id = ?').get(prod.product_item_id);
    const stockBefore = currentItem ? currentItem.current_stock : 0;
    const stockAfter = Math.max(0, stockBefore - Number(prod.production_quantity));
    dbPrepare('UPDATE items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(stockAfter, prod.product_item_id);

    // 2. Record reverse transaction
    dbPrepare(`
      INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, reference, notes)
      VALUES (?, 'OUT', ?, ?, ?, 'Production Deleted', ?)
    `).run(prod.product_item_id, Number(prod.production_quantity), stockBefore, stockAfter, `Reversed stock for deleted Production ID: PRD-${id}`);

    // 3. Reverse raw material consumption, returns, and wastage
    for (const item of consumedItems) {
      const currItem = dbPrepare('SELECT item_id, consumed_quantity, returned_quantity, damage_quantity FROM issue_items WHERE id = ?').get(item.issueItemId);
      if (currItem) {
        const newConsumed = Math.max(0, currItem.consumed_quantity - Number(item.consumedQty));
        const newWastage = Math.max(0, currItem.damage_quantity - Number(item.wastageQty || 0));
        const newReturned = Math.max(0, currItem.returned_quantity - Number(item.returnQty || 0));
        dbPrepare('UPDATE issue_items SET consumed_quantity = ?, damage_quantity = ?, returned_quantity = ? WHERE id = ?').run(newConsumed, newWastage, newReturned, item.issueItemId);

        // Reverse raw material stock if there was a returnQty
        const retQty = Number(item.returnQty || 0);
        if (retQty > 0) {
          const rawItem = dbPrepare('SELECT current_stock FROM items WHERE id = ?').get(currItem.item_id);
          if (rawItem) {
            const stockBefore = rawItem.current_stock;
            const stockAfter = Math.max(0, stockBefore - retQty);
            dbPrepare('UPDATE items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(stockAfter, currItem.item_id);
            
            dbPrepare(`
              INSERT INTO stock_transactions (item_id, type, quantity, stock_before, stock_after, reference, notes)
              VALUES (?, 'OUT', ?, ?, ?, 'Production Deleted', ?)
            `).run(currItem.item_id, retQty, stockBefore, stockAfter, `Reversed raw material return for deleted Production ID: PRD-${id}`);
          }
        }
      }
    }

    // 4. Delete production record
    dbPrepare('DELETE FROM factory_production WHERE id = ?').run(id);

    // 5. Update issue status
    await IssuesRepo.updateStatus(internalIssueId);
    return true;
  }
};

module.exports = ProductionRepo;
