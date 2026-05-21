import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, DollarSign,
  ShoppingCart, Package, Users, Download, FileText, AlertTriangle,
  ClipboardList, Beaker, ArrowUpDown,
} from 'lucide-react';
import { database } from '../database/index.js';
import SalesOrder from '../database/models/SalesOrder.js';
import SalesOrderLine from '../database/models/SalesOrderLine.js';
import InventoryItem from '../database/models/InventoryItem.js';
import StockMovement from '../database/models/StockMovement.js';
import MenuIngredient from '../database/models/MenuIngredient.js';
import { formatCurrency, formatDate, formatDateTime } from '../shared/utils.js';
import { StatCard, TabButton } from '../shared/components.js';

export default function Reports() {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [menuIngredients, setMenuIngredients] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const sub1 = database.get<SalesOrder>('pos_order').query().observe().subscribe(setOrders);
    const sub2 = database.get<SalesOrderLine>('pos_order_line').query().observe().subscribe(setOrderLines);
    const sub3 = database.get<InventoryItem>('inventory_items').query().observe().subscribe(setItems);
    const sub4 = database.get<StockMovement>('stock_movements').query().observe().subscribe(setMovements);
    const sub5 = database.get<MenuIngredient>('menu_ingredients').query().observe().subscribe(setMenuIngredients);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); sub4.unsubscribe(); sub5.unsubscribe(); };
  }, []);

  const getStartTime = () => new Date(startDate).getTime();
  const getEndTime = () => {
    const d = new Date(endDate);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };

  const filteredOrders = useMemo(() => {
    const start = getStartTime();
    const end = getEndTime();
    return orders.filter((o: any) => o.createdAt >= start && o.createdAt <= end && o.status === 'COMPLETED');
  }, [orders, startDate, endDate]);

  const totalRevenue = useMemo(() => filteredOrders.reduce((sum: number, o: any) => sum + parseFloat(o.totalAmount || '0'), 0), [filteredOrders]);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const topProducts = useMemo(() => {
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    const start = getStartTime();
    const end = getEndTime();
    orderLines.filter((l: any) => {
      const order = orders.find((o: any) => o.id === l.orderId);
      return order && order.createdAt >= start && order.createdAt <= end && order.status === 'COMPLETED';
    }).forEach((line: any) => {
      if (!productMap[line.productId]) {
        productMap[line.productId] = { name: line.productName, qty: 0, revenue: 0 };
      }
      productMap[line.productId].qty += parseInt(line.quantity) || 0;
      productMap[line.productId].revenue += parseFloat(line.subtotal) || 0;
    });
    return Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10);
  }, [orderLines, orders, startDate, endDate]);

  const inventoryValue = useMemo(() => {
    return items.reduce((sum: number, i: any) => sum + (parseFloat(i.quantity) * parseFloat(i.price || '0')), 0);
  }, [items]);

  const lowStockItems = useMemo(() => {
    return items.filter((i: any) => parseFloat(i.quantity) <= parseFloat(i.reorderLevel));
  }, [items]);

  const recentMovements = useMemo(() => {
    return movements.slice().reverse().slice(0, 20);
  }, [movements]);

  // ===== Materials Report Computations =====

  // KHUNG 1: Danh sách hàng đã bán (products sold in the period)
  const soldProducts = useMemo(() => {
    const start = getStartTime();
    const end = getEndTime();
    return orderLines.filter((l: any) => {
      const order = orders.find((o: any) => o.id === l.orderId);
      return order && order.createdAt >= start && order.createdAt <= end && order.status === 'COMPLETED';
    }).map((line: any) => {
      const order = orders.find((o: any) => o.id === line.orderId);
      const item = items.find((i: any) => i.id === line.productId);
      return {
        id: line.id,
        productId: line.productId,
        date: order ? order.createdAt : Date.now(),
        sku: item ? item.sku : 'SP-' + line.productId.slice(-6).toUpperCase(),
        name: line.productName,
        unit: item ? item.unit : 'Ly',
        qty: parseInt(line.quantity) || 0,
        price: parseFloat(line.price) || 0,
        revenue: parseFloat(line.subtotal) || 0,
        note: order?.note || '-',
      };
    }).sort((a: any, b: any) => b.date - a.date);
  }, [orderLines, orders, items, startDate, endDate]);

  // KHUNG 2: Nguyên liệu tương ứng tính từ BOM (menu_ingredients)
  const calculatedMaterials = useMemo(() => {
    const matMap: Record<string, { materialId: string; sku: string; materialName: string; quantity: number; unit: string; price: number; amount: number; note: string }> = {};
    for (const product of soldProducts) {
      const ings = menuIngredients.filter((ing: any) => ing.menuItemId === product.productId);
      for (const ing of ings) {
        if (!matMap[ing.materialId]) {
          const materialItem = items.find((i: any) => i.id === ing.materialId || i.name === ing.materialName);
          const price = materialItem ? parseFloat(materialItem.price || '0') : 0;
          matMap[ing.materialId] = {
            materialId: ing.materialId,
            sku: materialItem ? materialItem.sku : 'NL-' + ing.materialId.slice(-6).toUpperCase(),
            materialName: ing.materialName,
            quantity: 0,
            unit: ing.unit || materialItem?.unit || 'Gram',
            price,
            amount: 0,
            note: 'Định mức BOM hệ thống',
          };
        }
        matMap[ing.materialId].quantity += parseFloat(ing.quantity) * product.qty;
      }
    }
    return Object.values(matMap).map((m: any) => {
      m.amount = m.quantity * m.price;
      return m;
    }).sort((a: any, b: any) => b.quantity - a.quantity);
  }, [soldProducts, menuIngredients, items]);

  // KHUNG 3: Nguyên liệu đã xuất thực tế (số dư đầu ngày - số dư cuối ngày)
  const actualExportedMaterials = useMemo(() => {
    const start = getStartTime();
    const end = getEndTime();
    const rawMaterials = items.filter((i: any) => i.isRawMaterial);

    return rawMaterials.map((item: any) => {
      // 1. Movements after the end of the period
      const movementsAfter = movements.filter((m: any) => m.itemId === item.id && m.createdAt > end);
      const qtyAfter = movementsAfter.reduce((sum: number, m: any) => sum + (parseFloat(m.quantity) || 0), 0);

      // 2. Quantity at the end of the period
      const balanceEnd = parseFloat(item.quantity) - qtyAfter;

      // 3. Movements during the period
      const movementsIn = movements.filter((m: any) => m.itemId === item.id && m.createdAt >= start && m.createdAt <= end);
      const qtyIn = movementsIn.reduce((sum: number, m: any) => sum + (parseFloat(m.quantity) || 0), 0);

      // 4. Quantity at the start of the period
      const balanceStart = balanceEnd - qtyIn;

      // 5. Used quantity = balanceStart - balanceEnd
      const usedQty = Math.max(0, balanceStart - balanceEnd);

      const price = parseFloat(item.price || '0');
      const amount = usedQty * price;

      return {
        materialId: item.id,
        sku: item.sku || 'NL-' + item.id.slice(-6).toUpperCase(),
        materialName: item.name,
        unit: item.unit || 'Gram',
        balanceStart,
        balanceEnd,
        quantity: usedQty,
        price,
        amount,
        note: `Đầu: ${balanceStart.toFixed(1)} | Cuối: ${balanceEnd.toFixed(1)}`,
      };
    }).filter((m: any) => m.quantity > 0)
      .sort((a: any, b: any) => b.quantity - a.quantity);
  }, [movements, items, startDate, endDate]);

  // KHUNG 4: Chênh lệch giữa calculated và actual
  const materialDiscrepancies = useMemo(() => {
    const allMaterialIds = new Set([
      ...calculatedMaterials.map((m: any) => m.materialId),
      ...actualExportedMaterials.map((m: any) => m.materialId),
    ]);
    const result: Array<{
      materialId: string;
      sku: string;
      materialName: string;
      unit: string;
      price: number;
      calculatedQty: number;
      calculatedAmount: number;
      actualQty: number;
      actualAmount: number;
      diffQty: number;
      diffAmount: number;
      note: string;
    }> = [];

    for (const matId of allMaterialIds) {
      const calc = calculatedMaterials.find((m: any) => m.materialId === matId);
      const actual = actualExportedMaterials.find((m: any) => m.materialId === matId);
      const item = items.find((i: any) => i.id === matId);

      const sku = item ? item.sku : (calc ? calc.sku : (actual ? actual.sku : ''));
      const materialName = item ? item.name : (calc ? calc.materialName : (actual ? actual.materialName : ''));
      const unit = item ? item.unit : (calc ? calc.unit : (actual ? actual.unit : ''));
      const price = item ? parseFloat(item.price || '0') : (calc ? calc.price : (actual ? actual.price : 0));

      const calculatedQty = calc ? calc.quantity : 0;
      const calculatedAmount = calc ? calc.amount : 0;

      const actualQty = actual ? actual.quantity : 0;
      const actualAmount = actual ? actual.amount : 0;

      const diffQty = calculatedQty - actualQty;
      const diffAmount = calculatedAmount - actualAmount;

      let note = '';
      if (diffQty > 0) {
        note = 'Thừa nguyên liệu';
      } else if (diffQty < 0) {
        note = 'Hao hụt nguyên liệu';
      } else {
        note = 'Khớp';
      }

      result.push({
        materialId: matId,
        sku,
        materialName,
        unit,
        price,
        calculatedQty,
        calculatedAmount,
        actualQty,
        actualAmount,
        diffQty,
        diffAmount,
        note,
      });
    }
    return result.sort((a: any, b: any) => Math.abs(b.diffQty) - Math.abs(a.diffQty));
  }, [calculatedMaterials, actualExportedMaterials, items]);

  const exportReport = () => {
    let rows: string[][] = [];
    if (activeTab === 'materials') {
      rows = [
        ['BÁO CÁO NGUYÊN LIỆU CHI TIẾT', '', '', '', '', '', '', '', '', '', ''],
        [`Thời gian: ${formatDate(new Date(startDate).getTime())} -> ${formatDate(new Date(endDate).getTime())}`, '', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', '', ''],
        ['1. HÀNG ĐÃ BÁN', '', '', '', '', '', '', '', '', '', ''],
        ['Ngày bán', 'Mã sản phẩm', 'Tên sản phẩm', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Tổng tiền', 'Ghi chú', '', '', ''],
        ...soldProducts.map((p: any) => [
          formatDateTime(p.date),
          p.sku,
          p.name,
          p.unit,
          p.qty.toString(),
          p.price.toString(),
          p.revenue.toString(),
          p.note
        ]),
        ['', '', '', '', '', '', '', '', '', '', ''],
        ['2. TỔNG NGUYÊN LIỆU HỆ THỐNG (ĐỊNH MỨC BOM)', '', '', '', '', '', '', '', '', '', ''],
        ['Mã nguyên liệu', 'Tên nguyên liệu', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Ghi chú', '', '', '', ''],
        ...calculatedMaterials.map((m: any) => [
          m.sku,
          m.materialName,
          m.unit,
          m.quantity.toString(),
          m.price.toString(),
          m.amount.toString(),
          m.note
        ]),
        ['', '', '', '', '', '', '', '', '', '', ''],
        ['3. TỔNG NGUYÊN LIỆU ĐÃ XUẤT THỰC TẾ (KIỂM KÊ)', '', '', '', '', '', '', '', '', '', ''],
        ['Mã nguyên liệu', 'Tên nguyên liệu', 'Đơn vị tính', 'Số lượng dùng', 'Đơn giá', 'Thành tiền', 'Ghi chú', '', '', '', ''],
        ...actualExportedMaterials.map((m: any) => [
          m.sku,
          m.materialName,
          m.unit,
          m.quantity.toString(),
          m.price.toString(),
          m.amount.toString(),
          m.note
        ]),
        ['', '', '', '', '', '', '', '', '', '', ''],
        ['4. BẢNG CHÊNH LỆCH NGUYÊN LIỆU', '', '', '', '', '', '', '', '', '', ''],
        ['Mã', 'Tên nguyên liệu', 'Đơn vị tính', 'Đơn giá', 'SL Hệ thống', 'TT Hệ thống', 'SL Thực tế', 'TT Thực tế', 'Chênh lệch', 'TT Chênh lệch', 'Ghi chú'],
        ...materialDiscrepancies.map((d: any) => [
          d.sku,
          d.materialName,
          d.unit,
          d.price.toString(),
          d.calculatedQty.toString(),
          d.calculatedAmount.toString(),
          d.actualQty.toString(),
          d.actualAmount.toString(),
          d.diffQty.toString(),
          d.diffAmount.toString(),
          d.note
        ])
      ];
    } else {
      rows = [
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
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baocao_${activeTab}_${formatDate(Date.now()).replace(/\//g, '-')}.csv`;
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
          <TabButton label="Nguyên liệu" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-surface-zen rounded-lg px-3 py-1.5">
            <Calendar size={16} className="text-text-secondary" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm font-medium text-text-secondary outline-none border-none" />
            <span className="text-text-secondary">→</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm font-medium text-text-secondary outline-none border-none" />
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

      {activeTab === 'materials' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Góc trên trái: Hàng đã bán */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-surface-zen">
            <div className="flex items-center space-x-2 mb-4">
              <ShoppingCart size={18} className="text-primary" />
              <h3 className="font-bold text-primary-dark">Hàng đã bán</h3>
              <span className="text-xs text-text-secondary ml-auto">{soldProducts.length} mặt hàng</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-zen text-text-secondary text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Ngày bán</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Mã</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Tên</th>
                    <th className="text-center p-2 font-medium whitespace-nowrap">ĐVT</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Số lượng</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Đơn giá</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Tổng tiền</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {soldProducts.map((p: any) => (
                    <tr key={p.id} className="border-t border-surface-zen hover:bg-surface-zen/30">
                      <td className="p-2 text-xs whitespace-nowrap">{formatDateTime(p.date)}</td>
                      <td className="p-2 text-xs font-mono whitespace-nowrap">{p.sku}</td>
                      <td className="p-2 font-medium whitespace-nowrap">{p.name}</td>
                      <td className="p-2 text-center text-text-secondary whitespace-nowrap">{p.unit}</td>
                      <td className="p-2 text-right font-bold whitespace-nowrap">{p.qty}</td>
                      <td className="p-2 text-right whitespace-nowrap">{formatCurrency(p.price)}</td>
                      <td className="p-2 text-right text-accent font-bold whitespace-nowrap">{formatCurrency(p.revenue)}</td>
                      <td className="p-2 text-text-secondary text-xs max-w-[120px] truncate whitespace-nowrap">{p.note}</td>
                    </tr>
                  ))}
                  {soldProducts.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Góc trên phải: Chênh lệch */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-surface-zen">
            <div className="flex items-center space-x-2 mb-4">
              <ArrowUpDown size={18} className="text-error-zen" />
              <h3 className="font-bold text-primary-dark">Chênh lệch</h3>
              <span className="text-xs text-text-secondary ml-auto">{materialDiscrepancies.length} loại</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-zen text-text-secondary text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Mã</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Tên</th>
                    <th className="text-center p-2 font-medium whitespace-nowrap">ĐVT</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Đơn giá</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Số lượng</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Thành tiền</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">SL đúng</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">TT đúng</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Chênh lệch</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">TT chênh lệch</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {materialDiscrepancies.map((d: any) => {
                    const isOver = d.diffQty > 0;
                    const isUnder = d.diffQty < 0;
                    return (
                      <tr key={d.materialId} className="border-t border-surface-zen hover:bg-surface-zen/30">
                        <td className="p-2 text-xs font-mono whitespace-nowrap">{d.sku}</td>
                        <td className="p-2 font-medium whitespace-nowrap">{d.materialName}</td>
                        <td className="p-2 text-center text-text-secondary whitespace-nowrap">{d.unit}</td>
                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(d.price)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{d.calculatedQty.toFixed(2)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(d.calculatedAmount)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{d.actualQty.toFixed(2)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(d.actualAmount)}</td>
                        <td className={`p-2 text-right font-bold whitespace-nowrap ${isOver ? 'text-error-zen' : isUnder ? 'text-success-zen' : ''}`}>
                          {d.diffQty > 0 ? '+' : ''}{d.diffQty.toFixed(2)}
                        </td>
                        <td className={`p-2 text-right font-bold whitespace-nowrap ${isOver ? 'text-error-zen' : isUnder ? 'text-success-zen' : ''}`}>
                          {d.diffAmount > 0 ? '+' : ''}{formatCurrency(d.diffAmount)}
                        </td>
                        <td className="p-2 text-text-secondary text-xs max-w-[120px] truncate whitespace-nowrap">{d.note}</td>
                      </tr>
                    );
                  })}
                  {materialDiscrepancies.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Góc dưới trái: Nguyên liệu (hệ thống) */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-surface-zen">
            <div className="flex items-center space-x-2 mb-4">
              <ClipboardList size={18} className="text-primary" />
              <h3 className="font-bold text-primary-dark">Nguyên liệu (hệ thống)</h3>
              <span className="text-xs text-text-secondary ml-auto">{calculatedMaterials.length} loại</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-zen text-text-secondary text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Mã</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Tên</th>
                    <th className="text-center p-2 font-medium whitespace-nowrap">ĐVT</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Số lượng</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Đơn giá</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Thành tiền</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedMaterials.map((m: any) => (
                    <tr key={m.materialId} className="border-t border-surface-zen hover:bg-surface-zen/30">
                      <td className="p-2 text-xs font-mono whitespace-nowrap">{m.sku}</td>
                      <td className="p-2 font-medium whitespace-nowrap">{m.materialName}</td>
                      <td className="p-2 text-center text-text-secondary whitespace-nowrap">{m.unit}</td>
                      <td className="p-2 text-right font-bold text-primary whitespace-nowrap">{m.quantity.toFixed(2)}</td>
                      <td className="p-2 text-right whitespace-nowrap">{formatCurrency(m.price)}</td>
                      <td className="p-2 text-right font-bold whitespace-nowrap">{formatCurrency(m.amount)}</td>
                      <td className="p-2 text-text-secondary text-xs max-w-[120px] truncate whitespace-nowrap">{m.note}</td>
                    </tr>
                  ))}
                  {calculatedMaterials.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Góc dưới phải: Nguyên liệu đã xuất (thực tế) */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-surface-zen">
            <div className="flex items-center space-x-2 mb-4">
              <Beaker size={18} className="text-accent" />
              <h3 className="font-bold text-primary-dark">Nguyên liệu đã xuất (thực tế)</h3>
              <span className="text-xs text-text-secondary ml-auto">{actualExportedMaterials.length} loại</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-zen text-text-secondary text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Mã</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Tên</th>
                    <th className="text-center p-2 font-medium whitespace-nowrap">ĐVT</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Số lượng dùng</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Đơn giá</th>
                    <th className="text-right p-2 font-medium whitespace-nowrap">Thành tiền</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {actualExportedMaterials.map((m: any) => (
                    <tr key={m.materialId} className="border-t border-surface-zen hover:bg-surface-zen/30">
                      <td className="p-2 text-xs font-mono whitespace-nowrap">{m.sku}</td>
                      <td className="p-2 font-medium whitespace-nowrap">{m.materialName}</td>
                      <td className="p-2 text-center text-text-secondary whitespace-nowrap">{m.unit}</td>
                      <td className="p-2 text-right font-bold text-accent whitespace-nowrap">{m.quantity.toFixed(2)}</td>
                      <td className="p-2 text-right whitespace-nowrap">{formatCurrency(m.price)}</td>
                      <td className="p-2 text-right font-bold whitespace-nowrap">{formatCurrency(m.amount)}</td>
                      <td className="p-2 text-text-secondary text-xs max-w-[120px] truncate whitespace-nowrap">{m.note}</td>
                    </tr>
                  ))}
                  {actualExportedMaterials.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
