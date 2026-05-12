import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, User, Shield, Printer, Wifi,
  RefreshCw, Info, Save, Check, Globe, Users, Key, Plus,
  Lock, Unlock, Trash2, Edit3, UserPlus, Search,
} from 'lucide-react';
import { database } from '../database/index.js';
import UserModel from '../database/models/User.js';
import { useAuth } from '../auth/AuthContext.js';
import { ROLES, ROLE_LABELS, PERMISSIONS, type Role, type Permission } from '../auth/permissions.js';
import { TabButton, Modal, Input, Select } from '../shared/components.js';
import { generateId } from '../shared/utils.js';

export default function Settings() {
  const { user: currentUser, hasPermission, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Xóa người dùng này?')) return;
    await database.write(async () => {
      const record = await database.get<UserModel>('users').find(userId);
      await record.destroyPermanently();
    });
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
