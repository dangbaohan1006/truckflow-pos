// ===== Permission Definitions =====
// Each permission is a string key: "module:action"

export const PERMISSIONS = {
  // User Management
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_VIEW: 'user:view',
  USER_ASSIGN_ROLE: 'user:assign_role',

  // Settings
  SETTINGS_STORE: 'settings:store',
  SETTINGS_PRINTER: 'settings:printer',
  SETTINGS_SYNC: 'settings:sync',
  SETTINGS_TEMPLATE: 'settings:template',
  SETTINGS_INGREDIENT: 'settings:ingredient',

  // Sales
  SALES_CREATE: 'sales:create',
  SALES_EDIT: 'sales:edit',
  SALES_CANCEL: 'sales:cancel',
  SALES_PAYMENT: 'sales:payment',
  SALES_REFUND: 'sales:refund',
  SALES_PRINT: 'sales:print',
  SALES_VIEW: 'sales:view',
  SALES_VIEW_ALL: 'sales:view_all',

  // Inventory
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

  // Finance
  FIN_INCOME: 'finance:income',
  FIN_EXPENSE: 'finance:expense',
  FIN_APPROVE: 'finance:approve',
  FIN_BOOK: 'finance:book',
  FIN_LOCK: 'finance:lock',
  FIN_VIEW: 'finance:view',

  // HR
  HR_EMPLOYEE: 'hr:employee',
  HR_ATTENDANCE: 'hr:attendance',
  HR_ADVANCE: 'hr:advance',
  HR_SALARY: 'hr:salary',
  HR_APPROVE_SALARY: 'hr:approve_salary',
  HR_VIEW: 'hr:view',

  // Reports
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // Customer Orders
  ORDER_VIEW: 'order:view',
  ORDER_CONFIRM: 'order:confirm',
  ORDER_EDIT: 'order:edit',
  ORDER_CANCEL: 'order:cancel',

  // System
  SYSTEM_ADMIN: 'system:admin',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ===== Role Definitions =====
export const ROLES = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  STORE_MANAGER: 'STORE_MANAGER',
  CASHIER: 'CASHIER',
  WAREHOUSE: 'WAREHOUSE',
  HR: 'HR',
  ACCOUNTANT: 'ACCOUNTANT',
  REPORT_VIEWER: 'REPORT_VIEWER',
  STAFF: 'STAFF',
} as const;

export type Role = string;

// Standard role constants for references
export const STANDARD_ROLES = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  STORE_MANAGER: 'STORE_MANAGER',
  CASHIER: 'CASHIER',
  WAREHOUSE: 'WAREHOUSE',
  HR: 'HR',
  ACCOUNTANT: 'ACCOUNTANT',
  REPORT_VIEWER: 'REPORT_VIEWER',
  STAFF: 'STAFF',
} as const;

export const STANDARD_ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'System Admin',
  STORE_MANAGER: 'Quản lý cửa hàng',
  CASHIER: 'Thu ngân',
  WAREHOUSE: 'Nhân viên kho',
  HR: 'Nhân sự',
  ACCOUNTANT: 'Kế toán / Thu chi',
  REPORT_VIEWER: 'Người xem báo cáo',
  STAFF: 'Người dùng thường',
};

export const ROLE_LABELS: Record<string, string> = { ...STANDARD_ROLE_LABELS };

const STANDARD_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // System Admin: full access
  SYSTEM_ADMIN: Object.values(PERMISSIONS),

  // Store Manager: most operations except user management & system admin
  STORE_MANAGER: [
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.SALES_CANCEL,
    PERMISSIONS.SALES_PAYMENT,
    PERMISSIONS.SALES_REFUND,
    PERMISSIONS.SALES_PRINT,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.INV_RECEIVE,
    PERMISSIONS.INV_ISSUE,
    PERMISSIONS.INV_COUNT,
    PERMISSIONS.INV_ADJUST,
    PERMISSIONS.INV_SPOILAGE,
    PERMISSIONS.INV_APPROVE,
    PERMISSIONS.INV_VIEW,
    PERMISSIONS.INV_BOM,
    PERMISSIONS.INV_SUPPLIER,
    PERMISSIONS.INV_TRUCK,
    PERMISSIONS.FIN_INCOME,
    PERMISSIONS.FIN_EXPENSE,
    PERMISSIONS.FIN_APPROVE,
    PERMISSIONS.FIN_BOOK,
    PERMISSIONS.FIN_VIEW,
    PERMISSIONS.HR_EMPLOYEE,
    PERMISSIONS.HR_ATTENDANCE,
    PERMISSIONS.HR_ADVANCE,
    PERMISSIONS.HR_SALARY,
    PERMISSIONS.HR_APPROVE_SALARY,
    PERMISSIONS.HR_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SETTINGS_STORE,
    PERMISSIONS.SETTINGS_PRINTER,
    PERMISSIONS.SETTINGS_SYNC,
    PERMISSIONS.SETTINGS_TEMPLATE,
    PERMISSIONS.SETTINGS_INGREDIENT,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CONFIRM,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_CANCEL,
  ],

  // Cashier: sales only
  CASHIER: [
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.SALES_PAYMENT,
    PERMISSIONS.SALES_PRINT,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.INV_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CONFIRM,
    PERMISSIONS.ORDER_EDIT,
  ],

  // Warehouse: inventory only
  WAREHOUSE: [
    PERMISSIONS.INV_RECEIVE,
    PERMISSIONS.INV_ISSUE,
    PERMISSIONS.INV_COUNT,
    PERMISSIONS.INV_SPOILAGE,
    PERMISSIONS.INV_VIEW,
    PERMISSIONS.INV_BOM,
    PERMISSIONS.INV_SUPPLIER,
    PERMISSIONS.INV_TRUCK,
    PERMISSIONS.SETTINGS_INGREDIENT,
  ],

  // HR: HR operations only
  HR: [
    PERMISSIONS.HR_EMPLOYEE,
    PERMISSIONS.HR_ATTENDANCE,
    PERMISSIONS.HR_ADVANCE,
    PERMISSIONS.HR_SALARY,
    PERMISSIONS.HR_APPROVE_SALARY,
    PERMISSIONS.HR_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
  ],

  // Accountant: finance only
  ACCOUNTANT: [
    PERMISSIONS.FIN_INCOME,
    PERMISSIONS.FIN_EXPENSE,
    PERMISSIONS.FIN_APPROVE,
    PERMISSIONS.FIN_BOOK,
    PERMISSIONS.FIN_LOCK,
    PERMISSIONS.FIN_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.INV_VIEW,
  ],

  // Report Viewer: read-only reports
  REPORT_VIEWER: [
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.INV_VIEW,
    PERMISSIONS.FIN_VIEW,
    PERMISSIONS.HR_VIEW,
  ],

  // Staff: basic operations in assigned screen
  STAFF: [
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.INV_VIEW,
  ],
};

export const ROLE_PERMISSIONS: Record<string, Permission[]> = { ...STANDARD_ROLE_PERMISSIONS };

/**
 * Refreshes dynamic roles from local storage to allow runtime custom roles/permissions
 */
export function refreshDynamicRoles() {
  try {
    const savedConfig = localStorage.getItem('truckflow_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      if (parsed) {
        // 1. Reset to standard
        Object.keys(ROLE_LABELS).forEach(key => {
          if (!(key in STANDARD_ROLE_LABELS)) {
            delete ROLE_LABELS[key];
          }
        });
        Object.keys(ROLE_PERMISSIONS).forEach(key => {
          if (!(key in STANDARD_ROLE_PERMISSIONS)) {
            delete ROLE_PERMISSIONS[key];
          }
        });

        // 2. Load custom role labels
        if (parsed.customRoles && typeof parsed.customRoles === 'object') {
          Object.assign(ROLE_LABELS, parsed.customRoles);
        }

        // 3. Load custom role permissions
        if (parsed.customRolePermissions && typeof parsed.customRolePermissions === 'object') {
          Object.assign(ROLE_PERMISSIONS, parsed.customRolePermissions);
        }
      }
    }
  } catch (e) {
    console.error('Failed to refresh dynamic roles:', e);
  }
}

// Auto-run on load in browser environments
if (typeof window !== 'undefined') {
  refreshDynamicRoles();
}

// ===== Module access based on permissions =====
export interface ModuleAccess {
  key: string;
  label: string;
  icon: string;
  requiredPermissions: Permission[];
}

export const MODULE_ACCESS: ModuleAccess[] = [
  { key: 'pos', label: 'Bán hàng', icon: 'Store', requiredPermissions: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW] },
  { key: 'inventory', label: 'Kho hàng', icon: 'Package', requiredPermissions: [PERMISSIONS.INV_VIEW] },
  { key: 'reports', label: 'Báo cáo', icon: 'BarChart3', requiredPermissions: [PERMISSIONS.REPORT_VIEW] },
  { key: 'finance', label: 'Thu chi', icon: 'DollarSign', requiredPermissions: [PERMISSIONS.FIN_VIEW] },
  { key: 'hr', label: 'Nhân sự', icon: 'Users', requiredPermissions: [PERMISSIONS.HR_VIEW] },
  { key: 'customer-orders', label: 'Đơn khách', icon: 'ClipboardList', requiredPermissions: [PERMISSIONS.ORDER_VIEW] },
  { key: 'settings', label: 'Cài đặt', icon: 'Settings', requiredPermissions: [PERMISSIONS.SYSTEM_ADMIN, PERMISSIONS.SETTINGS_STORE] },
];

// ===== Helper: Check if user has a permission =====
export function hasPermission(userPermissions: Permission[], permission: Permission): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  return userPermissions.includes(PERMISSIONS.SYSTEM_ADMIN) || userPermissions.includes(permission);
}

// ===== Helper: Check if user has any of the required permissions =====
export function hasAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes(PERMISSIONS.SYSTEM_ADMIN)) return true;
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

// ===== Helper: Get accessible modules for a user =====
export function getAccessibleModules(userPermissions: Permission[]): ModuleAccess[] {
  if (!userPermissions || !Array.isArray(userPermissions)) return [];
  return MODULE_ACCESS.filter((mod) => hasAnyPermission(userPermissions, mod.requiredPermissions));
}
