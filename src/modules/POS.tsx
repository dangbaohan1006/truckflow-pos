import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, Check,
  CreditCard, Printer, FileText, Percent, Banknote, QrCode,
  Store, Truck as TruckIcon, AlertTriangle, Package, Utensils,
} from 'lucide-react';
import { database } from '../database/index.js';
import MenuItem from '../database/models/MenuItem.js';
import MenuIngredient from '../database/models/MenuIngredient.js';
import InventoryItem from '../database/models/InventoryItem.js';
import SalesOrder from '../database/models/SalesOrder.js';
import SalesOrderLine from '../database/models/SalesOrderLine.js';
import StockMovement from '../database/models/StockMovement.js';
import TruckModel from '../database/models/Truck.js';
import { formatCurrency, formatDateTime, generateId } from '../shared/utils.js';
import { Modal, Input } from '../shared/components.js';
import { useToast } from '../shared/ToastContext.js';

export default function POS() {
  const toast = useToast();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuIngredients, setMenuIngredients] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState('0');
  const [note, setNote] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [selectedTruck, setSelectedTruck] = useState('');

  useEffect(() => {
    const sub1 = database.get<MenuItem>('menu_items').query().observe().subscribe(setMenuItems);
    const sub2 = database.get<MenuIngredient>('menu_ingredients').query().observe().subscribe(setMenuIngredients);
    const sub3 = database.get<InventoryItem>('inventory_items').query().observe().subscribe(setInventoryItems);
    const sub4 = database.get<TruckModel>('trucks').query().observe().subscribe(setTrucks);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); sub4.unsubscribe(); };
  }, []);

  // Only show active menu items
  const activeMenuItems = useMemo(() => menuItems.filter((i: any) => i.isActive !== false), [menuItems]);

  const categories = useMemo(() => {
    const cats = new Set(activeMenuItems.filter((i: any) => i.category).map((i: any) => i.category));
    return ['all', ...Array.from(cats)];
  }, [activeMenuItems]);

  const filteredItems = useMemo(() => {
    return activeMenuItems.filter((item: any) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [activeMenuItems, searchTerm, selectedCategory]);

  const addToCart = (item: any) => {
    const existing = cart.find((c: any) => c.menuItemId === item.id);
    if (existing) {
      setCart(cart.map((c: any) => c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, {
        id: generateId(), menuItemId: item.id, productName: item.name,
        price: parseFloat(item.price || '0'), qty: 1,
        defaultDiscount: parseFloat(item.defaultDiscount || '0'),
      }]);
    }
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart(cart.map((c: any) => {
      if (c.menuItemId !== menuItemId) return c;
      const newQty = Math.max(0, c.qty + delta);
      return { ...c, qty: newQty };
    }).filter((c: any) => c.qty > 0));
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(cart.filter((c: any) => c.menuItemId !== menuItemId));
  };

  const subtotal = useMemo(() => cart.reduce((acc: number, curr: any) => acc + (curr.price * curr.qty), 0), [cart]);
  const discountAmount = useMemo(() => subtotal * (parseFloat(discount) / 100), [subtotal, discount]);
  const total = subtotal - discountAmount;

  const processPayment = async () => {
    const orderId = generateId();
    const now = Date.now();
    const cashRec = parseFloat(cashReceived) || 0;
    const change = paymentMethod === 'cash' ? Math.max(0, cashRec - total) : 0;

    // Check ingredients (BOM) for each menu item in cart
    const missingMaterials: string[] = [];

    // Determine which inventory to check: if a truck is selected, check truck inventory
    const truckInv = selectedTruck
      ? inventoryItems.filter((i: any) => i.locationType === 'TRUCK' && i.truckId === selectedTruck)
      : inventoryItems;

    for (const cartItem of cart) {
      const ingredients = menuIngredients.filter((ing: any) => ing.menuItemId === cartItem.menuItemId);
      for (const ing of ingredients) {
        const neededQty = parseFloat(ing.quantity) * cartItem.qty;
        // Check in truck inventory first, then main warehouse
        let material = truckInv.find((i: any) => i.id === ing.materialId);
        if (!material) {
          material = inventoryItems.find((i: any) => i.id === ing.materialId);
        }
        if (material && parseFloat(material.quantity) < neededQty) {
          missingMaterials.push(`${ing.materialName} (cần ${neededQty} ${ing.unit}, tồn ${material.quantity} ${material.unit})`);
        } else if (!material) {
          missingMaterials.push(`${ing.materialName} (cần ${neededQty} ${ing.unit}, không có trong kho)`);
        }
      }
    }

    if (missingMaterials.length > 0) {
      toast.warning(`Thiếu nguyên liệu:\n${missingMaterials.join('\n')}`, 6000);
      return;
    }

    await database.write(async () => {
      await database.get<SalesOrder>('pos_order').create((o: any) => {
        o._raw.id = orderId;
        o.totalAmount = total.toFixed(2);
        o.status = 'COMPLETED';
        o.paymentMethod = paymentMethod;
        o.cashReceived = cashRec.toFixed(2);
        o.changeAmount = change.toFixed(2);
        o.discount = discount;
        o.note = note;
        o.truckId = selectedTruck || 'TRUCK-001';
        o.createdAt = now;
        o.updatedAt = now;
      });

      for (const item of cart) {
        await database.get<SalesOrderLine>('pos_order_line').create((line: any) => {
          line._raw.id = generateId();
          line.orderId = orderId;
          line.productId = item.menuItemId;
          line.productName = item.productName;
          line.quantity = item.qty.toString();
          line.price = item.price.toFixed(2);
          line.subtotal = (item.price * item.qty).toFixed(2);
          line.createdAt = now;
          line.updatedAt = now;
        });

        // Deduct ingredients (materials) from truck inventory
        const ingredients = menuIngredients.filter((ing: any) => ing.menuItemId === item.menuItemId);
        for (const ing of ingredients) {
          const neededQty = parseFloat(ing.quantity) * item.qty;
          let matItem = selectedTruck
            ? inventoryItems.find((i: any) => i.id === ing.materialId && i.locationType === 'TRUCK' && i.truckId === selectedTruck)
            : null;
          if (!matItem) {
            matItem = inventoryItems.find((i: any) => i.id === ing.materialId);
          }
          if (matItem) {
            const newMatQty = Math.max(0, parseFloat(matItem.quantity) - neededQty);
            await matItem.update((i: any) => { i.quantity = newMatQty.toString(); });
          }
        }

        await database.get<StockMovement>('stock_movements').create((m: any) => {
          m._raw.id = generateId();
          m.itemId = item.menuItemId;
          m.itemName = item.productName;
          m.quantity = (-item.qty).toString();
          m.type = 'SALE';
          m.referenceId = orderId;
          m.note = `Bán hàng - Đơn ${orderId.slice(-6)}`;
          m.createdAt = now;
          m.updatedAt = now;
        });
      }
    });

    setLastOrder({ id: orderId, items: cart, total, paymentMethod, cashReceived: cashRec, change, discount, note, date: now });
    setCart([]);
    setCashReceived('');
    setDiscount('0');
    setNote('');
    setShowPayment(false);
    setShowReceipt(true);
    toast.success(`Thanh toán thành công! Mã đơn: ${orderId.slice(-8).toUpperCase()}`, 4000);
  };

  const printReceipt = () => {
    if (!lastOrder) return;
    (async () => {
      const lines: string[] = [];
      lines.push('TRUCKFLOW POS');
      lines.push(formatDateTime(lastOrder.date));
      lines.push('Mã đơn: ' + lastOrder.id.slice(-8).toUpperCase());
      lines.push('-------------------------------');
      lastOrder.items.forEach((i: any) => {
        lines.push(`${i.productName} x${i.qty}`);
        lines.push(`${formatCurrency(i.price)}  ${formatCurrency(i.price * i.qty)}`);
      });
      lines.push('-------------------------------');
      lines.push('Tổng: ' + formatCurrency(lastOrder.total));
      if (lastOrder.discount && parseFloat(lastOrder.discount) > 0) {
        lines.push('Giảm giá: ' + lastOrder.discount + '%');
      }
      lines.push('Phương thức: ' + (lastOrder.paymentMethod === 'cash' ? 'Tiền mặt' : lastOrder.paymentMethod === 'card' ? 'Thẻ' : 'QR'));
      if (lastOrder.paymentMethod === 'cash') {
        lines.push('Tiền khách: ' + formatCurrency(lastOrder.cashReceived));
        lines.push('Tiền thừa: ' + formatCurrency(lastOrder.change));
      }
      lines.push('');
      lines.push('Cảm ơn quý khách!');

      // Try to read printer config from localStorage, else let server use default env config
      let printer = null;
      try {
        const cfg = localStorage.getItem('printerConfig');
        if (cfg) printer = JSON.parse(cfg);
      } catch (err) { /* ignore */ }

      try {
        const res = await fetch('/api/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printer, lines }),
        });
        if (!res.ok) {
          const text = await res.text();
          toast.warning('In lỗi: ' + (text || res.statusText));
          // fallback to window.print
          const w = window.open('', '_blank', 'width=300,height=600');
          if (!w) return;
          w.document.write('<pre style="font-family: monospace;">' + lines.join('\n') + '</pre>');
          w.document.close();
          w.print();
          w.close();
          return;
        }
        toast.success('Lệnh in đã gửi');
      } catch (err: any) {
        toast.warning('Không thể kết nối máy in: sử dụng in trình duyệt');
        const w = window.open('', '_blank', 'width=300,height=600');
        if (!w) return;
        w.document.write('<pre style="font-family: monospace;">' + lines.join('\n') + '</pre>');
        w.document.close();
        w.print();
        w.close();
      }
    })();
  };

  return (
    <div className="flex h-full space-x-6">
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input type="text" placeholder="Tìm kiếm món..." value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-zen rounded-lg focus:ring-2 focus:ring-primary/30 outline-none" />
          </div>
          <select value={selectedTruck} onChange={(e: any) => setSelectedTruck(e.target.value)}
            className="px-3 py-2 border border-surface-zen rounded-lg text-sm bg-white outline-none">
            <option value="">Kho tổng</option>
            {trucks.filter((t: any) => t.status === 'ACTIVE').map((t: any) => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {categories.map((cat: string) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-primary text-white shadow-sm' : 'bg-white border border-surface-zen text-text-secondary hover:border-primary/30'}`}>
              {cat === 'all' ? 'Tất cả' : cat}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            {filteredItems.map((item: any) => (
              <motion.button whileTap={{ scale: 0.95 }} key={item.id} onClick={() => addToCart(item)}
                className="p-4 bg-white rounded-xl shadow-sm border border-gray-200/50 flex flex-col items-center space-y-2 hover:shadow-md transition-all hover:border-primary/30">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold">
                  <Utensils size={24} />
                </div>
                <span className="font-semibold text-text-main text-sm text-center">{item.name}</span>
                <span className="text-sm font-bold text-accent">{formatCurrency(parseFloat(item.price || '0'))}</span>
                {item.defaultDiscount && parseFloat(item.defaultDiscount) > 0 && (
                  <span className="text-xs text-success-zen">Giảm {item.defaultDiscount}%</span>
                )}
              </motion.button>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">
                {searchTerm ? 'Không tìm thấy món' : 'Chưa có món nào trong menu'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-96 bg-white rounded-2xl shadow-xl flex flex-col border border-surface-zen">
        <div className="p-6 pb-4 border-b border-surface-zen">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="text-accent" />
            <h2 className="text-xl font-bold text-primary-dark">Đơn hàng</h2>
            {cart.length > 0 && <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">{cart.length} món</span>}
          </div>
          {selectedTruck && (
            <div className="mt-2 flex items-center space-x-1 text-xs text-primary bg-primary/5 px-2 py-1 rounded-lg">
              <TruckIcon size={12} />
              <span>{trucks.find((t: any) => t.id === selectedTruck)?.name || 'Xe'}</span>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map((item: any) => (
            <div key={item.menuItemId} className="bg-surface-zen rounded-xl p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-medium text-text-main">{item.productName}</p>
                  <p className="text-xs text-text-secondary">{formatCurrency(item.price)} / đơn vị</p>
                </div>
                <button onClick={() => removeFromCart(item.menuItemId)} className="text-error-zen/50 hover:text-error-zen p-1"><Trash2 size={14} /></button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 bg-white rounded-lg border border-surface-zen">
                  <button onClick={() => updateQty(item.menuItemId, -1)} className="p-1.5 hover:bg-surface-zen rounded-l-lg"><Minus size={14} /></button>
                  <span className="px-3 font-bold text-text-main min-w-[30px] text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.menuItemId, 1)} className="p-1.5 hover:bg-surface-zen rounded-r-lg"><Plus size={14} /></button>
                </div>
                <span className="font-bold text-accent">{formatCurrency(item.price * item.qty)}</span>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-12 text-text-secondary/50">
              <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
              <p>Giỏ hàng trống</p>
              <p className="text-xs mt-1">Chọn món từ menu để bắt đầu</p>
            </div>
          )}
        </div>
        <div className="p-6 pt-4 border-t border-surface-zen space-y-3">
          <div className="flex items-center space-x-2">
            <Percent size={16} className="text-text-secondary" />
            <input type="number" placeholder="Giảm giá %" value={discount} onChange={(e: any) => setDiscount(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-surface-zen rounded-lg outline-none" />
          </div>
          <div className="flex items-center space-x-2">
            <FileText size={16} className="text-text-secondary" />
            <input type="text" placeholder="Ghi chú..." value={note} onChange={(e: any) => setNote(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-surface-zen rounded-lg outline-none" />
          </div>
          <div className="flex justify-between text-lg font-bold pt-2">
            <span>Tổng cộng</span>
            <span className="text-accent">{formatCurrency(total)}</span>
          </div>
          <button disabled={cart.length === 0} onClick={() => setShowPayment(true)}
            className="w-full py-4 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none">
            THANH TOÁN - {formatCurrency(total)}
          </button>
        </div>
      </div>

      {showPayment && (
        <Modal title="Thanh toán" onClose={() => setShowPayment(false)}>
          <div className="space-y-4">
            <div className="bg-surface-zen rounded-xl p-4">
              <div className="flex justify-between text-lg"><span>Tổng tiền:</span><span className="font-bold text-accent">{formatCurrency(total)}</span></div>
              {parseFloat(discount) > 0 && <div className="flex justify-between text-sm text-text-secondary mt-1"><span>Giảm giá ({discount}%):</span><span>-{formatCurrency(discountAmount)}</span></div>}
            </div>
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-2">Phương thức thanh toán</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'cash', label: 'Tiền mặt', icon: Banknote },
                  { value: 'card', label: 'Thẻ', icon: CreditCard },
                  { value: 'qr', label: 'QR Code', icon: QrCode },
                ].map((pm: any) => (
                  <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${paymentMethod === pm.value ? 'border-primary bg-primary/5 text-primary-dark' : 'border-surface-zen text-text-secondary hover:border-primary/30'}`}>
                    <pm.icon size={24} className="mb-1" /><span className="text-xs font-medium">{pm.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {paymentMethod === 'cash' && (
              <Input label="Tiền khách đưa" type="number" value={cashReceived} onChange={(e: any) => setCashReceived(e.target.value)} placeholder="Nhập số tiền..." />
            )}
            {paymentMethod === 'cash' && parseFloat(cashReceived) > 0 && (
              <div className="bg-success-zen/10 text-success-zen p-3 rounded-lg text-sm">
                Tiền thừa: <strong>{formatCurrency(Math.max(0, parseFloat(cashReceived) - total))}</strong>
              </div>
            )}
            <button onClick={processPayment} disabled={paymentMethod === 'cash' && parseFloat(cashReceived) < total}
              className="w-full py-4 bg-accent text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all disabled:opacity-50">
              XÁC NHẬN THANH TOÁN
            </button>
          </div>
        </Modal>
      )}

      {showReceipt && lastOrder && (
        <Modal title="Hóa đơn thanh toán" onClose={() => setShowReceipt(false)}>
          <div className="space-y-4">
            <div className="bg-success-zen/10 text-success-zen p-4 rounded-xl text-center">
              <Check size={40} className="mx-auto mb-2" />
              <p className="font-bold text-lg">Thanh toán thành công!</p>
              <p className="text-sm">Mã đơn: {lastOrder.id.slice(-8).toUpperCase()}</p>
            </div>
            <div className="border-t pt-4 space-y-2">
              {lastOrder.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.productName} x{item.qty}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold"><span>Tổng cộng</span><span className="text-accent">{formatCurrency(lastOrder.total)}</span></div>
              <div className="text-xs text-text-secondary">
                <p>Thanh toán: {lastOrder.paymentMethod === 'cash' ? 'Tiền mặt' : lastOrder.paymentMethod === 'card' ? 'Thẻ' : 'QR Code'}</p>
                {lastOrder.paymentMethod === 'cash' && (<><p>Tiền khách: {formatCurrency(lastOrder.cashReceived)}</p><p>Tiền thừa: {formatCurrency(lastOrder.change)}</p></>)}
              </div>
            </div>
            <div className="flex space-x-3">
              <button onClick={printReceipt} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center justify-center space-x-2">
                <Printer size={18} /><span>In hóa đơn</span>
              </button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 py-3 border border-surface-zen text-text-secondary rounded-xl font-medium hover:bg-surface-zen transition-all">Đóng</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
