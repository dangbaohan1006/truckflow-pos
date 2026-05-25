import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList, Bell, BellRing, Check, X, Edit3, Printer,
  Clock, AlertCircle, ChevronRight, RefreshCw, User, Phone,
  Table, ShoppingCart, Search, Trash2, Plus, Minus, CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency, formatDateTime, generateId } from '../shared/utils.js';
import { Modal } from '../shared/components.js';
import { useToast } from '../shared/ToastContext.js';
import {
  getPendingOrders,
  getAllOrders,
  getOrderDetail,
  confirmOrder,
  updateOrder,
  cancelOrder,
  completeOrder,
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type CustomerOrder,
  type Notification,
  type OrderItemInput,
} from '../database/customerOrderApi.js';

const POLL_INTERVAL = 5000; // 5 seconds

export default function StaffOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingItems, setEditingItems] = useState<OrderItemInput[]>([]);
  const [staffNote, setStaffNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch orders (fetches all orders reactively so both tabs and badge counts are always up-to-date)
  const fetchOrders = useCallback(async () => {
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getUnreadNotifications();
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchOrders();
    fetchNotifications();

    pollRef.current = setInterval(() => {
      fetchOrders();
      fetchNotifications();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchOrders, fetchNotifications]);

  const unreadCount = notifications.length;

  // View order detail
  const handleViewDetail = async (order: CustomerOrder) => {
    try {
      const detail = await getOrderDetail(order.id);
      setSelectedOrder(detail);
      setEditingItems(detail.items.map((item) => ({
        menu_item_id: item.menu_item_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        note: item.note,
      })));
      setStaffNote(detail.staff_note || '');
      setShowDetail(true);
    } catch (e: any) {
      toast.error('Không thể tải chi tiết đơn');
    }
  };

  // Handle confirm order
  const handleConfirm = async () => {
    if (!selectedOrder) return;
    setConfirming(true);
    try {
      const result = await confirmOrder(selectedOrder.id);
      toast.success(`Đã xác nhận đơn bàn ${selectedOrder.table_number}!`);
      setShowDetail(false);
      setSelectedOrder(null);
      fetchOrders();
      fetchNotifications();

      // Print bill
      if (result.print_bill) {
        printBill(selectedOrder);
      }
    } catch (e: any) {
      toast.error(e.message || 'Xác nhận thất bại');
    } finally {
      setConfirming(false);
    }
  };

  // Handle update order
  const handleUpdate = async () => {
    if (!selectedOrder) return;
    try {
      await updateOrder(selectedOrder.id, {
        items: editingItems,
        staff_note: staffNote,
      });
      toast.success('Đã cập nhật đơn hàng!');
      setShowDetail(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (e: any) {
      toast.error(e.message || 'Cập nhật thất bại');
    }
  };

  // Handle cancel order
  const handleCancel = async (orderId: string) => {
    if (!confirm('Bạn có chắc muốn hủy đơn này?')) return;
    try {
      await cancelOrder(orderId);
      toast.success('Đã hủy đơn hàng');
      fetchOrders();
      fetchNotifications();
    } catch (e: any) {
      toast.error(e.message || 'Hủy đơn thất bại');
    }
  };

  // Handle complete order
  const handleComplete = async (orderId: string) => {
    try {
      await completeOrder(orderId);
      toast.success('Đã hoàn tất đơn hàng');
      fetchOrders();
    } catch (e: any) {
      toast.error(e.message || 'Hoàn tất thất bại');
    }
  };

  // Print bill
  const printBill = (order: CustomerOrder) => {
    const w = window.open('', '_blank', 'width=300,height=600');
    if (!w) return;
    w.document.write(`
      <html><head><title>Hóa đơn</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 10px; }
        h2 { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4px; text-align: left; border-bottom: 1px dashed #ccc; }
        .total { font-weight: bold; font-size: 14px; }
        .center { text-align: center; }
      </style></head><body>
      <h2>TRUCKFLOW POS</h2>
      <p class="center">${formatDateTime(order.created_at)}</p>
      <p class="center">Bàn: ${order.table_number}</p>
      <p class="center">Khách: ${order.customer_name}</p>
      ${order.customer_phone ? `<p class="center">ĐT: ${order.customer_phone}</p>` : ''}
      <hr/>
      <table><tr><th>SP</th><th>SL</th><th>ĐG</th><th>TT</th></tr>
        ${order.items.map((item) => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.price * item.quantity)}</td></tr>`).join('')}
      </table>
      <hr/>
      <p class="total">Tổng cộng: ${formatCurrency(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</p>
      ${order.note ? `<p>Ghi chú: ${order.note}</p>` : ''}
      <hr/><p class="center">Cảm ơn quý khách!</p>
      <script>window.print();window.close();</script></body></html>
    `);
    w.document.close();
  };

  // Edit item quantity
  const editItemQty = (index: number, delta: number) => {
    setEditingItems((prev) => {
      const updated = [...prev];
      const newQty = Math.max(0, updated[index].quantity + delta);
      updated[index] = { ...updated[index], quantity: newQty };
      return newQty > 0 ? updated : updated.filter((_, i) => i !== index);
    });
  };

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-warning-zen/10', text: 'text-warning-zen', label: 'Chờ xác nhận' },
      CONFIRMED: { bg: 'bg-primary/10', text: 'text-primary', label: 'Đã xác nhận' },
      COMPLETED: { bg: 'bg-success-zen/10', text: 'text-success-zen', label: 'Hoàn tất' },
      CANCELLED: { bg: 'bg-error-zen/10', text: 'text-error-zen', label: 'Đã hủy' },
    };
    const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-500', label: status };
    return (
      <span className={`${c.bg} ${c.text} px-2 py-0.5 rounded-full text-xs font-medium`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ClipboardList className="text-accent" size={28} />
          <h1 className="text-2xl font-bold text-primary-dark">Đơn khách hàng</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => { fetchOrders(); fetchNotifications(); }}
            className="p-2 bg-white border border-surface-zen rounded-lg hover:bg-surface-zen transition-all"
            title="Làm mới"
          >
            <RefreshCw size={18} className="text-text-secondary" />
          </button>
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 bg-white border border-surface-zen rounded-lg hover:bg-surface-zen transition-all"
            title="Thông báo"
          >
            {unreadCount > 0 ? (
              <BellRing size={18} className="text-accent" />
            ) : (
              <Bell size={18} className="text-text-secondary" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-error-zen text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pending' ? 'bg-primary text-white shadow-sm' : 'bg-white text-text-secondary hover:bg-surface-zen border border-surface-zen'
          }`}
        >
          Đang chờ ({orders.filter((o) => o.status === 'PENDING').length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-white text-text-secondary hover:bg-surface-zen border border-surface-zen'
          }`}
        >
          Tất cả
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12 text-text-secondary">
          <Clock size={36} className="mx-auto mb-3 animate-spin" />
          <p>Đang tải đơn hàng...</p>
        </div>
      ) : orders.filter((o) => activeTab === 'all' || o.status === 'PENDING').length === 0 ? (
        <div className="text-center py-12 text-text-secondary/50">
          <ClipboardList size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">
            {activeTab === 'pending' ? 'Không có đơn hàng nào đang chờ' : 'Chưa có đơn hàng nào'}
          </p>
          <p className="text-sm mt-1">Khách hàng sẽ gửi đơn qua QR code</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders
            .filter((o) => activeTab === 'all' || o.status === 'PENDING')
            .map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 shadow-sm border border-surface-zen hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleViewDetail(order)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center font-bold text-lg">
                      {order.table_number}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-text-main">Bàn {order.table_number}</h3>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-text-secondary mt-1">
                        <span className="flex items-center"><User size={10} className="mr-1" />{order.customer_name}</span>
                        {order.customer_phone && (
                          <span className="flex items-center"><Phone size={10} className="mr-1" />{order.customer_phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-text-secondary" />
                </div>

                <div className="space-y-1">
                  {order.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-text-secondary">
                        {item.product_name} <span className="text-text-secondary/60">x{item.quantity}</span>
                      </span>
                      <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-xs text-text-secondary/60">+{order.items.length - 3} món khác</p>
                  )}
                </div>

                <div className="flex justify-between items-center mt-3 pt-3 border-t border-surface-zen">
                  <span className="text-xs text-text-secondary">
                    {formatDateTime(order.created_at)}
                  </span>
                  <span className="font-bold text-accent">
                    {formatCurrency(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                  </span>
                </div>

                {order.status === 'PENDING' && (
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewDetail(order); }}
                      className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all"
                    >
                      Xem & Xác nhận
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}
                      className="px-4 py-2 border border-error-zen/30 text-error-zen rounded-lg text-sm hover:bg-error-zen/5 transition-all"
                    >
                      Hủy
                    </button>
                  </div>
                )}

                {order.status === 'CONFIRMED' && (
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleComplete(order.id); }}
                      className="flex-1 py-2 bg-success-zen text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all flex items-center justify-center space-x-2"
                    >
                      <CheckCircle size={16} />
                      <span>Hoàn tất đơn</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); printBill(order); }}
                      className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 transition-all flex items-center justify-center space-x-2"
                      title="In hóa đơn"
                    >
                      <Printer size={16} />
                      <span>In Bill</span>
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {showDetail && selectedOrder && (
        <Modal title={`Đơn bàn ${selectedOrder.table_number}`} onClose={() => setShowDetail(false)}>
          <div className="space-y-4">
            {/* Customer Info */}
            <div className="bg-surface-zen rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2">
                <User size={16} className="text-text-secondary" />
                <span className="font-medium">{selectedOrder.customer_name}</span>
              </div>
              {selectedOrder.customer_phone && (
                <div className="flex items-center space-x-2">
                  <Phone size={16} className="text-text-secondary" />
                  <span>{selectedOrder.customer_phone}</span>
                </div>
              )}
              {selectedOrder.note && (
                <div className="flex items-start space-x-2">
                  <AlertCircle size={16} className="text-text-secondary mt-0.5" />
                  <span className="text-sm">{selectedOrder.note}</span>
                </div>
              )}
              <div className="flex items-center space-x-2 text-xs text-text-secondary">
                <Clock size={14} />
                <span>{formatDateTime(selectedOrder.created_at)}</span>
              </div>
            </div>

            {/* Order Items (Editable) */}
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">Món đã gọi</h4>
              <div className="space-y-2">
                {editingItems.map((item, index) => (
                  <div key={index} className="bg-white border border-surface-zen rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{item.product_name}</span>
                      <button
                        onClick={() => setEditingItems((prev) => prev.filter((_, i) => i !== index))}
                        className="text-error-zen/50 hover:text-error-zen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1 bg-surface-zen rounded-lg">
                        <button onClick={() => editItemQty(index, -1)} className="p-1.5 hover:bg-white rounded-l-lg">
                          <Minus size={14} />
                        </button>
                        <span className="px-3 font-bold text-sm min-w-[24px] text-center">{item.quantity}</span>
                        <button onClick={() => editItemQty(index, 1)} className="p-1.5 hover:bg-white rounded-r-lg">
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="font-bold text-accent text-sm">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Note */}
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1">Ghi chú nhân viên</label>
              <textarea
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                placeholder="Ghi chú cho bếp hoặc khách..."
                className="w-full px-3 py-2 text-sm border border-surface-zen rounded-xl outline-none resize-none"
                rows={2}
              />
            </div>

            {/* Total */}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Tổng cộng</span>
              <span className="text-accent">
                {formatCurrency(editingItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}
              </span>
            </div>

            {/* Actions */}
            {selectedOrder.status === 'PENDING' && (
              <div className="flex space-x-3">
                <button
                  onClick={handleUpdate}
                  className="flex-1 py-3 border border-primary text-primary rounded-xl font-medium hover:bg-primary/5 transition-all flex items-center justify-center space-x-2"
                >
                  <Edit3 size={18} />
                  <span>Cập nhật</span>
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {confirming ? (
                    <Clock size={18} className="animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  <span>{confirming ? 'Đang xử lý...' : 'XÁC NHẬN & IN BILL'}</span>
                </button>
              </div>
            )}

            {selectedOrder.status === 'CONFIRMED' && (
              <div className="flex space-x-3">
                <button
                  onClick={() => printBill(selectedOrder)}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center justify-center space-x-2"
                >
                  <Printer size={18} />
                  <span>In lại bill</span>
                </button>
                <button
                  onClick={() => handleComplete(selectedOrder.id)}
                  className="flex-1 py-3 bg-success-zen text-white rounded-xl font-medium hover:bg-green-700 transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle size={18} />
                  <span>Hoàn tất</span>
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <Modal title="Thông báo" onClose={() => setShowNotifications(false)}>
          <div className="space-y-3">
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  await markAllNotificationsRead();
                  setNotifications([]);
                  toast.success('Đã đánh dấu tất cả đã đọc');
                }}
                className="w-full py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-all"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}

            {notifications.length === 0 ? (
              <div className="text-center py-8 text-text-secondary/50">
                <Bell size={36} className="mx-auto mb-2 opacity-30" />
                <p>Không có thông báo mới</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border ${
                    notif.type === 'NEW_ORDER'
                      ? 'bg-warning-zen/5 border-warning-zen/20'
                      : 'bg-surface-zen border-surface-zen'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {notif.type === 'NEW_ORDER' && <AlertTriangle size={14} className="text-warning-zen" />}
                        {notif.type === 'CONFIRMED' && <Check size={14} className="text-success-zen" />}
                        {notif.type === 'UPDATED' && <Edit3 size={14} className="text-primary" />}
                        {notif.type === 'CANCELLED' && <X size={14} className="text-error-zen" />}
                        <span className="text-sm font-medium">{notif.message}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        {formatDateTime(notif.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await markNotificationRead(notif.id);
                        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                      }}
                      className="text-text-secondary/50 hover:text-text-secondary"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
