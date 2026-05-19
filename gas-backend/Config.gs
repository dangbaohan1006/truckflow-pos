/**
 * Config.gs — Sheet names, column mappings, and constants.
 *
 * All sheet/tab names and column indices are defined here so they
 * can be changed in one place.
 */

// ============================================================
// Spreadsheet ID — set this to your Google Sheet ID
// ============================================================
const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

// ============================================================
// Sheet (tab) names
// ============================================================
const SHEETS = {
  SESSIONS: 'sessions',
  USERS: 'users',
  INVENTORY_LEVELS: 'inventory_levels',
  STOCK_MOVES: 'stock_moves',
  ORDERS: 'orders',
  ORDER_LINES: 'order_lines',
  OUTBOX: 'outbox',
};

// ============================================================
// Column headers (row 1) — must match exactly
// ============================================================
const COLUMNS = {
  SESSIONS: ['token', 'userId', 'email', 'displayName', 'createdAt'],
  USERS: ['id', 'username', 'password', 'email', 'name', 'role', 'permissions', 'createdAt'],
  INVENTORY_LEVELS: ['product_id', 'quantity', 'updated_at'],
  STOCK_MOVES: ['id', 'product_id', 'item_name', 'quantity', 'origin', 'meta', 'created_at', 'updated_at'],
  ORDERS: ['id', 'total', 'status', 'created_at', 'updated_at'],
  ORDER_LINES: ['id', 'order_id', 'product_id', 'quantity', 'price', 'created_at'],
  OUTBOX: ['id', 'aggregate_type', 'aggregate_id', 'event_type', 'payload', 'created_at'],
};

// ============================================================
// Column indices (0-based, auto-computed from COLUMNS)
// ============================================================
const COL_IDX = {};
for (const [sheet, cols] of Object.entries(COLUMNS)) {
  COL_IDX[sheet] = {};
  cols.forEach((name, i) => { COL_IDX[sheet][name] = i; });
}

// ============================================================
// Auth constants
// ============================================================
const SESSION_TOKEN_LENGTH = 64; // bytes for random token
const SESSION_EXPIRY_DAYS = 30;

// ============================================================
// Default roles & permissions (mirrors frontend permissions.ts)
// ============================================================
const ROLES = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  STORE_MANAGER: 'STORE_MANAGER',
  CASHIER: 'CASHIER',
  WAREHOUSE: 'WAREHOUSE',
  HR: 'HR',
  ACCOUNTANT: 'ACCOUNTANT',
  REPORT_VIEWER: 'REPORT_VIEWER',
  STAFF: 'STAFF',
};

const PERMISSIONS = {
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_VIEW: 'user:view',
  USER_ASSIGN_ROLE: 'user:assign_role',
  SETTINGS_STORE: 'settings:store',
  SETTINGS_PRINTER: 'settings:printer',
  SETTINGS_SYNC: 'settings:sync',
  SETTINGS_TEMPLATE: 'settings:template',
  SETTINGS_INGREDIENT: 'settings:ingredient',
  SALES_CREATE: 'sales:create',
  SALES_EDIT: 'sales:edit',
  SALES_CANCEL: 'sales:cancel',
  SALES_PAYMENT: 'sales:payment',
  SALES_REFUND: 'sales:refund',
  SALES_PRINT: 'sales:print',
  SALES_VIEW: 'sales:view',
  SALES_VIEW_ALL: 'sales:view_all',
  INV_RECEIVE: 'inventory:receive',
  INV_ISSUE: 'inventory:issue',
  INV_COUNT: 'inventory:count',
  INV_ADJUST: 'inventory:adjust',
  INV_SPOILAGE: 'inventory:spoilage',
  INV_APPROVE: 'inventory:approve',
  INV_VIEW: 'inventory:view',
  INV_BOM: 'inventory:bom',
  INV_SUPPLIER: 'inventory:supplier',
  INV_TRUCK: 'inventory:truck',
  FIN_INCOME: 'finance:income',
  FIN_EXPENSE: 'finance:expense',
  FIN_APPROVE: 'finance:approve',
  FIN_BOOK: 'finance:book',
  FIN_LOCK: 'finance:lock',
  FIN_VIEW: 'finance:view',
  HR_EMPLOYEE: 'hr:employee',
  HR_ATTENDANCE: 'hr:attendance',
  HR_ADVANCE: 'hr:advance',
  HR_SALARY: 'hr:salary',
  HR_APPROVE_SALARY: 'hr:approve_salary',
  HR_VIEW: 'hr:view',
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',
  SYSTEM_ADMIN: 'system:admin',
};

const ROLE_PERMISSIONS = {
  SYSTEM_ADMIN: Object.values(PERMISSIONS),
  STORE_MANAGER: [
    PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_EDIT, PERMISSIONS.SALES_CANCEL,
    PERMISSIONS.SALES_PAYMENT, PERMISSIONS.SALES_REFUND, PERMISSIONS.SALES_PRINT,
    PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.INV_RECEIVE, PERMISSIONS.INV_ISSUE, PERMISSIONS.INV_COUNT,
    PERMISSIONS.INV_ADJUST, PERMISSIONS.INV_SPOILAGE, PERMISSIONS.INV_APPROVE,
    PERMISSIONS.INV_VIEW, PERMISSIONS.INV_BOM, PERMISSIONS.INV_SUPPLIER, PERMISSIONS.INV_TRUCK,
    PERMISSIONS.FIN_INCOME, PERMISSIONS.FIN_EXPENSE, PERMISSIONS.FIN_APPROVE,
    PERMISSIONS.FIN_BOOK, PERMISSIONS.FIN_VIEW,
    PERMISSIONS.HR_EMPLOYEE, PERMISSIONS.HR_ATTENDANCE, PERMISSIONS.HR_ADVANCE,
    PERMISSIONS.HR_SALARY, PERMISSIONS.HR_APPROVE_SALARY, PERMISSIONS.HR_VIEW,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SETTINGS_STORE, PERMISSIONS.SETTINGS_PRINTER, PERMISSIONS.SETTINGS_SYNC,
    PERMISSIONS.SETTINGS_TEMPLATE, PERMISSIONS.SETTINGS_INGREDIENT,
  ],
  CASHIER: [
    PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_EDIT, PERMISSIONS.SALES_PAYMENT,
    PERMISSIONS.SALES_PRINT, PERMISSIONS.SALES_VIEW, PERMISSIONS.INV_VIEW,
  ],
  WAREHOUSE: [
    PERMISSIONS.INV_RECEIVE, PERMISSIONS.INV_ISSUE, PERMISSIONS.INV_COUNT,
    PERMISSIONS.INV_SPOILAGE, PERMISSIONS.INV_VIEW, PERMISSIONS.INV_BOM,
    PERMISSIONS.INV_SUPPLIER, PERMISSIONS.INV_TRUCK, PERMISSIONS.SETTINGS_INGREDIENT,
  ],
  HR: [
    PERMISSIONS.HR_EMPLOYEE, PERMISSIONS.HR_ATTENDANCE, PERMISSIONS.HR_ADVANCE,
    PERMISSIONS.HR_SALARY, PERMISSIONS.HR_APPROVE_SALARY, PERMISSIONS.HR_VIEW,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
  ],
  ACCOUNTANT: [
    PERMISSIONS.FIN_INCOME, PERMISSIONS.FIN_EXPENSE, PERMISSIONS.FIN_APPROVE,
    PERMISSIONS.FIN_BOOK, PERMISSIONS.FIN_LOCK, PERMISSIONS.FIN_VIEW,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_VIEW_ALL, PERMISSIONS.INV_VIEW,
  ],
  REPORT_VIEWER: [
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SALES_VIEW, PERMISSIONS.INV_VIEW, PERMISSIONS.FIN_VIEW, PERMISSIONS.HR_VIEW,
  ],
  STAFF: [
    PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW, PERMISSIONS.INV_VIEW,
  ],
};
