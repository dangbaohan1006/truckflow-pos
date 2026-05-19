/**
 * Authentication Context — Google OAuth + Session Token.
 *
 * Replaces the old JWT-based auth with Google OAuth 2.0.
 *
 * Architecture:
 *  - Login: Redirect to Google OAuth → callback → get session token
 *  - Auth: Session token stored in localStorage, sent as X-Session-Token
 *  - Logout: Delete session on server + clear local state
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { database } from '../database/index.js';
import User from '../database/models/User.js';
import { ROLES, ROLE_PERMISSIONS, type Role, type Permission } from './permissions.js';
import { initializeDefaultUsers } from '../database/initializeDefaultUsers.js';
import { seedTestData } from '../database/seedTestData.js';
import { seedReportsFinanceHRData } from '../database/seedReportsFinanceHR.js';

// Import session-based auth API
import {
  loginApi,
  getOAuthUrlApi,
  oauthCallbackApi,
  logoutApi,
  getProfileApi,
  saveSession,
  clearSession,
  loadSessionFromStorage,
  hasValidSession,
  getSessionToken,
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
  loginWithGoogle: () => Promise<void>;
  handleOAuthRedirect: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  isAdmin: boolean;
  getSessionToken: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  loginWithGoogle: async () => {},
  handleOAuthRedirect: async () => ({ success: false }),
  logout: () => {},
  hasPermission: () => false,
  hasAnyPermission: () => false,
  isAdmin: false,
  getSessionToken: () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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
  // Helper: Try to restore session from stored token
  // ---------------------------------------------------------------------------
  const restoreSession = useCallback(async (): Promise<boolean> => {
    // Load session from localStorage
    loadSessionFromStorage();

    if (!hasValidSession()) {
      return false;
    }

    // We have a session token, verify it by fetching the user profile
    try {
      const profile = await getProfileApi();
      const authUser = profileToAuthUser(profile);
      setUser(authUser);
      console.log('✅ Session restored for user:', authUser.username);
      return true;
    } catch (error) {
      console.error('❌ Failed to restore session:', error);
      clearSession();
      return false;
    }
  }, [profileToAuthUser]);

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

      // Try to restore session
      const restored = await restoreSession();
      if (!restored) {
        console.log('ℹ️ No saved session found');
      }

      setLoading(false);
      console.log('✅ App initialization complete');
    };

    initializeApp();
  }, [restoreSession]);

  // ---------------------------------------------------------------------------
  // Login with username/password
  // ---------------------------------------------------------------------------
  const login = useCallback(async (username: string, password: string) => {
    try {
      const sessionResponse = await loginApi(username, password);
      
      // Save session to localStorage
      saveSession(sessionResponse);
      
      // Set user state
      const authUser = profileToAuthUser(sessionResponse.user);
      setUser(authUser);
      
      console.log('✅ Login successful for user:', authUser.username);
      return { success: true };
    } catch (e: any) {
      console.error('❌ Login failed:', e.message);
      return { success: false, error: e.message || 'Lỗi đăng nhập' };
    }
  }, [profileToAuthUser]);

  // ---------------------------------------------------------------------------
  // Login with Google
  // ---------------------------------------------------------------------------
  const loginWithGoogle = useCallback(async () => {
    try {
      const oauthUrl = await getOAuthUrlApi();
      window.location.href = oauthUrl.url;
    } catch (e: any) {
      console.error('❌ Google login failed:', e.message);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Handle OAuth Redirect (called from the callback page)
  // ---------------------------------------------------------------------------
  const handleOAuthRedirect = useCallback(async (code: string) => {
    try {
      const sessionResponse = await oauthCallbackApi(code);
      
      // Save session to localStorage
      saveSession(sessionResponse);
      
      // Set user state
      const authUser = profileToAuthUser(sessionResponse.user);
      setUser(authUser);
      
      console.log('✅ Google OAuth login successful for user:', authUser.username);
      return { success: true };
    } catch (e: any) {
      console.error('❌ OAuth callback failed:', e.message);
      clearSession();
      return { success: false, error: e.message || 'Lỗi xác thực Google' };
    }
  }, [profileToAuthUser]);

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    // 1. Revoke session on server (best-effort)
    logoutApi().catch(() => {});

    // 2. Clear local state
    setUser(null);
    clearSession();

    console.log('✅ Logged out');
  }, []);

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
        loginWithGoogle,
        handleOAuthRedirect,
        logout,
        hasPermission,
        hasAnyPermission,
        isAdmin: user?.role === ROLES.SYSTEM_ADMIN,
        getSessionToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
