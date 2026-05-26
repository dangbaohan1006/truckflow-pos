import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, UserCheck, CalendarDays, HandCoins,
  Plus, Search, Clock, DollarSign, Briefcase,
  Edit3, Trash2, Truck as TruckIcon, Building2, Filter, LogIn, LogOut, CheckCircle2,
} from 'lucide-react';
import { database } from '../database/index.js';
import Employee from '../database/models/Employee.js';
import Attendance from '../database/models/Attendance.js';
import Advance from '../database/models/Advance.js';
import TruckModel from '../database/models/Truck.js';
import { formatCurrency, formatDate, formatDateTime, generateId } from '../shared/utils.js';
import { Modal, Input, Select, StatCard, TabButton } from '../shared/components.js';
import { useToast } from '../shared/ToastContext.js';
import { useAuth } from '../auth/AuthContext.js';

interface HRProps {
  isAdmin?: boolean;
}

export default function HR({ isAdmin }: HRProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);

  const isAdminView = useMemo(() => {
    if (isAdmin !== undefined) return isAdmin;
    return (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash.startsWith('#/admin') ||
      window.location.hash === '#admin'
    );
  }, [isAdmin]);

  const [activeTab, setActiveTab] = useState(() => {
    const isCurrentAdmin = isAdmin !== undefined ? isAdmin : (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash.startsWith('#/admin') ||
      window.location.hash === '#admin'
    );
    return isCurrentAdmin ? 'employees' : 'attendance';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState<any>(null);
  const [empData, setEmpData] = useState({ name: '', phone: '', role: '', salary: '0', status: 'ACTIVE', department: '', truckId: '' });
  const [attData, setAttData] = useState({ employeeId: '', type: 'CHECK_IN', note: '' });
  const [advData, setAdvData] = useState({ employeeId: '', amount: '0', note: '' });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [selfAttNote, setSelfAttNote] = useState('');
  const [selfEmployeeSelect, setSelfEmployeeSelect] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const sub1 = database.get<Employee>('employees').query().observe().subscribe(setEmployees);
    const sub2 = database.get<Attendance>('attendance').query().observe().subscribe(setAttendances);
    const sub3 = database.get<Advance>('advances').query().observe().subscribe(setAdvances);
    const sub4 = database.get<TruckModel>('trucks').query().observe().subscribe(setTrucks);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); sub4.unsubscribe(); };
  }, []);

  const departments = useMemo(() => {
    const deps = new Set(employees.filter((e: any) => e.department).map((e: any) => e.department));
    return ['all', ...Array.from(deps)];
  }, [employees]);

  const filteredEmployees = employees.filter((e: any) => {
    if (searchTerm && !e.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (departmentFilter !== 'all' && e.department !== departmentFilter) return false;
    return true;
  });

  const addEmployee = async () => {
    await database.write(async () => {
      await database.get<Employee>('employees').create((e: any) => {
        e._raw.id = generateId();
        e.name = empData.name;
        e.phone = empData.phone;
        e.role = empData.role;
        e.salary = empData.salary;
        e.status = empData.status;
        e.department = empData.department;
        e.truckId = empData.truckId;
      });
    });
    setShowAddEmployee(false);
    setEmpData({ name: '', phone: '', role: '', salary: '0', status: 'ACTIVE', department: '', truckId: '' });
    toast.success(`Đã thêm nhân viên "${empData.name}"`);
  };

  const recordAttendance = async () => {
    const now = Date.now();
    await database.write(async () => {
      await database.get<Attendance>('attendance').create((a: any) => {
        a._raw.id = generateId();
        a.employeeId = attData.employeeId;
        a.date = now;
        if (attData.type === 'CHECK_IN') {
          a.checkIn = now;
        } else {
          a.checkOut = now;
        }
        a.note = attData.note;
      });
    });
    setShowAttendance(false);
    setAttData({ employeeId: '', type: 'CHECK_IN', note: '' });
    const empName = getEmployeeName(attData.employeeId);
    toast.success(`Đã chấm công ${attData.type === 'CHECK_IN' ? 'vào ca' : 'ra ca'} cho "${empName}"`);
  };

  const handleSelfAttendance = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    const targetEmployeeId = user?.employeeId || selfEmployeeSelect;
    if (!targetEmployeeId) {
      toast.warning('Vui lòng chọn nhân viên để chấm công');
      return;
    }

    const now = Date.now();
    await database.write(async () => {
      await database.get<Attendance>('attendance').create((a: any) => {
        a._raw.id = generateId();
        a.employeeId = targetEmployeeId;
        a.date = now;
        if (type === 'CHECK_IN') {
          a.checkIn = now;
        } else {
          a.checkOut = now;
        }
        a.note = selfAttNote;
      });
    });

    const empName = getEmployeeName(targetEmployeeId);
    toast.success(`Đã chấm công ${type === 'CHECK_IN' ? 'vào ca' : 'ra ca'} thành công cho "${empName}"`);
    setSelfAttNote('');
  };

  const recordAdvance = async () => {
    const now = Date.now();
    const emp = employees.find((e: any) => e.id === advData.employeeId);
    await database.write(async () => {
      await database.get<Advance>('advances').create((a: any) => {
        a._raw.id = generateId();
        a.employeeId = advData.employeeId;
        a.employeeName = emp?.name || '';
        a.amount = advData.amount;
        a.note = advData.note;
        a.date = now;
      });
    });
    setShowAdvance(false);
    setAdvData({ employeeId: '', amount: '0', note: '' });
    toast.success(`Đã tạm ứng ${formatCurrency(parseFloat(advData.amount))} cho "${emp?.name || ''}"`);
  };

  const updateEmployee = async () => {
    if (!showEditEmployee) return;
    await database.write(async () => {
      const record = await database.get<Employee>('employees').find(showEditEmployee.id);
      await record.update((u: any) => {
        u.name = showEditEmployee.name;
        u.phone = showEditEmployee.phone;
        u.role = showEditEmployee.role;
        u.salary = showEditEmployee.salary;
        u.status = showEditEmployee.status;
        u.department = showEditEmployee.department;
        u.truckId = showEditEmployee.truckId;
      });
    });
    setShowEditEmployee(null);
    toast.success(`Đã cập nhật nhân viên "${showEditEmployee.name}"`);
  };

  const deleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Xóa nhân viên "${name}"?`)) return;
    await database.write(async () => {
      const record = await database.get<Employee>('employees').find(id);
      await record.destroyPermanently();
    });
    toast.success(`Đã xóa nhân viên "${name}"`);
  };

  const getEmployeeName = (id: string) => employees.find((e: any) => e.id === id)?.name || 'N/A';

  const todayAttendances = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return attendances.filter((a: any) => a.createdAt >= today.getTime());
  }, [attendances]);

  const staffSelfLogs = useMemo(() => {
    const targetId = user?.employeeId || selfEmployeeSelect;
    if (!targetId) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return attendances
      .filter((a: any) => a.employeeId === targetId && a.createdAt >= today.getTime())
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [attendances, user, selfEmployeeSelect]);

  const totalAdvances = useMemo(() => advances.reduce((s: number, a: any) => s + parseFloat(a.amount || '0'), 0), [advances]);

  if (!isAdminView) {
    const matchedEmployee = employees.find((e: any) => e.id === user?.employeeId);
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-md border border-surface-zen flex items-center space-x-4">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center text-2xl font-bold">
            {matchedEmployee?.name?.[0] || user?.displayName?.[0] || 'S'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Xin chào, {matchedEmployee?.name || user?.displayName || 'Nhân viên'}!</h2>
            <p className="text-sm text-text-secondary">{matchedEmployee?.role || 'Nhân sự cửa hàng'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-surface-zen space-y-6 text-center">
          <div className="space-y-1">
            <span className="text-xs font-bold text-accent tracking-widest uppercase">Thời gian thực tế</span>
            <div className="text-4xl font-bold text-primary-dark font-mono">
              {currentTime.toLocaleTimeString('vi-VN')}
            </div>
            <p className="text-sm text-text-secondary">{formatDate(currentTime.getTime())}</p>
          </div>

          {!user?.employeeId && (
            <div className="max-w-sm mx-auto text-left">
              <Select
                label="Chọn tên của bạn"
                value={selfEmployeeSelect}
                onChange={(e: any) => setSelfEmployeeSelect(e.target.value)}
                options={[{ value: '', label: '-- Chọn nhân viên --' }, ...employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => ({ value: e.id, label: e.name }))]}
              />
            </div>
          )}

          <div className="max-w-md mx-auto">
            <input
              type="text"
              placeholder="Ghi chú ca làm việc (không bắt buộc)..."
              value={selfAttNote}
              onChange={(e: any) => setSelfAttNote(e.target.value)}
              className="w-full px-4 py-3 bg-surface-zen border border-surface-zen rounded-xl outline-none text-sm text-text-main focus:ring-2 focus:ring-primary/20 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <button
              onClick={() => handleSelfAttendance('CHECK_IN')}
              className="py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
            >
              <LogIn size={20} />
              <span>Vào ca làm việc</span>
            </button>
            <button
              onClick={() => handleSelfAttendance('CHECK_OUT')}
              className="py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
            >
              <LogOut size={20} />
              <span>Kết thúc ca</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-surface-zen overflow-hidden">
          <div className="p-4 border-b border-surface-zen bg-surface-zen/30">
            <h3 className="font-bold text-primary-dark flex items-center space-x-2">
              <CheckCircle2 className="text-success-zen" size={18} />
              <span>Lịch sử chấm công hôm nay</span>
            </h3>
          </div>
          <div className="divide-y divide-surface-zen">
            {staffSelfLogs.map((log: any) => (
              <div key={log.id} className="p-4 flex justify-between items-center hover:bg-surface-zen/20 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      log.checkIn && !log.checkOut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {log.checkIn && !log.checkOut ? 'Vào ca' : 'Ra ca'}
                    </span>
                    <span className="text-sm font-medium font-mono text-text-main">
                      {new Date(log.checkIn || log.checkOut || log.createdAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  {log.note && <p className="text-xs text-text-secondary pl-1">Ghi chú: {log.note}</p>}
                </div>
                <span className="text-xs text-text-secondary">
                  {formatDate(log.checkIn || log.checkOut || log.createdAt)}
                </span>
              </div>
            ))}
            {staffSelfLogs.length === 0 && (
              <div className="text-center py-8 text-text-secondary/50 text-sm">
                Bạn chưa ghi nhận ca làm việc nào hôm nay.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <TabButton label="Nhân viên" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} />
          <TabButton label="Chấm công" active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} />
          <TabButton label="Tạm ứng" active={activeTab === 'advances'} onClick={() => setActiveTab('advances')} />
        </div>
        <div className="flex space-x-2">
          {activeTab === 'employees' && (
            <button onClick={() => setShowAddEmployee(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1 cursor-pointer">
              <Plus size={16} /><span>Thêm nhân viên</span>
            </button>
          )}
          {activeTab === 'attendance' && (
            <button onClick={() => setShowAttendance(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1 cursor-pointer">
              <Plus size={16} /><span>Chấm công</span>
            </button>
          )}
          {activeTab === 'advances' && (
            <button onClick={() => setShowAdvance(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1 cursor-pointer">
              <Plus size={16} /><span>Tạm ứng</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'employees' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={Users} label="Tổng nhân viên" value={employees.length.toString()} color="primary" />
            <StatCard icon={UserCheck} label="Đang làm" value={employees.filter((e: any) => e.status === 'ACTIVE').length.toString()} color="success-zen" />
            <StatCard icon={DollarSign} label="Tổng lương/tháng" value={formatCurrency(employees.reduce((s: number, e: any) => s + parseFloat(e.salary || '0'), 0))} color="accent" />
            <StatCard icon={Building2} label="Bộ phận" value={departments.filter(d => d !== 'all').length.toString()} color="primary" sub="phòng ban" />
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input type="text" placeholder="Tìm kiếm nhân viên..." value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div className="flex items-center space-x-1">
              <Filter size={16} className="text-text-secondary" />
              <select value={departmentFilter} onChange={(e: any) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 border border-surface-zen rounded-lg text-sm bg-white outline-none">
                <option value="all">Tất cả bộ phận</option>
                {departments.filter(d => d !== 'all').map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {filteredEmployees.map((emp: any) => (
              <div key={emp.id} className="bg-white rounded-xl p-4 shadow-sm border border-surface-zen">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center text-lg font-bold">{emp.name?.[0] || 'E'}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{emp.name}</h4>
                    <p className="text-xs text-text-secondary">{emp.role || 'Chưa phân công'}</p>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => setShowEditEmployee({
                      id: emp.id, name: emp.name, phone: emp.phone,
                      role: emp.role, salary: emp.salary, status: emp.status,
                      department: emp.department || '', truckId: emp.truckId || '',
                    })}
                      className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                      title="Sửa">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => deleteEmployee(emp.id, emp.name)}
                      className="p-1.5 text-text-secondary hover:text-error-zen hover:bg-error-zen/10 rounded-lg transition-all cursor-pointer"
                      title="Xóa">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-text-secondary">{emp.phone}</p>
                  <p className="font-medium text-accent">Lương: {formatCurrency(parseFloat(emp.salary || '0'))}</p>
                  {emp.department && (
                    <p className="text-xs text-primary flex items-center space-x-1">
                      <Building2 size={12} /><span>{emp.department}</span>
                    </p>
                  )}
                  {emp.truckId && (
                    <p className="text-xs text-primary flex items-center space-x-1">
                      <TruckIcon size={12} /><span>{trucks.find((t: any) => t.id === emp.truckId)?.name || 'Xe'}</span>
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-surface-zen flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {emp.status === 'ACTIVE' ? 'Đang làm' : 'Đã nghỉ'}
                  </span>
                </div>
              </div>
            ))}
            {filteredEmployees.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">Chưa có nhân viên</div>}
          </div>
        </>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
          <div className="p-4 border-b border-surface-zen">
            <h3 className="font-bold text-primary-dark">Hôm nay ({formatDate(Date.now())})</h3>
            <p className="text-sm text-text-secondary">{todayAttendances.length} lượt chấm công</p>
          </div>
          <table className="w-full text-left">
            <thead className="bg-surface-zen">
              <tr>
                <th className="p-4 text-sm font-medium text-text-secondary">Nhân viên</th>
                <th className="p-4 text-sm font-medium text-text-secondary">Loại</th>
                <th className="p-4 text-sm font-medium text-text-secondary">Thời gian</th>
                <th className="p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {attendances.slice().reverse().map((a: any) => (
                <tr key={a.id} className="border-t border-surface-zen hover:bg-surface-zen/50 transition-colors">
                  <td className="p-4 text-sm font-medium">{getEmployeeName(a.employeeId)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.checkIn && !a.checkOut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.checkIn && !a.checkOut ? 'Vào ca' : 'Đã ra ca'}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{formatDateTime(a.checkIn || a.checkOut || a.createdAt)}</td>
                  <td className="p-4 text-sm text-text-secondary">{a.note || '-'}</td>
                </tr>
              ))}
              {attendances.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-gray-400">Chưa có dữ liệu chấm công</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'advances' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={HandCoins} label="Tổng tạm ứng" value={formatCurrency(totalAdvances)} color="accent" sub={`${advances.length} lần`} />
            <StatCard icon={Users} label="Nhân viên đã tạm ứng" value={new Set(advances.map((a: any) => a.employeeId)).size.toString()} color="primary" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-zen">
                <tr>
                  <th className="p-4 text-sm font-medium text-text-secondary">Nhân viên</th>
                  <th className="p-4 text-sm font-medium text-text-secondary">Ngày</th>
                  <th className="p-4 text-sm font-medium text-text-secondary text-right">Số tiền</th>
                  <th className="p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {advances.slice().reverse().map((a: any) => (
                  <tr key={a.id} className="border-t border-surface-zen hover:bg-surface-zen/50 transition-colors">
                    <td className="p-4 text-sm font-medium">{a.employeeName || getEmployeeName(a.employeeId)}</td>
                    <td className="p-4 text-sm">{formatDateTime(a.createdAt)}</td>
                    <td className="p-4 text-sm text-right font-bold text-accent">{formatCurrency(parseFloat(a.amount))}</td>
                    <td className="p-4 text-sm text-text-secondary">{a.note || '-'}</td>
                  </tr>
                ))}
                {advances.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-gray-400">Chưa có tạm ứng</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAddEmployee && (
        <Modal title="Thêm nhân viên" onClose={() => setShowAddEmployee(false)}>
          <div className="space-y-3">
            <Input label="Họ tên" value={empData.name} onChange={(e: any) => setEmpData({ ...empData, name: e.target.value })} placeholder="Nhập họ tên..." />
            <Input label="Số điện thoại" value={empData.phone} onChange={(e: any) => setEmpData({ ...empData, phone: e.target.value })} placeholder="Số điện thoại..." />
            <Input label="Chức vụ" value={empData.role} onChange={(e: any) => setEmpData({ ...empData, role: e.target.value })} placeholder="VD: Nhân viên bán hàng..." />
            <Input label="Lương" type="number" value={empData.salary} onChange={(e: any) => setEmpData({ ...empData, salary: e.target.value })} placeholder="0" />
            <Input label="Bộ phận" value={empData.department} onChange={(e: any) => setEmpData({ ...empData, department: e.target.value })} placeholder="VD: Bán hàng, Bếp..." />
            <Select label="Phân công xe" value={empData.truckId} onChange={(e: any) => setEmpData({ ...empData, truckId: e.target.value })}
              options={[{ value: '', label: '-- Không phân công --' }, ...trucks.filter((t: any) => t.status === 'ACTIVE').map((t: any) => ({ value: t.id, label: `${t.name} (${t.code})` }))]} />
            <Select label="Trạng thái" value={empData.status} onChange={(e: any) => setEmpData({ ...empData, status: e.target.value })}
              options={[{ value: 'ACTIVE', label: 'Đang làm' }, { value: 'INACTIVE', label: 'Đã nghỉ' }]} />
            <button onClick={addEmployee} disabled={!empData.name} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50 cursor-pointer">
              Thêm nhân viên
            </button>
          </div>
        </Modal>
      )}

      {showAttendance && (
        <Modal title="Chấm công" onClose={() => setShowAttendance(false)}>
          <div className="space-y-3">
            <Select label="Nhân viên" value={attData.employeeId} onChange={(e: any) => setAttData({ ...attData, employeeId: e.target.value })}
              options={[{ value: '', label: '-- Chọn --' }, ...employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => ({ value: e.id, label: e.name }))]} />
            <div className="flex space-x-2">
              <button onClick={() => setAttData({ ...attData, type: 'CHECK_IN' })}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer ${attData.type === 'CHECK_IN' ? 'bg-success-zen text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <Clock size={16} className="inline mr-1" />Vào ca
              </button>
              <button onClick={() => setAttData({ ...attData, type: 'CHECK_OUT' })}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer ${attData.type === 'CHECK_OUT' ? 'bg-error-zen text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <Clock size={16} className="inline mr-1" />Ra ca
              </button>
            </div>
            <Input label="Ghi chú" value={attData.note} onChange={(e: any) => setAttData({ ...attData, note: e.target.value })} placeholder="Ghi chú..." />
            <button onClick={recordAttendance} disabled={!attData.employeeId} className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50 cursor-pointer">
              Xác nhận chấm công
            </button>
          </div>
        </Modal>
      )}

      {showAdvance && (
        <Modal title="Tạm ứng" onClose={() => setShowAdvance(false)}>
          <div className="space-y-3">
            <Select label="Nhân viên" value={advData.employeeId} onChange={(e: any) => setAdvData({ ...advData, employeeId: e.target.value })}
              options={[{ value: '', label: '-- Chọn --' }, ...employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => ({ value: e.id, label: e.name }))]} />
            <Input label="Số tiền" type="number" value={advData.amount} onChange={(e: any) => setAdvData({ ...advData, amount: e.target.value })} placeholder="0" />
            <Input label="Lý do" value={advData.note} onChange={(e: any) => setAdvData({ ...advData, note: e.target.value })} placeholder="Lý do tạm ứng..." />
            <button onClick={recordAdvance} disabled={!advData.employeeId || !advData.amount} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50 cursor-pointer">
              Xác nhận tạm ứng
            </button>
          </div>
        </Modal>
      )}

      {showEditEmployee && (
        <Modal title="Sửa thông tin nhân viên" onClose={() => setShowEditEmployee(null)}>
          <div className="space-y-3">
            <Input label="Họ tên" value={showEditEmployee.name} onChange={(e: any) => setShowEditEmployee({ ...showEditEmployee, name: e.target.value })} placeholder="Nhập họ tên..." />
            <Input label="Số điện thoại" value={showEditEmployee.phone} onChange={(e: any) => setShowEditEmployee({ ...showEditEmployee, phone: e.target.value })} placeholder="Số điện thoại..." />
            <Input label="Chức vụ" value={showEditEmployee.role} onChange={(e: any) => setShowEditEmployee({ ...showEditEmployee, role: e.target.value })} placeholder="VD: Nhân viên bán hàng..." />
            <Input label="Lương" type="number" value={showEditEmployee.salary} onChange={(e: any) => setShowEditEmployee({ ...showEditEmployee, salary: e.target.value })} placeholder="0" />
            <Input label="Bộ phận" value={showEditEmployee.department} onChange={(e: any) => setShowEditEmployee({ ...showEditEmployee, department: e.target.value })} placeholder="VD: Bán hàng, Bếp..." />
            <Select label="Phân công xe" value={showEditEmployee.truckId} onChange={(e: any) => setShowEditEmployee({ ...showEditEmployee, truckId: e.target.value })}
              options={[{ value: '', label: '-- Không phân công --' }, ...trucks.filter((t: any) => t.status === 'ACTIVE').map((t: any) => ({ value: t.id, label: `${t.name} (${t.code})` }))]} />
            <Select label="Trạng thái" value={showEditEmployee.status} onChange={(e: any) => setShowEditEmployee({ ...showEditEmployee, status: e.target.value })}
              options={[{ value: 'ACTIVE', label: 'Đang làm' }, { value: 'INACTIVE', label: 'Đã nghỉ' }]} />
            <button onClick={updateEmployee} disabled={!showEditEmployee.name}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all cursor-pointer">
              Cập nhật
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
