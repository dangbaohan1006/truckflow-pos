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
        
      case '/api/sales/sync':
        result = handleSalesPull(params, headers);
        break;

      case '/api/users/sync':
        result = handleUserPull(params, headers);
        break;
        
      case '/api/sync/batch':
        result = handleBatchPull(params, headers);
        break;
        
      case '/api/health':
        result = { status: 'ok', timestamp: new Date().toISOString() };
        break;

      case '/api/customer-orders/menu':
        result = handleGetCustomerMenu(params);
        break;
        
      case '/api/customer-orders/pending':
        result = handleGetPendingOrders(params, headers);
        break;
        
      case '/api/customer-orders/all':
        result = handleGetAllOrders(params, headers);
        break;
        
      case '/api/customer-orders/notifications/unread':
        result = handleGetUnreadNotifications(headers);
        break;
        
      case '/api/customer-orders/notifications/all':
        result = handleGetAllNotifications(headers);
        break;

      default:
        // Handle dynamic paths
        if (path.startsWith('/api/customer-orders/')) {
          const segments = path.split('/');
          // segments: ["", "api", "customer-orders", "{orderId}"]
          if (segments.length === 4) {
            const orderId = segments[3];
            result = handleGetOrderDetail(orderId, headers);
            break;
          }
        }
        
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
        
      case '/api/sales/sync':
        result = handleSalesSync(body, headers);
        break;

      case '/api/users/sync':
        result = handleUserSync(body, headers);
        break;
        
      case '/api/sync/batch':
        result = handleBatchPush(body, headers);
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

      case '/api/customer-orders/menu/sync':
        result = handleSyncMenu(body, headers);
        break;

      case '/api/customer-orders':
        result = handleCreateCustomerOrder(body);
        break;

      case '/api/customer-orders/notifications/read-all':
        result = handleMarkAllNotificationsRead(headers);
        break;

      default:
        // Handle dynamic paths
        if (path.startsWith('/api/customer-orders/')) {
          const segments = path.split('/');
          // For: /api/customer-orders/{orderId}/{action}
          if (segments.length === 5) {
            const orderId = segments[3];
            const action = segments[4];
            if (action === 'confirm') {
              result = handleConfirmOrder(orderId, headers);
              break;
            } else if (action === 'cancel') {
              result = handleCancelOrder(orderId, headers);
              break;
            } else if (action === 'complete') {
              result = handleCompleteOrder(orderId, headers);
              break;
            } else if (action === 'update') {
              result = handleUpdateOrder(orderId, body, headers);
              break;
            }
          }
          // For: /api/customer-orders/notifications/{notifId}/read
          if (segments.length === 6 && segments[3] === 'notifications' && segments[5] === 'read') {
            const notifId = segments[4];
            result = handleMarkNotificationRead(notifId, headers);
            break;
          }
        }

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
