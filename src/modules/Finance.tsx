import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Wallet, PiggyBank, Coins, ReceiptText,
  Plus, TrendingUp, TrendingDown, Calendar, Search,
  ArrowUpFromLine, ArrowDownToLine, NotebookTabs,
} from 'lucide-react';
import { database } from '../database/index.js';
import Transaction from '../database/models/Transaction.js';
import { formatCurrency, formatDateTime, generateId } from '../shared/utils.js';
import { Modal, Input, Select, StatCard, TabButton } from '../shared/components.js';
import { useToast } from '../shared/ToastContext.js';

export default function Finance() {
  const toast = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAdd, setShowAdd] = useState(false);
  const [dateRange, setDateRange] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    type: 'INCOME', amount: '', category: '', note: '', paymentMethod: 'cash',
  });

  useEffect(() => {
    const sub = database.get<Transaction>('transactions').query().observe().subscribe(setTransactions);
    return () => sub.unsubscribe();
  }, []);

  const getDateFilter = () => {
    const now = new Date();
    const start = new Date(now);
    if (dateRange === 'today') start.setHours(0, 0, 0, 0);
    else if (dateRange === 'week') start.setDate(now.getDate() - 7);
    else if (dateRange === 'month') start.setMonth(now.getMonth() - 1);
    else start.setFullYear(now.getFullYear() - 1);
    return start.getTime();
  };

  const filteredTxns = useMemo(() => {
    const cutoff = getDateFilter();
    return transactions.filter((t: any) => {
      if (t.createdAt < cutoff) return false;
      if (searchTerm && !t.note?.toLowerCase().includes(searchTerm.toLowerCase()) && !t.category?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [transactions, dateRange, searchTerm]);

  const totalIncome = useMemo(() => filteredTxns.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0), [filteredTxns]);
  const totalExpense = useMemo(() => filteredTxns.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0), [filteredTxns]);
  const balance = totalIncome - totalExpense;

  const addTransaction = async () => {
    await database.write(async () => {
      await database.get<Transaction>('transactions').create((t: any) => {
        t._raw.id = generateId();
        t.type = formData.type;
        t.amount = formData.amount;
        t.category = formData.category;
        t.note = formData.note;
        t.paymentMethod = formData.paymentMethod;
      });
    });
    setShowAdd(false);
    setFormData({ type: 'INCOME', amount: '', category: '', note: '', paymentMethod: 'cash' });
    const label = formData.type === 'INCOME' ? 'Khoản thu' : 'Khoản chi';
    toast.success(`Đã ghi sổ ${label.toLowerCase()} - ${formData.category}: ${formatCurrency(parseFloat(formData.amount))}`);
  };

  const incomeCategories = ['Bán hàng', 'Thu khác', 'Hoàn trả', 'Đầu tư'];
  const expenseCategories = ['Nhập hàng', 'Lương', 'Mặt bằng', 'Điện nước', 'Vận chuyển', 'Bảo trì', 'Chi khác'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <TabButton label="Tổng quan" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Thu" active={activeTab === 'income'} onClick={() => setActiveTab('income')} />
          <TabButton label="Chi" active={activeTab === 'expense'} onClick={() => setActiveTab('expense')} />
          <TabButton label="Sổ quỹ" active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} />
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
          <Plus size={16} /><span>Ghi sổ</span>
        </button>
      </div>

      <div className="flex space-x-1 bg-surface-zen rounded-lg p-1 w-fit">
        {['today', 'week', 'month', 'year'].map((r: string) => (
          <button key={r} onClick={() => setDateRange(r)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateRange === r ? 'bg-white shadow-sm text-primary-dark' : 'text-text-secondary'}`}>
            {r === 'today' ? 'Hôm nay' : r === 'week' ? '7 ngày' : r === 'month' ? '30 ngày' : 'Năm'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={ArrowUpFromLine} label="Tổng thu" value={formatCurrency(totalIncome)} color="success-zen" />
            <StatCard icon={ArrowDownToLine} label="Tổng chi" value={formatCurrency(totalExpense)} color="error-zen" />
            <StatCard icon={Wallet} label="Cân đối" value={formatCurrency(balance)} color={balance >= 0 ? 'primary' : 'error-zen'} />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen">
            <h3 className="font-bold text-primary-dark mb-4">Giao dịch gần đây</h3>
            <div className="space-y-2">
              {filteredTxns.slice().reverse().slice(0, 10).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-3 border-b border-surface-zen last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type === 'INCOME' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.note || t.category}</p>
                      <p className="text-xs text-text-secondary">{t.category} • {formatDateTime(t.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${t.type === 'INCOME' ? 'text-success-zen' : 'text-error-zen'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(parseFloat(t.amount))}
                  </span>
                </div>
              ))}
              {filteredTxns.length === 0 && <p className="text-center text-gray-400 py-8">Chưa có giao dịch</p>}
            </div>
          </div>
        </>
      )}

      {(activeTab === 'income' || activeTab === 'expense') && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
          <div className="p-4 border-b border-surface-zen">
            <div className="relative w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input type="text" placeholder="Tìm kiếm..." value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-zen rounded-lg outline-none text-sm" />
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-surface-zen">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Ngày</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Danh mục</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
                <th className="text-right p-4 text-sm font-medium text-text-secondary">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.filter((t: any) => activeTab === 'income' ? t.type === 'INCOME' : t.type === 'EXPENSE').slice().reverse().map((t: any) => (
                <tr key={t.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                  <td className="p-4 text-sm">{formatDateTime(t.createdAt)}</td>
                  <td className="p-4 text-sm">{t.category}</td>
                  <td className="p-4 text-sm text-text-secondary">{t.note || '-'}</td>
                  <td className={`p-4 text-sm text-right font-bold ${t.type === 'INCOME' ? 'text-success-zen' : 'text-error-zen'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(parseFloat(t.amount))}
                  </td>
                </tr>
              ))}
              {filteredTxns.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-gray-400">Chưa có giao dịch</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
          <div className="p-4 border-b border-surface-zen">
            <div className="relative w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input type="text" placeholder="Tìm kiếm..." value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-zen rounded-lg outline-none text-sm" />
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-surface-zen">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Ngày</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Loại</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Danh mục</th>
                <th className="text-left p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
                <th className="text-right p-4 text-sm font-medium text-text-secondary">Thu</th>
                <th className="text-right p-4 text-sm font-medium text-text-secondary">Chi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.slice().reverse().map((t: any) => (
                <tr key={t.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                  <td className="p-4 text-sm">{formatDateTime(t.createdAt)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type === 'INCOME' ? 'Thu' : 'Chi'}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{t.category}</td>
                  <td className="p-4 text-sm text-text-secondary">{t.note || '-'}</td>
                  <td className="p-4 text-sm text-right text-success-zen font-medium">
                    {t.type === 'INCOME' ? formatCurrency(parseFloat(t.amount)) : '-'}
                  </td>
                  <td className="p-4 text-sm text-right text-error-zen font-medium">
                    {t.type === 'EXPENSE' ? formatCurrency(parseFloat(t.amount)) : '-'}
                  </td>
                </tr>
              ))}
              {filteredTxns.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">Chưa có giao dịch</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Ghi sổ thu chi" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <div className="flex space-x-2">
              <button onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${formData.type === 'INCOME' ? 'bg-success-zen text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <ArrowUpFromLine size={16} className="inline mr-1" />Khoản thu
              </button>
              <button onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${formData.type === 'EXPENSE' ? 'bg-error-zen text-white' : 'bg-surface-zen text-text-secondary'}`}>
                <ArrowDownToLine size={16} className="inline mr-1" />Khoản chi
              </button>
            </div>
            <Input label="Số tiền" type="number" value={formData.amount} onChange={(e: any) => setFormData({ ...formData, amount: e.target.value })} placeholder="0" />
            <Select label="Danh mục" value={formData.category} onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { value: '', label: '-- Chọn danh mục --' },
                ...(formData.type === 'INCOME' ? incomeCategories : expenseCategories).map((c: string) => ({ value: c, label: c })),
              ]} />
            <Select label="Phương thức" value={formData.paymentMethod} onChange={(e: any) => setFormData({ ...formData, paymentMethod: e.target.value })}
              options={[
                { value: 'cash', label: 'Tiền mặt' },
                { value: 'bank', label: 'Chuyển khoản' },
                { value: 'card', label: 'Thẻ' },
              ]} />
            <Input label="Ghi chú" value={formData.note} onChange={(e: any) => setFormData({ ...formData, note: e.target.value })} placeholder="Nội dung..." />
            <button onClick={addTransaction} disabled={!formData.amount || !formData.category}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all disabled:opacity-50">
              Ghi sổ
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
