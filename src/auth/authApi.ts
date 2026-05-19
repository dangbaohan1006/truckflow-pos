/**
 * Authentication API Service — Google OAuth + Session Token.
 *
 * Replaces the old JWT-based auth with Google OAuth 2.0.
 * Sessions are managed via a session token stored in localStorage.
 *
 * Architecture:
 *  - Login: Redirect to Google OAuth → callback → get session token
 *  - Auth: Session token sent as X-Session-Token header (or query param for GAS)
 *  - Logout: Delete session on server
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// In development, Vite proxies /api to the backend (see vite.config.ts proxy).
// In production, set VITE_API_URL to the actual Google Apps Script Web App URL.
// Fallback: hardcode GAS URL for production deployment
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwUoJrEgm2bX7lyreOJYm1ciVgL4S6kSFB6Z3RYzX8O87FBMA1_9BvaoaNU2jS164Y9Pw/exec';
const API_BASE_URL = import.meta.env.VITE_API_URL || GAS_API_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SessionResponse {
  session_token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  role: string;
  permissions: string[];
}

export interface ApiError {
  error: string;
}

// ---------------------------------------------------------------------------
// Session Token Storage
// ---------------------------------------------------------------------------
const SESSION_TOKEN_KEY = 'truckflow_session_token';
const USER_PROFILE_KEY = 'truckflow_user_profile';

let _sessionToken: string | null = null;
let _userProfile: UserProfile | null = null;

export function loadSessionFromStorage(): void {
  try {
    _sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    const profile = localStorage.getItem(USER_PROFILE_KEY);
    _userProfile = profile ? JSON.parse(profile) : null;
  } catch {
    _sessionToken = null;
    _userProfile = null;
  }
}

export function saveSession(response: SessionResponse): void {
  _sessionToken = response.session_token;
  _userProfile = response.user;

  try {
    localStorage.setItem(SESSION_TOKEN_KEY, _sessionToken);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(_userProfile));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function clearSession(): void {
  _sessionToken = null;
  _userProfile = null;

  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
  } catch {
    // Silently fail
  }
}

export function getSessionToken(): string | null {
  return _sessionToken;
}

/**
 * Alias for getSessionToken — used by inventoryApi and other modules.
 */
export function getAccessToken(): string | null {
  return _sessionToken;
}

export function hasValidSession(): boolean {
  return !!_sessionToken;
}

// ---------------------------------------------------------------------------
// HTTP Helpers
// ---------------------------------------------------------------------------

/**
 * Build the URL with path and optional auth token as query parameter.
 * Google Apps Script doesn't support custom headers in doGet/doPost,
 * so we pass the session token as a query parameter.
 */
export function buildUrl(endpoint: string, params?: Record<string, string>): string {
  const isGas = API_BASE_URL.includes('script.google.com');
  let url: URL;
  
  if (isGas) {
    // For Google Apps Script Web App, keep the base URL pathname exactly as is (/exec)
    // and only pass the endpoint as the 'path' query parameter.
    url = new URL(API_BASE_URL);
  } else {
    // For standard APIs (or dev proxy), append the endpoint to the path.
    url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
  }
  
  // Add path as query parameter (GAS routing)
  url.searchParams.set('path', endpoint);
  
  // Add session token if available
  if (_sessionToken) {
    url.searchParams.set('X-Session-Token', _sessionToken);
  }
  
  // Add any additional params
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  
  return url.toString();
}


async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  params?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(endpoint, params);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      errorDetail = errorBody.error || errorBody.detail || errorDetail;
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
 * Login with username and password.
 */
export async function loginApi(username: string, password: string): Promise<SessionResponse> {
  return request<SessionResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
  );
}

/**
 * Get the Google OAuth URL to redirect the user to.
 */
export async function getOAuthUrlApi(): Promise<{ url: string }> {
  return request<{ url: string }>('/api/auth/oauth-url', { method: 'GET' });
}

/**
 * Exchange the OAuth authorization code for a session token.
 */
export async function oauthCallbackApi(code: string): Promise<SessionResponse> {
  return request<SessionResponse>(
    '/api/auth/oauth-callback',
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    },
  );
}

/**
 * Logout: delete the current session.
 */
export async function logoutApi(): Promise<void> {
  try {
    await request<{ message: string }>(
      '/api/auth/logout',
      { method: 'POST' },
    );
  } catch {
    // Even if the server request fails, we should clear local session
  }
}

/**
 * Get the current user's profile from the server.
 */
export async function getProfileApi(): Promise<UserProfile> {
  return request<UserProfile>('/api/auth/me', { method: 'GET' });
}

// Initialize session from storage on module load
loadSessionFromStorage();
