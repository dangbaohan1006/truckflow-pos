import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, UserCheck, CalendarDays, HandCoins,
  Plus, Search, Clock, DollarSign, Briefcase,
} from 'lucide-react';
import { database } from '../database/index.js';
import Employee from '../database/models/Employee.js';
import Attendance from '../database/models/Attendance.js';
import Advance from '../database/models/Advance.js';
import { formatCurrency, formatDate, formatDateTime, generateId } from '../shared/utils.js';
import { Modal, Input, Select, StatCard, TabButton } from '../shared/components.js';

export default function HR() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);

  const [empData, setEmpData] = useState({ name: '', phone: '', role: '', salary: '0', status: 'ACTIVE' });
  const [attData, setAttData] = useState({ employeeId: '', type: 'CHECK_IN', note: '' });
  const [advData, setAdvData] = useState({ employeeId: '', amount: '0', note: '' });

  useEffect(() => {
    const sub1 = database.get<Employee>('employees').query().observe().subscribe(setEmployees);
    const sub2 = database.get<Attendance>('attendance').query().observe().subscribe(setAttendances);
    const sub3 = database.get<Advance>('advances').query().observe().subscribe(setAdvances);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); };
  }, []);

  const filteredEmployees = employees.filter((e: any) => !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const addEmployee = async () => {
    await database.write(async () => {
      await database.get<Employee>('employees').create((e: any) => {
        e._raw.id = generateId();
        e.name = empData.name;
        e.phone = empData.phone;
        e.role = empData.role;
        e.salary = empData.salary;
        e.status = empData.status;
        e.createdAt = Date.now();
        e.updatedAt = Date.now();
      });
    });
    setShowAddEmployee(false);
    setEmpData({ name: '', phone: '', role: '', salary: '0', status: 'ACTIVE' });
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
        a.createdAt = now;
        a.updatedAt = now;
      });
    });
    setShowAttendance(false);
    setAttData({ employeeId: '', type: 'CHECK_IN', note: '' });
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
        a.createdAt = now;
        a.updatedAt = now;
      });
    });
    setShowAdvance(false);
    setAdvData({ employeeId: '', amount: '0', note: '' });
  };

  const getEmployeeName = (id: string) => employees.find((e: any) => e.id === id)?.name || 'N/A';

  const todayAttendances = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return attendances.filter((a: any) => a.createdAt >= today.getTime());
  }, [attendances]);

  const totalAdvances = useMemo(() => advances.reduce((s: number, a: any) => s + parseFloat(a.amount || '0'), 0), [advances]);

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
            <button onClick={() => setShowAddEmployee(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
              <Plus size={16} /><span>Thêm nhân viên</span>
            </button>
          )}
          {activeTab === 'attendance' && (
            <button onClick={() => setShowAttendance(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
              <Plus size={16} /><span>Chấm công</span>
            </button>
          )}
          {activeTab === 'advances' && (
            <button onClick={() => setShowAdvance(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
              <Plus size={16} /><span>Tạm ứng</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'employees' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={Users} label="Tổng nhân viên" value={employees.length.toString()} color="primary" />
            <StatCard icon={UserCheck} label="Đang làm" value={employees.filter((e: any) => e.status === 'ACTIVE').length.toString()} color="success-zen" />
            <StatCard icon={DollarSign} label="Tổng lương" value={formatCurrency(employees.reduce((s: number, e: any) => s + parseFloat(e.salary || '0'), 0))} color="accent" />
          </div>
          <div className="relative w-72">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input type="text" placeholder="Tìm kiếm nhân viên..." value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {filteredEmployees.map((emp: any) => (
              <div key={emp.id} className="bg-white rounded-xl p-4 shadow-sm border border-surface-zen">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center text-lg font-bold">{emp.name[0]}</div>
                  <div>
                    <h4 className="font-semibold">{emp.name}</h4>
                    <p className="text-xs text-text-secondary">{emp.role || 'Chưa phân công'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-text-secondary">{emp.phone}</p>
                  <p className="font-medium text-accent">Lương: {formatCurrency(parseFloat(emp.salary || '0'))}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-surface-zen">
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
          <table className="w-full">
            <thead className="bg-surface-zen">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Nhân viên</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Loại</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Thời gian</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {attendances.slice().reverse().map((a: any) => (
                <tr key={a.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
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
            <table className="w-full">
              <thead className="bg-surface-zen">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Nhân viên</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Ngày</th>
                  <th className="text-right p-4 text-sm font-medium text-text-secondary">Số tiền</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {advances.slice().reverse().map((a: any) => (
                  <tr key={a.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
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
            <Select label="Trạng thái" value={empData.status} onChange={(e: any) => setEmpData({ ...empData, status: e.target.value })}
              options={[{ value: 'ACTIVE', label: 'Đang làm' }, { value: 'INACTIVE', label: 'Đã nghỉ' }]} />
            <button onClick={addEmployee} disabled={!empData.name} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
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
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${attData.type === 'CHECK_IN' ? 'bg-success-zen text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <Clock size={16} className="inline mr-1" />Vào ca
              </button>
              <button onClick={() => setAttData({ ...attData, type: 'CHECK_OUT' })}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${attData.type === 'CHECK_OUT' ? 'bg-error-zen text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <Clock size={16} className="inline mr-1" />Ra ca
              </button>
            </div>
            <Input label="Ghi chú" value={attData.note} onChange={(e: any) => setAttData({ ...attData, note: e.target.value })} placeholder="Ghi chú..." />
            <button onClick={recordAttendance} disabled={!attData.employeeId} className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
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
            <button onClick={recordAdvance} disabled={!advData.employeeId || !advData.amount} className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Xác nhận tạm ứng
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
