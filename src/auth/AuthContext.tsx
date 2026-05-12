import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { database } from '../database/index.js';
import User from '../database/models/User.js';
import { ROLES, ROLE_PERMISSIONS, type Role, type Permission } from './permissions.js';

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  permissions: Permission[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  hasPermission: () => false,
  hasAnyPermission: () => false,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem('truckflow_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      } catch {
        localStorage.removeItem('truckflow_session');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const users = await database.get<User>('users').query().fetch();
      const found = users.find((u: any) => u.username === username && u.password === password);

      if (!found) {
        return { success: false, error: 'Sai tên đăng nhập hoặc mật khẩu' };
      }

      if (found.status !== 'ACTIVE') {
        return { success: false, error: 'Tài khoản đã bị khóa' };
      }

      const role = found.role as Role;
      const permissions = ROLE_PERMISSIONS[role] || [];
      const authUser: AuthUser = {
        id: found.id,
        username: found.username,
        displayName: found.displayName,
        role,
        permissions,
      };

      setUser(authUser);
      localStorage.setItem('truckflow_session', JSON.stringify(authUser));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Lỗi đăng nhập' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('truckflow_session');
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false;
      return user.permissions.includes('system:admin' as Permission) || user.permissions.includes(permission);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]) => {
      if (!user) return false;
      if (user.permissions.includes('system:admin' as Permission)) return true;
      return permissions.some((p) => user.permissions.includes(p));
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        isAdmin: user?.role === ROLES.SYSTEM_ADMIN,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
