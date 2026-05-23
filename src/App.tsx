import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, Package, BarChart3, Settings, Wifi, WifiOff, Cloud, RefreshCw,
  Wallet, Users, DollarSign, LogOut, Shield, User, ClipboardList,
} from 'lucide-react';
import { mySync } from './database/index.js';
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
import { ToastProvider } from './shared/ToastContext.js';

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
  const [activeModule, setActiveModule] = useState('pos');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

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
      await mySync();
    } catch (e) {
      console.error('Sync failed:', e);
    }
    setSyncing(false);
  };

  // Get accessible modules based on user permissions
  const accessibleModules = user ? getAccessibleModules(user.permissions) : [];

  // For STAFF role, further filter by custom module access
  // For STAFF role, further filter by custom module access
  const staffModuleAccess = user?.role === 'STAFF' ? (user as any).moduleAccess : null;
  const filteredModules = staffModuleAccess
    ? accessibleModules.filter((mod) => {
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
    : accessibleModules;


  // If current active module is not accessible, switch to first accessible
  useEffect(() => {
    if (filteredModules.length > 0 && !filteredModules.find((m) => m.key === activeModule)) {
      setActiveModule(filteredModules[0].key);
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
              />
            );
          })}
        </div>

        {/* Bottom: Sync + Logout */}
        <div className="p-4 border-t border-surface-zen space-y-3">
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
              className="text-primary hover:text-primary-dark transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || !isOnline}
            className="w-full py-2 bg-surface-zen rounded-lg text-xs font-medium text-text-secondary hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center space-x-1 disabled:opacity-50"
          >
            <Cloud size={14} />
            <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}</span>
          </button>
          <button
            onClick={logout}
            className="w-full py-2 bg-surface-zen rounded-lg text-xs font-medium text-text-secondary hover:bg-error-zen/10 hover:text-error-zen transition-all flex items-center justify-center space-x-1"
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
