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
} as const;

export type Role = string;

// Standard role constants for references
export const STANDARD_ROLES = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
} as const;

export const STANDARD_ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'System Admin',
};

export const ROLE_LABELS: Record<string, string> = { ...STANDARD_ROLE_LABELS };

const STANDARD_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // System Admin: full access
  SYSTEM_ADMIN: Object.values(PERMISSIONS),
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
