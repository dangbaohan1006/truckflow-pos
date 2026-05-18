/**
 * JWT Authentication Context.
 *
 * Replaces the old session-based auth with JWT (Access Token + Refresh Token).
 *
 * Architecture:
 *  - Access Token: Short-lived (15 min), stored in memory + localStorage.
 *  - Refresh Token: Long-lived (30 days), used to get new access tokens.
 *  - Auto-refresh: Silently refreshes the access token before it expires.
 *  - Logout: Revokes tokens via the backend API (Redis blacklist).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../database/index.js';
import User from '../database/models/User.js';
import { ROLES, ROLE_PERMISSIONS, type Role, type Permission } from './permissions.js';
import { initializeDefaultUsers } from '../database/initializeDefaultUsers.js';
import { seedTestData } from '../database/seedTestData.js';
import { seedReportsFinanceHRData } from '../database/seedReportsFinanceHR.js';

// Import JWT auth API
import {
  loginApi,
  logoutApi,
  logoutAllApi,
  getProfileApi,
  saveTokens,
  clearTokens,
  loadTokensFromStorage,
  hasValidTokens,
  isTokenExpired,
  attemptTokenRefresh,
  getAccessToken,
  type UserProfile,
} from './authApi.js';

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
  logoutAll: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  isAdmin: boolean;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  logoutAll: async () => {},
  hasPermission: () => false,
  hasAnyPermission: () => false,
  isAdmin: false,
  getAccessToken: () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Helper: Convert UserProfile from API to AuthUser
  // ---------------------------------------------------------------------------
  const profileToAuthUser = useCallback((profile: UserProfile): AuthUser => {
    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      role: profile.role as Role,
      permissions: profile.permissions as Permission[],
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Helper: Try to restore session from stored tokens
  // ---------------------------------------------------------------------------
  const restoreSession = useCallback(async (): Promise<boolean> => {
    // Load tokens from localStorage
    loadTokensFromStorage();

    if (!hasValidTokens()) {
      // Try to refresh if we have a refresh token but access token is expired
      const refreshed = await attemptTokenRefresh();
      if (!refreshed) {
        return false;
      }
    }

    // We have a valid access token, fetch the user profile
    try {
      const profile = await getProfileApi();
      const authUser = profileToAuthUser(profile);
      setUser(authUser);
      console.log('✅ JWT session restored for user:', authUser.username);
      return true;
    } catch (error) {
      console.error('❌ Failed to restore session:', error);
      clearTokens();
      return false;
    }
  }, [profileToAuthUser]);

  // ---------------------------------------------------------------------------
  // Auto-refresh timer: refresh token before it expires
  // ---------------------------------------------------------------------------
  const startRefreshTimer = useCallback(() => {
    // Clear any existing timer
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Check every 5 minutes if token needs refresh
    refreshIntervalRef.current = setInterval(async () => {
      if (isTokenExpired()) {
        console.log('🔄 Token expired, attempting refresh...');
        const success = await attemptTokenRefresh();
        if (!success) {
          console.error('❌ Token refresh failed, logging out');
          setUser(null);
          clearTokens();
        } else {
          console.log('✅ Token refreshed successfully');
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }, []);

  const stopRefreshTimer = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Initialize app on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🔄 Starting app initialization...');
      try {
        // Initialize default admin user if no users exist
        console.log('⏳ Initializing default users...');
        await initializeDefaultUsers();
        console.log('✅ Default users initialized');

        console.log('⏳ Seeding test data...');
        await seedTestData();
        console.log('✅ Test data seeded');

        console.log('⏳ Seeding Reports/Finance/HR test data...');
        await seedReportsFinanceHRData();
        console.log('✅ Reports/Finance/HR test data seeded');
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
      }

      // Try to restore JWT session
      const restored = await restoreSession();
      if (restored) {
        startRefreshTimer();
      }

      setLoading(false);
      console.log('✅ App initialization complete');
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      stopRefreshTimer();
    };
  }, [restoreSession, startRefreshTimer, stopRefreshTimer]);

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  const login = useCallback(async (username: string, password: string) => {
    try {
      // 1. Authenticate via backend API (JWT)
      const tokenResponse = await loginApi({ username, password });

      // 2. Save tokens to memory + localStorage
      saveTokens(tokenResponse);

      // 3. Fetch user profile from the server
      const profile = await getProfileApi();
      const authUser = profileToAuthUser(profile);

      // 4. Set user state
      setUser(authUser);

      // 5. Start auto-refresh timer
      startRefreshTimer();

      console.log('✅ JWT login successful for user:', authUser.username);
      return { success: true };
    } catch (e: any) {
      console.error('❌ Login failed:', e.message);
      clearTokens();
      return { success: false, error: e.message || 'Lỗi đăng nhập' };
    }
  }, [profileToAuthUser, startRefreshTimer]);

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    // 1. Revoke token on server (best-effort)
    logoutApi().catch(() => {});

    // 2. Clear local state
    setUser(null);
    clearTokens();
    stopRefreshTimer();

    console.log('✅ Logged out');
  }, [stopRefreshTimer]);

  // ---------------------------------------------------------------------------
  // Logout from all devices
  // ---------------------------------------------------------------------------
  const logoutAll = useCallback(async () => {
    try {
      await logoutAllApi();
    } catch {
      // Best-effort
    }

    setUser(null);
    clearTokens();
    stopRefreshTimer();

    console.log('✅ Logged out from all devices');
  }, [stopRefreshTimer]);

  // ---------------------------------------------------------------------------
  // Permission checks
  // ---------------------------------------------------------------------------
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
        logoutAll,
        hasPermission,
        hasAnyPermission,
        isAdmin: user?.role === ROLES.SYSTEM_ADMIN,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
