import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart, Plus, Minus, Trash2, Send, Utensils,
  User, Phone, Table, CheckCircle, Clock, AlertCircle,
  Search, ChevronUp, ChevronDown,
} from 'lucide-react';
import { database } from '../database/index.js';
import MenuItem from '../database/models/MenuItem.js';
import { formatCurrency, generateId } from '../shared/utils.js';
import { createCustomerOrder } from '../database/customerOrderApi.js';

function getTableFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('table') || '1';
}

export default function CustomerOrder() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCart, setShowCart] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [showInfoForm, setShowInfoForm] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  const tableNumber = getTableFromUrl();

  useEffect(() => {
    const sub = database.get<MenuItem>('menu_items').query().observe().subscribe(setMenuItems);
    return () => sub.unsubscribe();
  }, []);

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
  const totalItems = useMemo(() => cart.reduce((sum: number, c: any) => sum + c.qty, 0), [cart]);

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) { setOrderError('Vui lòng nhập tên của bạn'); return; }
    if (cart.length === 0) { setOrderError('Vui lòng chọn món'); return; }

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
        setShowCart(false);
      } else {
        setOrderError(result.message || 'Có lỗi xảy ra, vui lòng thử lại');
      }
    } catch (e: any) {
      setOrderError(e.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ──────────────────────────────────────────
  if (orderSuccess) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--color-primary, #f97316) 0%, #fff7ed 40%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ background: '#fff', borderRadius: '24px', padding: '36px 28px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
        >
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={40} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Đặt món thành công!</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
            Cảm ơn <strong>{customerName}</strong> đã đặt món tại <strong>Bàn {tableNumber}</strong>
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>Nhân viên sẽ đến xác nhận đơn ngay. Vui lòng chờ trong giây lát!</p>
          <button
            onClick={() => { setOrderSuccess(false); setShowInfoForm(true); setCart([]); }}
            style={{ width: '100%', padding: '14px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
          >
            Đặt món mới
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Info Form ────────────────────────────────────────────────
  if (showInfoForm) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff7ed 0%, #fff 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: '#fff', borderRadius: '24px', padding: '36px 28px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '64px', height: '64px', background: '#fff7ed', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Utensils size={30} color="#f97316" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Chào mừng đến với</h1>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#f97316', marginBottom: '10px' }}>TruckFlow</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fff7ed', color: '#f97316', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
              <Table size={13} /> Bàn {tableNumber}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <User size={13} /> Tên của bạn *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                autoFocus
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                onFocus={(e) => e.target.style.borderColor = '#f97316'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Phone size={13} /> Số điện thoại
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Không bắt buộc..."
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                onFocus={(e) => e.target.style.borderColor = '#f97316'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <button
              onClick={() => { if (!customerName.trim()) return; setShowInfoForm(false); }}
              disabled={!customerName.trim()}
              style={{ width: '100%', padding: '15px', background: customerName.trim() ? '#f97316' : '#e2e8f0', color: customerName.trim() ? '#fff' : '#94a3b8', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '16px', cursor: customerName.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            >
              Bắt đầu gọi món →
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main Ordering Interface ──────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>

      {/* ── STICKY HEADER ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#fff', borderBottom: '1px solid #f1f5f9' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: '#f97316', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Utensils size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', lineHeight: 1.2 }}>TruckFlow</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{customerName}</span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Table size={10} />Bàn {tableNumber}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowInfoForm(true)}
            style={{ fontSize: '12px', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}
          >
            Đổi thông tin
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '0 16px 10px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '28px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Tìm món..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 38px', background: '#f8f9fa', border: '1.5px solid #f1f5f9', borderRadius: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1e293b' }}
          />
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 16px 12px', scrollbarWidth: 'none' }}>
          {categories.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: selectedCategory === cat ? 'none' : '1.5px solid #e2e8f0',
                background: selectedCategory === cat ? '#f97316' : '#fff',
                color: selectedCategory === cat ? '#fff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              {cat === 'all' ? 'Tất cả' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── MENU LIST ── */}
      {/* Bottom padding for sticky bar */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', paddingBottom: cart.length > 0 ? '88px' : '16px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
            <Utensils size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: '14px' }}>{searchTerm ? 'Không tìm thấy món' : 'Chưa có món nào trong menu'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredItems.map((item: any) => {
              const cartItem = cart.find((c: any) => c.menuItemId === item.id);
              const qty = cartItem?.qty || 0;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ background: '#fff', borderRadius: '14px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: qty > 0 ? '1.5px solid #f97316' : '1.5px solid transparent' }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: '52px', height: '52px', background: '#fff7ed', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Utensils size={22} color="#f97316" />
                  </div>

                  {/* Name & Price */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#f97316' }}>{formatCurrency(parseFloat(item.price || '0'))}</p>
                  </div>

                  {/* Qty control */}
                  {qty > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Minus size={13} color="#64748b" />
                      </button>
                      <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{qty}</span>
                      <button
                        onClick={() => addToCart(item)}
                        style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Plus size={13} color="#fff" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}
                    >
                      <Plus size={18} color="#fff" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── STICKY BOTTOM BAR ── */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', zIndex: 40, background: '#fff', borderTop: '1px solid #f1f5f9', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}
          >
            {/* Cart drawer */}
            <AnimatePresence>
              {showCart && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '12px 16px 8px', maxHeight: '240px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      {cart.map((item: any) => (
                        <div key={item.menuItemId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f8f9fa', borderRadius: '10px' }}>
                          <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => updateQty(item.menuItemId, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <Minus size={11} color="#64748b" />
                            </button>
                            <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>{item.qty}</span>
                            <button onClick={() => updateQty(item.menuItemId, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <Plus size={11} color="#fff" />
                            </button>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f97316', minWidth: '70px', textAlign: 'right' }}>{formatCurrency(item.price * item.qty)}</span>
                          <button onClick={() => removeFromCart(item.menuItemId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#cbd5e1' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Note */}
                    <input
                      type="text"
                      placeholder="Ghi chú cho món..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1e293b' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {orderError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', color: '#dc2626', padding: '8px 16px', fontSize: '13px' }}>
                <AlertCircle size={14} />
                <span>{orderError}</span>
              </div>
            )}

            {/* Bottom action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px 14px' }}>
              {/* Summary pill (toggle cart) */}
              <button
                onClick={() => setShowCart(!showCart)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '9px 12px', cursor: 'pointer' }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <ShoppingCart size={18} color="#f97316" />
                  <span style={{ position: 'absolute', top: '-6px', right: '-8px', background: '#f97316', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalItems}</span>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1 }}>Đã chọn {totalItems} món</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f97316', lineHeight: 1.4 }}>{formatCurrency(subtotal)}</div>
                </div>
                {showCart ? <ChevronDown size={14} color="#f97316" /> : <ChevronUp size={14} color="#f97316" />}
              </button>

              {/* Send button */}
              <button
                disabled={submitting}
                onClick={handleSubmitOrder}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 18px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.4)', opacity: submitting ? 0.7 : 1, whiteSpace: 'nowrap' }}
              >
                {submitting ? <Clock size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                {submitting ? 'Đang gửi...' : 'GỬI ĐƠN'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
