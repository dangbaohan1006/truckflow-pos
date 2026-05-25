import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, Package, BarChart3, Settings, Wifi, WifiOff, Cloud, RefreshCw,
  Wallet, Users, DollarSign, LogOut, Shield, User, ClipboardList,
} from 'lucide-react';
import { mySync, publishMenuToBackend } from './database/index.js';
import { AuthProvider, useAuth } from './auth/AuthContext.js';
import LoginScreen from './auth/LoginScreen.js';
import { getAccessibleModules, ROLE_LABELS, type Role } from './auth/permissions.js';
import POS from './modules/POS.js';
import Inventory from './modules/Inventory.js';
import Reports from './modules/Reports.js';
import Finance from './modules/Finance.js';
import HR from './modules/HR.js';
import SettingsPage from './modules/Settings.js';
import StaffOrders from './modules/StaffOrders.js';
import { ToastProvider, useToast } from './shared/ToastContext.js';
import { getUnreadNotifications } from './database/customerOrderApi.js';

// Chime synthesizer function using Web Audio API (offline-friendly, 0 external assets)
const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'triangle'; // Soft, warm triangle wave
      osc.frequency.setValueAtTime(freq, startTime);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.05); // Smooth attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Smooth decay
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    playTone(523.25, now, 0.4); // C5 tone
    playTone(659.25, now + 0.12, 0.55); // E5 tone (arpeggio sound)
  } catch (e) {
    console.error('Audio chime failed:', e);
  }
};

const ICON_MAP: Record<string, any> = {
  Store, Package, BarChart3, DollarSign, Users, Settings, ClipboardList,
};

const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
      active ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:bg-surface-zen'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium flex-1 text-left">{label}</span>
    {badge != null && (
      <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>
    )}
  </button>
);

function AppContent() {
  const { user, logout, isAdmin, hasAnyPermission } = useAuth();
  // Determine if the URL path or hash indicates the Admin view (/admin or #/admin)
  const [isAdminView, setIsAdminView] = useState(() => {
    return (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash.startsWith('#/admin') ||
      window.location.hash === '#admin'
    );
  });

  const [activeModule, setActiveModule] = useState(() => {
    const isCurrentAdmin =
      window.location.pathname.startsWith('/admin') ||
      window.location.hash.startsWith('#/admin') ||
      window.location.hash === '#admin';
    return isCurrentAdmin ? 'pos' : 'customer-orders';
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const handleUrlChange = () => {
      const isCurrentAdmin =
        window.location.pathname.startsWith('/admin') ||
        window.location.hash.startsWith('#/admin') ||
        window.location.hash === '#admin';
      setIsAdminView(isCurrentAdmin);
      setActiveModule(isCurrentAdmin ? 'pos' : 'customer-orders');
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const navigateTo = (path: string) => {
    const isTargetAdmin = path.startsWith('/admin') || path.startsWith('#/admin') || path === '#admin';
    window.history.pushState(null, '', path);
    setIsAdminView(isTargetAdmin);
    setActiveModule(isTargetAdmin ? 'pos' : 'customer-orders');
  };

  // Global customer order notifications polling
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      prevCountRef.current = null;
      return;
    }

    const checkNotifications = async () => {
      try {
        const notifs = await getUnreadNotifications();
        const currentCount = notifs.length;
        setUnreadCount(currentCount);

        // If it's not the initial fetch and count increased, play a sound and show a toast alert
        if (prevCountRef.current !== null && currentCount > prevCountRef.current) {
          playNotificationSound();
          
          // Find the new notifications that were not in the previous set
          const newNotifs = notifs.slice(0, currentCount - prevCountRef.current);
          newNotifs.forEach((notif) => {
            toast.info(notif.message, 6000);
          });
        }
        prevCountRef.current = currentCount;
      } catch (err) {
        console.error('Failed to poll global notifications:', err);
      }
    };

    // Run immediately
    checkNotifications();

    const interval = setInterval(checkNotifications, 6000); // Poll every 6 seconds
    return () => clearInterval(interval);
  }, [user, toast]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      toast.info('Bắt đầu đồng bộ thực đơn...');
      await publishMenuToBackend();
      
      toast.info('Bắt đầu đồng bộ giao dịch bán hàng...');
      await mySync();
      
      toast.success('Đồng bộ dữ liệu thành công!');
    } catch (e: any) {
      console.error('Sync failed:', e);
      toast.error('Đồng bộ thất bại: ' + e.message);
    }
    setSyncing(false);
  };

  // Background auto-sync 3 seconds after cashier startup/login if online
  useEffect(() => {
    if (user && isOnline) {
      const timer = setTimeout(() => {
        // Publish menu directly first so customer gets it instantly!
        publishMenuToBackend().catch(err => console.error('Auto publish menu failed:', err));
        mySync().catch(err => console.error('Background auto-sync failed:', err));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, isOnline]);

  // Get accessible modules based on user permissions
  const accessibleModules = user ? getAccessibleModules(user.permissions) : [];

  const canAccessAdmin = accessibleModules.some(m => ['pos', 'inventory', 'reports', 'finance', 'settings'].includes(m.key));
  const canAccessStaff = accessibleModules.some(m => ['pos', 'customer-orders', 'hr'].includes(m.key));

  // Filter modules based on whether we are in the Admin View or Staff View
  const viewModules = accessibleModules.filter((mod) => {
    if (isAdminView) {
      return ['pos', 'inventory', 'reports', 'finance', 'settings'].includes(mod.key);
    } else {
      return ['pos', 'customer-orders', 'hr'].includes(mod.key);
    }
  });

  // For STAFF role, further filter by custom module access
  const staffModuleAccess = user?.role === 'STAFF' ? (user as any).moduleAccess : null;
  const filteredModules = staffModuleAccess
    ? viewModules.filter((mod) => {
        try {
          if (typeof staffModuleAccess === 'string') {
            // Handle if it's a JSON array string
            if (staffModuleAccess.trim().startsWith('[')) {
              const parsed = JSON.parse(staffModuleAccess);
              if (Array.isArray(parsed)) {
                return parsed.includes(mod.key);
              }
            }
            return staffModuleAccess.includes(mod.key);
          }
          if (Array.isArray(staffModuleAccess)) {
            return staffModuleAccess.includes(mod.key);
          }
        } catch (e) {
          console.error('Failed to parse staff module access:', e);
        }
        return false;
      })
    : viewModules;


  // If current active module is not accessible in the current view, switch to first accessible
  useEffect(() => {
    if (filteredModules.length > 0) {
      const hasActive = filteredModules.find((m) => m.key === activeModule);
      if (!hasActive) {
        setActiveModule(filteredModules[0].key);
      }
    }
  }, [filteredModules, activeModule]);


  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen flex bg-background text-text-main">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-surface-zen flex flex-col">
        <div className="p-6 border-b border-surface-zen">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <Store size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-primary-dark text-lg">TruckFlow</h1>
              <p className="text-xs text-text-secondary">F&B Management</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-4 pt-4 pb-2 border-b border-surface-zen">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold">
              {user.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.displayName}</p>
              <p className="text-xs text-text-secondary truncate">{ROLE_LABELS[user.role as Role] || user.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredModules.map((mod) => {
            const Icon = ICON_MAP[mod.icon] || Store;
            return (
              <SidebarItem
                key={mod.key}
                icon={Icon}
                label={mod.label}
                active={activeModule === mod.key}
                onClick={() => setActiveModule(mod.key)}
                badge={mod.key === 'customer-orders' && unreadCount > 0 ? unreadCount : undefined}
              />
            );
          })}
        </div>

        {/* Bottom: Sync + View Switcher + Logout */}
        <div className="p-4 border-t border-surface-zen space-y-3">
          {/* View Switcher for Authorized Users */}
          {isAdminView ? (
            canAccessStaff && (
              <button
                onClick={() => navigateTo('/')}
                className="w-full py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <span>⬅️ Xem trang Nhân viên</span>
              </button>
            )
          ) : (
            canAccessAdmin && (
              <button
                onClick={() => navigateTo('/admin')}
                className="w-full py-2 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <span>Chuyển sang trang Admin ➡️</span>
              </button>
            )
          )}

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi size={14} className="text-success-zen" />
              ) : (
                <WifiOff size={14} className="text-error-zen" />
              )}
              <span className="text-xs font-medium">{isOnline ? 'Đã kết nối' : 'Ngoại tuyến'}</span>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing || !isOnline}
              className="text-primary hover:text-primary-dark transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || !isOnline}
            className="w-full py-2 bg-surface-zen rounded-lg text-xs font-medium text-text-secondary hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center space-x-1 disabled:opacity-50 cursor-pointer"
          >
            <Cloud size={14} />
            <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}</span>
          </button>
          <button
            onClick={logout}
            className="w-full py-2 bg-surface-zen rounded-lg text-xs font-medium text-text-secondary hover:bg-error-zen/10 hover:text-error-zen transition-all flex items-center justify-center space-x-1 cursor-pointer"
          >
            <LogOut size={14} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeModule === 'pos' && <POS />}
              {activeModule === 'inventory' && <Inventory />}
              {activeModule === 'reports' && <Reports />}
              {activeModule === 'finance' && <Finance />}
              {activeModule === 'hr' && <HR />}
              {activeModule === 'customer-orders' && <StaffOrders />}
              {activeModule === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
