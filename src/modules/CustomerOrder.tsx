import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ShoppingCart, Plus, Minus, Trash2, Send, Utensils,
  User, Phone, Table, CheckCircle, Clock, AlertCircle,
  ChevronLeft, Search,
} from 'lucide-react';
import { database } from '../database/index.js';
import MenuItem from '../database/models/MenuItem.js';
import { formatCurrency, generateId } from '../shared/utils.js';
import { createCustomerOrder } from '../database/customerOrderApi.js';

// Get table number from URL params
function getTableFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('table') || '1';
}

export default function CustomerOrder() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [showInfoForm, setShowInfoForm] = useState(true);

  // Order state
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  const tableNumber = getTableFromUrl();

  useEffect(() => {
    const sub = database.get<MenuItem>('menu_items').query().observe().subscribe(setMenuItems);
    return () => sub.unsubscribe();
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

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      setOrderError('Vui lòng nhập tên của bạn');
      return;
    }
    if (cart.length === 0) {
      setOrderError('Vui lòng chọn món');
      return;
    }

    setSubmitting(true);
    setOrderError('');

    try {
      const result = await createCustomerOrder({
        table_number: tableNumber,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        note: note.trim(),
        truck_id: '',
        items: cart.map((item: any) => ({
          menu_item_id: item.menuItemId,
          product_name: item.productName,
          quantity: item.qty,
          price: item.price,
          note: '',
        })),
      });

      if (result.success) {
        setOrderSuccess(true);
        setCart([]);
      } else {
        setOrderError(result.message || 'Có lỗi xảy ra, vui lòng thử lại');
      }
    } catch (e: any) {
      setOrderError(e.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  // If order was submitted successfully, show success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-success-zen/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={48} className="text-success-zen" />
          </div>
          <h2 className="text-2xl font-bold text-primary-dark mb-2">Đặt món thành công!</h2>
          <p className="text-text-secondary mb-4">
            Cảm ơn {customerName} đã đặt món tại <strong>Bàn {tableNumber}</strong>
          </p>
          <div className="bg-surface-zen rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm font-medium text-text-secondary">Món đã gọi:</p>
            {cart.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{item.productName} x{item.qty}</span>
                <span className="font-medium">{formatCurrency(item.price * item.qty)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Tạm tính</span>
              <span className="text-accent">{formatCurrency(subtotal)}</span>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Nhân viên sẽ đến xác nhận đơn ngay. Vui lòng chờ trong giây lát!
          </p>
          <button
            onClick={() => {
              setOrderSuccess(false);
              setShowInfoForm(true);
              setCart([]);
            }}
            className="mt-6 w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all"
          >
            Đặt món mới
          </button>
        </motion.div>
      </div>
    );
  }

  // Customer info form
  if (showInfoForm) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Utensils size={32} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-primary-dark">Chào mừng đến với</h1>
            <p className="text-lg font-semibold text-accent">TruckFlow</p>
            <div className="mt-2 inline-flex items-center space-x-1 bg-primary/5 text-primary px-3 py-1 rounded-full text-sm">
              <Table size={14} />
              <span>Bàn {tableNumber}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">
                <User size={14} className="inline mr-1" />Tên của bạn *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full px-4 py-3 border border-surface-zen rounded-xl focus:ring-2 focus:ring-primary/30 outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">
                <Phone size={14} className="inline mr-1" />Số điện thoại
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Nhập số điện thoại (không bắt buộc)..."
                className="w-full px-4 py-3 border border-surface-zen rounded-xl focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
            <button
              onClick={() => {
                if (!customerName.trim()) return;
                setShowInfoForm(false);
              }}
              disabled={!customerName.trim()}
              className="w-full py-4 bg-accent text-white rounded-xl font-bold text-lg shadow-lg hover:bg-primary-dark transition-all disabled:opacity-50"
            >
              Bắt đầu gọi món
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main ordering interface
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-surface-zen px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <Utensils size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-primary-dark">TruckFlow</h1>
              <div className="flex items-center space-x-2 text-xs text-text-secondary">
                <span>{customerName}</span>
                <span>•</span>
                <span className="flex items-center"><Table size={10} className="mr-0.5" />Bàn {tableNumber}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowInfoForm(true)}
            className="text-xs text-primary hover:text-primary-dark"
          >
            Đổi thông tin
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-4">
        {/* Menu Items */}
        <div className="flex-1 flex flex-col space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Tìm món..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-surface-zen rounded-xl focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          {/* Categories */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {categories.map((cat: string) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white border border-surface-zen text-text-secondary hover:border-accent/30'
                }`}
              >
                {cat === 'all' ? 'Tất cả' : cat}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredItems.map((item: any) => (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="p-4 bg-white rounded-2xl shadow-sm border border-gray-200/50 flex flex-col items-center space-y-2 hover:shadow-md transition-all hover:border-accent/30"
                >
                  <div className="w-14 h-14 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xl font-bold">
                    <Utensils size={24} />
                  </div>
                  <span className="font-semibold text-text-main text-sm text-center line-clamp-2">{item.name}</span>
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

        {/* Cart */}
        <div className="lg:w-80 bg-white rounded-2xl shadow-xl flex flex-col border border-surface-zen lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <div className="p-4 pb-3 border-b border-surface-zen">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="text-accent" size={20} />
              <h2 className="text-lg font-bold text-primary-dark">Giỏ hàng</h2>
              {cart.length > 0 && (
                <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                  {cart.reduce((sum: number, c: any) => sum + c.qty, 0)} món
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.map((item: any) => (
              <div key={item.menuItemId} className="bg-surface-zen rounded-xl p-3">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-text-main text-sm flex-1">{item.productName}</p>
                  <button onClick={() => removeFromCart(item.menuItemId)} className="text-error-zen/50 hover:text-error-zen p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 bg-white rounded-lg border border-surface-zen">
                    <button onClick={() => updateQty(item.menuItemId, -1)} className="p-1.5 hover:bg-surface-zen rounded-l-lg">
                      <Minus size={14} />
                    </button>
                    <span className="px-3 font-bold text-text-main min-w-[24px] text-center text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.menuItemId, 1)} className="p-1.5 hover:bg-surface-zen rounded-r-lg">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="font-bold text-accent text-sm">{formatCurrency(item.price * item.qty)}</span>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center py-8 text-text-secondary/50">
                <ShoppingCart size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Giỏ hàng trống</p>
                <p className="text-xs mt-1">Chọn món từ menu</p>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="px-3 pb-2">
            <input
              type="text"
              placeholder="Ghi chú cho món..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-zen rounded-xl outline-none"
            />
          </div>

          {/* Total & Submit */}
          <div className="p-4 pt-3 border-t border-surface-zen space-y-3">
            <div className="flex justify-between text-base font-bold">
              <span>Tạm tính</span>
              <span className="text-accent">{formatCurrency(subtotal)}</span>
            </div>

            {orderError && (
              <div className="flex items-center space-x-2 text-error-zen bg-error-zen/5 p-2 rounded-lg text-sm">
                <AlertCircle size={14} />
                <span>{orderError}</span>
              </div>
            )}

            <button
              disabled={cart.length === 0 || submitting}
              onClick={handleSubmitOrder}
              className="w-full py-4 bg-accent text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <Clock size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
              <span>{submitting ? 'Đang gửi...' : `GỬI ĐƠN - ${formatCurrency(subtotal)}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
