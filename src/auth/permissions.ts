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

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  SYSTEM_ADMIN: 'System Admin',
  STORE_MANAGER: 'Quản lý cửa hàng',
  CASHIER: 'Thu ngân',
  WAREHOUSE: 'Nhân viên kho',
  HR: 'Nhân sự',
  ACCOUNTANT: 'Kế toán / Thu chi',
  REPORT_VIEWER: 'Người xem báo cáo',
  STAFF: 'Người dùng thường',
};

// ===== Role -> Permission Mapping =====
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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
  ],

  // Cashier: sales only
  CASHIER: [
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.SALES_PAYMENT,
    PERMISSIONS.SALES_PRINT,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.INV_VIEW,
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
  { key: 'settings', label: 'Cài đặt', icon: 'Settings', requiredPermissions: [PERMISSIONS.SYSTEM_ADMIN, PERMISSIONS.SETTINGS_STORE] },
];

// ===== Helper: Check if user has a permission =====
export function hasPermission(userPermissions: Permission[], permission: Permission): boolean {
  return userPermissions.includes(PERMISSIONS.SYSTEM_ADMIN) || userPermissions.includes(permission);
}

// ===== Helper: Check if user has any of the required permissions =====
export function hasAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
  if (userPermissions.includes(PERMISSIONS.SYSTEM_ADMIN)) return true;
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

// ===== Helper: Get accessible modules for a user =====
export function getAccessibleModules(userPermissions: Permission[]): ModuleAccess[] {
  return MODULE_ACCESS.filter((mod) => hasAnyPermission(userPermissions, mod.requiredPermissions));
}
