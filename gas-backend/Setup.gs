/**
 * Setup.gs — Run this once to initialize the Google Sheet.
 *
 * This script creates all required sheet tabs with proper headers.
 * Run `setupSheet()` from the Apps Script editor after setting SPREADSHEET_ID.
 */

function setupSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const sheetConfig = {
    sessions: ['token', 'userId', 'email', 'displayName', 'createdAt'],
    users: ['id', 'username', 'password', 'email', 'name', 'role', 'permissions', 'createdAt'],
    inventory_levels: ['product_id', 'quantity', 'updated_at'],
    stock_moves: ['id', 'product_id', 'item_name', 'quantity', 'origin', 'meta', 'created_at', 'updated_at'],
    orders: ['id', 'total', 'status', 'created_at', 'updated_at'],
    order_lines: ['id', 'order_id', 'product_id', 'quantity', 'price', 'created_at'],
    outbox: ['id', 'aggregate_type', 'aggregate_id', 'event_type', 'payload', 'created_at'],
    menu_items: ['id', 'name', 'price', 'category', 'unit', 'default_discount', 'is_active', 'image', 'created_at', 'updated_at'],
    customer_orders: ['id', 'table_number', 'customer_name', 'customer_phone', 'note', 'status', 'truck_id', 'staff_note', 'created_at', 'updated_at'],
    customer_order_items: ['id', 'order_id', 'menu_item_id', 'product_name', 'quantity', 'price', 'note'],
    order_notifications: ['id', 'order_id', 'type', 'message', 'is_read', 'created_at'],
  };
  
  for (const [sheetName, headers] of Object.entries(sheetConfig)) {
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      // Clear existing content and rewrite headers
      sheet.clear();
    } else {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    Logger.log('Created sheet: ' + sheetName);
  }
  
  // Create a default admin user
  const adminUser = {
    id: 'admin-001',
    username: 'admin',
    password: '123456',
    email: 'admin@truckflow.com',
    name: 'System Admin',
    role: 'SYSTEM_ADMIN',
    permissions: JSON.stringify([
      'user:create', 'user:edit', 'user:delete', 'user:view', 'user:assign_role',
      'settings:store', 'settings:printer', 'settings:sync', 'settings:template', 'settings:ingredient',
      'sales:create', 'sales:edit', 'sales:cancel', 'sales:payment', 'sales:refund', 'sales:print', 'sales:view', 'sales:view_all',
      'inventory:receive', 'inventory:issue', 'inventory:count', 'inventory:adjust', 'inventory:spoilage',
      'inventory:approve', 'inventory:view', 'inventory:bom', 'inventory:supplier', 'inventory:truck',
      'finance:income', 'finance:expense', 'finance:approve', 'finance:book', 'finance:lock', 'finance:view',
      'hr:employee', 'hr:attendance', 'hr:advance', 'hr:salary', 'hr:approve_salary', 'hr:view',
      'report:view', 'report:export', 'system:admin',
    ]),
    createdAt: new Date().toISOString(),
  };
  
  const userSheet = ss.getSheetByName('users');
  const userHeaders = sheetConfig.users;
  const adminRow = userHeaders.map(h => adminUser[h] || '');
  userSheet.appendRow(adminRow);
  
  Logger.log('Created default admin user: admin@truckflow.com');
  Logger.log('Setup complete!');
}

/**
 * Add sample inventory items for testing.
 */
function addSampleInventory() {
  const items = [
    { product_id: 'coffee-beans', quantity: '100', updated_at: String(new Date().getTime()) },
    { product_id: 'milk', quantity: '50', updated_at: String(new Date().getTime()) },
    { product_id: 'sugar', quantity: '200', updated_at: String(new Date().getTime()) },
    { product_id: 'ice', quantity: '500', updated_at: String(new Date().getTime()) },
    { product_id: 'cups', quantity: '1000', updated_at: String(new Date().getTime()) },
  ];
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('inventory_levels');
  const headers = ['product_id', 'quantity', 'updated_at'];
  
  items.forEach(item => {
    const row = headers.map(h => item[h] || '');
    sheet.appendRow(row);
  });
  
  Logger.log('Added ' + items.length + ' sample inventory items');
}
