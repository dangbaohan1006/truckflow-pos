/**
 * Code.gs — Main entry point for the Google Apps Script Web App.
 *
 * Routes HTTP requests to the appropriate handler based on method + path.
 *
 * Deploy as: Web App
 * Execute as: User accessing the web app
 * Who has access: Anyone (or specific users for testing)
 */

// ============================================================
// Entry Points
// ============================================================

/**
 * Handle GET requests.
 * URL format: ?path=/api/auth/oauth-url&lastPulledAt=123
 */
function doGet(e) {
  const params = e.parameter || {};
  const path = params.path || '';
  const headers = getRequestHeaders_(e);
  
  let result;
  
  try {
    switch (path) {
      case '/api/auth/oauth-url':
        result = handleGetOAuthUrl();
        break;
        
      case '/api/auth/me':
        result = handleGetProfile(headers);
        break;
        
      case '/api/inventory/sync':
        result = handlePullSync(params, headers);
        break;
        
      case '/api/health':
        result = { status: 'ok', timestamp: new Date().toISOString() };
        break;
        
      default:
        result = { error: 'Not found', path: path };
        return sendJsonResponse_(result, 404);
    }
  } catch (err) {
    result = { error: err.toString() };
    return sendJsonResponse_(result, 500);
  }
  
  // Check if handler returned an error with status
  if (result && result.status) {
    const status = result.status;
    delete result.status;
    return sendJsonResponse_(result, status);
  }
  
  return sendJsonResponse_(result);
}

/**
 * Handle POST requests.
 * URL format: ?path=/api/auth/login
 * Body: JSON
 */
function doPost(e) {
  const params = e.parameter || {};
  const path = params.path || '';
  const headers = getRequestHeaders_(e);
  
  // Parse JSON body
  let body = {};
  try {
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return sendJsonResponse_({ error: 'Invalid JSON body' }, 400);
  }
  
  let result;
  
  try {
    switch (path) {
      case '/api/auth/login':
        result = handleLogin(body);
        break;

      case '/api/auth/oauth-callback':
        result = handleOAuthCallback(body);
        break;
        
      case '/api/auth/logout':
        result = handleLogout(headers);
        break;
        
      case '/api/inventory/sync':
        result = handlePushSync(body, headers);
        break;
        
      case '/api/inventory/receive':
        result = handleInventoryReceive(body, headers);
        break;
        
      case '/api/inventory/issue':
        result = handleInventoryIssue(body, headers);
        break;
        
      case '/api/inventory/count':
        result = handleInventoryCount(body, headers);
        break;
        
      case '/api/inventory/adjust':
        result = handleInventoryAdjust(body, headers);
        break;
        
      default:
        result = { error: 'Not found', path: path };
        return sendJsonResponse_(result, 404);
    }
  } catch (err) {
    result = { error: err.toString() };
    return sendJsonResponse_(result, 500);
  }
  
  // Check if handler returned an error with status
  if (result && result.status) {
    const status = result.status;
    delete result.status;
    return sendJsonResponse_(result, status);
  }
  
  return sendJsonResponse_(result);
}

/**
 * Handle OPTIONS requests (CORS preflight).
 */
function doOptions(e) {
  return sendJsonResponse_({}, 204);
}

// ============================================================
// Response Helpers
// ============================================================

function sendJsonResponse_(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // CORS headers are handled by the Web App deployment settings.
  // For custom CORS, we'd need to use HtmlService, but ContentService
  // is simpler and sufficient for API-only apps.
  //
  // If you need CORS, deploy as a Web App with "Anyone" access,
  // and the frontend can call it directly.
  
  return output;
}

/**
 * Extract headers from the request event.
 * Google Apps Script doesn't expose headers directly in doGet/doPost,
 * so we use a workaround: pass headers as query parameters.
 *
 * The frontend should append ?path=...&X-Session-Token=... to the URL.
 */
function getRequestHeaders_(e) {
  const headers = {};
  
  // Check for auth token in query parameters
  if (e.parameter) {
    const token = e.parameter['X-Session-Token'] || e.parameter['x-session-token'];
    if (token) {
      headers['X-Session-Token'] = token;
    }
    
    // Also check Authorization
    const auth = e.parameter['Authorization'] || e.parameter['authorization'];
    if (auth) {
      headers['Authorization'] = auth;
    }
  }
  
  return headers;
}
