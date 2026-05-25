/**
 * CustomerOrders.gs — Customer Orders and Menu Sync handlers.
 * 
 * Implements the server-side API endpoints for:
 *   - Cashier syncing menu items to server
 *   - Customer fetching menu items
 *   - Customer placing a new order (with table number, items, etc.)
 *   - Cashier POS receiving and updating orders
 *   - Real-time order notification center
 */

// ============================================================
// Customer Menu Sync & Fetch
// ============================================================

/**
 * POST /api/customer-orders/menu/sync
 */
function handleSyncMenu(body, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const menuItems = body.menu_items || [];
  if (menuItems.length === 0) {
    return { success: true, message: 'Không có dữ liệu menu để đồng bộ', skipped: true };
  }

  const now = new Date().getTime();

  // Upsert all received menu items
  menuItems.forEach(item => {
    sheetUpsert(SHEETS.MENU_ITEMS, 'id', {
      id: item.id,
      name: item.name,
      price: String(item.price),
      category: item.category,
      unit: item.unit || '',
      default_discount: String(item.default_discount || '0'),
      is_active: item.is_active ? 'true' : 'false',
      image: item.image || '',
      created_at: String(now),
      updated_at: String(now),
    });
  });

  // Delete items that are no longer in the sent list
  const sentIds = menuItems.map(item => item.id);
  const currentDbItems = sheetGetAll(SHEETS.MENU_ITEMS);
  currentDbItems.forEach(dbItem => {
    if (sentIds.indexOf(dbItem.id) === -1) {
      sheetDelete(SHEETS.MENU_ITEMS, 'id', dbItem.id);
    }
  });

  return { success: true, message: 'Đồng bộ thành công ' + menuItems.length + ' món ăn!' };
}

/**
 * GET /api/customer-orders/menu
 */
function handleGetCustomerMenu() {
  const allItems = sheetGetAll(SHEETS.MENU_ITEMS);
  // Return only active items
  const activeItems = allItems.filter(item => isTruthyValue_(item.is_active));

  if (activeItems.length === 0) {
    return getDefaultCustomerMenu_();
  }
  
  return activeItems.map(item => ({
    id: item.id,
    name: item.name,
    price: parseFloat(item.price) || 0,
    category: item.category,
    unit: item.unit || '',
    defaultDiscount: item.default_discount || '0',
    image: item.image || '',
    isActive: true,
  }));
}

function getDefaultCustomerMenu_() {
  return [
    { id: 'seed-menu-1', name: 'Cà phê sữa đá', price: 25000, category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', image: '', isActive: true },
    { id: 'seed-menu-2', name: 'Cà phê đen', price: 20000, category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', image: '', isActive: true },
    { id: 'seed-menu-3', name: 'Trà đào cam sả', price: 32000, category: 'Đồ uống', unit: 'ly', defaultDiscount: '5', image: '', isActive: true },
    { id: 'seed-menu-4', name: 'Nước ép cam', price: 28000, category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', image: '', isActive: true },
    { id: 'seed-menu-5', name: 'Sinh tố bơ', price: 35000, category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', image: '', isActive: true },
    { id: 'seed-menu-6', name: 'Nước suối', price: 10000, category: 'Đồ uống', unit: 'chai', defaultDiscount: '0', image: '', isActive: true },
    { id: 'seed-menu-7', name: 'Bánh mì thịt', price: 30000, category: 'Đồ ăn', unit: 'ổ', defaultDiscount: '0', image: '', isActive: true },
    { id: 'seed-menu-8', name: 'Bánh mì chảo', price: 45000, category: 'Đồ ăn', unit: 'suất', defaultDiscount: '10', image: '', isActive: true },
  ];
}

function isTruthyValue_(value) {
  if (value === true) return true;
  if (value === 1) return true;
  if (value === '1') return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === 'y';
  }
  return false;
}

// ============================================================
// Order Creation
// ============================================================

/**
 * POST /api/customer-orders
 */
function handleCreateCustomerOrder(body) {
  if (!body.table_number || !body.items || body.items.length === 0) {
    return { error: 'Invalid order input data', status: 400 };
  }

  const orderId = 'ord_' + Utilities.getUuid();
  const now = new Date().getTime();

  // 1. Insert order header
  sheetInsert(SHEETS.CUSTOMER_ORDERS, {
    id: orderId,
    table_number: String(body.table_number),
    customer_name: body.customer_name || 'Khách hàng',
    customer_phone: body.customer_phone || '',
    note: body.note || '',
    status: 'PENDING',
    truck_id: body.truck_id || '',
    staff_note: '',
    created_at: String(now),
    updated_at: String(now),
  });

  // 2. Insert order items
  body.items.forEach(item => {
    sheetInsert(SHEETS.CUSTOMER_ORDER_ITEMS, {
      id: 'itm_' + Utilities.getUuid(),
      order_id: orderId,
      menu_item_id: item.menu_item_id || '',
      product_name: item.product_name || '',
      quantity: String(item.quantity || 1),
      price: String(item.price || 0),
      note: item.note || '',
    });
  });

  // 3. Create push notification for cashier POS
  sheetInsert(SHEETS.ORDER_NOTIFICATIONS, {
    id: 'ntf_' + Utilities.getUuid(),
    order_id: orderId,
    type: 'NEW_ORDER',
    message: 'Đơn mới từ Bàn ' + body.table_number + ' - ' + (body.customer_name || 'Khách hàng'),
    is_read: 'false',
    created_at: String(now),
  });

  return { success: true, order_id: orderId, message: 'Đặt món thành công!' };
}

// ============================================================
// Order Management (Auth Required)
// ============================================================

/**
 * GET /api/customer-orders/pending
 */
function handleGetPendingOrders(params, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const allOrders = sheetGetAll(SHEETS.CUSTOMER_ORDERS);
  const pendingOrders = allOrders.filter(o => o.status === 'PENDING');
  
  // Filter by truck_id if provided
  let filtered = pendingOrders;
  if (params.truck_id) {
    filtered = pendingOrders.filter(o => o.truck_id === params.truck_id);
  }

  return fetchOrderItemsForList_(filtered);
}

/**
 * GET /api/customer-orders/all
 */
function handleGetAllOrders(params, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  let orders = sheetGetAll(SHEETS.CUSTOMER_ORDERS);

  if (params.status) {
    orders = orders.filter(o => o.status === params.status);
  }
  if (params.truck_id) {
    orders = orders.filter(o => o.truck_id === params.truck_id);
  }

  return fetchOrderItemsForList_(orders);
}

/**
 * GET /api/customer-orders/:orderId
 */
function handleGetOrderDetail(orderId, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const order = sheetFindOne(SHEETS.CUSTOMER_ORDERS, 'id', orderId);
  if (!order) {
    return { error: 'Order not found', status: 404 };
  }

  return fetchSingleOrderWithItems_(order);
}

/**
 * PUT /api/customer-orders/:orderId/confirm
 */
function handleConfirmOrder(orderId, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const order = sheetFindOne(SHEETS.CUSTOMER_ORDERS, 'id', orderId);
  if (!order) {
    return { error: 'Order not found', status: 404 };
  }

  const now = new Date().getTime();
  sheetUpdate(SHEETS.CUSTOMER_ORDERS, 'id', orderId, {
    status: 'CONFIRMED',
    updated_at: String(now),
  });

  return { success: true, message: 'Đã xác nhận đơn hàng', order_id: orderId, print_bill: true };
}

/**
 * PUT /api/customer-orders/:orderId/cancel
 */
function handleCancelOrder(orderId, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const order = sheetFindOne(SHEETS.CUSTOMER_ORDERS, 'id', orderId);
  if (!order) {
    return { error: 'Order not found', status: 404 };
  }

  const now = new Date().getTime();
  sheetUpdate(SHEETS.CUSTOMER_ORDERS, 'id', orderId, {
    status: 'CANCELLED',
    updated_at: String(now),
  });

  return { success: true, message: 'Đã hủy đơn hàng thành công' };
}

/**
 * PUT /api/customer-orders/:orderId/complete
 */
function handleCompleteOrder(orderId, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const order = sheetFindOne(SHEETS.CUSTOMER_ORDERS, 'id', orderId);
  if (!order) {
    return { error: 'Order not found', status: 404 };
  }

  const now = new Date().getTime();
  sheetUpdate(SHEETS.CUSTOMER_ORDERS, 'id', orderId, {
    status: 'COMPLETED',
    updated_at: String(now),
  });

  return { success: true, message: 'Đã hoàn thành đơn hàng' };
}

/**
 * PUT /api/customer-orders/:orderId/update
 */
function handleUpdateOrder(orderId, body, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const order = sheetFindOne(SHEETS.CUSTOMER_ORDERS, 'id', orderId);
  if (!order) {
    return { error: 'Order not found', status: 404 };
  }

  const now = new Date().getTime();
  const updateData = { updated_at: String(now) };
  if (body.staff_note !== undefined) updateData.staff_note = body.staff_note;
  if (body.note !== undefined) updateData.note = body.note;

  sheetUpdate(SHEETS.CUSTOMER_ORDERS, 'id', orderId, updateData);

  // If items list was modified
  if (body.items) {
    // Remove existing items
    const currentItems = sheetGetAll(SHEETS.CUSTOMER_ORDER_ITEMS).filter(itm => itm.order_id === orderId);
    currentItems.forEach(itm => sheetDelete(SHEETS.CUSTOMER_ORDER_ITEMS, 'id', itm.id));

    // Save new items list
    body.items.forEach(item => {
      sheetInsert(SHEETS.CUSTOMER_ORDER_ITEMS, {
        id: 'itm_' + Utilities.getUuid(),
        order_id: orderId,
        menu_item_id: item.menu_item_id || '',
        product_name: item.product_name || '',
        quantity: String(item.quantity || 1),
        price: String(item.price || 0),
        note: item.note || '',
      });
    });
  }

  return { success: true, message: 'Cập nhật đơn hàng thành công!' };
}

// ============================================================
// Notifications Center
// ============================================================

/**
 * GET /api/customer-orders/notifications/unread
 */
function handleGetUnreadNotifications(headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const all = sheetGetAll(SHEETS.ORDER_NOTIFICATIONS);
  const unread = all.filter(n => n.is_read === 'false');
  return unread.map(n => ({
    id: n.id,
    order_id: n.order_id,
    type: n.type,
    message: n.message,
    is_read: false,
    created_at: parseFloat(n.created_at) || 0,
  }));
}

/**
 * GET /api/customer-orders/notifications/all
 */
function handleGetAllNotifications(headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const all = sheetGetAll(SHEETS.ORDER_NOTIFICATIONS);
  return all.map(n => ({
    id: n.id,
    order_id: n.order_id,
    type: n.type,
    message: n.message,
    is_read: n.is_read === 'true',
    created_at: parseFloat(n.created_at) || 0,
  }));
}

/**
 * PUT /api/customer-orders/notifications/:notifId/read
 */
function handleMarkNotificationRead(notifId, headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  sheetUpdate(SHEETS.ORDER_NOTIFICATIONS, 'id', notifId, {
    is_read: 'true',
  });

  return { success: true, message: 'Đã đánh dấu đã đọc' };
}

/**
 * PUT /api/customer-orders/notifications/read-all
 */
function handleMarkAllNotificationsRead(headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }

  const all = sheetGetAll(SHEETS.ORDER_NOTIFICATIONS);
  all.forEach(n => {
    if (n.is_read === 'false') {
      sheetUpdate(SHEETS.ORDER_NOTIFICATIONS, 'id', n.id, { is_read: 'true' });
    }
  });

  return { success: true, message: 'Đã đánh dấu tất cả đã đọc' };
}

// ============================================================
// Internal Private Helpers
// ============================================================

function fetchOrderItemsForList_(orders) {
  const items = sheetGetAll(SHEETS.CUSTOMER_ORDER_ITEMS);
  
  return orders.map(o => {
    const orderItems = items.filter(itm => itm.order_id === o.id).map(itm => ({
      id: itm.id,
      menu_item_id: itm.menu_item_id,
      product_name: itm.product_name,
      quantity: parseFloat(itm.quantity) || 1,
      price: parseFloat(itm.price) || 0,
      note: itm.note || '',
    }));

    return {
      id: o.id,
      table_number: o.table_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone || '',
      note: o.note || '',
      status: o.status,
      truck_id: o.truck_id || '',
      staff_note: o.staff_note || '',
      items: orderItems,
      created_at: parseFloat(o.created_at) || 0,
      updated_at: parseFloat(o.updated_at) || 0,
    };
  });
}

function fetchSingleOrderWithItems_(o) {
  const items = sheetGetAll(SHEETS.CUSTOMER_ORDER_ITEMS).filter(itm => itm.order_id === o.id).map(itm => ({
    id: itm.id,
    menu_item_id: itm.menu_item_id,
    product_name: itm.product_name,
    quantity: parseFloat(itm.quantity) || 1,
    price: parseFloat(itm.price) || 0,
    note: itm.note || '',
  }));

  return {
    id: o.id,
    table_number: o.table_number,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone || '',
    note: o.note || '',
    status: o.status,
    truck_id: o.truck_id || '',
    staff_note: o.staff_note || '',
    items: items,
    created_at: parseFloat(o.created_at) || 0,
    updated_at: parseFloat(o.updated_at) || 0,
  };
}
