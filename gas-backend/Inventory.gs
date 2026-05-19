/**
 * Inventory.gs — Inventory-specific operations.
 *
 * Handles: receive, issue, count, adjust, spoilage
 * These are called from the frontend's offline queue processor.
 */

/**
 * POST /api/inventory/receive
 * Receive stock into inventory.
 * Body: { items: [{ product_id, quantity }], location_id?, reference?, note? }
 */
function handleInventoryReceive(body, headers) {
  const session = validateSession_(headers);
  if (!session) return { error: 'Unauthorized', status: 401 };
  
  const items = body.items || [];
  const reference = body.reference || ('receive:' + Utilities.getUuid());
  const note = body.note || '';
  const now = new Date().getTime();
  const results = [];
  
  items.forEach(item => {
    const productId = item.product_id;
    const quantity = parseFloat(item.quantity) || 0;
    
    // Create stock move
    const moveId = Utilities.getUuid();
    sheetInsert(SHEETS.STOCK_MOVES, {
      id: moveId,
      product_id: productId,
      item_name: item.item_name || '',
      quantity: String(quantity),
      origin: reference,
      meta: JSON.stringify({ move_type: 'RECEIVE', note: note }),
      created_at: String(now),
      updated_at: String(now),
    });
    
    // Update inventory level
    const existing = sheetFindOne(SHEETS.INVENTORY_LEVELS, 'product_id', productId);
    if (existing) {
      const currentQty = parseFloat(existing.quantity) || 0;
      sheetUpdate(SHEETS.INVENTORY_LEVELS, 'product_id', productId, {
        quantity: String(currentQty + quantity),
        updated_at: String(now),
      });
    } else {
      sheetInsert(SHEETS.INVENTORY_LEVELS, {
        product_id: productId,
        quantity: String(quantity),
        updated_at: String(now),
      });
    }
    
    results.push({ product_id: productId, success: true });
  });
  
  return { success: true, results: results };
}

/**
 * POST /api/inventory/issue
 * Issue stock from inventory.
 * Body: { items: [{ product_id, quantity }], location_id?, reference?, note? }
 */
function handleInventoryIssue(body, headers) {
  const session = validateSession_(headers);
  if (!session) return { error: 'Unauthorized', status: 401 };
  
  const items = body.items || [];
  const reference = body.reference || ('issue:' + Utilities.getUuid());
  const note = body.note || '';
  const now = new Date().getTime();
  const results = [];
  const errors = [];
  
  items.forEach(item => {
    const productId = item.product_id;
    const quantity = parseFloat(item.quantity) || 0;
    
    // Check if enough stock
    const existing = sheetFindOne(SHEETS.INVENTORY_LEVELS, 'product_id', productId);
    const currentQty = existing ? (parseFloat(existing.quantity) || 0) : 0;
    
    if (currentQty < quantity) {
      errors.push({ product_id: productId, error: 'Insufficient stock: have ' + currentQty + ', need ' + quantity });
      return;
    }
    
    // Create stock move (negative quantity)
    const moveId = Utilities.getUuid();
    sheetInsert(SHEETS.STOCK_MOVES, {
      id: moveId,
      product_id: productId,
      item_name: item.item_name || '',
      quantity: String(-quantity),
      origin: reference,
      meta: JSON.stringify({ move_type: 'ISSUE', note: note }),
      created_at: String(now),
      updated_at: String(now),
    });
    
    // Update inventory level
    sheetUpdate(SHEETS.INVENTORY_LEVELS, 'product_id', productId, {
      quantity: String(currentQty - quantity),
      updated_at: String(now),
    });
    
    results.push({ product_id: productId, success: true });
  });
  
  return {
    success: errors.length === 0,
    results: results,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * POST /api/inventory/count
 * Physical count adjustment (sets exact quantity).
 * Body: { items: [{ product_id, counted_quantity }], location_id?, reference?, note? }
 */
function handleInventoryCount(body, headers) {
  const session = validateSession_(headers);
  if (!session) return { error: 'Unauthorized', status: 401 };
  
  const items = body.items || [];
  const reference = body.reference || ('count:' + Utilities.getUuid());
  const note = body.note || '';
  const now = new Date().getTime();
  const results = [];
  
  items.forEach(item => {
    const productId = item.product_id;
    const countedQty = parseFloat(item.counted_quantity) || 0;
    
    // Get current quantity
    const existing = sheetFindOne(SHEETS.INVENTORY_LEVELS, 'product_id', productId);
    const currentQty = existing ? (parseFloat(existing.quantity) || 0) : 0;
    const delta = countedQty - currentQty;
    
    if (delta !== 0) {
      // Create stock move for the delta
      const moveId = Utilities.getUuid();
      sheetInsert(SHEETS.STOCK_MOVES, {
        id: moveId,
        product_id: productId,
        item_name: item.item_name || '',
        quantity: String(delta),
        origin: reference,
        meta: JSON.stringify({ move_type: 'ADJUSTMENT', note: 'Count adjustment: ' + note }),
        created_at: String(now),
        updated_at: String(now),
      });
    }
    
    // Set exact quantity
    if (existing) {
      sheetUpdate(SHEETS.INVENTORY_LEVELS, 'product_id', productId, {
        quantity: String(countedQty),
        updated_at: String(now),
      });
    } else {
      sheetInsert(SHEETS.INVENTORY_LEVELS, {
        product_id: productId,
        quantity: String(countedQty),
        updated_at: String(now),
      });
    }
    
    results.push({ product_id: productId, success: true, delta: delta });
  });
  
  return { success: true, results: results };
}

/**
 * POST /api/inventory/adjust
 * Delta adjustment (adds/subtracts quantity).
 * Body: { items: [{ product_id, delta_quantity }], location_id?, reference?, note? }
 */
function handleInventoryAdjust(body, headers) {
  const session = validateSession_(headers);
  if (!session) return { error: 'Unauthorized', status: 401 };
  
  const items = body.items || [];
  const reference = body.reference || ('adjust:' + Utilities.getUuid());
  const note = body.note || '';
  const now = new Date().getTime();
  const results = [];
  
  items.forEach(item => {
    const productId = item.product_id;
    const delta = parseFloat(item.delta_quantity) || 0;
    
    if (delta === 0) {
      results.push({ product_id: productId, success: true, delta: 0 });
      return;
    }
    
    // Create stock move
    const moveId = Utilities.getUuid();
    sheetInsert(SHEETS.STOCK_MOVES, {
      id: moveId,
      product_id: productId,
      item_name: item.item_name || '',
      quantity: String(delta),
      origin: reference,
      meta: JSON.stringify({ move_type: 'ADJUSTMENT', note: note }),
      created_at: String(now),
      updated_at: String(now),
    });
    
    // Update inventory level
    const existing = sheetFindOne(SHEETS.INVENTORY_LEVELS, 'product_id', productId);
    if (existing) {
      const currentQty = parseFloat(existing.quantity) || 0;
      sheetUpdate(SHEETS.INVENTORY_LEVELS, 'product_id', productId, {
        quantity: String(currentQty + delta),
        updated_at: String(now),
      });
    } else {
      sheetInsert(SHEETS.INVENTORY_LEVELS, {
        product_id: productId,
        quantity: String(delta),
        updated_at: String(now),
      });
    }
    
    results.push({ product_id: productId, success: true, delta: delta });
  });
  
  return { success: true, results: results };
}
