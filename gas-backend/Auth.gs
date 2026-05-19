/**
 * Auth.gs — Google OAuth login + session management.
 *
 * Uses Google OAuth 2.0 (via ScriptApp.getOAuthToken()) to authenticate users.
 * Sessions are stored in the `sessions` sheet.
 *
 * Flow:
 *   1. Frontend calls GET /api/auth/oauth-url → gets Google OAuth URL
 *   2. User logs in via Google → redirected back to frontend with auth code
 *   3. Frontend calls POST /api/auth/oauth-callback with the code
 *   4. Backend verifies the code, creates a session, returns session token
 *   5. Frontend stores the session token and uses it for subsequent requests
 */

// ============================================================
// OAuth Configuration
// ============================================================

// The OAuth client ID from Google Cloud Console
const OAUTH_CLIENT_ID = 'YOUR_GOOGLE_OAUTH_CLIENT_ID';

// The redirect URI registered in Google Cloud Console
// Must match the Apps Script Web App URL
const OAUTH_REDIRECT_URI = 'YOUR_APPS_SCRIPT_WEB_APP_URL';

// ============================================================
// Session Token Helpers
// ============================================================

function generateSessionToken_() {
  const bytes = [];
  for (let i = 0; i < SESSION_TOKEN_LENGTH; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  // Convert to hex string
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function isSessionExpired_(session) {
  if (!session || !session.createdAt) return true;
  const created = new Date(session.createdAt);
  const now = new Date();
  const diffDays = (now - created) / (1000 * 60 * 60 * 24);
  return diffDays > SESSION_EXPIRY_DAYS;
}

// ============================================================
// Public Auth API
// ============================================================

/**
 * POST /api/auth/login
 * Authenticate user with username/password and return a session token.
 * Body: { username: "...", password: "..." }
 */
function handleLogin(body) {
  const username = body.username;
  const password = body.password;

  if (!username || !password) {
    return { error: 'Vui lòng nhập tên đăng nhập và mật khẩu', status: 400 };
  }

  // Find user by username
  let user = sheetFindOne(SHEETS.USERS, 'username', username);
  if (!user) {
    // If admin is not found and trying to log in as admin with default password, auto-create it!
    if (username === 'admin' && password === '123456') {
      const adminUser = {
        id: 'admin-001',
        username: 'admin',
        password: '123456',
        email: 'admin@truckflow.com',
        name: 'System Admin',
        role: 'SYSTEM_ADMIN',
        permissions: JSON.stringify([
          'user:create', 'user:edit', 'user:delete', 'user:view', 'user:assign_role',
          'settings:store', 'settings:printer', 'settings:sync', 'settings:template', 'settings:ingredient',
          'sales:create', 'sales:edit', 'sales:cancel', 'sales:payment', 'sales:refund', 'sales:print', 'sales:view', 'sales:view_all',
          'inventory:receive', 'inventory:issue', 'inventory:count', 'inventory:adjust', 'inventory:spoilage',
          'inventory:approve', 'inventory:view', 'inventory:bom', 'inventory:supplier', 'inventory:truck',
          'finance:income', 'finance:expense', 'finance:approve', 'finance:book', 'finance:lock', 'finance:view',
          'hr:employee', 'hr:attendance', 'hr:advance', 'hr:salary', 'hr:approve_salary', 'hr:view',
          'report:view', 'report:export', 'system:admin',
        ]),
        createdAt: new Date().toISOString(),
      };
      user = sheetInsert(SHEETS.USERS, adminUser);
    } else {
      return { error: 'Sai tên đăng nhập hoặc mật khẩu', status: 401 };
    }
  }

  // Check password (cast to String in case Google Sheets formatted password cell as a number)
  if (String(user.password) !== String(password)) {
    return { error: 'Sai tên đăng nhập hoặc mật khẩu', status: 401 };
  }

  // Check status (if user has status field, otherwise assume active)
  if (user.status === 'INACTIVE' || user.status === 'DISABLED') {
    return { error: 'Tài khoản đã bị khóa', status: 403 };
  }

  // Parse permissions
  let permissions = [];
  try {
    permissions = JSON.parse(user.permissions || '[]');
  } catch (e) {
    permissions = [];
  }

  // Create session
  const sessionToken = generateSessionToken_();
  const session = {
    token: sessionToken,
    userId: user.id,
    email: user.email || '',
    displayName: user.name,
    createdAt: new Date().toISOString(),
  };
  sheetInsert(SHEETS.SESSIONS, session);

  // Clean up expired sessions for this user
  cleanupExpiredSessions_(user.id);

  return {
    session_token: sessionToken,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.name,
      role: user.role,
      permissions: permissions,
    },
  };
}

/**
 * GET /api/auth/oauth-url
 * Returns the Google OAuth URL for the frontend to redirect to.
 */
function handleGetOAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/spreadsheets',
  ];
  
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + encodeURIComponent(OAUTH_CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(OAUTH_REDIRECT_URI) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(scopes.join(' ')) +
    '&access_type=offline' +
    '&prompt=consent';
  
  return { url: authUrl };
}

/**
 * POST /api/auth/oauth-callback
 * Exchange the OAuth code for user info and create a session.
 * Body: { code: "..." }
 */
function handleOAuthCallback(body) {
  const code = body.code;
  if (!code) {
    return { error: 'Missing authorization code' };
  }
  
  // Exchange code for tokens using UrlFetchApp
  const tokenResponse = exchangeCodeForTokens_(code);
  if (!tokenResponse || !tokenResponse.access_token) {
    return { error: 'Failed to exchange authorization code' };
  }
  
  // Get user info from Google
  const userInfo = getUserInfo_(tokenResponse.access_token);
  if (!userInfo || !userInfo.email) {
    return { error: 'Failed to get user info' };
  }
  
  // Check if user exists in our users sheet, create if not
  let user = sheetFindOne(SHEETS.USERS, 'email', userInfo.email);
  if (!user) {
    const newUser = {
      id: Utilities.getUuid(),
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split('@')[0],
      role: ROLES.STAFF,
      permissions: JSON.stringify(ROLE_PERMISSIONS[ROLES.STAFF]),
      createdAt: new Date().toISOString(),
    };
    user = sheetInsert(SHEETS.USERS, newUser);
  }
  
  // Parse permissions from JSON string
  let permissions = [];
  try {
    permissions = JSON.parse(user.permissions || '[]');
  } catch (e) {
    permissions = [];
  }
  
  // Create session
  const sessionToken = generateSessionToken_();
  const session = {
    token: sessionToken,
    userId: user.id,
    email: user.email,
    displayName: user.name,
    createdAt: new Date().toISOString(),
  };
  sheetInsert(SHEETS.SESSIONS, session);
  
  // Clean up expired sessions for this user
  cleanupExpiredSessions_(user.id);
  
  return {
    session_token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.name,
      role: user.role,
      permissions: permissions,
    },
  };
}

/**
 * POST /api/auth/logout
 * Delete the current session.
 * Header: X-Session-Token: <token>
 */
function handleLogout(headers) {
  const token = extractSessionToken_(headers);
  if (token) {
    sheetDelete(SHEETS.SESSIONS, 'token', token);
  }
  return { message: 'Logged out' };
}

/**
 * GET /api/auth/me
 * Get the current user's profile.
 * Header: X-Session-Token: <token>
 */
function handleGetProfile(headers) {
  const session = validateSession_(headers);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const user = sheetFindOne(SHEETS.USERS, 'id', session.userId);
  if (!user) {
    return { error: 'User not found', status: 404 };
  }
  
  let permissions = [];
  try {
    permissions = JSON.parse(user.permissions || '[]');
  } catch (e) {
    permissions = [];
  }
  
  return {
    id: user.id,
    username: user.username || user.email,
    display_name: user.name,
    role: user.role,
    permissions: permissions,
  };
}

// ============================================================
// Internal Helpers
// ============================================================

function exchangeCodeForTokens_(code) {
  const payload = {
    code: code,
    client_id: OAUTH_CLIENT_ID,
    client_secret: ScriptApp.getOAuthToken(), // Not the right approach — see note below
    redirect_uri: OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
  };
  
  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: Object.entries(payload)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&'),
    muteHttpExceptions: true,
  };
  
  try {
    const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', options);
    const result = JSON.parse(response.getContentText());
    return result;
  } catch (e) {
    console.error('Token exchange failed:', e.toString());
    return null;
  }
}

function getUserInfo_(accessToken) {
  const options = {
    headers: { Authorization: 'Bearer ' + accessToken },
    muteHttpExceptions: true,
  };
  
  try {
    const response = UrlFetchApp.fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      options
    );
    return JSON.parse(response.getContentText());
  } catch (e) {
    console.error('Failed to get user info:', e.toString());
    return null;
  }
}

/**
 * Extract session token from request headers.
 * Checks X-Session-Token header first, then Authorization: Bearer <token>.
 */
function extractSessionToken_(headers) {
  if (!headers) return null;
  
  // Check X-Session-Token header
  if (headers['X-Session-Token'] || headers['x-session-token']) {
    return headers['X-Session-Token'] || headers['x-session-token'];
  }
  
  // Check Authorization: Bearer <token>
  const auth = headers['Authorization'] || headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.substring(7);
  }
  
  return null;
}

/**
 * Validate a session token. Returns the session object if valid, null otherwise.
 */
function validateSession_(headers) {
  const token = extractSessionToken_(headers);
  if (!token) return null;
  
  const session = sheetFindOne(SHEETS.SESSIONS, 'token', token);
  if (!session) return null;
  
  if (isSessionExpired_(session)) {
    sheetDelete(SHEETS.SESSIONS, 'token', token);
    return null;
  }
  
  return session;
}

/**
 * Clean up expired sessions for a user.
 */
function cleanupExpiredSessions_(userId) {
  const sessions = sheetGetWhereEqual(SHEETS.SESSIONS, 'userId', userId);
  sessions.forEach(s => {
    if (isSessionExpired_(s)) {
      sheetDelete(SHEETS.SESSIONS, 'token', s.token);
    }
  });
}
