/**
 * JWT Authentication API Service.
 *
 * Handles all communication with the backend auth endpoints:
 *  - Login: POST /api/auth/login
 *  - Refresh: POST /api/auth/refresh
 *  - Logout: POST /api/auth/logout
 *  - Logout All: POST /api/auth/logout/all
 *  - Get Profile: GET /api/auth/me
 *  - JWKS: GET /api/auth/.well-known/jwks.json
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// In development, Vite proxies /api to the backend (see vite.config.ts proxy).
// In production, set VITE_API_URL to the actual backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  role: string;
  permissions: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ApiError {
  detail: string;
}

// ---------------------------------------------------------------------------
// Token Storage (memory + localStorage for persistence)
// ---------------------------------------------------------------------------
const ACCESS_TOKEN_KEY = 'truckflow_access_token';
const REFRESH_TOKEN_KEY = 'truckflow_refresh_token';
const TOKEN_EXPIRY_KEY = 'truckflow_token_expiry';

// In-memory cache for faster access
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _tokenExpiry: number | null = null; // epoch seconds

export function loadTokensFromStorage(): void {
  try {
    _accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    _refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    _tokenExpiry = expiry ? parseInt(expiry, 10) : null;
  } catch {
    // localStorage might be unavailable in some environments
    _accessToken = null;
    _refreshToken = null;
    _tokenExpiry = null;
  }
}

export function saveTokens(response: TokenResponse): void {
  _accessToken = response.access_token;
  _refreshToken = response.refresh_token;
  // Calculate expiry timestamp (current time + expires_in seconds)
  _tokenExpiry = Math.floor(Date.now() / 1000) + response.expires_in;

  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, _accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, _refreshToken);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(_tokenExpiry));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function clearTokens(): void {
  _accessToken = null;
  _refreshToken = null;
  _tokenExpiry = null;

  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // Silently fail
  }
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function getRefreshToken(): string | null {
  return _refreshToken;
}

export function isTokenExpired(): boolean {
  if (!_tokenExpiry) return true;
  // Consider token expired 30 seconds before actual expiry (safety margin)
  return (Date.now() / 1000) >= (_tokenExpiry - 30);
}

export function hasValidTokens(): boolean {
  return !!(_accessToken && _refreshToken && !isTokenExpired());
}

// ---------------------------------------------------------------------------
// HTTP Helpers
// ---------------------------------------------------------------------------
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  useAuth: boolean = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (useAuth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      errorDetail = errorBody.detail || errorDetail;
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Auth API Methods
// ---------------------------------------------------------------------------

/**
 * Authenticate user with username/password.
 */
export async function loginApi(credentials: LoginRequest): Promise<TokenResponse> {
  return request<TokenResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    },
    false, // no auth needed for login
  );
}

/**
 * Refresh the access token using a refresh token.
 */
export async function refreshApi(refreshToken: string): Promise<TokenResponse> {
  return request<TokenResponse>(
    '/api/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
    false, // no auth needed (we're getting a new token)
  );
}

/**
 * Logout: revoke the current access token.
 */
export async function logoutApi(): Promise<void> {
  try {
    await request<{ message: string }>(
      '/api/auth/logout',
      { method: 'POST' },
      true,
    );
  } catch {
    // Even if the server request fails, we should clear local tokens
  }
}

/**
 * Logout from all devices: revoke ALL tokens for this user.
 */
export async function logoutAllApi(): Promise<void> {
  try {
    await request<{ message: string }>(
      '/api/auth/logout/all',
      { method: 'POST' },
      true,
    );
  } catch {
    // Even if the server request fails, we should clear local tokens
  }
}

/**
 * Get the current user's profile from the server.
 */
export async function getProfileApi(): Promise<UserProfile> {
  return request<UserProfile>('/api/auth/me');
}

// ---------------------------------------------------------------------------
// Token Refresh Logic (with retry queue to prevent race conditions)
// ---------------------------------------------------------------------------
let _refreshPromise: Promise<TokenResponse> | null = null;

/**
 * Attempt to refresh the access token.
 * Uses a singleton pattern to prevent multiple simultaneous refresh attempts.
 */
export async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  // If a refresh is already in progress, wait for it
  if (_refreshPromise) {
    try {
      await _refreshPromise;
      return true;
    } catch {
      return false;
    }
  }

  // Start a new refresh attempt
  _refreshPromise = refreshApi(refreshToken)
    .then((response) => {
      saveTokens(response);
      return response;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  try {
    await _refreshPromise;
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

// Initialize tokens from storage on module load
loadTokensFromStorage();
