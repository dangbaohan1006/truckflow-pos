import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, DollarSign,
  ShoppingCart, Package, Users, Download, FileText, AlertTriangle,
} from 'lucide-react';
import { database } from '../database/index.js';
import SalesOrder from '../database/models/SalesOrder.js';
import SalesOrderLine from '../database/models/SalesOrderLine.js';
import InventoryItem from '../database/models/InventoryItem.js';
import StockMovement from '../database/models/StockMovement.js';
import { formatCurrency, formatDate, formatDateTime } from '../shared/utils.js';
import { StatCard, TabButton } from '../shared/components.js';

export default function Reports() {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('today');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const sub1 = database.get<SalesOrder>('pos_order').query().observe().subscribe(setOrders);
    const sub2 = database.get<SalesOrderLine>('pos_order_line').query().observe().subscribe(setOrderLines);
    const sub3 = database.get<InventoryItem>('inventory_items').query().observe().subscribe(setItems);
    const sub4 = database.get<StockMovement>('stock_movements').query().observe().subscribe(setMovements);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); sub4.unsubscribe(); };
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

  const filteredOrders = useMemo(() => {
    const cutoff = getDateFilter();
    return orders.filter((o: any) => o.createdAt >= cutoff && o.status === 'COMPLETED');
  }, [orders, dateRange]);

  const totalRevenue = useMemo(() => filteredOrders.reduce((sum: number, o: any) => sum + parseFloat(o.totalAmount || '0'), 0), [filteredOrders]);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const topProducts = useMemo(() => {
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    const cutoff = getDateFilter();
    orderLines.filter((l: any) => {
      const order = orders.find((o: any) => o.id === l.orderId);
      return order && order.createdAt >= cutoff && order.status === 'COMPLETED';
    }).forEach((line: any) => {
      if (!productMap[line.productId]) {
        productMap[line.productId] = { name: line.productName, qty: 0, revenue: 0 };
      }
      productMap[line.productId].qty += parseInt(line.quantity) || 0;
      productMap[line.productId].revenue += parseFloat(line.subtotal) || 0;
    });
    return Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10);
  }, [orderLines, orders, dateRange]);

  const inventoryValue = useMemo(() => {
    return items.reduce((sum: number, i: any) => sum + (parseFloat(i.quantity) * parseFloat(i.price || '0')), 0);
  }, [items]);

  const lowStockItems = useMemo(() => {
    return items.filter((i: any) => parseFloat(i.quantity) <= parseFloat(i.reorderLevel));
  }, [items]);

  const recentMovements = useMemo(() => {
    return movements.slice().reverse().slice(0, 20);
  }, [movements]);

  const exportReport = () => {
    const rows = [
      ['BÁO CÁO TRUCKFLOW', '', '', ''],
      [`Ngày: ${formatDate(Date.now())}`, '', '', ''],
      ['', '', '', ''],
      ['DOANH THU', '', '', ''],
      ['Tổng đơn hàng:', totalOrders.toString(), '', ''],
      ['Tổng doanh thu:', formatCurrency(totalRevenue), '', ''],
      ['Trung bình/đơn:', formatCurrency(avgOrderValue), '', ''],
      ['', '', '', ''],
      ['TOP SẢN PHẨM', '', '', ''],
      ['Sản phẩm', 'SL', 'Doanh thu', ''],
      ...topProducts.map((p: any) => [p.name, p.qty.toString(), formatCurrency(p.revenue), '']),
      ['', '', '', ''],
      ['TỒN KHO', '', '', ''],
      ['Tổng giá trị tồn:', formatCurrency(inventoryValue), '', ''],
      ['Số mặt hàng tồn thấp:', lowStockItems.length.toString(), '', ''],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baocao_${formatDate(Date.now()).replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <TabButton label="Tổng quan" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Bán hàng" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
          <TabButton label="Tồn kho" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
        </div>
        <div className="flex space-x-3">
          <div className="flex space-x-1 bg-surface-zen rounded-lg p-1">
            {['today', 'week', 'month', 'year'].map((r: string) => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateRange === r ? 'bg-white shadow-sm text-primary-dark' : 'text-text-secondary'}`}>
                {r === 'today' ? 'Hôm nay' : r === 'week' ? '7 ngày' : r === 'month' ? '30 ngày' : 'Năm'}
              </button>
            ))}
          </div>
          <button onClick={exportReport} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all flex items-center space-x-1">
            <Download size={16} /><span>Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Doanh thu" value={formatCurrency(totalRevenue)} color="accent" sub={`${totalOrders} đơn hàng`} />
            <StatCard icon={ShoppingCart} label="Đơn hàng" value={totalOrders.toString()} color="primary" sub={`TB ${formatCurrency(avgOrderValue)}/đơn`} />
            <StatCard icon={Package} label="Giá trị tồn kho" value={formatCurrency(inventoryValue)} color="success-zen" sub={`${items.length} mặt hàng`} />
            <StatCard icon={AlertTriangle} label="Tồn thấp" value={lowStockItems.length.toString()} color="error-zen" sub="Cần nhập thêm" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen">
              <h3 className="font-bold text-primary-dark mb-4">Top sản phẩm bán chạy</h3>
              <div className="space-y-3">
                {topProducts.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-accent">{formatCurrency(p.revenue)}</p>
                      <p className="text-xs text-text-secondary">{p.qty} đã bán</p>
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && <p className="text-center text-gray-400 py-8">Chưa có dữ liệu</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-zen">
              <h3 className="font-bold text-primary-dark mb-4">Giao dịch gần đây</h3>
              <div className="space-y-2">
                {recentMovements.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-surface-zen last:border-0">
                    <div className="flex items-center space-x-2">
                      {parseFloat(m.quantity) >= 0 ? <TrendingUp size={14} className="text-success-zen" /> : <TrendingDown size={14} className="text-error-zen" />}
                      <span className="text-sm">{m.itemName}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${parseFloat(m.quantity) >= 0 ? 'text-success-zen' : 'text-error-zen'}`}>
                        {parseFloat(m.quantity) >= 0 ? '+' : ''}{m.quantity}
                      </span>
                      <p className="text-xs text-text-secondary">{formatDateTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {recentMovements.length === 0 && <p className="text-center text-gray-400 py-8">Chưa có giao dịch</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'sales' && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-zen overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-zen">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Mã đơn</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Ngày</th>
                  <th className="text-right p-4 text-sm font-medium text-text-secondary">Tổng tiền</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Thanh toán</th>
                  <th className="text-left p-4 text-sm font-medium text-text-secondary">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice().reverse().map((o: any) => (
                  <tr key={o.id} className="border-t border-surface-zen hover:bg-surface-zen/50">
                    <td className="p-4 text-sm font-mono font-medium">{o.id.slice(-8).toUpperCase()}</td>
                    <td className="p-4 text-sm">{formatDateTime(o.createdAt)}</td>
                    <td className="p-4 text-sm text-right font-bold text-accent">{formatCurrency(parseFloat(o.totalAmount))}</td>
                    <td className="p-4 text-sm">{o.paymentMethod === 'cash' ? 'Tiền mặt' : o.paymentMethod === 'card' ? 'Thẻ' : 'QR'}</td>
                    <td className="p-4 text-sm text-text-secondary">{o.note || '-'}</td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">Chưa có đơn hàng</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="grid grid-cols-4 gap-4">
          {items.map((item: any) => (
            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-surface-zen">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-sm">{item.name}</h4>
                <span className={`text-xs font-bold ${parseFloat(item.quantity) <= parseFloat(item.reorderLevel) ? 'text-error-zen' : 'text-success-zen'}`}>
                  {item.quantity} {item.unit}
                </span>
              </div>
              <p className="text-xs text-text-secondary">Giá: {formatCurrency(parseFloat(item.price || '0'))}</p>
              <p className="text-xs text-text-secondary">Giá trị tồn: {formatCurrency(parseFloat(item.quantity) * parseFloat(item.price || '0'))}</p>
              <div className="mt-2 w-full bg-surface-zen rounded-full h-2">
                <div className={`h-2 rounded-full ${parseFloat(item.quantity) <= parseFloat(item.reorderLevel) ? 'bg-error-zen' : 'bg-success-zen'}`}
                  style={{ width: `${Math.min(100, (parseFloat(item.quantity) / Math.max(1, parseFloat(item.reorderLevel) * 5)) * 100)}%` }} />
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="col-span-4 text-center py-12 text-gray-400">Chưa có hàng hóa</div>}
        </div>
      )}
    </div>
  );
}
