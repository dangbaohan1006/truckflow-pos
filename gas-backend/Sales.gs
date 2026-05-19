/**
 * Sales.gs — Sales order operations.
 *
 * Handles: create order, sync orders
 */

/**
 * POST /api/sales/sync
 * Push sales orders from the device.
 * Body: WatermelonDB sync format for orders + order_lines
 */
function handleSalesSync(body, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const changes = body.changes || {};
  const errors = [];
  
  // Process orders (created + updated)
  const orderChanges = changes.orders || {};
  const ordersToProcess = [
    ...(orderChanges.created || []),
    ...(orderChanges.updated || []),
  ];
  
  ordersToProcess.forEach(order => {
    try {
      const orderId = order.id;
      if (!orderId) return;
      
      const orderData = {
        id: orderId,
        total: String(order.total || '0'),
        status: order.status || 'pending',
        created_at: String(order.created_at || new Date().getTime()),
        updated_at: String(order.updated_at || new Date().getTime()),
      };
      
      sheetUpsert(SHEETS.ORDERS, 'id', orderData);
      
      // Emit outbox event
      saveOutboxEvent_({
        aggregate_type: 'SalesOrder',
        aggregate_id: orderId,
        event_type: 'Order' + (order.status === 'completed' ? 'Completed' : 'Created'),
        payload: JSON.stringify(orderData),
      });
    } catch (e) {
      errors.push('Failed to process order ' + (order.id || 'unknown') + ': ' + e.toString());
    }
  });
  
  // Process order lines
  const lineChanges = changes.order_lines || {};
  const linesToProcess = [
    ...(lineChanges.created || []),
    ...(lineChanges.updated || []),
  ];
  
  linesToProcess.forEach(line => {
    try {
      const lineId = line.id;
      if (!lineId) return;
      
      sheetUpsert(SHEETS.ORDER_LINES, 'id', {
        id: lineId,
        order_id: line.order_id || '',
        product_id: line.product_id || '',
        quantity: String(line.quantity || '0'),
        price: String(line.price || '0'),
        created_at: String(line.created_at || new Date().getTime()),
      });
    } catch (e) {
      errors.push('Failed to process order line ' + (line.id || 'unknown') + ': ' + e.toString());
    }
  });
  
  return {
    success: true,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * GET /api/sales/sync?lastPulledAt=<timestamp>
 * Pull sales orders from the server.
 */
function handleSalesPull(params, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const lastPulledAt = parseInt(params.lastPulledAt) || 0;
  const now = new Date().getTime();
  
  // Get orders updated after lastPulledAt
  const allOrders = sheetGetAll(SHEETS.ORDERS);
  const updatedOrders = allOrders.filter(o => {
    const updatedAt = parseInt(o.updated_at) || 0;
    return updatedAt > lastPulledAt;
  });
  
  // Get order lines for those orders
  const allLines = sheetGetAll(SHEETS.ORDER_LINES);
  const orderIds = new Set(updatedOrders.map(o => o.id));
  const updatedLines = allLines.filter(l => orderIds.has(l.order_id));
  
  return {
    changes: {
      orders: {
        created: [],
        updated: updatedOrders.map(o => ({
          id: o.id,
          total: String(o.total || '0'),
          status: o.status || 'pending',
          created_at: parseInt(o.created_at) || 0,
          updated_at: parseInt(o.updated_at) || 0,
        })),
        deleted: [],
      },
      order_lines: {
        created: [],
        updated: updatedLines.map(l => ({
          id: l.id,
          order_id: l.order_id,
          product_id: l.product_id,
          quantity: String(l.quantity || '0'),
          price: String(l.price || '0'),
          created_at: parseInt(l.created_at) || 0,
        })),
        deleted: [],
      },
    },
    timestamp: now,
  };
}
