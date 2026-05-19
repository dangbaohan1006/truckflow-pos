import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, User, Shield, Printer, Wifi,
  RefreshCw, Info, Save, Check, Globe, Users, Key, Plus,
  Lock, Unlock, Trash2, Edit3, UserPlus, Search,
} from 'lucide-react';
import { database } from '../database/index.js';
import UserModel from '../database/models/User.js';
import { seedTestData } from '../database/seedTestData.js';
import { seedMaterialsReportData } from '../database/seedMaterialsReport.js';
import { useAuth } from '../auth/AuthContext.js';
import { ROLES, ROLE_LABELS, PERMISSIONS, type Role, type Permission } from '../auth/permissions.js';
import { TabButton, Modal, Input, Select } from '../shared/components.js';
import { generateId } from '../shared/utils.js';
import { useToast } from '../shared/ToastContext.js';
import MenuItem from '../database/models/MenuItem.js';
import MenuIngredient from '../database/models/MenuIngredient.js';
import InventoryItem from '../database/models/InventoryItem.js';

export default function Settings() {
  const toast = useToast();
  const { user: currentUser, hasPermission, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [seedMessage, setSeedMessage] = useState('');
  const [materialsSeedMessage, setMaterialsSeedMessage] = useState('');

  const [config, setConfig] = useState({
    storeName: 'TruckFlow POS',
    storeAddress: '123 Đường ABC, Quận 1, TP.HCM',
    storePhone: '0123456789',
    taxRate: '10',
    currency: 'VND',
    autoSync: true,
    syncInterval: '30',
    printerEnabled: true,
    printerType: 'escpos',
    lowStockThreshold: '10',
  });

  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'STAFF' as Role,
    status: 'ACTIVE',
  });

  useEffect(() => {
    if (isAdmin || hasPermission(PERMISSIONS.USER_VIEW)) {
      const sub = database.get<UserModel>('users').query().observe().subscribe(setUsers);
      return () => sub.unsubscribe();
    }
  }, [isAdmin]);

  // Load config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('truckflow_config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch {}
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem('truckflow_config', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success('Đã lưu cấu hình');
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
        u.createdAt = Date.now();
        u.updatedAt = Date.now();
      });
    });
    setShowAddUser(false);
    setUserForm({ username: '', password: '', displayName: '', role: 'STAFF', status: 'ACTIVE' });
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
        if (showEditUser.password) {
          u.password = showEditUser.password;
        }
        u.updatedAt = Date.now();
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
        u.updatedAt = Date.now();
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
    { key: 'users', label: 'Người dùng', show: canManageUsers || hasPermission(PERMISSIONS.USER_VIEW) },
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
          </div>
          <button onClick={saveConfig} className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center space-x-2">
            {saved ? <><Check size={18} /><span>Đã lưu</span></> : <><Save size={18} /><span>Lưu cấu hình</span></>}
          </button>
        </div>
      )}

      {activeTab === 'menu' && <MenuConfig />}

      {activeTab === 'ingredients' && <IngredientConfig />}

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
                          {u.displayName[0]?.toUpperCase() || 'U'}
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
              </div>
            )}
          </div>
          <button onClick={saveConfig} className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center space-x-2">
            {saved ? <><Check size={18} /><span>Đã lưu</span></> : <><Save size={18} /><span>Lưu cấu hình</span></>}
          </button>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen space-y-4">
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <SettingsIcon size={40} />
            </div>
            <h2 className="text-2xl font-bold text-primary-dark">TruckFlow POS</h2>
            <p className="text-text-secondary mt-2">Hệ thống quản lý bán hàng F&B</p>
            <div className="mt-6 space-y-2 text-sm text-text-secondary">
              <p>Phiên bản: 1.0.0</p>
              <p>Nền tảng: Offline-first PWA</p>
              <p>Cơ sở dữ liệu: WatermelonDB + PostgreSQL</p>
              <p>Phân quyền: RBAC với 8 vai trò</p>
              <p>© 2026 TruckFlow. All rights reserved.</p>
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
              onChange={(e: any) => setUserForm({ ...userForm, role: e.target.value })}
              options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
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
            <button onClick={updateUser}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all">
              Cập nhật
            </button>
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

// ===== Menu Config Component =====
function MenuConfig() {
  const toast = useToast();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuIngredients, setMenuIngredients] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState<any>(null);
  const [showIngredients, setShowIngredients] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [itemForm, setItemForm] = useState({
    name: '', price: '', category: 'Đồ uống', unit: 'ly',
    defaultDiscount: '0', discountStart: '', discountEnd: '', isActive: true,
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

  const addMenuItem = async () => {
    if (!itemForm.name || !itemForm.price) return;
    const discountStart = itemForm.discountStart ? new Date(itemForm.discountStart).getTime() : 0;
    const discountEnd = itemForm.discountEnd ? new Date(itemForm.discountEnd).getTime() : 0;
    const menuItemId = generateId();
    await database.write(async () => {
      // Create menu item
      await database.get<MenuItem>('menu_items').create((m: any) => {
        m._raw.id = menuItemId;
        m.name = itemForm.name;
        m.price = itemForm.price;
        m.category = itemForm.category;
        m.unit = itemForm.unit;
        m.defaultDiscount = itemForm.defaultDiscount;
        m.discountStart = discountStart;
        m.discountEnd = discountEnd;
        m.isActive = itemForm.isActive;
        m.createdAt = Date.now();
        m.updatedAt = Date.now();
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
          r.createdAt = Date.now();
          r.updatedAt = Date.now();
        });
      }
    });
    setShowAddItem(false);
    setPendingIngredients([]);
    setItemForm({ name: '', price: '', category: 'Đồ uống', unit: 'ly', defaultDiscount: '0', discountStart: '', discountEnd: '', isActive: true });
    toast.success(`Đã thêm món "${itemForm.name}" vào menu với ${pendingIngredients.length} nguyên liệu`);
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
        m.unit = showEditItem.unit;
        m.defaultDiscount = showEditItem.defaultDiscount;
        m.discountStart = discountStart;
        m.discountEnd = discountEnd;
        m.isActive = showEditItem.isActive;
        m.updatedAt = Date.now();
      });
    });
    setShowEditItem(null);
    toast.success(`Đã cập nhật món "${showEditItem.name}"`);
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
  };

  const toggleActive = async (id: string, current: boolean) => {
    await database.write(async () => {
      const record = await database.get<MenuItem>('menu_items').find(id);
      await record.update((m: any) => { m.isActive = !current; m.updatedAt = Date.now(); });
    });
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
        ing.createdAt = Date.now();
        ing.updatedAt = Date.now();
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
        <button onClick={() => setShowAddItem(true)}
          className="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
          <Plus size={16} /><span>Thêm món</span>
        </button>
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
                  <td className="p-4 font-medium text-sm">{item.name}</td>
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
                      <button onClick={() => setShowEditItem({
                        id: item.id, name: item.name, price: item.price,
                        category: item.category, unit: item.unit,
                        defaultDiscount: item.defaultDiscount,
                        discountStart: item.discountStart > 0 ? new Date(item.discountStart).toISOString().slice(0, 16) : '',
                        discountEnd: item.discountEnd > 0 ? new Date(item.discountEnd).toISOString().slice(0, 16) : '',
                        isActive: item.isActive,
                      })}
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
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <Input label="Tên món" value={itemForm.name}
              onChange={(e: any) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="VD: Cà phê sữa đá..." />
            <Input label="Giá bán" type="number" value={itemForm.price}
              onChange={(e: any) => setItemForm({ ...itemForm, price: e.target.value })} placeholder="25000" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Danh mục" value={itemForm.category}
                onChange={(e: any) => setItemForm({ ...itemForm, category: e.target.value })}
                options={[
                  { value: 'Đồ uống', label: 'Đồ uống' },
                  { value: 'Đồ ăn', label: 'Đồ ăn' },
                  { value: 'Tráng miệng', label: 'Tráng miệng' },
                  { value: 'Khác', label: 'Khác' },
                ]} />
              <Select label="Đơn vị" value={itemForm.unit}
                onChange={(e: any) => setItemForm({ ...itemForm, unit: e.target.value })}
                options={[
                  { value: 'ly', label: 'Ly' },
                  { value: 'chai', label: 'Chai' },
                  { value: 'ổ', label: 'Ổ' },
                  { value: 'suất', label: 'Suất' },
                  { value: 'phần', label: 'Phần' },
                ]} />
            </div>
            <Input label="Giảm giá mặc định (%)" type="number" value={itemForm.defaultDiscount}
              onChange={(e: any) => setItemForm({ ...itemForm, defaultDiscount: e.target.value })} placeholder="0" />
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-text-secondary mb-2">Lịch giảm giá (để trống nếu không có thời hạn)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary font-medium block mb-1">Bắt đầu</label>
                  <input type="datetime-local" value={itemForm.discountStart}
                    onChange={(e: any) => setItemForm({ ...itemForm, discountStart: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-text-secondary font-medium block mb-1">Kết thúc</label>
                  <input type="datetime-local" value={itemForm.discountEnd}
                    onChange={(e: any) => setItemForm({ ...itemForm, discountEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
              </div>
            </div>

            {/* ===== Nguyên liệu ===== */}
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-text-secondary mb-2">Nguyên liệu chế biến:</p>
              
              {/* Danh sách nguyên liệu đã thêm */}
              {pendingIngredients.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {pendingIngredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-surface-zen p-2.5 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center font-bold">{idx + 1}</span>
                        <span className="font-medium text-sm">{ing.materialName}</span>
                        <span className="text-xs text-text-secondary">({ing.quantity} {ing.unit})</span>
                      </div>
                      <button onClick={() => setPendingIngredients(pendingIngredients.filter((_, i) => i !== idx))}
                        className="text-error-zen/50 hover:text-error-zen p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pendingIngredients.length === 0 && (
                <p className="text-xs text-gray-400 italic mb-2">Chưa thêm nguyên liệu nào. Nhấn "Thêm nguyên liệu" bên dưới.</p>
              )}

              {/* Form thêm nguyên liệu */}
              <div className="space-y-2 bg-surface-zen/50 p-3 rounded-lg">
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

            <button onClick={addMenuItem} disabled={!itemForm.name || !itemForm.price}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Thêm món{pendingIngredients.length > 0 ? ` (${pendingIngredients.length} nguyên liệu)` : ''}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Menu Item Modal */}
      {showEditItem && (
        <Modal title="Sửa món" onClose={() => setShowEditItem(null)}>
          <div className="space-y-3">
            <Input label="Tên món" value={showEditItem.name}
              onChange={(e: any) => setShowEditItem({ ...showEditItem, name: e.target.value })} />
            <Input label="Giá bán" type="number" value={showEditItem.price}
              onChange={(e: any) => setShowEditItem({ ...showEditItem, price: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Danh mục" value={showEditItem.category}
                onChange={(e: any) => setShowEditItem({ ...showEditItem, category: e.target.value })}
                options={[
                  { value: 'Đồ uống', label: 'Đồ uống' },
                  { value: 'Đồ ăn', label: 'Đồ ăn' },
                  { value: 'Tráng miệng', label: 'Tráng miệng' },
                  { value: 'Khác', label: 'Khác' },
                ]} />
              <Select label="Đơn vị" value={showEditItem.unit}
                onChange={(e: any) => setShowEditItem({ ...showEditItem, unit: e.target.value })}
                options={[
                  { value: 'ly', label: 'Ly' },
                  { value: 'chai', label: 'Chai' },
                  { value: 'ổ', label: 'Ổ' },
                  { value: 'suất', label: 'Suất' },
                  { value: 'phần', label: 'Phần' },
                ]} />
            </div>
            <Input label="Giảm giá mặc định (%)" type="number" value={showEditItem.defaultDiscount}
              onChange={(e: any) => setShowEditItem({ ...showEditItem, defaultDiscount: e.target.value })} />
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-text-secondary mb-2">Lịch giảm giá (để trống nếu không có thời hạn)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary font-medium block mb-1">Bắt đầu</label>
                  <input type="datetime-local" value={showEditItem.discountStart}
                    onChange={(e: any) => setShowEditItem({ ...showEditItem, discountStart: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-text-secondary font-medium block mb-1">Kết thúc</label>
                  <input type="datetime-local" value={showEditItem.discountEnd}
                    onChange={(e: any) => setShowEditItem({ ...showEditItem, discountEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-zen rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
              </div>
            </div>
            <button onClick={updateMenuItem}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all">
              Cập nhật
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
    </div>
  );
}

// ===== Ingredient Config Component =====
function IngredientConfig() {
  const toast = useToast();
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [menuIngredients, setMenuIngredients] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showEditIngredient, setShowEditIngredient] = useState<any>(null);
  const [showLinkedMenus, setShowLinkedMenus] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [ingredientForm, setIngredientForm] = useState({
    name: '', unit: 'kg', price: '', reorderLevel: '5',
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
        r.createdAt = Date.now();
        r.updatedAt = Date.now();
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
        r.updatedAt = Date.now();
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
                options={[
                  { value: 'kg', label: 'Kg' },
                  { value: 'g', label: 'Gram' },
                  { value: 'lít', label: 'Lít' },
                  { value: 'ml', label: 'Ml' },
                  { value: 'lon', label: 'Lon' },
                  { value: 'hộp', label: 'Hộp' },
                  { value: 'chai', label: 'Chai' },
                  { value: 'bịch', label: 'Bịch' },
                  { value: 'ổ', label: 'Ổ' },
                  { value: 'cái', label: 'Cái' },
                ]} />
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
                options={[
                  { value: 'kg', label: 'Kg' },
                  { value: 'g', label: 'Gram' },
                  { value: 'lít', label: 'Lít' },
                  { value: 'ml', label: 'Ml' },
                  { value: 'lon', label: 'Lon' },
                  { value: 'hộp', label: 'Hộp' },
                  { value: 'chai', label: 'Chai' },
                  { value: 'bịch', label: 'Bịch' },
                  { value: 'ổ', label: 'Ổ' },
                  { value: 'cái', label: 'Cái' },
                ]} />
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
