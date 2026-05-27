import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, User, Shield, Printer, Wifi,
  RefreshCw, Info, Save, Check, Globe, Users, Key, Plus,
  Lock, Unlock, Trash2, Edit3, UserPlus, Search, History,
  Store, Package, BarChart3, DollarSign, Users as UsersIcon,
} from 'lucide-react';
import { database } from '../database/index.js';
import UserModel from '../database/models/User.js';
import Employee from '../database/models/Employee.js';
import { seedTestData } from '../database/seedTestData.js';
import { seedMaterialsReportData } from '../database/seedMaterialsReport.js';
import { useAuth } from '../auth/AuthContext.js';
import { logActivity, getActivityLogs, clearActivityLogs, type ActivityRecord } from '../shared/activityLogger.js';
import { ROLES, ROLE_LABELS, ROLE_PERMISSIONS, PERMISSIONS, MODULE_ACCESS, type Role, type Permission, refreshDynamicRoles, STANDARD_ROLES, STANDARD_ROLE_LABELS } from '../auth/permissions.js';
import { TabButton, Modal, Input, Select } from '../shared/components.js';
import { generateId } from '../shared/utils.js';
import { useToast } from '../shared/ToastContext.js';
import MenuItem from '../database/models/MenuItem.js';
import MenuIngredient from '../database/models/MenuIngredient.js';
import InventoryItem from '../database/models/InventoryItem.js';
import { publishMenuToBackend } from '../database/sync.js';

const getSavedUnits = (): string[] => {
  const saved = localStorage.getItem('truckflow_units');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return ['Kg', 'Gram', 'Lít', 'Ml', 'Lon', 'Hộp', 'Chai', 'Bịch', 'Ổ', 'Cái', 'Ly', 'Phần', 'Suất'];
};

const getSavedCategories = (): string[] => {
  const saved = localStorage.getItem('truckflow_categories');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return ['Đồ uống', 'Đồ ăn', 'Tráng miệng', 'Khác'];
};

const compressImage = (base64Str: string, maxWidth = 160, maxHeight = 160, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Keep aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export default function Settings() {
  const toast = useToast();
  const { user: currentUser, hasPermission, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  // Self-healing database migration: Automatically compress any historically oversized images
  useEffect(() => {
    async function compressExistingImages() {
      try {
        const items = await database.get<MenuItem>('menu_items').query().fetch();
        let updatedCount = 0;
        for (const item of items) {
          if (item.image && item.image.startsWith('data:image/') && item.image.length > 50000) {
            console.log(`Compressing oversized historical image for item: ${item.name} (${item.image.length} chars)`);
            const compressed = await compressImage(item.image);
            await database.write(async () => {
              const record = await database.get<MenuItem>('menu_items').find(item.id);
              await record.update((m: any) => {
                m.image = compressed;
              });
            });
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          toast.success(`Đã tự động tối ưu hóa và nén thành công ${updatedCount} ảnh sản phẩm dung lượng lớn dưới nền!`);
          // Re-trigger sync to update the backend
          publishMenuToBackend().catch(err => console.error("Background sync after self-healing failed:", err));
        }
      } catch (err) {
        console.error('Failed to run self-healing image compression:', err);
      }
    }
    compressExistingImages();
  }, []);
  const [units, setUnits] = useState<string[]>(getSavedUnits);
  const [newUnit, setNewUnit] = useState('');
  const [saved, setSaved] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [seedMessage, setSeedMessage] = useState('');
  const [materialsSeedMessage, setMaterialsSeedMessage] = useState('');
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [activityRoleFilter, setActivityRoleFilter] = useState('all');

  const [customRoles, setCustomRoles] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('truckflow_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.customRolesList) {
          return parsed.customRolesList;
        }
      }
    } catch {}
    return [];
  });

  const [showAddRole, setShowAddRole] = useState(false);
  const [showEditRole, setShowEditRole] = useState<any>(null);
  const [roleForm, setRoleForm] = useState({
    key: '',
    label: '',
    modules: {
      pos: 'none',
      inventory: 'none',
      reports: 'none',
      finance: 'none',
      hr: 'none',
      'customer-orders': 'none',
      settings: 'none',
    } as Record<string, string>,
  });

  const saveCustomRoles = (updatedRoles: any[]) => {
    try {
      const saved = localStorage.getItem('truckflow_config');
      const parsed = saved ? JSON.parse(saved) : {};
      
      // 1. Build labels map { ROLE_KEY: "Label" }
      const customRolesMap: Record<string, string> = {};
      updatedRoles.forEach(r => {
        customRolesMap[r.key] = r.label;
      });
      
      // 2. Build permissions map { ROLE_KEY: ["perm1", "perm2"] }
      const customRolePermissions: Record<string, string[]> = {};
      updatedRoles.forEach(r => {
        const perms: string[] = [];
        
        // POS / Sales
        if (r.modules.pos === 'read') {
          perms.push(PERMISSIONS.SALES_VIEW);
        } else if (r.modules.pos === 'edit') {
          perms.push(PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_EDIT, PERMISSIONS.SALES_PAYMENT, PERMISSIONS.SALES_PRINT, PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_VIEW_ALL);
        }
        
        // Inventory
        if (r.modules.inventory === 'read') {
          perms.push(PERMISSIONS.INV_VIEW);
        } else if (r.modules.inventory === 'edit') {
          perms.push(PERMISSIONS.INV_RECEIVE, PERMISSIONS.INV_ISSUE, PERMISSIONS.INV_COUNT, PERMISSIONS.INV_ADJUST, PERMISSIONS.INV_SPOILAGE, PERMISSIONS.INV_APPROVE, PERMISSIONS.INV_VIEW, PERMISSIONS.INV_BOM, PERMISSIONS.INV_SUPPLIER, PERMISSIONS.INV_TRUCK, PERMISSIONS.SETTINGS_INGREDIENT);
        }
        
        // Reports
        if (r.modules.reports === 'read') {
          perms.push(PERMISSIONS.REPORT_VIEW);
        } else if (r.modules.reports === 'edit') {
          perms.push(PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT);
        }
        
        // Finance
        if (r.modules.finance === 'read') {
          perms.push(PERMISSIONS.FIN_VIEW);
        } else if (r.modules.finance === 'edit') {
          perms.push(PERMISSIONS.FIN_INCOME, PERMISSIONS.FIN_EXPENSE, PERMISSIONS.FIN_APPROVE, PERMISSIONS.FIN_BOOK, PERMISSIONS.FIN_LOCK, PERMISSIONS.FIN_VIEW);
        }
        
        // HR
        if (r.modules.hr === 'read') {
          perms.push(PERMISSIONS.HR_VIEW);
        } else if (r.modules.hr === 'edit') {
          perms.push(PERMISSIONS.HR_EMPLOYEE, PERMISSIONS.HR_ATTENDANCE, PERMISSIONS.HR_ADVANCE, PERMISSIONS.HR_SALARY, PERMISSIONS.HR_APPROVE_SALARY, PERMISSIONS.HR_VIEW);
        }
        
        // Customer Orders
        if (r.modules['customer-orders'] === 'read') {
          perms.push(PERMISSIONS.ORDER_VIEW);
        } else if (r.modules['customer-orders'] === 'edit') {
          perms.push(PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_CONFIRM, PERMISSIONS.ORDER_EDIT, PERMISSIONS.ORDER_CANCEL);
        }
        
        // Settings
        if (r.modules.settings === 'edit') {
          perms.push(PERMISSIONS.SETTINGS_STORE, PERMISSIONS.SETTINGS_PRINTER, PERMISSIONS.SETTINGS_SYNC, PERMISSIONS.SETTINGS_TEMPLATE, PERMISSIONS.USER_VIEW, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_EDIT, PERMISSIONS.USER_DELETE, PERMISSIONS.USER_ASSIGN_ROLE);
        }
        
        customRolePermissions[r.key] = perms;
      });
      
      parsed.customRolesList = updatedRoles;
      parsed.customRoles = customRolesMap;
      parsed.customRolePermissions = customRolePermissions;
      
      localStorage.setItem('truckflow_config', JSON.stringify(parsed));
      setCustomRoles(updatedRoles);
      
      // Update memory immediately
      refreshDynamicRoles();
      
      // Also publish to backend
      publishMenuToBackend().catch(err => console.error('Failed to sync updated config:', err));
      
      toast.success('Cập nhật vai trò & quyền hạn thành công!');
    } catch (e) {
      console.error('Failed to save custom roles:', e);
      toast.error('Không thể lưu cấu hình vai trò!');
    }
  };

  const loadActivities = async () => {
    const logs = await getActivityLogs();
    setActivities(logs);
  };

  useEffect(() => {
    if (activeTab === 'activities') {
      loadActivities();
    }
  }, [activeTab]);

  const [config, setConfig] = useState({
    storeName: 'Geta Oasis',
    storeAddress: 'Xe lưu động',
    storePhone: '0123456789',
    taxRate: '10',
    currency: 'VND',
    autoSync: true,
    syncInterval: '30',
    printerEnabled: true,
    printerType: 'escpos',
    lowStockThreshold: '10',
    storeLogo: '',
  });

  const [printerCfg, setPrinterCfg] = useState({
    type: 'network', // 'network' or 'usb'
    host: '',
    port: 9100,
    idVendor: '',
    idProduct: '',
  });
  const [showPrinterHelp, setShowPrinterHelp] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'STAFF' as Role,
    status: 'ACTIVE',
    employeeId: '',
    moduleAccess: '[]' as string, // JSON array of module keys
  });

  useEffect(() => {
    if (isAdmin || hasPermission(PERMISSIONS.USER_VIEW)) {
      const sub = database.get<UserModel>('users').query().observe().subscribe(setUsers);
      return () => sub.unsubscribe();
    }
  }, [isAdmin]);

  // Load employees for matching
  useEffect(() => {
    const sub = database.get<Employee>('employees').query().observe().subscribe(setEmployees);
    return () => sub.unsubscribe();
  }, []);


  // Load config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('truckflow_config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch {}
    }
    const savedPrinter = localStorage.getItem('printerConfig');
    if (savedPrinter) {
      try {
        setPrinterCfg(JSON.parse(savedPrinter));
      } catch {}
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem('truckflow_config', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success('Đã lưu cấu hình');
    // Sync store profile to backend instantly!
    publishMenuToBackend().catch(err => console.error("Failed to sync store profile:", err));
  };

  const savePrinterConfig = () => {
    localStorage.setItem('printerConfig', JSON.stringify(printerCfg));
    toast.success('Đã lưu cấu hình máy in');
  };

  const testPrinter = async () => {
    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer: printerCfg, lines: ['TEST PRINT', 'Geta Oasis'] }),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error('Test in thất bại: ' + (txt || res.statusText));
        return;
      }
      toast.success('Lệnh test in đã gửi');
    } catch (e: any) {
      toast.error('Không thể gửi lệnh in: ' + (e.message || e));
    }
  };

  const createTestData = async () => {
    const result = await seedTestData({ force: true });
    setSeedMessage(result.message);
    setTimeout(() => setSeedMessage(''), 4000);
    toast.success(result.message || 'Đã import dữ liệu test');
  };

  const resetDatabase = async () => {
    if (!confirm('CẢNH BÁO NGUY HIỂM:\nHành động này sẽ xóa vĩnh viễn TOÀN BỘ dữ liệu (sản phẩm, nguyên liệu, nhân sự, đơn hàng, giao dịch...) đang lưu trên trình duyệt này và đưa hệ thống về trạng thái trống.\n\nBạn có chắc chắn muốn tiếp tục?')) return;
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
      toast.success('Đã reset cơ sở dữ liệu thành công!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e: any) {
      toast.error('Lỗi khi xóa dữ liệu: ' + e.message);
    }
  };

  const handleAddUnit = () => {
    if (!newUnit.trim()) return;
    const trimmed = newUnit.trim();
    if (units.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Đơn vị này đã tồn tại!');
      return;
    }
    const updated = [...units, trimmed];
    setUnits(updated);
    localStorage.setItem('truckflow_units', JSON.stringify(updated));
    setNewUnit('');
    toast.success(`Đã thêm đơn vị "${trimmed}"`);
  };

  const handleDeleteUnit = (unitToDelete: string) => {
    if (units.length <= 1) {
      toast.error('Phải giữ lại ít nhất 1 đơn vị!');
      return;
    }
    const updated = units.filter(u => u !== unitToDelete);
    setUnits(updated);
    localStorage.setItem('truckflow_units', JSON.stringify(updated));
    toast.success(`Đã xóa đơn vị "${unitToDelete}"`);
  };

  const addUser = async () => {
    if (!userForm.username || !userForm.password) return;
    await database.write(async () => {
      await database.get<UserModel>('users').create((u: any) => {
        u._raw.id = generateId();
        u.username = userForm.username;
        u.password = userForm.password;
        u.displayName = userForm.displayName;
        u.role = userForm.role;
        u.status = userForm.status;
        u.employeeId = userForm.employeeId || '';
        u.moduleAccess = userForm.moduleAccess || '[]';
      });
    });
    setShowAddUser(false);
    setUserForm({ username: '', password: '', displayName: '', role: 'STAFF', status: 'ACTIVE', employeeId: '', moduleAccess: '[]' });
    toast.success(`Đã thêm người dùng "${userForm.displayName || userForm.username}"`);
  };


  const updateUser = async () => {
    if (!showEditUser) return;
    await database.write(async () => {
      const record = await database.get<UserModel>('users').find(showEditUser.id);
      await record.update((u: any) => {
        u.displayName = showEditUser.displayName;
        u.role = showEditUser.role;
        u.status = showEditUser.status;
        u.employeeId = showEditUser.employeeId || '';
        u.moduleAccess = showEditUser.moduleAccess || '[]';
        if (showEditUser.password) {
          u.password = showEditUser.password;
        }
      });
    });
    setShowEditUser(null);
    toast.success(`Đã cập nhật người dùng "${showEditUser.displayName || showEditUser.username}"`);
  };


  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await database.write(async () => {
      const record = await database.get<UserModel>('users').find(userId);
      await record.update((u: any) => {
        u.status = newStatus;
      });
    });
    const user = users.find((u: any) => u.id === userId);
    const label = newStatus === 'ACTIVE' ? 'mở khóa' : 'khóa';
    toast.success(`Đã ${label} người dùng "${user?.displayName || user?.username || ''}"`);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Xóa người dùng này?')) return;
    await database.write(async () => {
      const record = await database.get<UserModel>('users').find(userId);
      await record.destroyPermanently();
    });
    const user = users.find((u: any) => u.id === userId);
    toast.success(`Đã xóa người dùng "${user?.displayName || user?.username || ''}"`);
  };

  const filteredUsers = users.filter((u: any) =>
    !searchTerm ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageUsers = isAdmin || hasPermission(PERMISSIONS.USER_CREATE);
  const canEditUsers = isAdmin || hasPermission(PERMISSIONS.USER_EDIT);

  const tabs = [
    { key: 'general', label: 'Cửa hàng', show: true },
    { key: 'menu', label: 'Menu', show: isAdmin || hasPermission(PERMISSIONS.INV_BOM) },
    { key: 'ingredients', label: 'Nguyên liệu', show: isAdmin || hasPermission(PERMISSIONS.SETTINGS_INGREDIENT) },
    { key: 'units', label: 'Đơn vị', show: isAdmin || hasPermission(PERMISSIONS.SETTINGS_INGREDIENT) },
    { key: 'users', label: 'Người dùng', show: canManageUsers || hasPermission(PERMISSIONS.USER_VIEW) },
    { key: 'roles', label: 'Vai trò & Quyền', show: isAdmin || hasPermission(PERMISSIONS.USER_ASSIGN_ROLE) },
    { key: 'activities', label: 'Lịch sử hoạt động', show: isAdmin },
    { key: 'sync', label: 'Đồng bộ', show: hasPermission(PERMISSIONS.SETTINGS_SYNC) || isAdmin },
    { key: 'printer', label: 'Máy in', show: hasPermission(PERMISSIONS.SETTINGS_PRINTER) || isAdmin },
    { key: 'about', label: 'Về phần mềm', show: true },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex space-x-2 flex-wrap gap-2">
        {tabs.filter(t => t.show).map(t => (
          <TabButton key={t.key} label={t.label} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} />
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen space-y-4">
          <h3 className="font-bold text-primary-dark text-lg">Thông tin cửa hàng</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">Tên cửa hàng</label>
              <input type="text" value={config.storeName} onChange={(e: any) => setConfig({ ...config, storeName: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">Số điện thoại</label>
              <input type="text" value={config.storePhone} onChange={(e: any) => setConfig({ ...config, storePhone: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-text-secondary font-medium block mb-1">Địa chỉ</label>
              <input type="text" value={config.storeAddress} onChange={(e: any) => setConfig({ ...config, storeAddress: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">Thuế (%)</label>
              <input type="number" value={config.taxRate} onChange={(e: any) => setConfig({ ...config, taxRate: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">Đơn vị tiền tệ</label>
              <select value={config.currency} onChange={(e: any) => setConfig({ ...config, currency: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none bg-white">
                <option value="VND">VND - Việt Nam Đồng</option>
                <option value="USD">USD - US Dollar</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">Ngưỡng tồn thấp</label>
              <input type="number" value={config.lowStockThreshold} onChange={(e: any) => setConfig({ ...config, lowStockThreshold: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            
            {/* Logo cửa hàng */}
            <div className="col-span-2 space-y-1.5 p-3.5 bg-surface-zen/10 border border-surface-zen rounded-xl">
              <label className="text-xs text-text-secondary font-semibold block">Logo cửa hàng (Geta Oasis)</label>
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-xl border border-surface-zen flex items-center justify-center bg-white overflow-hidden flex-shrink-0">
                  {config.storeLogo ? (
                    <img src={config.storeLogo} alt="Logo Preview" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-text-secondary text-[10px] text-center px-1 font-medium leading-tight">Chưa có Logo</span>
                  )}
                </div>
                <div className="flex-1 flex flex-col space-y-1">
                  <input type="file" accept="image/*" id="store-logo-upload" className="hidden"
                    onChange={(e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const compressed = await compressImage(reader.result as string, 100, 100, 0.7);
                          setConfig({ ...config, storeLogo: compressed });
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  <div className="flex space-x-2">
                    <label htmlFor="store-logo-upload"
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer">
                      Chọn Logo
                    </label>
                    {config.storeLogo && (
                      <button onClick={() => setConfig({ ...config, storeLogo: '' })}
                        className="px-3 py-1.5 bg-error-zen/10 text-error-zen rounded-lg text-xs font-bold hover:bg-error-zen/20 transition-all">
                        Xóa Logo
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-text-secondary">Tự động nén và đồng bộ lên trang Order của khách hàng.</p>
                </div>
              </div>
            </div>
          </div>
          <button onClick={saveConfig} className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center space-x-2">
            {saved ? <><Check size={18} /><span>Đã lưu</span></> : <><Save size={18} /><span>Lưu cấu hình</span></>}
          </button>
        </div>
      )}

      {activeTab === 'menu' && <MenuConfig units={units} />}

      {activeTab === 'ingredients' && <IngredientConfig units={units} />}

      {activeTab === 'units' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen space-y-6">
          <div>
            <h3 className="font-bold text-primary-dark text-lg">Quản lý đơn vị tính</h3>
            <p className="text-text-secondary text-sm mt-1">Cấu hình danh sách các đơn vị sử dụng cho sản phẩm và nguyên liệu.</p>
          </div>

          {/* Add unit form */}
          <div className="flex space-x-3 items-end max-w-md">
            <div className="flex-1">
              <label className="text-sm text-text-secondary font-medium block mb-1">Tên đơn vị mới</label>
              <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                placeholder="VD: Ly, Chai, Túi, Thùng..."
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <button onClick={handleAddUnit}
              className="px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-primary-dark transition-all flex items-center space-x-1 h-[46px]">
              <Plus size={16} />
              <span>Thêm</span>
            </button>
          </div>

          {/* List of units */}
          <div className="border border-surface-zen rounded-xl overflow-hidden max-w-md bg-surface-zen/10">
            <div className="bg-surface-zen px-4 py-3 font-semibold text-sm text-text-secondary border-b border-surface-zen">
              Danh sách đơn vị ({units.length})
            </div>
            <div className="divide-y divide-surface-zen max-h-[300px] overflow-y-auto bg-white">
              {units.map((unit) => (
                <div key={unit} className="flex justify-between items-center px-4 py-3 hover:bg-surface-zen/20 transition-all">
                  <span className="font-medium text-sm text-primary-dark">{unit}</span>
                  <button onClick={() => handleDeleteUnit(unit)}
                    className="p-1 text-text-secondary hover:text-error-zen hover:bg-error-zen/10 rounded transition-all"
                    title="Xóa đơn vị">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input type="text" placeholder="Tìm kiếm người dùng..." value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            {canManageUsers && (
              <button onClick={() => setShowAddUser(true)}
                className="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
                <UserPlus size={16} /><span>Thêm người dùng</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-zen">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Người dùng</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Tên đăng nhập</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Vai trò</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Nhân viên</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Trạng thái</th>
                  {(canEditUsers || isAdmin) && <th className="text-right p-4 text-sm font-medium text-text-secondary">Thao tác</th>}

                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                          {u.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium text-sm">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-text-secondary">{u.username}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {ROLE_LABELS[u.role as Role] || u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {u.employeeId ? (
                        <span className="text-xs text-text-secondary">
                          {employees.find((e: any) => e.id === u.employeeId)?.name || 'Đã xóa'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    {(canEditUsers || isAdmin) && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button onClick={() => setShowEditUser({
                            id: u.id, username: u.username, displayName: u.displayName,
                            role: u.role, status: u.status, password: '',
                            employeeId: u.employeeId || '',
                            moduleAccess: u.moduleAccess || '[]',
                          })}

                            className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Sửa">
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => toggleUserStatus(u.id, u.status)}
                            className={`p-2 rounded-lg transition-all ${u.status === 'ACTIVE' ? 'text-text-secondary hover:text-error-zen hover:bg-error-zen/10' : 'text-text-secondary hover:text-success-zen hover:bg-success-zen/10'}`}
                            title={u.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}>
                            {u.status === 'ACTIVE' ? <Lock size={15} /> : <Unlock size={15} />}
                          </button>
                          {isAdmin && u.id !== currentUser?.id && (
                            <button onClick={() => deleteUser(u.id)}
                              className="p-2 text-text-secondary hover:text-error-zen hover:bg-error-zen/10 rounded-lg transition-all"
                              title="Xóa">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">Chưa có người dùng nào</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Role Info Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen">
            <h3 className="font-bold text-primary-dark text-lg mb-4 flex items-center space-x-2">
              <Shield size={20} /><span>Phân quyền theo vai trò</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} className="p-3 bg-surface-zen rounded-lg">
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-text-secondary mt-1">{role === 'SYSTEM_ADMIN' ? 'Toàn quyền hệ thống' : getRoleDescription(role as Role)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen space-y-4">
          <h3 className="font-bold text-primary-dark text-lg">Cấu hình đồng bộ</h3>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={config.autoSync} onChange={(e: any) => setConfig({ ...config, autoSync: e.target.checked })} className="w-5 h-5 rounded" />
              <div>
                <p className="font-medium">Tự động đồng bộ</p>
                <p className="text-sm text-text-secondary">Đồng bộ dữ liệu lên cloud định kỳ</p>
              </div>
            </label>
            {config.autoSync && (
              <div>
                <label className="text-sm text-text-secondary font-medium block mb-1">Chu kỳ đồng bộ (giây)</label>
                <input type="number" value={config.syncInterval} onChange={(e: any) => setConfig({ ...config, syncInterval: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
              </div>
            )}
          </div>
          <button onClick={saveConfig} className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center space-x-2">
            {saved ? <><Check size={18} /><span>Đã lưu</span></> : <><Save size={18} /><span>Lưu cấu hình</span></>}
          </button>
        </div>
      )}

      {activeTab === 'printer' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen space-y-4">
          <h3 className="font-bold text-primary-dark text-lg">Cấu hình máy in</h3>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input type="checkbox" checked={config.printerEnabled} onChange={(e: any) => setConfig({ ...config, printerEnabled: e.target.checked })} className="w-5 h-5 rounded" />
              <div>
                <p className="font-medium">Bật máy in hóa đơn</p>
                <p className="text-sm text-text-secondary">In hóa đơn tự động sau khi thanh toán</p>
              </div>
            </label>
            {config.printerEnabled && (
              <div>
                <label className="text-sm text-text-secondary font-medium block mb-1">Loại máy in</label>
                <select value={config.printerType} onChange={(e: any) => setConfig({ ...config, printerType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none bg-white">
                  <option value="escpos">ESC/POS (Máy in nhiệt)</option>
                  <option value="a4">A4 (Máy in thường)</option>
                </select>
                {config.printerType === 'escpos' && (
                  <div className="mt-4 space-y-3">
                    <label className="text-sm text-text-secondary font-medium block mb-1">Kết nối máy in</label>
                    <select value={printerCfg.type} onChange={(e: any) => setPrinterCfg({ ...printerCfg, type: e.target.value })}
                      className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none bg-white">
                      <option value="network">Mạng (TCP/IP)</option>
                      <option value="usb">USB</option>
                    </select>

                    {printerCfg.type === 'network' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-text-secondary block mb-1">Host (IP hoặc hostname)</label>
                          <input type="text" value={printerCfg.host}
                            onChange={(e: any) => setPrinterCfg({ ...printerCfg, host: e.target.value })}
                            className="w-full px-4 py-2.5 border border-surface-zen rounded-lg outline-none" />
                        </div>
                        <div>
                          <label className="text-sm text-text-secondary block mb-1">Port</label>
                          <input type="number" value={printerCfg.port}
                            onChange={(e: any) => setPrinterCfg({ ...printerCfg, port: Number(e.target.value) })}
                            className="w-full px-4 py-2.5 border border-surface-zen rounded-lg outline-none" />
                        </div>
                      </div>
                    )}

                    {printerCfg.type === 'usb' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-text-secondary block mb-1">idVendor (hex hoặc dec)</label>
                          <input type="text" value={printerCfg.idVendor}
                            onChange={(e: any) => setPrinterCfg({ ...printerCfg, idVendor: e.target.value })}
                            className="w-full px-4 py-2.5 border border-surface-zen rounded-lg outline-none" />
                        </div>
                        <div>
                          <label className="text-sm text-text-secondary block mb-1">idProduct (hex hoặc dec)</label>
                          <input type="text" value={printerCfg.idProduct}
                            onChange={(e: any) => setPrinterCfg({ ...printerCfg, idProduct: e.target.value })}
                            className="w-full px-4 py-2.5 border border-surface-zen rounded-lg outline-none" />
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-3 mt-2">
                      <button onClick={savePrinterConfig} className="px-4 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-primary-dark">Lưu máy in</button>
                      <button onClick={testPrinter} className="px-4 py-2.5 border border-surface-zen rounded-lg text-text-secondary">Test in</button>
                      <button onClick={() => setShowPrinterHelp(true)} className="px-4 py-2.5 border border-surface-zen rounded-lg text-text-secondary">Hướng dẫn</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={saveConfig} className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center space-x-2">
            {saved ? <><Check size={18} /><span>Đã lưu</span></> : <><Save size={18} /><span>Lưu cấu hình</span></>}
          </button>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-primary-dark text-lg">Quản lý vai trò & Phân quyền</h3>
              <p className="text-sm text-text-secondary">Định nghĩa vai trò và cấu hình quyền hạn chi tiết cho từng tab chức năng.</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  setRoleForm({
                    key: '',
                    label: '',
                    modules: {
                      pos: 'none',
                      inventory: 'none',
                      reports: 'none',
                      finance: 'none',
                      hr: 'none',
                      'customer-orders': 'none',
                      settings: 'none',
                    }
                  });
                  setShowAddRole(true);
                }}
                className="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1"
              >
                <Plus size={16} /><span>Thêm vai trò</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-zen">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Vai trò</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Loại vai trò</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Quyền truy cập các tab</th>
                  {isAdmin && <th className="text-right p-4 text-sm font-medium text-text-secondary">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {/* 1. Standard Roles */}
                {Object.entries(STANDARD_ROLE_LABELS).map(([key, label]) => {
                  return (
                    <tr key={key} className="border-t border-surface-zen hover:bg-surface-zen/50">
                      <td className="p-4 font-medium text-sm text-primary-dark">{label}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Hệ thống (Khóa)
                        </span>
                      </td>
                      <td className="p-4 text-xs text-text-secondary max-w-sm">
                        <div className="flex flex-wrap gap-1">
                          {key === 'SYSTEM_ADMIN' ? (
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">Toàn bộ hệ thống</span>
                          ) : (
                            MODULE_ACCESS.map(mod => {
                              const required = mod.requiredPermissions;
                              const userPerms = ROLE_PERMISSIONS[key] || [];
                              const hasEdit = required.some(p => userPerms.includes(p.replace(':view', ':create') as any) || userPerms.includes(p.replace(':view', ':edit') as any));
                              const hasRead = required.some(p => userPerms.includes(p));
                              if (hasEdit) {
                                return <span key={mod.key} className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-150">{mod.label} (Edit)</span>;
                              } else if (hasRead) {
                                return <span key={mod.key} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-150">{mod.label} (Xem)</span>;
                              }
                              return null;
                            })
                          )}
                        </div>
                      </td>
                      {isAdmin && <td className="p-4 text-right text-xs text-gray-400 font-medium italic">-</td>}
                    </tr>
                  );
                })}

                {/* 2. Custom Roles */}
                {customRoles.map((role: any) => (
                  <tr key={role.key} className="border-t border-surface-zen hover:bg-surface-zen/50">
                    <td className="p-4 font-medium text-sm text-primary-dark">{role.label}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        Tùy chỉnh
                      </span>
                    </td>
                    <td className="p-4 text-xs text-text-secondary max-w-sm">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(role.modules).map(([modKey, level]) => {
                          const label = MODULE_ACCESS.find(m => m.key === modKey)?.label || modKey;
                          if (level === 'edit') {
                            return <span key={modKey} className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-150">{label} (Edit)</span>;
                          } else if (level === 'read') {
                            return <span key={modKey} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-150">{label} (Xem)</span>;
                          }
                          return null;
                        })}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => {
                              setShowEditRole(role);
                              setRoleForm({
                                key: role.key,
                                label: role.label,
                                modules: { ...role.modules }
                              });
                            }}
                            className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Sửa quyền"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa vai trò "${role.label}" không?`)) {
                                const remaining = customRoles.filter(r => r.key !== role.key);
                                saveCustomRoles(remaining);
                              }
                            }}
                            className="p-2 text-text-secondary hover:text-error-zen hover:bg-error-zen/10 rounded-lg transition-all"
                            title="Xóa vai trò"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                
                {customRoles.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="text-center py-6 text-sm text-text-secondary italic bg-slate-50/50">
                      Chưa có vai trò tùy chỉnh nào được tạo. Nhấn "Thêm vai trò" ở trên để tạo mới.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add Role Modal */}
          {showAddRole && (
            <Modal title="Thêm vai trò tùy chỉnh" onClose={() => setShowAddRole(false)}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Tên vai trò <span className="text-error-zen">*</span></label>
                  <input
                    type="text"
                    value={roleForm.label}
                    onChange={(e: any) => {
                      const label = e.target.value;
                      const key = 'CUSTOM_' + label.toUpperCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '') // strip vietnamese accents
                        .replace(/[^A-Z0-9]/g, '_')
                        .substring(0, 15);
                      setRoleForm({ ...roleForm, label, key });
                    }}
                    placeholder="VD: Tổ trưởng, Phục vụ ca tối..."
                    className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Mã vai trò (Tự động)</label>
                  <input
                    type="text"
                    value={roleForm.key}
                    disabled
                    className="w-full px-4 py-2.5 border border-surface-zen bg-slate-50 rounded-lg text-text-secondary cursor-not-allowed font-mono text-xs"
                  />
                </div>

                <div className="border border-surface-zen rounded-xl overflow-hidden mt-4">
                  <table className="w-full text-sm text-primary-dark">
                    <thead className="bg-slate-50 border-b border-surface-zen">
                      <tr>
                        <th className="text-left p-3 font-semibold text-text-secondary">Chức năng (Tab)</th>
                        <th className="text-left p-3 font-semibold text-text-secondary">Quyền hạn truy cập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULE_ACCESS.map(mod => (
                        <tr key={mod.key} className="border-b border-surface-zen hover:bg-slate-50/50">
                          <td className="p-3 font-medium">{mod.label}</td>
                          <td className="p-3">
                            <select
                              value={roleForm.modules[mod.key] || 'none'}
                              onChange={(e: any) => {
                                const updatedModules = { ...roleForm.modules, [mod.key]: e.target.value };
                                setRoleForm({ ...roleForm, modules: updatedModules });
                              }}
                              className="px-3 py-1.5 border border-surface-zen rounded-lg outline-none text-sm bg-white"
                            >
                              <option value="none">Không có quyền (None)</option>
                              <option value="read">Chỉ xem (Read-only)</option>
                              <option value="edit">Toàn quyền (Edit)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex space-x-2 justify-end mt-6">
                  <button
                    onClick={() => setShowAddRole(false)}
                    className="px-4 py-2.5 border border-surface-zen text-text-secondary rounded-lg font-medium hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (!roleForm.label.trim()) {
                        toast.error('Vui lòng nhập tên vai trò!');
                        return;
                      }
                      if (customRoles.some(r => r.key === roleForm.key)) {
                        toast.error('Mã vai trò đã tồn tại hoặc tên vai trò trùng lặp!');
                        return;
                      }
                      const updated = [...customRoles, { key: roleForm.key, label: roleForm.label, modules: roleForm.modules }];
                      saveCustomRoles(updated);
                      setShowAddRole(false);
                    }}
                    className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-primary-dark"
                  >
                    Thêm vai trò
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Edit Role Modal */}
          {showEditRole && (
            <Modal title={`Chỉnh sửa vai trò: ${showEditRole.label}`} onClose={() => setShowEditRole(null)}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Tên vai trò</label>
                  <input
                    type="text"
                    value={roleForm.label}
                    onChange={(e: any) => setRoleForm({ ...roleForm, label: e.target.value })}
                    className="w-full px-4 py-2.5 border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
                  />
                </div>

                <div className="border border-surface-zen rounded-xl overflow-hidden mt-4">
                  <table className="w-full text-sm text-primary-dark">
                    <thead className="bg-slate-50 border-b border-surface-zen">
                      <tr>
                        <th className="text-left p-3 font-semibold text-text-secondary">Chức năng (Tab)</th>
                        <th className="text-left p-3 font-semibold text-text-secondary">Quyền hạn truy cập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULE_ACCESS.map(mod => (
                        <tr key={mod.key} className="border-b border-surface-zen hover:bg-slate-50/50">
                          <td className="p-3 font-medium">{mod.label}</td>
                          <td className="p-3">
                            <select
                              value={roleForm.modules[mod.key] || 'none'}
                              onChange={(e: any) => {
                                const updatedModules = { ...roleForm.modules, [mod.key]: e.target.value };
                                setRoleForm({ ...roleForm, modules: updatedModules });
                              }}
                              className="px-3 py-1.5 border border-surface-zen rounded-lg outline-none text-sm bg-white"
                            >
                              <option value="none">Không có quyền (None)</option>
                              <option value="read">Chỉ xem (Read-only)</option>
                              <option value="edit">Toàn quyền (Edit)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex space-x-2 justify-end mt-6">
                  <button
                    onClick={() => setShowEditRole(null)}
                    className="px-4 py-2.5 border border-surface-zen text-text-secondary rounded-lg font-medium hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (!roleForm.label.trim()) {
                        toast.error('Vui lòng nhập tên vai trò!');
                        return;
                      }
                      const updated = customRoles.map(r => r.key === showEditRole.key ? { ...r, label: roleForm.label, modules: roleForm.modules } : r);
                      saveCustomRoles(updated);
                      setShowEditRole(null);
                    }}
                    className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-primary-dark"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen space-y-4">
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <SettingsIcon size={40} />
            </div>
            <h2 className="text-2xl font-bold text-primary-dark">Geta Oasis</h2>
            <p className="text-text-secondary mt-2">Hệ thống xe lưu động (Oasis)</p>
            <div className="mt-6 space-y-2 text-sm text-text-secondary">
              <p>Phiên bản: 1.0.0</p>
              <p>Nền tảng: Offline-first PWA</p>
              <p>Cơ sở dữ liệu: WatermelonDB + PostgreSQL</p>
              <p>Phân quyền: RBAC với 8 vai trò</p>
              <p>© 2026 Geta Oasis. All rights reserved.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3 flex-wrap gap-2">
              <div className="relative w-72">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Tìm kiếm hoạt động, tên, chi tiết..."
                  value={activitySearchTerm}
                  onChange={(e) => setActivitySearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-sm"
                />
              </div>
              <select
                value={activityRoleFilter}
                onChange={(e) => setActivityRoleFilter(e.target.value)}
                className="px-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-sm min-w-[150px]"
              >
                <option value="all">Tất cả vai trò</option>
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </div>
            {activities.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm('Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ lịch sử hoạt động không? Hành động này không thể hoàn tác.')) {
                    await clearActivityLogs();
                    toast.success('Đã xóa toàn bộ lịch sử hoạt động');
                    loadActivities();
                  }
                }}
                className="px-4 py-2.5 bg-error-zen/10 text-error-zen hover:bg-error-zen hover:text-white rounded-lg text-sm font-medium transition-all"
              >
                Xóa lịch sử
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-surface-zen">
              {activities
                .filter((act) => {
                  const matchesSearch =
                    !activitySearchTerm ||
                    act.action.toLowerCase().includes(activitySearchTerm.toLowerCase()) ||
                    act.details.toLowerCase().includes(activitySearchTerm.toLowerCase()) ||
                    act.username.toLowerCase().includes(activitySearchTerm.toLowerCase()) ||
                    act.displayName.toLowerCase().includes(activitySearchTerm.toLowerCase());
                  const matchesRole = activityRoleFilter === 'all' || act.role === activityRoleFilter;
                  return matchesSearch && matchesRole;
                })
                .map((act) => {
                  // Pastel colors for different roles
                  const roleColors: Record<string, string> = {
                    SYSTEM_ADMIN: 'bg-orange-50/70 border-orange-100 hover:bg-orange-100/50 text-orange-950',
                    STORE_MANAGER: 'bg-purple-50/70 border-purple-100 hover:bg-purple-100/50 text-purple-950',
                    CASHIER: 'bg-blue-50/70 border-blue-100 hover:bg-blue-100/50 text-blue-950',
                    WAREHOUSE: 'bg-amber-50/70 border-amber-100 hover:bg-amber-100/50 text-amber-950',
                    HR: 'bg-rose-50/70 border-rose-100 hover:bg-rose-100/50 text-rose-950',
                    ACCOUNTANT: 'bg-emerald-50/70 border-emerald-100 hover:bg-emerald-100/50 text-emerald-950',
                    REPORT_VIEWER: 'bg-cyan-50/70 border-cyan-100 hover:bg-cyan-100/50 text-cyan-950',
                    STAFF: 'bg-slate-50/70 border-slate-100 hover:bg-slate-100/50 text-slate-950',
                  };
                  const colorClass = roleColors[act.role] || 'bg-slate-50 border-slate-100 hover:bg-slate-100/50';

                  return (
                    <div
                      key={act.id}
                      className={`p-4 border-l-4 transition-all flex items-start justify-between gap-4 ${colorClass}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-1">
                          <span className="font-semibold text-sm">{act.action}</span>
                          <span className="text-xs text-text-secondary opacity-80">•</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/5">
                            {ROLE_LABELS[act.role as Role] || act.role}
                          </span>
                          <span className="text-xs font-semibold">
                            {act.displayName} ({act.username})
                          </span>
                        </div>
                        <p className="text-sm text-text-primary/90">{act.details}</p>
                      </div>
                      <span className="text-[11px] text-text-secondary whitespace-nowrap">
                        {new Date(act.timestamp).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  );
                })}
              {activities.length === 0 && (
                <div className="text-center py-16 text-gray-400 space-y-2">
                  <History size={40} className="mx-auto text-gray-300 stroke-[1.5]" />
                  <p className="text-sm">Chưa ghi nhận hoạt động nào trên hệ thống</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <Modal title="Thêm người dùng" onClose={() => setShowAddUser(false)}>
          <div className="space-y-3">
            <Input label="Tên đăng nhập" value={userForm.username}
              onChange={(e: any) => setUserForm({ ...userForm, username: e.target.value })} placeholder="Nhập tên đăng nhập..." />
            <Input label="Mật khẩu" type="password" value={userForm.password}
              onChange={(e: any) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Nhập mật khẩu..." />
            <Input label="Tên hiển thị" value={userForm.displayName}
              onChange={(e: any) => setUserForm({ ...userForm, displayName: e.target.value })} placeholder="Nhập tên hiển thị..." />
            <Select label="Vai trò" value={userForm.role}
              onChange={(e: any) => {
                const newRole = e.target.value;
                setUserForm({ ...userForm, role: newRole, moduleAccess: newRole === 'STAFF' ? userForm.moduleAccess : '[]' });
              }}
              options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />

            {/* Employee matching - only for STAFF role */}
            {userForm.role === 'STAFF' && (
              <>
                <Select label="Ghép với nhân viên" value={userForm.employeeId}
                  onChange={(e: any) => setUserForm({ ...userForm, employeeId: e.target.value })}
                  options={[
                    { value: '', label: '-- Không ghép --' },
                    ...employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => ({
                      value: e.id,
                      label: `${e.name} (${e.role || 'Nhân viên'})`,
                    })),
                  ]} />

                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-text-secondary mb-2">Quyền truy cập menu:</p>
                  <p className="text-xs text-text-secondary mb-3">Chọn các tab mà nhân viên này được phép xem</p>
                  <div className="space-y-2">
                    {MODULE_ACCESS.map((mod) => {
                      const selectedModules: string[] = JSON.parse(userForm.moduleAccess || '[]');
                      const isSelected = selectedModules.includes(mod.key);
                      return (
                        <label key={mod.key} className="flex items-center space-x-3 p-2 hover:bg-surface-zen rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const current = JSON.parse(userForm.moduleAccess || '[]');
                              const updated = isSelected
                                ? current.filter((k: string) => k !== mod.key)
                                : [...current, mod.key];
                              setUserForm({ ...userForm, moduleAccess: JSON.stringify(updated) });
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm">{mod.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <button onClick={addUser} disabled={!userForm.username || !userForm.password}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Thêm người dùng
            </button>
          </div>
        </Modal>
      )}


      {/* Edit User Modal */}
      {showEditUser && (
        <Modal title="Sửa người dùng" onClose={() => setShowEditUser(null)}>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">Tên đăng nhập</label>
              <input type="text" value={showEditUser.username} disabled
                className="w-full px-4 py-2.5 border border-surface-zen rounded-lg bg-gray-50 text-gray-500" />
            </div>
            <Input label="Mật khẩu mới (để trống nếu không đổi)" type="password" value={showEditUser.password}
              onChange={(e: any) => setShowEditUser({ ...showEditUser, password: e.target.value })} placeholder="Để trống nếu không đổi..." />
            <Input label="Tên hiển thị" value={showEditUser.displayName}
              onChange={(e: any) => setShowEditUser({ ...showEditUser, displayName: e.target.value })} placeholder="Nhập tên hiển thị..." />
            <Select label="Vai trò" value={showEditUser.role}
              onChange={(e: any) => setShowEditUser({ ...showEditUser, role: e.target.value })}
              options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
            <Select label="Trạng thái" value={showEditUser.status}
              onChange={(e: any) => setShowEditUser({ ...showEditUser, status: e.target.value })}
              options={[{ value: 'ACTIVE', label: 'Hoạt động' }, { value: 'INACTIVE', label: 'Đã khóa' }]} />

            {/* Employee matching - only for STAFF role */}
            {showEditUser.role === 'STAFF' && (
              <>
                <Select label="Ghép với nhân viên" value={showEditUser.employeeId}
                  onChange={(e: any) => setShowEditUser({ ...showEditUser, employeeId: e.target.value })}
                  options={[
                    { value: '', label: '-- Không ghép --' },
                    ...employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => ({
                      value: e.id,
                      label: `${e.name} (${e.role || 'Nhân viên'})`,
                    })),
                  ]} />

                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-text-secondary mb-2">Quyền truy cập menu:</p>
                  <p className="text-xs text-text-secondary mb-3">Chọn các tab mà nhân viên này được phép xem</p>
                  <div className="space-y-2">
                    {MODULE_ACCESS.map((mod) => {
                      const selectedModules: string[] = JSON.parse(showEditUser.moduleAccess || '[]');
                      const isSelected = selectedModules.includes(mod.key);
                      return (
                        <label key={mod.key} className="flex items-center space-x-3 p-2 hover:bg-surface-zen rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const current = JSON.parse(showEditUser.moduleAccess || '[]');
                              const updated = isSelected
                                ? current.filter((k: string) => k !== mod.key)
                                : [...current, mod.key];
                              setShowEditUser({ ...showEditUser, moduleAccess: JSON.stringify(updated) });
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm">{mod.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <button onClick={updateUser}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all">
              Cập nhật
            </button>
          </div>
        </Modal>
      )}

      {showPrinterHelp && (
        <Modal title="Hướng dẫn cấu hình máy in" onClose={() => setShowPrinterHelp(false)}>
          <div className="space-y-3 text-sm">
            <p className="font-medium">Mô tả nhanh</p>
            <p>Hướng dẫn này giúp bạn cấu hình máy in nhiệt (ESC/POS) để hệ thống có thể gửi lệnh in trực tiếp từ backend hoặc frontend.</p>

            <p className="font-medium">Khi in từ backend</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Đặt biến môi trường trên server (Render/VPS): <code>PRINTER_TYPE=network</code>, <code>PRINTER_HOST=IP</code>, <code>PRINTER_PORT=9100</code>.</li>
              <li>Đảm bảo máy in có thể truy cập từ server (cùng mạng hoặc public IP) và port 9100 mở.</li>
              <li>Gửi test in từ giao diện Settings → Máy in → Test in.</li>
            </ol>

            <p className="font-medium">Khi in từ máy nhân viên (frontend)</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Trong tab Máy in, chọn loại <strong>ESC/POS</strong> và kết nối <strong>Mạng (TCP/IP)</strong>.</li>
              <li>Nhập <strong>Host</strong> (IP của máy in) và <strong>Port</strong> (mặc định 9100) rồi nhấn <strong>Lưu máy in</strong>.</li>
              <li>Nhấn <strong>Test in</strong> để gửi lệnh test; nếu thất bại, hệ thống sẽ hiển thị lỗi (kiểm tra IP/port và firewall).</li>
            </ol>

            <p className="font-medium">Lưu ý cấu hình USB</p>
            <p>Nếu chọn USB, backend cần quyền truy cập cổng USB (không khả dụng trên nhiều hosting). Để dùng USB bạn thường phải chạy backend trên máy nội bộ (VPS/PC) có cắm máy in.</p>

            <p className="font-medium">Ví dụ cấu hình môi trường</p>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">PRINTER_TYPE=network
PRINTER_HOST=192.168.1.55
PRINTER_PORT=9100</pre>

            <p className="font-medium">Ví dụ lưu vào trình duyệt (localStorage)</p>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">{"localStorage.setItem('printerConfig', JSON.stringify({\"type\":\"network\", \"host\":\"192.168.1.55\", \"port\":9100}))"}</pre>

            <div className="flex space-x-2 mt-2">
              <button onClick={() => { savePrinterConfig(); setShowPrinterHelp(false); }} className="px-4 py-2 bg-accent text-white rounded">Lưu cấu hình mẫu</button>
              <button onClick={() => { testPrinter(); setShowPrinterHelp(false); }} className="px-4 py-2 border rounded">Gửi test in</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    SYSTEM_ADMIN: 'Toàn quyền: quản trị hệ thống, người dùng, phân quyền, xem toàn bộ dữ liệu',
    STORE_MANAGER: 'Quản lý: bán hàng, kho, báo cáo, chốt ca, duyệt điều chỉnh kho, xem nhân sự',
    CASHIER: 'Thu ngân: tạo/sửa đơn, thanh toán, in hóa đơn, xem lịch sử giao dịch',
    WAREHOUSE: 'Nhân viên kho: nhập/xuất/kiểm kê, hủy hàng, xem tồn kho',
    HR: 'Nhân sự: quản lý nhân viên, chấm công, tạm ứng, tính lương',
    ACCOUNTANT: 'Kế toán: quản lý quỹ, phiếu thu/chi, sổ quỹ, đối soát, báo cáo tài chính',
    REPORT_VIEWER: 'Xem báo cáo: dashboard, bán hàng, kho, thu chi, lương (chỉ xem)',
    STAFF: 'Người dùng thường: thao tác cơ bản trong phạm vi được giao',
  };
  return descriptions[role] || '';
}

function MenuConfig({ units }: { units: string[] }) {
  const toast = useToast();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuIngredients, setMenuIngredients] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState<any>(null);
  const [showIngredients, setShowIngredients] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [categories, setCategories] = useState<string[]>(getSavedCategories);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  const [itemForm, setItemForm] = useState({
    name: '', price: '', category: getSavedCategories()[0] || 'Đồ uống', unit: '',
    defaultDiscount: '0', discountStart: '', discountEnd: '', isActive: true, image: '',
  });

  const [ingredientForm, setIngredientForm] = useState({
    materialId: '', materialName: '', quantity: '1', unit: '',
  });

  // Pending ingredients for the Add modal (not yet saved to DB)
  const [pendingIngredients, setPendingIngredients] = useState<Array<{
    materialId: string; materialName: string; quantity: string; unit: string;
  }>>([]);

  // Pending ingredients for the Edit modal
  const [editPendingIngredients, setEditPendingIngredients] = useState<Array<{
    materialId: string; materialName: string; quantity: string; unit: string;
  }>>([]);

  // Bulk add state
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    const sub1 = database.get<MenuItem>('menu_items').query().observe().subscribe(setMenuItems);
    const sub2 = database.get<MenuIngredient>('menu_ingredients').query().observe().subscribe(setMenuIngredients);
    const sub3 = database.get<InventoryItem>('inventory_items').query().observe().subscribe(setInventoryItems);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); };
  }, []);

  // Only raw materials for ingredient selection
  const rawMaterials = inventoryItems.filter((i: any) => i.isRawMaterial);

  const filteredItems = menuItems.filter((item: any) =>
    !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addMenuItem = async (keepOpen: boolean = false) => {
    if (!itemForm.name || !itemForm.price) return;
    const discountStart = itemForm.discountStart ? new Date(itemForm.discountStart).getTime() : 0;
    const discountEnd = itemForm.discountEnd ? new Date(itemForm.discountEnd).getTime() : 0;
    const menuItemId = generateId();
    const itemName = itemForm.name;
    const itemIngredientsCount = pendingIngredients.length;
    
    await database.write(async () => {
      // Create menu item
      await database.get<MenuItem>('menu_items').create((m: any) => {
        m._raw.id = menuItemId;
        m.name = itemForm.name;
        m.price = itemForm.price;
        m.category = itemForm.category;
        m.unit = '';
        m.defaultDiscount = itemForm.defaultDiscount;
        m.discountStart = discountStart;
        m.discountEnd = discountEnd;
        m.isActive = itemForm.isActive;
        m.image = itemForm.image || '';
      });
      // Save pending ingredients
      for (const ing of pendingIngredients) {
        await database.get<MenuIngredient>('menu_ingredients').create((r: any) => {
          r._raw.id = generateId();
          r.menuItemId = menuItemId;
          r.materialId = ing.materialId;
          r.materialName = ing.materialName;
          r.quantity = ing.quantity;
          r.unit = ing.unit;
        });
      }
    });

    setPendingIngredients([]);
    // Reset inputs, but keep the current category preselected for faster adding
    setItemForm({
      name: '',
      price: '',
      category: itemForm.category,
      unit: '',
      defaultDiscount: '0',
      discountStart: '',
      discountEnd: '',
      isActive: true,
      image: '',
    });
    
    if (!keepOpen) {
      setShowAddItem(false);
    }
    toast.success(`Đã thêm thành công món "${itemName}"${itemIngredientsCount > 0 ? ` (${itemIngredientsCount} nguyên liệu)` : ''}`);
    publishMenuToBackend().catch(err => console.error("Auto-sync menu failed:", err));
  };

  const addBulkMenuItems = async () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n');
    const parsedItems: Array<{
      name: string;
      price: string;
      category: string;
    }> = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      // Accept both comma and dash separators
      const parts = line.includes(',') ? line.split(',') : line.split('-');
      if (parts.length < 2) continue;
      
      const name = parts[0].trim();
      const price = parts[1].trim().replace(/[^0-9]/g, '');
      const category = parts[2] ? parts[2].trim() : (itemForm.category || categories[0] || 'Đồ uống');
      
      if (name && price) {
        parsedItems.push({ name, price, category });
      }
    }

    if (parsedItems.length === 0) {
      toast.error('Không tìm thấy món hợp lệ! Định dạng: Tên món, Giá, Danh mục (VD: Cà phê sữa, 25000, Cà phê)');
      return;
    }

    try {
      await database.write(async () => {
        for (const item of parsedItems) {
          const menuItemId = generateId();
          await database.get<MenuItem>('menu_items').create((m: any) => {
            m._raw.id = menuItemId;
            m.name = item.name;
            m.price = item.price;
            m.category = item.category;
            m.unit = '';
            m.defaultDiscount = '0';
            m.discountStart = 0;
            m.discountEnd = 0;
            m.isActive = true;
            m.image = '';
          });
        }
      });
      
      toast.success(`Đã thêm hàng loạt thành công ${parsedItems.length} món ăn vào thực đơn!`);
      setShowAddItem(false);
      setBulkText('');
      publishMenuToBackend().catch(err => console.error("Auto-sync menu failed:", err));
    } catch (e: any) {
      toast.error('Có lỗi xảy ra khi lưu thực đơn: ' + e.message);
    }
  };

  const updateMenuItem = async () => {
    if (!showEditItem) return;
    const discountStart = showEditItem.discountStart ? new Date(showEditItem.discountStart).getTime() : 0;
    const discountEnd = showEditItem.discountEnd ? new Date(showEditItem.discountEnd).getTime() : 0;
    await database.write(async () => {
      const record = await database.get<MenuItem>('menu_items').find(showEditItem.id);
      await record.update((m: any) => {
        m.name = showEditItem.name;
        m.price = showEditItem.price;
        m.category = showEditItem.category;
        m.unit = '';
        m.defaultDiscount = showEditItem.defaultDiscount;
        m.discountStart = discountStart;
        m.discountEnd = discountEnd;
        m.isActive = showEditItem.isActive;
        m.image = showEditItem.image || '';
      });

      // Synchronize ingredients directly in edit mode
      const existingDbIngs = menuIngredients.filter((i: any) => i.menuItemId === showEditItem.id);
      
      // Delete ones that are no longer in editPendingIngredients
      for (const dbIng of existingDbIngs) {
        const stillExists = editPendingIngredients.some(pi => pi.materialId === dbIng.materialId);
        if (!stillExists) {
          const dbRecord = await database.get<MenuIngredient>('menu_ingredients').find(dbIng.id);
          await dbRecord.destroyPermanently();
        }
      }

      // Add or update ones in editPendingIngredients
      for (const pi of editPendingIngredients) {
        const dbIng = existingDbIngs.find(di => di.materialId === pi.materialId);
        if (dbIng) {
          if (dbIng.quantity !== pi.quantity || dbIng.unit !== pi.unit) {
            const dbRecord = await database.get<MenuIngredient>('menu_ingredients').find(dbIng.id);
            await dbRecord.update((r: any) => {
              r.quantity = pi.quantity;
              r.unit = pi.unit;
            });
          }
        } else {
          await database.get<MenuIngredient>('menu_ingredients').create((r: any) => {
            r._raw.id = generateId();
            r.menuItemId = showEditItem.id;
            r.materialId = pi.materialId;
            r.materialName = pi.materialName;
            r.quantity = pi.quantity;
            r.unit = pi.unit;
          });
        }
      }
    });
    setShowEditItem(null);
    setEditPendingIngredients([]);
    toast.success(`Đã cập nhật món "${showEditItem.name}" và đồng bộ nguyên liệu thành công`);
    publishMenuToBackend().catch(err => console.error("Auto-sync menu failed:", err));
  };

  const deleteMenuItem = async (id: string) => {
    if (!confirm('Xóa món này khỏi menu?')) return;
    await database.write(async () => {
      const record = await database.get<MenuItem>('menu_items').find(id);
      await record.destroyPermanently();
      // Also delete related ingredients
      const ings = menuIngredients.filter((i: any) => i.menuItemId === id);
      for (const ing of ings) {
        const ingRecord = await database.get<MenuIngredient>('menu_ingredients').find(ing.id);
        await ingRecord.destroyPermanently();
      }
    });
    toast.success('Đã xóa món khỏi menu');
    publishMenuToBackend().catch(err => console.error("Auto-sync menu failed:", err));
  };

  const toggleActive = async (id: string, current: boolean) => {
    await database.write(async () => {
      const record = await database.get<MenuItem>('menu_items').find(id);
      await record.update((m: any) => { m.isActive = !current; });
    });
    publishMenuToBackend().catch(err => console.error("Auto-sync menu failed:", err));
  };

  const addIngredient = async () => {
    if (!showIngredients || !ingredientForm.materialId) return;
    const mat = rawMaterials.find((m: any) => m.id === ingredientForm.materialId);
    await database.write(async () => {
      await database.get<MenuIngredient>('menu_ingredients').create((ing: any) => {
        ing._raw.id = generateId();
        ing.menuItemId = showIngredients.id;
        ing.materialId = ingredientForm.materialId;
        ing.materialName = mat?.name || ingredientForm.materialName;
        ing.quantity = ingredientForm.quantity;
        ing.unit = ingredientForm.unit || mat?.unit || '';
      });
    });
    setIngredientForm({ materialId: '', materialName: '', quantity: '1', unit: '' });
    toast.success('Đã thêm nguyên liệu');
  };

  const removeIngredient = async (ingId: string) => {
    await database.write(async () => {
      const record = await database.get<MenuIngredient>('menu_ingredients').find(ingId);
      await record.destroyPermanently();
    });
    toast.success('Đã xóa nguyên liệu');
  };

  const getIngredientsForItem = (itemId: string) => {
    return menuIngredients.filter((ing: any) => ing.menuItemId === itemId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input type="text" placeholder="Tìm kiếm món..." value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary/20 transition-all flex items-center space-x-1"
            title="Quản lý danh mục món ăn">
            <span>Quản lý danh mục</span>
          </button>
          <button onClick={() => setShowAddItem(true)}
            className="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
            <Plus size={16} /><span>Thêm món</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-zen">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Món</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Danh mục</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Giá</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Giảm giá</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Nguyên liệu</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Trạng thái</th>
              <th className="text-right p-4 text-sm font-medium text-text-secondary">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item: any) => {
              const ings = getIngredientsForItem(item.id);
              return (
                <tr key={item.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                  <td className="p-4 font-medium text-sm">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-lg border border-surface-zen bg-surface-zen/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-text-secondary font-semibold font-mono">{item.name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-primary-dark font-medium">{item.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-text-secondary">{item.category}</td>
                  <td className="p-4 text-sm font-bold text-accent">{parseInt(item.price).toLocaleString()}đ</td>
                  <td className="p-4 text-sm">
                    {item.defaultDiscount && parseFloat(item.defaultDiscount) > 0 ? (
                      <div>
                        <span className="font-medium text-error-zen">{item.defaultDiscount}%</span>
                        {item.discountStart > 0 && item.discountEnd > 0 && (
                          <div className="text-[10px] text-text-secondary mt-0.5">
                            {new Date(item.discountStart).toLocaleDateString('vi-VN')} - {new Date(item.discountEnd).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-4">
                    <button onClick={() => setShowIngredients(item)}
                      className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-all">
                      {ings.length} nguyên liệu
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggleActive(item.id, item.isActive)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.isActive ? 'Đang bán' : 'Tạm dừng'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button onClick={() => {
                        setShowEditItem({
                          id: item.id, name: item.name, price: item.price,
                          category: item.category, unit: item.unit,
                          defaultDiscount: item.defaultDiscount,
                          discountStart: item.discountStart > 0 ? new Date(item.discountStart).toISOString().slice(0, 16) : '',
                          discountEnd: item.discountEnd > 0 ? new Date(item.discountEnd).toISOString().slice(0, 16) : '',
                          isActive: item.isActive,
                          image: item.image || '',
                        });
                        // Load ingredients into editPendingIngredients state
                        const currentIngs = getIngredientsForItem(item.id).map((ing: any) => ({
                          materialId: ing.materialId,
                          materialName: ing.materialName,
                          quantity: ing.quantity,
                          unit: ing.unit,
                        }));
                        setEditPendingIngredients(currentIngs);
                      }}
                        className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Sửa">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => deleteMenuItem(item.id)}
                        className="p-2 text-text-secondary hover:text-error-zen hover:bg-error-zen/10 rounded-lg transition-all" title="Xóa">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Chưa có món nào trong menu</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Menu Item Modal */}
      {showAddItem && (
        <Modal title="Thêm món vào menu" onClose={() => setShowAddItem(false)}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Tab Selector */}
            <div className="flex bg-surface-zen p-1 rounded-xl border border-surface-zen/60 mb-2">
              <button onClick={() => setAddMode('single')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addMode === 'single' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-primary'}`}>
                Thêm 1 món
              </button>
              <button onClick={() => setAddMode('bulk')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addMode === 'bulk' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-primary'}`}>
                Thêm hàng loạt (Nhanh)
              </button>
            </div>

            {addMode === 'single' ? (
              <>
                <Input label="Tên món" value={itemForm.name}
                  onChange={(e: any) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="VD: Cà phê sữa đá..." />
                <Input label="Giá bán" type="number" value={itemForm.price}
                  onChange={(e: any) => setItemForm({ ...itemForm, price: e.target.value })} placeholder="25000" />
                
                {/* Hình ảnh món ăn */}
                <div className="space-y-1.5 p-3.5 bg-surface-zen/20 border border-surface-zen/40 rounded-xl">
                  <label className="text-xs text-text-secondary font-semibold block">Hình ảnh món ăn</label>
                  <div className="flex items-center space-x-3">
                    <div className="w-14 h-14 rounded-xl border border-surface-zen flex items-center justify-center bg-white overflow-hidden flex-shrink-0">
                      {itemForm.image ? (
                        <img src={itemForm.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-text-secondary text-[9px] text-center px-1 font-medium leading-tight">Chưa có ảnh</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col space-y-1">
                      <input type="file" accept="image/*" id="dish-image-upload-add" className="hidden"
                        onChange={(e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const compressed = await compressImage(reader.result as string);
                              setItemForm({ ...itemForm, image: compressed });
                            };
                            reader.readAsDataURL(file);
                          }
                        }} />
                      <div className="flex space-x-2">
                        <label htmlFor="dish-image-upload-add"
                          className="px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer">
                          Chọn ảnh
                        </label>
                        {itemForm.image && (
                          <button onClick={() => setItemForm({ ...itemForm, image: '' })}
                            className="px-2.5 py-1.5 bg-error-zen/10 text-error-zen rounded-lg text-xs font-bold hover:bg-error-zen/20 transition-all">
                            Xóa ảnh
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] text-text-secondary">Hỗ trợ JPG, PNG. Lưu ngoại tuyến trực tiếp.</p>
                    </div>
                  </div>
                </div>
                
                <Select label="Danh mục" value={itemForm.category}
                  onChange={(e: any) => setItemForm({ ...itemForm, category: e.target.value })}
                  options={categories.map(c => ({ value: c, label: c }))} />

                {/* Khung giảm giá riêng biệt */}
                <div className="p-4 bg-amber-50/30 border border-amber-100 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎁 Thiết lập giảm giá & Khuyến mãi</span>
                  </p>
                  <Input label="Giảm giá mặc định (%)" type="number" value={itemForm.defaultDiscount}
                    onChange={(e: any) => setItemForm({ ...itemForm, defaultDiscount: e.target.value })} placeholder="0" />
                  <div className="space-y-1.5 border-t border-amber-100/50 pt-2.5">
                    <p className="text-xs font-medium text-amber-900/80">Lịch giảm giá (để trống nếu không có thời hạn)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-text-secondary font-medium block mb-1">Bắt đầu</label>
                        <input type="datetime-local" value={itemForm.discountStart}
                          onChange={(e: any) => setItemForm({ ...itemForm, discountStart: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                      </div>
                      <div>
                        <label className="text-[11px] text-text-secondary font-medium block mb-1">Kết thúc</label>
                        <input type="datetime-local" value={itemForm.discountEnd}
                          onChange={(e: any) => setItemForm({ ...itemForm, discountEnd: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ===== Nguyên liệu ===== */}
                <div className="border-t pt-4">
                  <p className="text-sm font-bold text-primary-dark mb-2">Nguyên liệu định lượng (BOM):</p>
                  
                  {/* Danh sách nguyên liệu đã thêm */}
                  {pendingIngredients.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {pendingIngredients.map((ing, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-surface-zen p-2.5 rounded-lg border border-surface-zen/60">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center font-bold">{idx + 1}</span>
                            <span className="font-medium text-sm">{ing.materialName}</span>
                            <span className="text-xs text-text-secondary">({ing.quantity} {ing.unit})</span>
                          </div>
                          <button onClick={() => setPendingIngredients(pendingIngredients.filter((_, i) => i !== idx))}
                            className="text-error-zen hover:text-error-zen/80 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingIngredients.length === 0 && (
                    <p className="text-xs text-gray-400 italic mb-2">Món này chưa có nguyên liệu nào. Thêm nguyên liệu bên dưới để tự động trừ kho khi bán.</p>
                  )}

                  {/* Form thêm nguyên liệu */}
                  <div className="space-y-2 bg-surface-zen/50 p-3 rounded-lg border border-surface-zen/60">
                    <Select label="Chọn nguyên liệu" value={ingredientForm.materialId}
                      onChange={(e: any) => {
                        const mat = rawMaterials.find((m: any) => m.id === e.target.value);
                        setIngredientForm({
                          materialId: e.target.value,
                          materialName: mat?.name || '',
                          quantity: '1',
                          unit: mat?.unit || '',
                        });
                      }}
                      options={rawMaterials.map((m: any) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Số lượng" type="number" value={ingredientForm.quantity}
                        onChange={(e: any) => setIngredientForm({ ...ingredientForm, quantity: e.target.value })} />
                      <Input label="Đơn vị" value={ingredientForm.unit}
                        onChange={(e: any) => setIngredientForm({ ...ingredientForm, unit: e.target.value })} />
                    </div>
                    <button onClick={() => {
                      if (!ingredientForm.materialId) return;
                      if (pendingIngredients.some(i => i.materialId === ingredientForm.materialId)) {
                        toast.error('Nguyên liệu này đã được thêm!');
                        return;
                      }
                      const mat = rawMaterials.find((m: any) => m.id === ingredientForm.materialId);
                      setPendingIngredients([...pendingIngredients, {
                        materialId: ingredientForm.materialId,
                        materialName: mat?.name || ingredientForm.materialName,
                        quantity: ingredientForm.quantity,
                        unit: ingredientForm.unit || mat?.unit || '',
                      }]);
                      setIngredientForm({ materialId: '', materialName: '', quantity: '1', unit: '' });
                    }} disabled={!ingredientForm.materialId}
                      className="w-full py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center space-x-1">
                      <Plus size={14} /><span>Thêm nguyên liệu</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t">
                  <button onClick={() => addMenuItem(true)} disabled={!itemForm.name || !itemForm.price}
                    className="py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold hover:bg-primary/20 transition-all disabled:opacity-50 text-xs">
                    Lưu & Thêm tiếp
                  </button>
                  <button onClick={() => addMenuItem(false)} disabled={!itemForm.name || !itemForm.price}
                    className="py-3 bg-accent text-white rounded-xl font-bold hover:bg-primary-dark transition-all disabled:opacity-50 text-xs">
                    Lưu & Đóng
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 space-y-1">
                  <p className="text-[11px] font-bold text-primary">💡 Định dạng nhập hàng loạt:</p>
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    Nhập mỗi món trên một dòng theo định dạng:<br />
                    <code className="bg-white px-1 py-0.5 rounded border font-mono">Tên món, Giá bán, Danh mục</code><br />
                    VD:<br />
                    <code className="bg-white px-1 py-0.5 rounded border font-mono">Cà phê sữa đá, 25000, Cà phê</code><br />
                    <code className="bg-white px-1 py-0.5 rounded border font-mono">Cà phê đen, 20000, Cà phê</code><br />
                    <code className="bg-white px-1 py-0.5 rounded border font-mono">Trà đào cam sả, 35000, Trà trái cây</code>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-text-secondary font-bold block mb-1.5">Danh sách thực đơn</label>
                  <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                    placeholder="VD:&#10;Cà phê đen, 20000, Cà phê&#10;Trà sữa trân châu, 35000, Trà sữa..."
                    rows={8}
                    className="w-full p-3 bg-white border border-surface-zen rounded-xl text-sm focus:ring-2 focus:ring-primary/30 outline-none font-mono placeholder:text-gray-300" />
                </div>

                {/* Live Preview Grid */}
                {bulkText.trim() && (
                  <div className="border rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-zen sticky top-0">
                        <tr>
                          <th className="p-2 text-left text-text-secondary font-medium">Tên món</th>
                          <th className="p-2 text-left text-text-secondary font-medium">Giá bán</th>
                          <th className="p-2 text-left text-text-secondary font-medium">Danh mục</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkText.split('\n').filter(l => l.trim()).map((line, idx) => {
                          const parts = line.includes(',') ? line.split(',') : line.split('-');
                          const name = parts[0]?.trim() || '';
                          const price = parts[1]?.trim().replace(/[^0-9]/g, '') || '';
                          const category = parts[2]?.trim() || itemForm.category || 'Đồ uống';
                          if (!name && !price) return null;
                          return (
                            <tr key={idx} className="border-t hover:bg-surface-zen/30">
                              <td className="p-2 font-medium">{name || <span className="text-error-zen italic">Thiếu tên</span>}</td>
                              <td className="p-2 font-bold text-accent">{price ? parseInt(price).toLocaleString() + 'đ' : <span className="text-error-zen italic">Thiếu giá</span>}</td>
                              <td className="p-2 text-text-secondary">{category}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <button onClick={addBulkMenuItems} disabled={!bulkText.trim()}
                  className="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-primary-dark transition-all disabled:opacity-50">
                  Xác nhận thêm hàng loạt
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Menu Item Modal */}
      {showEditItem && (
        <Modal title="Sửa món" onClose={() => { setShowEditItem(null); setEditPendingIngredients([]); }}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <Input label="Tên món" value={showEditItem.name}
              onChange={(e: any) => setShowEditItem({ ...showEditItem, name: e.target.value })} />
            <Input label="Giá bán" type="number" value={showEditItem.price}
              onChange={(e: any) => setShowEditItem({ ...showEditItem, price: e.target.value })} />
            
            {/* Hình ảnh món ăn */}
            <div className="space-y-1.5 p-3.5 bg-surface-zen/20 border border-surface-zen/40 rounded-xl">
              <label className="text-xs text-text-secondary font-semibold block">Hình ảnh món ăn</label>
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 rounded-xl border border-surface-zen flex items-center justify-center bg-white overflow-hidden flex-shrink-0">
                  {showEditItem.image ? (
                    <img src={showEditItem.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-text-secondary text-[9px] text-center px-1 font-medium leading-tight">Chưa có ảnh</span>
                  )}
                </div>
                <div className="flex-1 flex flex-col space-y-1">
                  <input type="file" accept="image/*" id="dish-image-upload-edit" className="hidden"
                    onChange={(e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const compressed = await compressImage(reader.result as string);
                          setShowEditItem({ ...showEditItem, image: compressed });
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  <div className="flex space-x-2">
                    <label htmlFor="dish-image-upload-edit"
                      className="px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer">
                      Chọn ảnh
                    </label>
                    {showEditItem.image && (
                      <button onClick={() => setShowEditItem({ ...showEditItem, image: '' })}
                        className="px-2.5 py-1.5 bg-error-zen/10 text-error-zen rounded-lg text-xs font-bold hover:bg-error-zen/20 transition-all">
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-text-secondary">Hỗ trợ JPG, PNG. Lưu ngoại tuyến trực tiếp.</p>
                </div>
              </div>
            </div>
            
            <Select label="Danh mục" value={showEditItem.category}
              onChange={(e: any) => setShowEditItem({ ...showEditItem, category: e.target.value })}
              options={categories.map(c => ({ value: c, label: c }))} />

            {/* Khung giảm giá riêng biệt */}
            <div className="p-4 bg-amber-50/30 border border-amber-100 rounded-xl space-y-3">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎁 Thiết lập giảm giá & Khuyến mãi</span>
              </p>
              <Input label="Giảm giá mặc định (%)" type="number" value={showEditItem.defaultDiscount}
                onChange={(e: any) => setShowEditItem({ ...showEditItem, defaultDiscount: e.target.value })} />
              <div className="space-y-1.5 border-t border-amber-100/50 pt-2.5">
                <p className="text-xs font-medium text-amber-900/80">Lịch giảm giá (để trống nếu không có thời hạn)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-text-secondary font-medium block mb-1">Bắt đầu</label>
                    <input type="datetime-local" value={showEditItem.discountStart}
                      onChange={(e: any) => setShowEditItem({ ...showEditItem, discountStart: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-text-secondary font-medium block mb-1">Kết thúc</label>
                    <input type="datetime-local" value={showEditItem.discountEnd}
                      onChange={(e: any) => setShowEditItem({ ...showEditItem, discountEnd: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Nguyên liệu ===== */}
            <div className="border-t pt-4">
              <p className="text-sm font-bold text-primary-dark mb-2">Nguyên liệu định lượng (BOM):</p>
              
              {/* Danh sách nguyên liệu đã thêm */}
              {editPendingIngredients.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {editPendingIngredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-surface-zen p-2.5 rounded-lg border border-surface-zen/60">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center font-bold">{idx + 1}</span>
                        <span className="font-medium text-sm">{ing.materialName}</span>
                        <span className="text-xs text-text-secondary">({ing.quantity} {ing.unit})</span>
                      </div>
                      <button onClick={() => setEditPendingIngredients(editPendingIngredients.filter((_, i) => i !== idx))}
                        className="text-error-zen hover:text-error-zen/80 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {editPendingIngredients.length === 0 && (
                <p className="text-xs text-gray-400 italic mb-2">Món này chưa có nguyên liệu nào. Thêm nguyên liệu bên dưới để tự động trừ kho khi bán.</p>
              )}

              {/* Form thêm nguyên liệu */}
              <div className="space-y-2 bg-surface-zen/50 p-3 rounded-lg border border-surface-zen/60">
                <Select label="Chọn nguyên liệu" value={ingredientForm.materialId}
                  onChange={(e: any) => {
                    const mat = rawMaterials.find((m: any) => m.id === e.target.value);
                    setIngredientForm({
                      materialId: e.target.value,
                      materialName: mat?.name || '',
                      quantity: '1',
                      unit: mat?.unit || '',
                    });
                  }}
                  options={rawMaterials.map((m: any) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Số lượng" type="number" value={ingredientForm.quantity}
                    onChange={(e: any) => setIngredientForm({ ...ingredientForm, quantity: e.target.value })} />
                  <Input label="Đơn vị" value={ingredientForm.unit}
                    onChange={(e: any) => setIngredientForm({ ...ingredientForm, unit: e.target.value })} />
                </div>
                <button onClick={() => {
                  if (!ingredientForm.materialId) return;
                  if (editPendingIngredients.some(i => i.materialId === ingredientForm.materialId)) {
                    toast.error('Nguyên liệu này đã được thêm!');
                    return;
                  }
                  const mat = rawMaterials.find((m: any) => m.id === ingredientForm.materialId);
                  setEditPendingIngredients([...editPendingIngredients, {
                    materialId: ingredientForm.materialId,
                    materialName: mat?.name || ingredientForm.materialName,
                    quantity: ingredientForm.quantity,
                    unit: ingredientForm.unit || mat?.unit || '',
                  }]);
                  setIngredientForm({ materialId: '', materialName: '', quantity: '1', unit: '' });
                }} disabled={!ingredientForm.materialId}
                  className="w-full py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center space-x-1">
                  <Plus size={14} /><span>Thêm nguyên liệu</span>
                </button>
              </div>
            </div>

            <button onClick={updateMenuItem}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all">
              Cập nhật{editPendingIngredients.length > 0 ? ` (${editPendingIngredients.length} nguyên liệu)` : ''}
            </button>
          </div>
        </Modal>
      )}

      {/* Ingredients Modal */}
      {showIngredients && (
        <Modal title={`Nguyên liệu: ${showIngredients.name}`} onClose={() => setShowIngredients(null)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-secondary">Nguyên liệu hiện tại:</p>
              {getIngredientsForItem(showIngredients.id).map((ing: any) => (
                <div key={ing.id} className="flex items-center justify-between bg-surface-zen p-3 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{ing.materialName}</span>
                    <span className="text-xs text-text-secondary ml-2">({ing.quantity} {ing.unit})</span>
                  </div>
                  <button onClick={() => removeIngredient(ing.id)}
                    className="text-error-zen/50 hover:text-error-zen p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {getIngredientsForItem(showIngredients.id).length === 0 && (
                <p className="text-sm text-gray-400 italic">Chưa có nguyên liệu nào</p>
              )}
            </div>
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Thêm nguyên liệu:</p>
              <Select label="Nguyên liệu" value={ingredientForm.materialId}
                onChange={(e: any) => {
                  const mat = rawMaterials.find((m: any) => m.id === e.target.value);
                  setIngredientForm({
                    materialId: e.target.value,
                    materialName: mat?.name || '',
                    quantity: '1',
                    unit: mat?.unit || '',
                  });
                }}
                options={rawMaterials.map((m: any) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Số lượng" type="number" value={ingredientForm.quantity}
                  onChange={(e: any) => setIngredientForm({ ...ingredientForm, quantity: e.target.value })} />
                <Input label="Đơn vị" value={ingredientForm.unit}
                  onChange={(e: any) => setIngredientForm({ ...ingredientForm, unit: e.target.value })} />
              </div>
              <button onClick={addIngredient} disabled={!ingredientForm.materialId}
                className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
                Thêm nguyên liệu
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <Modal title="Quản lý danh mục món ăn" onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">Cấu hình danh mục thực đơn hiển thị trên giao diện POS.</p>
            
            {/* Form thêm danh mục */}
            <div className="flex space-x-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-text-secondary font-medium block mb-1">Tên danh mục mới</label>
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="VD: Ăn vặt, Combo..."
                  className="w-full px-3 py-2 border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
              </div>
              <button onClick={() => {
                const trimmed = newCategoryName.trim();
                if (!trimmed) return;
                if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
                  toast.error('Danh mục này đã tồn tại!');
                  return;
                }
                const updated = [...categories, trimmed];
                setCategories(updated);
                localStorage.setItem('truckflow_categories', JSON.stringify(updated));
                setNewCategoryName('');
                toast.success(`Đã thêm danh mục "${trimmed}"`);
              }}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1 h-[38px]">
                <Plus size={14} />
                <span>Thêm</span>
              </button>
            </div>

            {/* Danh sách danh mục */}
            <div className="border border-surface-zen rounded-xl overflow-hidden bg-surface-zen/10">
              <div className="bg-surface-zen px-4 py-2 font-semibold text-xs text-text-secondary border-b border-surface-zen">
                Danh mục hiện có ({categories.length})
              </div>
              <div className="divide-y divide-surface-zen max-h-[250px] overflow-y-auto bg-white">
                {categories.map((cat) => {
                  const itemCount = menuItems.filter((item: any) => item.category === cat).length;
                  return (
                    <div key={cat} className="flex justify-between items-center px-4 py-2.5 hover:bg-surface-zen/20 transition-all min-h-[52px]">
                      {editingCategory === cat ? (
                        <div className="flex-1 flex items-center space-x-2 mr-2">
                          <input type="text" value={editingCategoryValue}
                            onChange={(e) => setEditingCategoryValue(e.target.value)}
                            className="flex-1 px-2.5 py-1 border border-surface-zen rounded text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                          <button onClick={async () => {
                            const trimmed = editingCategoryValue.trim();
                            if (!trimmed) return;
                            if (trimmed === cat) {
                              setEditingCategory(null);
                              return;
                            }
                            if (categories.some(c => c !== cat && c.toLowerCase() === trimmed.toLowerCase())) {
                              toast.error('Tên danh mục này đã tồn tại!');
                              return;
                            }
                            
                            // Update categories list in state & localStorage
                            const updated = categories.map(c => c === cat ? trimmed : c);
                            setCategories(updated);
                            localStorage.setItem('truckflow_categories', JSON.stringify(updated));

                            // Also update all menu items in database with old category to new category!
                            const itemsToUpdate = menuItems.filter((item: any) => item.category === cat);
                            if (itemsToUpdate.length > 0) {
                              await database.write(async () => {
                                for (const item of itemsToUpdate) {
                                  const record = await database.get<MenuItem>('menu_items').find(item.id);
                                  await record.update((m: any) => {
                                    m.category = trimmed;
                                  });
                                }
                              });
                              toast.success(`Đã đổi tên danh mục và cập nhật ${itemsToUpdate.length} món ăn!`);
                            } else {
                              toast.success(`Đã đổi tên danh mục thành "${trimmed}"`);
                            }
                            setEditingCategory(null);
                          }}
                            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-all">
                            Lưu
                          </button>
                          <button onClick={() => setEditingCategory(null)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-text-secondary rounded text-xs font-medium transition-all">
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-primary-dark">{cat}</span>
                            <span className="text-[10px] text-text-secondary">{itemCount} món ăn</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button onClick={() => {
                              setEditingCategory(cat);
                              setEditingCategoryValue(cat);
                            }}
                              className="p-1 text-text-secondary hover:text-primary hover:bg-primary/10 rounded transition-all"
                              title="Sửa tên danh mục">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => {
                              if (itemCount > 0) {
                                if (!confirm(`Danh mục "${cat}" đang có ${itemCount} món ăn hoạt động. Xóa danh mục có thể khiến các món này hiển thị sai danh mục. Bạn chắc chắn muốn xóa?`)) return;
                              } else {
                                if (!confirm(`Xóa danh mục "${cat}"?`)) return;
                              }
                              const updated = categories.filter(c => c !== cat);
                              setCategories(updated);
                              localStorage.setItem('truckflow_categories', JSON.stringify(updated));
                              toast.success(`Đã xóa danh mục "${cat}"`);
                            }}
                              className="p-1 text-text-secondary hover:text-error-zen hover:bg-error-zen/10 rounded transition-all"
                              title="Xóa danh mục">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===== Ingredient Config Component =====
function IngredientConfig({ units }: { units: string[] }) {
  const toast = useToast();
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [menuIngredients, setMenuIngredients] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showEditIngredient, setShowEditIngredient] = useState<any>(null);
  const [showLinkedMenus, setShowLinkedMenus] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [ingredientForm, setIngredientForm] = useState({
    name: '', unit: units[0] || 'Kg', price: '', reorderLevel: '5',
  });

  useEffect(() => {
    const sub1 = database.get<InventoryItem>('inventory_items').query().observe().subscribe(setInventoryItems);
    const sub2 = database.get<MenuIngredient>('menu_ingredients').query().observe().subscribe(setMenuIngredients);
    const sub3 = database.get<MenuItem>('menu_items').query().observe().subscribe(setMenuItems);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); };
  }, []);

  // Only raw materials
  const rawMaterials = inventoryItems.filter((i: any) => i.isRawMaterial);

  const filteredIngredients = rawMaterials.filter((ing: any) =>
    !searchTerm || ing.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addIngredient = async () => {
    if (!ingredientForm.name) return;
    const sku = `MAT-${ingredientForm.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 10)}-${Date.now().toString(36).toUpperCase()}`;
    await database.write(async () => {
      await database.get<InventoryItem>('inventory_items').create((r: any) => {
        r._raw.id = generateId();
        r.name = ingredientForm.name;
        r.sku = sku;
        r.unit = ingredientForm.unit;
        r.quantity = '0';
        r.reorderLevel = ingredientForm.reorderLevel;
        r.price = ingredientForm.price || '0';
        r.category = 'Nguyên liệu';
        r.isRawMaterial = true;
        r.locationType = 'MAIN_WAREHOUSE';
        r.truckId = '';
      });
    });
    setShowAddIngredient(false);
    setIngredientForm({ name: '', unit: 'kg', price: '', reorderLevel: '5' });
    toast.success(`Đã thêm nguyên liệu "${ingredientForm.name}"`);
  };

  const updateIngredient = async () => {
    if (!showEditIngredient) return;
    await database.write(async () => {
      const record = await database.get<InventoryItem>('inventory_items').find(showEditIngredient.id);
      await record.update((r: any) => {
        r.name = showEditIngredient.name;
        r.unit = showEditIngredient.unit;
        r.price = showEditIngredient.price;
        r.reorderLevel = showEditIngredient.reorderLevel;
      });
    });
    setShowEditIngredient(null);
    toast.success(`Đã cập nhật nguyên liệu "${showEditIngredient.name}"`);
  };

  const deleteIngredient = async (id: string) => {
    // Check if ingredient is linked to any menu items
    const linkedMenus = menuIngredients.filter((mi: any) => mi.materialId === id);
    if (linkedMenus.length > 0) {
      const menuNames = linkedMenus.map((mi: any) => {
        const menuItem = menuItems.find((m: any) => m.id === mi.menuItemId);
        return menuItem?.name || mi.menuItemId;
      });
      if (!confirm(`Nguyên liệu này đang được sử dụng trong ${linkedMenus.length} món: ${menuNames.join(', ')}.\n\nXóa nguyên liệu sẽ xóa luôn liên kết với các món này. Tiếp tục?`)) return;
    } else {
      if (!confirm('Xóa nguyên liệu này?')) return;
    }
    await database.write(async () => {
      // Delete linked menu ingredients
      for (const mi of linkedMenus) {
        const record = await database.get<MenuIngredient>('menu_ingredients').find(mi.id);
        await record.destroyPermanently();
      }
      // Delete the ingredient itself
      const record = await database.get<InventoryItem>('inventory_items').find(id);
      await record.destroyPermanently();
    });
    toast.success('Đã xóa nguyên liệu');
  };

  const getLinkedMenuNames = (materialId: string) => {
    const linked = menuIngredients.filter((mi: any) => mi.materialId === materialId);
    return linked.map((mi: any) => {
      const menuItem = menuItems.find((m: any) => m.id === mi.menuItemId);
      return {
        menuItemName: menuItem?.name || 'Đã xóa',
        quantity: mi.quantity,
        unit: mi.unit,
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input type="text" placeholder="Tìm kiếm nguyên liệu..." value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
        </div>
        <button onClick={() => setShowAddIngredient(true)}
          className="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
          <Plus size={16} /><span>Thêm nguyên liệu</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-zen">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Nguyên liệu</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Đơn vị</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Giá nhập</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Tồn kho</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Tồn tối thiểu</th>
              <th className="text-left p-4 text-sm font-medium text-text-secondary">Liên kết menu</th>
              <th className="text-right p-4 text-sm font-medium text-text-secondary">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredIngredients.map((ing: any) => {
              const linkedMenus = getLinkedMenuNames(ing.id);
              return (
                <tr key={ing.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                  <td className="p-4 font-medium text-sm">{ing.name}</td>
                  <td className="p-4 text-sm text-text-secondary">{ing.unit}</td>
                  <td className="p-4 text-sm">{parseInt(ing.price || '0').toLocaleString()}đ</td>
                  <td className="p-4 text-sm">{ing.quantity}</td>
                  <td className="p-4 text-sm">{ing.reorderLevel}</td>
                  <td className="p-4">
                    <button onClick={() => setShowLinkedMenus({ ...ing, linkedMenus })}
                      className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-all">
                      {linkedMenus.length} món
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button onClick={() => setShowEditIngredient({
                        id: ing.id, name: ing.name, unit: ing.unit,
                        price: ing.price, reorderLevel: ing.reorderLevel,
                      })}
                        className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Sửa">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => deleteIngredient(ing.id)}
                        className="p-2 text-text-secondary hover:text-error-zen hover:bg-error-zen/10 rounded-lg transition-all" title="Xóa">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredIngredients.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Chưa có nguyên liệu nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Ingredient Modal */}
      {showAddIngredient && (
        <Modal title="Thêm nguyên liệu" onClose={() => setShowAddIngredient(false)}>
          <div className="space-y-3">
            <Input label="Tên nguyên liệu" value={ingredientForm.name}
              onChange={(e: any) => setIngredientForm({ ...ingredientForm, name: e.target.value })} placeholder="VD: Cà phê hạt..." />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Đơn vị" value={ingredientForm.unit}
                onChange={(e: any) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                options={units.map(u => ({ value: u, label: u }))} />
              <Input label="Giá nhập" type="number" value={ingredientForm.price}
                onChange={(e: any) => setIngredientForm({ ...ingredientForm, price: e.target.value })} placeholder="0" />
            </div>
            <Input label="Tồn tối thiểu" type="number" value={ingredientForm.reorderLevel}
              onChange={(e: any) => setIngredientForm({ ...ingredientForm, reorderLevel: e.target.value })} placeholder="5" />
            <button onClick={addIngredient} disabled={!ingredientForm.name}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Thêm nguyên liệu
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Ingredient Modal */}
      {showEditIngredient && (
        <Modal title="Sửa nguyên liệu" onClose={() => setShowEditIngredient(null)}>
          <div className="space-y-3">
            <Input label="Tên nguyên liệu" value={showEditIngredient.name}
              onChange={(e: any) => setShowEditIngredient({ ...showEditIngredient, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Đơn vị" value={showEditIngredient.unit}
                onChange={(e: any) => setShowEditIngredient({ ...showEditIngredient, unit: e.target.value })}
                options={units.map(u => ({ value: u, label: u }))} />
              <Input label="Giá nhập" type="number" value={showEditIngredient.price}
                onChange={(e: any) => setShowEditIngredient({ ...showEditIngredient, price: e.target.value })} />
            </div>
            <Input label="Tồn tối thiểu" type="number" value={showEditIngredient.reorderLevel}
              onChange={(e: any) => setShowEditIngredient({ ...showEditIngredient, reorderLevel: e.target.value })} />
            <button onClick={updateIngredient}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all">
              Cập nhật
            </button>
          </div>
        </Modal>
      )}

      {/* Linked Menus Modal */}
      {showLinkedMenus && (
        <Modal title={`Menu liên kết: ${showLinkedMenus.name}`} onClose={() => setShowLinkedMenus(null)}>
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Nguyên liệu <strong>{showLinkedMenus.name}</strong> ({showLinkedMenus.unit}) được sử dụng trong các món sau:
            </p>
            {showLinkedMenus.linkedMenus.length > 0 ? (
              <div className="space-y-2">
                {showLinkedMenus.linkedMenus.map((lm: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-surface-zen p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center font-bold">{idx + 1}</span>
                      <span className="font-medium text-sm">{lm.menuItemName}</span>
                    </div>
                    <span className="text-xs text-text-secondary">Số lượng: {lm.quantity} {lm.unit}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Nguyên liệu chưa được liên kết với món nào</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
