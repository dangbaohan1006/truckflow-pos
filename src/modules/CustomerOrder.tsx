import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart, Plus, Minus, Trash2, Send, Utensils,
  User, Phone, Table, CheckCircle, Clock, AlertCircle,
  Search, ChevronUp, ChevronDown, Sparkles, Flame, Edit
} from 'lucide-react';
import { database } from '../database/index.js';
import MenuItem from '../database/models/MenuItem.js';
import { formatCurrency, generateId } from '../shared/utils.js';
import { createCustomerOrder } from '../database/customerOrderApi.js';

// Zen-themed color design tokens
const colors = {
  primary: '#8E9775',      // Sage Green
  primaryDark: '#4A5D23',  // Forest Green
  accent: '#E28413',       // Warm Amber
  background: '#FDFCF8',   // Sand / Cream White
  surface: '#F4F2EB',      // Soft Grey-Beige
  textMain: '#23281B',     // Charcoal Olive
  textSecondary: '#6B705C',// Muted Sage Gray
  success: '#5B8C5A',      // Soft Leaf Green
  error: '#BC4749',        // Soft Brick Red
  warning: '#DDA15E',      // Warm Ochre
};

// Elegant beverage gradients & matching emojis based on category
const getCategoryStyles = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('cà phê') || cat.includes('cafe')) {
    return {
      gradient: 'linear-gradient(135deg, #E6D7CB 0%, #A98A73 100%)',
      color: '#5c3a21',
      emoji: '☕'
    };
  }
  if (cat.includes('sữa') || cat.includes('trà')) {
    return {
      gradient: 'linear-gradient(135deg, #FFEAD2 0%, #D4A373 100%)',
      color: '#8B5A2B',
      emoji: '🧋'
    };
  }
  if (cat.includes('ép') || cat.includes('cam') || cat.includes('chanh')) {
    return {
      gradient: 'linear-gradient(135deg, #FFF2B2 0%, #F4A261 100%)',
      color: '#d46a00',
      emoji: '🍊'
    };
  }
  if (cat.includes('sinh tố') || cat.includes('matcha') || cat.includes('bơ')) {
    return {
      gradient: 'linear-gradient(135deg, #E8F5E9 0%, #81C784 100%)',
      color: '#2E7D32',
      emoji: '🥑'
    };
  }
  if (cat.includes('bánh') || cat.includes('ăn') || cat.includes('ngọt')) {
    return {
      gradient: 'linear-gradient(135deg, #FFE8EC 0%, #E57373 100%)',
      color: '#B71C1C',
      emoji: '🍰'
    };
  }
  // Default fallback style
  return {
    gradient: 'linear-gradient(135deg, #ECEFF1 0%, #90A4AE 100%)',
    color: '#37474F',
    emoji: '✨'
  };
};

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

  // Load products from DB
  useEffect(() => {
    const sub = database.get<MenuItem>('menu_items').query().observe().subscribe(setMenuItems);
    return () => sub.unsubscribe();
  }, []);

  // Premium fallback mock menu items if DB is empty
  const displayMenuItems = useMemo(() => {
    if (menuItems.length > 0) return menuItems;

    return [
      { id: 'mock-1', name: 'Cà phê Sữa Đá', price: '29000', category: 'Cà phê', unit: 'Ly', defaultDiscount: '0', isActive: true, isPopular: true, description: 'Cà phê rang xay Robusta Đắk Lắk đậm đà kết hợp sữa đặc ngọt béo đặc trưng.' },
      { id: 'mock-2', name: 'Trà Đào Cam Sả', price: '32000', category: 'Trà sữa & Trà', unit: 'Ly', defaultDiscount: '5', isActive: true, isPopular: true, description: 'Trà đen thanh mát ướp hương sả thơm cay dịu, kết hợp cùng đào ngâm và cam tươi.' },
      { id: 'mock-3', name: 'Bạc Xỉu Sài Gòn', price: '29000', category: 'Cà phê', unit: 'Ly', defaultDiscount: '0', isActive: true, description: 'Nhiều sữa đặc béo ngậy, ít cà phê đắng nhẹ dịu dành cho ngày ngọt ngào.' },
      { id: 'mock-4', name: 'Matcha Latte Đá', price: '39000', category: 'Sinh tố & Matcha', unit: 'Ly', defaultDiscount: '0', isActive: true, isNew: true, description: 'Trà xanh Uji Nhật Bản nguyên chất quyện đều với sữa tươi tươi thanh mát tuyệt hảo.' },
      { id: 'mock-5', name: 'Sinh Tố Bơ Sáp', price: '45000', category: 'Sinh tố & Matcha', unit: 'Ly', defaultDiscount: '10', isActive: true, description: 'Bơ sáp loại 1 dẻo thơm ngậy xay nhuyễn mịn cùng sữa đặc sữa tươi thơm béo.' },
      { id: 'mock-6', name: 'Cam Ép Nguyên Chất', price: '28000', category: 'Nước ép', unit: 'Ly', defaultDiscount: '0', isActive: true, description: 'Cam sành mọng nước ép tay tươi nguyên chất 100%, bổ sung Vitamin C sảng khoái.' },
      { id: 'mock-7', name: 'Bánh Mì Thịt Nguội', price: '30000', category: 'Đồ ăn', unit: 'Ổ', defaultDiscount: '0', isActive: true, description: 'Bánh mì giòn rụm đầy ắp ba tê tươi béo ngậy, thịt nguội cao cấp và dưa chua.' },
      { id: 'mock-8', name: 'Bánh Croissant Bơ Tỏi', price: '25000', category: 'Đồ ăn', unit: 'Cái', defaultDiscount: '0', isActive: true, isNew: true, description: 'Bánh sừng bò nướng giòn rụm ngập hương bơ Pháp và tỏi phi thơm nức lòng.' },
    ];
  }, [menuItems]);

  const activeMenuItems = useMemo(() => displayMenuItems.filter((i: any) => i.isActive !== false), [displayMenuItems]);

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
      <div style={{
        minHeight: '100%',
        background: `linear-gradient(135deg, ${colors.primary} 0%, #fff7ed 40%, #fff 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: '#fff',
            borderRadius: '28px',
            padding: '40px 24px 30px',
            maxWidth: '350px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(74, 93, 35, 0.12)',
            border: '1px solid rgba(142, 151, 117, 0.15)',
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(91, 140, 90, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            border: `2px solid rgba(91, 140, 90, 0.3)`
          }}>
            <CheckCircle size={44} color={colors.success} />
          </div>
          
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: colors.primaryDark, marginBottom: '8px', letterSpacing: '-0.5px' }}>Đặt món thành công!</h2>
          <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
            Cảm ơn <strong>{customerName}</strong> đã đặt món tại <strong>Bàn {tableNumber}</strong>. Đơn hàng của bạn đang được chế biến!
          </p>

          <div style={{
            background: colors.surface,
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '28px',
            textAlign: 'left',
            border: '1px solid rgba(142, 151, 117, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: colors.primaryDark }}>
              <Clock size={16} />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Trạng thái phục vụ</span>
            </div>
            <p style={{ fontSize: '13px', color: colors.textMain, lineHeight: 1.4 }}>
              Nhân viên đang chuẩn bị món ăn cho quý khách. Bạn có thể đặt thêm món bất cứ lúc nào!
            </p>
          </div>

          <button
            onClick={() => { setOrderSuccess(false); setShowInfoForm(false); setCart([]); }}
            style={{
              width: '100%',
              padding: '15px',
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: `0 6px 20px rgba(74, 93, 35, 0.2)`
            }}
          >
            Quay lại thực đơn
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Info Form ────────────────────────────────────────────────
  if (showInfoForm) {
    return (
      <div style={{
        minHeight: '100%',
        background: `radial-gradient(circle at top left, rgba(142, 151, 117, 0.15) 0%, transparent 40%),
                     radial-gradient(circle at bottom right, rgba(226, 132, 19, 0.1) 0%, transparent 40%),
                     #FDFCF8`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '28px',
            padding: '36px 28px',
            maxWidth: '360px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(74, 93, 35, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '68px',
              height: '68px',
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 20px rgba(74, 93, 35, 0.25)',
              position: 'relative'
            }}>
              <Utensils size={32} color="#fff" />
              {/* Pulsing dot indicator */}
              <span style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '12px',
                height: '12px',
                background: colors.accent,
                borderRadius: '50%',
                border: '2px solid #fff',
                display: 'inline-block',
                boxShadow: '0 0 8px rgba(226, 132, 19, 0.6)'
              }} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: colors.primaryDark, marginBottom: '6px', letterSpacing: '-0.5px' }}>Kính chào Quý khách!</h1>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '14px' }}>Chào mừng bạn đến với hệ thống đặt món</p>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(142, 151, 117, 0.12)',
              color: colors.primaryDark,
              padding: '6px 16px',
              borderRadius: '30px',
              fontSize: '14px',
              fontWeight: 700,
              border: `1px solid rgba(142, 151, 117, 0.15)`
            }}>
              <Table size={14} /> Bàn số {tableNumber}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <User size={14} color={colors.primary} /> Tên của bạn <span style={{ color: colors.error }}>*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên gọi của bạn..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  border: `1.5px solid rgba(142, 151, 117, 0.25)`,
                  borderRadius: '16px',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  color: colors.textMain,
                  transition: 'all 0.2s',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = colors.primary;
                  e.target.style.background = '#fff';
                  e.target.style.boxShadow = `0 0 0 4px rgba(142, 151, 117, 0.15)`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(142, 151, 117, 0.25)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Phone size={14} color={colors.primary} /> Số điện thoại
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Không bắt buộc (dùng để tích điểm)..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  border: `1.5px solid rgba(142, 151, 117, 0.25)`,
                  borderRadius: '16px',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  color: colors.textMain,
                  transition: 'all 0.2s',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = colors.primary;
                  e.target.style.background = '#fff';
                  e.target.style.boxShadow = `0 0 0 4px rgba(142, 151, 117, 0.15)`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(142, 151, 117, 0.25)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { if (!customerName.trim()) return; setShowInfoForm(false); }}
              disabled={!customerName.trim()}
              style={{
                width: '100%',
                padding: '16px',
                background: customerName.trim() ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)` : '#e2e8f0',
                color: customerName.trim() ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 700,
                fontSize: '16px',
                cursor: customerName.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s',
                boxShadow: customerName.trim() ? `0 8px 25px rgba(74, 93, 35, 0.2)` : 'none',
                marginTop: '8px'
              }}
            >
              Khám Phá Thực Đơn →
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main Ordering Interface ──────────────────────────────────
  return (
    <div style={{
      minHeight: '100%',
      background: colors.background,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>

      {/* ── STICKY HEADER ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(253, 252, 248, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid rgba(142, 151, 117, 0.1)`,
        paddingTop: '28px' // Spacing below Dynamic Island notch on desktop
      }}>

        {/* Brand bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(74, 93, 35, 0.15)'
            }}>
              <Utensils size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: colors.primaryDark, lineHeight: 1.2, letterSpacing: '-0.5px' }}>TruckFlow</div>
              <div style={{ fontSize: '11px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontWeight: 600, color: colors.textMain }}>{customerName}</span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}><Table size={10} />Bàn {tableNumber}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowInfoForm(true)}
            style={{
              fontSize: '11px',
              color: colors.primaryDark,
              background: colors.surface,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s'
            }}
          >
            <Edit size={12} /> Đổi thông tin
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '0 16px 12px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '28px', top: '44%', transform: 'translateY(-50%)', color: colors.textSecondary }} />
          <input
            type="text"
            placeholder="Tìm kiếm thức uống, đồ ăn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 42px',
              background: '#fff',
              border: `1.5px solid rgba(142, 151, 117, 0.18)`,
              borderRadius: '16px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              color: colors.textMain,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(74, 93, 35, 0.02)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = colors.primary;
              e.target.style.boxShadow = `0 0 0 3px rgba(142, 151, 117, 0.12)`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(142, 151, 117, 0.18)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Category list scrollbar */}
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '0 16px 2px',
          scrollbarWidth: 'none',
          gap: '8px'
        }}>
          {categories.map((cat: string) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 4px 12px',
                  marginRight: '12px',
                  fontSize: '14px',
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? colors.primaryDark : colors.textSecondary,
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  outline: 'none',
                  flexShrink: 0,
                }}
              >
                {cat === 'all' ? 'Tất cả' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MENU LIST ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        paddingBottom: cart.length > 0 ? '110px' : '30px'
      }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: colors.textSecondary }}>
            <Utensils size={44} style={{ margin: '0 auto 16px', opacity: 0.3, color: colors.primary }} />
            <p style={{ fontSize: '15px', fontWeight: 500 }}>
              {searchTerm ? 'Không tìm thấy món ăn phù hợp' : 'Thực đơn hiện đang cập nhật'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredItems.map((item: any) => {
              const cartItem = cart.find((c: any) => c.menuItemId === item.id);
              const qty = cartItem?.qty || 0;
              const catStyles = getCategoryStyles(item.category || '');

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: '#fff',
                    borderRadius: '20px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: qty > 0 ? '0 10px 25px rgba(74, 93, 35, 0.08)' : '0 4px 15px rgba(74, 93, 35, 0.02)',
                    border: qty > 0 ? `2px solid ${colors.primary}` : '2px solid rgba(142, 151, 117, 0.08)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Category gradient thumbnail */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: catStyles.gradient,
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    flexShrink: 0,
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2)'
                  }}>
                    {catStyles.emoji}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <p style={{
                        fontWeight: 700,
                        fontSize: '15px',
                        color: colors.textMain,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>{item.name}</p>
                      
                      {/* Active Tag Indicators */}
                      {item.isPopular && (
                        <span style={{
                          background: 'rgba(226, 132, 19, 0.1)',
                          color: colors.accent,
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          <Flame size={10} /> Hot
                        </span>
                      )}
                      
                      {item.isNew && (
                        <span style={{
                          background: 'rgba(91, 140, 90, 0.1)',
                          color: colors.success,
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          <Sparkles size={10} /> New
                        </span>
                      )}
                    </div>
                    
                    {/* Item description */}
                    {item.description && (
                      <p style={{
                        fontSize: '11px',
                        color: colors.textSecondary,
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{item.description}</p>
                    )}

                    <p style={{ fontSize: '15px', fontWeight: 800, color: colors.accent, marginTop: '2px' }}>
                      {formatCurrency(parseFloat(item.price || '0'))}
                    </p>
                  </div>

                  {/* Quantity control / Add button */}
                  {qty > 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: colors.surface,
                      padding: '3px 5px',
                      borderRadius: '12px',
                      border: '1px solid rgba(142, 151, 117, 0.15)',
                      flexShrink: 0
                    }}>
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '9px',
                          border: 'none',
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        <Minus size={12} color={colors.textSecondary} />
                      </button>
                      <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 800, fontSize: '13px', color: colors.textMain }}>{qty}</span>
                      <button
                        onClick={() => addToCart(item)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '9px',
                          border: 'none',
                          background: colors.accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(226,132,19,0.1)'
                        }}
                      >
                        <Plus size={12} color="#fff" />
                      </button>
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => addToCart(item)}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '12px',
                        border: 'none',
                        background: colors.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        boxShadow: `0 4px 12px rgba(226, 132, 19, 0.25)`
                      }}
                    >
                      <Plus size={16} color="#fff" />
                    </motion.button>
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
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            style={{
              position: 'fixed',
              bottom: '16px', // Floating overlay
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 32px)',
              maxWidth: '369px', // Perfect alignment inside dynamic frame container
              zIndex: 40,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '1px solid rgba(142, 151, 117, 0.15)',
              boxShadow: '0 15px 35px rgba(74, 93, 35, 0.12)',
              overflow: 'hidden'
            }}
          >
            {/* Cart drawer panel */}
            <AnimatePresence>
              {showCart && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '16px 16px 8px', maxHeight: '250px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {cart.map((item: any) => (
                        <div key={item.menuItemId} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          background: colors.surface,
                          borderRadius: '14px',
                          border: '1px solid rgba(142, 151, 117, 0.05)'
                        }}>
                          <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: colors.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => updateQty(item.menuItemId, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                              <Minus size={11} color={colors.textSecondary} />
                            </button>
                            <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 700, fontSize: '13px', color: colors.textMain }}>{item.qty}</span>
                            <button onClick={() => updateQty(item.menuItemId, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(226,132,19,0.1)' }}>
                              <Plus size={11} color="#fff" />
                            </button>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: colors.accent, minWidth: '72px', textAlign: 'right' }}>{formatCurrency(item.price * item.qty)}</span>
                          <button onClick={() => removeFromCart(item.menuItemId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: colors.error, opacity: 0.7 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Order Notes field */}
                    <input
                      type="text"
                      placeholder="Ghi chú món ăn (ví dụ: ít đường, không đá)..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#fff',
                        border: `1.5px solid rgba(142, 151, 117, 0.15)`,
                        borderRadius: '12px',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        color: colors.textMain
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error notifications */}
            {orderError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(188,71,73,0.1)', color: colors.error, padding: '8px 16px', fontSize: '13px', fontWeight: 600 }}>
                <AlertCircle size={14} />
                <span>{orderError}</span>
              </div>
            )}

            {/* Float control action bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px 14px' }}>
              {/* Drawer toggle summary */}
              <button
                onClick={() => setShowCart(!showCart)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(226, 132, 19, 0.08)',
                  border: `1.5px solid rgba(226, 132, 19, 0.2)`,
                  borderRadius: '16px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <ShoppingCart size={20} color={colors.accent} />
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-8px',
                    background: colors.accent,
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 800,
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(226,132,19,0.2)'
                  }}>{totalItems}</span>
                </div>
                
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: 500 }}>Đã chọn {totalItems} món</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: colors.accent, lineHeight: 1.3 }}>{formatCurrency(subtotal)}</div>
                </div>
                {showCart ? <ChevronDown size={16} color={colors.accent} /> : <ChevronUp size={16} color={colors.accent} />}
              </button>

              {/* Order Send button */}
              <button
                disabled={submitting}
                onClick={handleSubmitOrder}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 18px',
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '16px',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.5px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: `0 4px 15px rgba(74, 93, 35, 0.25)`,
                  opacity: submitting ? 0.75 : 1,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {submitting ? (
                  <Clock size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Send size={15} />
                )}
                {submitting ? 'Gửi đơn...' : 'GỬI ĐƠN'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
