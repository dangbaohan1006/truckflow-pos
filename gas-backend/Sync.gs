/**
 * Sync.gs — WatermelonDB sync protocol (pull/push for all tables).
 *
 * Implements the WatermelonDB sync protocol:
 *   - Pull: GET /api/inventory/sync?lastPulledAt=<timestamp>
 *   - Push: POST /api/inventory/sync
 *
 * Tables synced:
 *   - inventory_items → inventory_levels sheet
 *   - stock_movements → stock_moves sheet
 */

// ============================================================
// Pull: GET /api/inventory/sync?lastPulledAt=<timestamp>
// ============================================================

function handlePullSync(params, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const lastPulledAt = parseInt(params.lastPulledAt) || 0;
  const now = new Date().getTime();
  
  // Get inventory levels updated after lastPulledAt
  const allLevels = sheetGetAll(SHEETS.INVENTORY_LEVELS);
  const updatedLevels = allLevels.filter(level => {
    const updatedAt = parseInt(level.updated_at) || 0;
    return updatedAt > lastPulledAt;
  });
  
  // Get stock moves created after lastPulledAt
  const allMoves = sheetGetAll(SHEETS.STOCK_MOVES);
  const updatedMoves = allMoves.filter(move => {
    const createdAt = parseInt(move.created_at) || 0;
    return createdAt > lastPulledAt;
  });
  
  // Format inventory items for WatermelonDB
  const inventoryItems = updatedLevels.map(level => ({
    id: 'inv_' + level.product_id,
    sku: level.product_id,
    quantity: String(level.quantity || '0'),
    updated_at: parseInt(level.updated_at) || 0,
  }));
  
  // Format stock movements for WatermelonDB
  const stockMovements = updatedMoves.map(move => {
    let meta = {};
    try { meta = JSON.parse(move.meta || '{}'); } catch (e) {}
    return {
      id: move.id,
      item_id: move.product_id,
      item_name: move.item_name || '',
      quantity: String(move.quantity || '0'),
      type: meta.move_type || guessMoveType_(move.origin),
      reference_id: move.origin || '',
      note: meta.note || '',
      created_at: parseInt(move.created_at) || 0,
      updated_at: parseInt(move.updated_at) || 0,
    };
  });
  
  return {
    changes: {
      inventory_items: {
        created: [],
        updated: inventoryItems,
        deleted: [],
      },
      stock_movements: {
        created: [],
        updated: stockMovements,
        deleted: [],
      },
    },
    timestamp: now,
  };
}

// ============================================================
// Push: POST /api/inventory/sync
// ============================================================

function handlePushSync(body, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const changes = body.changes || {};
  const errors = [];
  
  // Process inventory items (created + updated)
  const inventoryChanges = changes.inventory_items || {};
  const toProcess = [
    ...(inventoryChanges.created || []),
    ...(inventoryChanges.updated || []),
  ];
  
  toProcess.forEach(item => {
    try {
      const productId = item.sku || item.id;
      if (!productId) return;
      
      const quantity = parseFloat(item.quantity) || 0;
      const updatedAt = item.updated_at || new Date().getTime();
      
      // Check if level exists
      const existing = sheetFindOne(SHEETS.INVENTORY_LEVELS, 'product_id', productId);
      
      if (existing) {
        // Only update if incoming timestamp is newer
        const existingUpdatedAt = parseInt(existing.updated_at) || 0;
        if (updatedAt > existingUpdatedAt) {
          sheetUpdate(SHEETS.INVENTORY_LEVELS, 'product_id', productId, {
            quantity: String(quantity),
            updated_at: String(updatedAt),
          });
        }
      } else {
        sheetInsert(SHEETS.INVENTORY_LEVELS, {
          product_id: productId,
          quantity: String(quantity),
          updated_at: String(updatedAt),
        });
      }
      
      // Emit outbox event
      saveOutboxEvent_({
        aggregate_type: 'InventoryLevel',
        aggregate_id: productId,
        event_type: 'InventoryUpdated',
        payload: JSON.stringify({ quantity: String(quantity), updated_at: String(updatedAt) }),
      });
    } catch (e) {
      errors.push('Failed to process inventory item ' + (item.sku || item.id) + ': ' + e.toString());
    }
  });
  
  // Process stock movements (created only)
  const moveChanges = changes.stock_movements || {};
  (moveChanges.created || []).forEach(move => {
    try {
      const productId = move.item_id;
      if (!productId) return;
      
      const quantity = parseFloat(move.quantity) || 0;
      const createdAt = move.created_at || new Date().getTime();
      const updatedAt = move.updated_at || createdAt;
      
      const meta = {
        move_type: move.type || guessMoveType_(move.reference_id),
        note: move.note || '',
      };
      
      const moveId = move.id || Utilities.getUuid();
      
      sheetInsert(SHEETS.STOCK_MOVES, {
        id: moveId,
        product_id: productId,
        item_name: move.item_name || '',
        quantity: String(quantity),
        origin: move.reference_id || '',
        meta: JSON.stringify(meta),
        created_at: String(createdAt),
        updated_at: String(updatedAt),
      });
      
      // Update inventory level
      const existing = sheetFindOne(SHEETS.INVENTORY_LEVELS, 'product_id', productId);
      if (existing) {
        const currentQty = parseFloat(existing.quantity) || 0;
        const newQty = currentQty + quantity;
        sheetUpdate(SHEETS.INVENTORY_LEVELS, 'product_id', productId, {
          quantity: String(newQty),
          updated_at: String(updatedAt),
        });
      } else {
        sheetInsert(SHEETS.INVENTORY_LEVELS, {
          product_id: productId,
          quantity: String(quantity),
          updated_at: String(updatedAt),
        });
      }
      
      // Emit outbox event
      saveOutboxEvent_({
        aggregate_type: 'StockMove',
        aggregate_id: moveId,
        event_type: 'StockMoveCreated',
        payload: JSON.stringify({
          product_id: productId,
          quantity: String(quantity),
          origin: move.reference_id || '',
          move_type: move.type || '',
        }),
      });
    } catch (e) {
      errors.push('Failed to process stock move ' + (move.id || move.item_id) + ': ' + e.toString());
    }
  });
  
  return {
    success: true,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================
// Helpers
// ============================================================

function guessMoveType_(origin) {
  if (!origin) return 'ADJUSTMENT';
  if (origin.startsWith('receive:')) return 'RECEIVE';
  if (origin.startsWith('issue:')) return 'ISSUE';
  if (origin.startsWith('spoilage:')) return 'SPOILAGE';
  if (origin.startsWith('order:')) return 'SALE';
  if (origin.startsWith('adjust:')) return 'ADJUSTMENT';
  if (origin.startsWith('count:')) return 'ADJUSTMENT';
  if (origin.startsWith('transfer:')) return 'TRANSFER_OUT';
  return 'ADJUSTMENT';
}

function saveOutboxEvent_(event) {
  sheetInsert(SHEETS.OUTBOX, {
    id: Utilities.getUuid(),
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    event_type: event.event_type,
    payload: event.payload,
    created_at: String(new Date().getTime()),
  });
}

// ============================================================
// Users Sync Protocol (pull/push for users table)
// ============================================================

/**
 * POST /api/users/sync
 * Push users from the device.
 */
function handleUserSync(body, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const changes = body.changes || {};
  const errors = [];
  
  const userChanges = changes.users || {};
  const toProcess = [
    ...(userChanges.created || []),
    ...(userChanges.updated || []),
  ];
  
  toProcess.forEach(user => {
    try {
      const userId = user.id;
      if (!userId) return;
      
      const userData = {
        id: userId,
        username: user.username || '',
        password: user.password || '',
        name: user.display_name || '', // Map local display_name to backend name
        role: user.role || 'STAFF',
        status: user.status || 'ACTIVE',
        employee_id: user.employee_id || '',
        module_access: user.module_access || '[]',
        created_at: String(user.created_at || new Date().getTime()),
        updated_at: String(user.updated_at || new Date().getTime()),
      };
      
      // Update permissions in backend based on role
      let permissions = [];
      if (ROLE_PERMISSIONS[userData.role]) {
        permissions = ROLE_PERMISSIONS[userData.role];
      }
      userData.permissions = JSON.stringify(permissions);
      
      sheetUpsert(SHEETS.USERS, 'id', userData);
      
      // Emit outbox event
      saveOutboxEvent_({
        aggregate_type: 'User',
        aggregate_id: userId,
        event_type: 'UserUpserted',
        payload: JSON.stringify(userData),
      });
    } catch (e) {
      errors.push('Failed to process user ' + (user.username || user.id) + ': ' + e.toString());
    }
  });
  
  return {
    success: true,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * GET /api/users/sync?lastPulledAt=<timestamp>
 * Pull users from the server.
 */
function handleUserPull(params, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const lastPulledAt = parseInt(params.lastPulledAt) || 0;
  const now = new Date().getTime();
  
  // Get users updated after lastPulledAt
  const allUsers = sheetGetAll(SHEETS.USERS);
  const updatedUsers = allUsers.filter(u => {
    const updatedAt = parseInt(u.updated_at || u.createdAt || 0) || 0;
    return updatedAt > lastPulledAt;
  });
  
  return {
    changes: {
      users: {
        created: [],
        updated: updatedUsers.map(u => ({
          id: u.id,
          username: u.username || '',
          password: u.password || '',
          display_name: u.name || '', // Map backend name to display_name
          role: u.role || 'STAFF',
          status: u.status || 'ACTIVE',
          employee_id: u.employee_id || '',
          module_access: u.module_access || '[]',
          created_at: parseInt(u.created_at || u.createdAt || now) || now,
          updated_at: parseInt(u.updated_at || u.created_at || u.createdAt || now) || now,
        })),
        deleted: [],
      },
    },
    timestamp: now,
  };
}
