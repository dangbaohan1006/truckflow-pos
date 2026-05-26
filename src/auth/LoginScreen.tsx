import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Store, User, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './AuthContext.js';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-surface-zen p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-accent/20">
              <Store size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">Geta Oasis</h1>
              <p className="text-sm text-text-secondary">Hệ thống quản lý bán hàng Xe lưu động</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-error-zen/10 border border-error-zen/20 text-error-zen px-4 py-3 rounded-xl flex items-center space-x-2 text-sm"
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1.5">Tên đăng nhập</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập..."
                  className="w-full pl-10 pr-4 py-3 border border-surface-zen rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all bg-white"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-text-secondary font-medium block mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full pl-10 pr-12 py-3 border border-surface-zen rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-main"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-dark transition-all flex items-center justify-center space-x-2 disabled:opacity-50 shadow-lg shadow-accent/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-text-secondary">
            <p>Phiên bản 1.0.0 | Offline-first PWA</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
