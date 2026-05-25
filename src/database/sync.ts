import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { buildUrl, getSessionToken } from '../auth/authApi';
import MenuItem from './models/MenuItem.js';

function buildAuthHeaders(): Record<string, string> {
  const token = getSessionToken();
  // Avoid custom headers (like X-Session-Token or Authorization) for Google Apps Script Web Apps,
  // as they trigger a CORS OPTIONS preflight request which GAS doesn't support.
  // The token is already successfully appended as a query parameter in buildUrl().
  const isGas = buildUrl('/test').includes('script.google.com');
  if (isGas) {
    return {};
  }
  return token ? { 'X-Session-Token': token, Authorization: `Bearer ${token}` } : {};
}

export async function publishMenuToBackend() {
  try {
    const menuItems = await database.get<MenuItem>('menu_items').query().fetch();
    const payload = {
      menu_items: menuItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        unit: item.unit || "",
        default_discount: item.defaultDiscount || "0",
        is_active: item.isActive !== false,
        image: item.image || null,
      }))
    };

    const syncUrl = buildUrl('/api/customer-orders/menu/sync');
    const isGas = syncUrl.includes('script.google.com');
    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': isGas ? 'text/plain;charset=utf-8' : 'application/json',
        ...buildAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!syncResponse.ok) {
      console.warn('Failed to publish menu items to customer order backend:', await syncResponse.text());
    } else {
      const data = await syncResponse.json();
      if (data && typeof data === 'object' && 'error' in data) {
        console.warn('Failed to publish menu items to customer order backend:', (data as any).error);
      } else {
        console.log('Successfully synchronized menu items to backend for customers!');
      }
    }
  } catch (err) {
    console.error('Error synchronizing menu items with customer order backend:', err);
  }
}

export async function syncProvider() {
  // Map local pos_order and pos_order_line to backend orders and order_lines schema
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const url = buildUrl('/api/sales/sync', { lastPulledAt: String(lastPulledAt || 0) });
      const response = await fetch(url, {
        headers: buildAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as any).error);
      }
      
      const { changes, timestamp } = data;
      
      // Translate backend table names to local WatermelonDB schema
      const mappedChanges = {
        ...changes,
        pos_order: changes.orders || { created: [], updated: [], deleted: [] },
        pos_order_line: changes.order_lines || { created: [], updated: [], deleted: [] },
      };
      delete mappedChanges.orders;
      delete mappedChanges.order_lines;

      return { changes: mappedChanges, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const url = buildUrl('/api/sales/sync');
      const isGas = url.includes('script.google.com');

      const rawChanges = changes as any;
      // Translate local WatermelonDB schema to backend table names
      const mappedChanges = {
        ...rawChanges,
        orders: rawChanges.pos_order || { created: [], updated: [], deleted: [] },
        order_lines: rawChanges.pos_order_line || { created: [], updated: [], deleted: [] },
      };
      delete mappedChanges.pos_order;
      delete mappedChanges.pos_order_line;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': isGas ? 'text/plain;charset=utf-8' : 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({ changes: mappedChanges, lastPulledAt }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as any).error);
      }
    },
  });

  // Also sync users to/from backend
  try {
    console.log('Syncing users with backend...');
    await syncUsersProvider();
  } catch (err) {
    console.error('Error synchronizing users with backend:', err);
  }

  // Also publish menu to backend when sync is run
  await publishMenuToBackend();
}

export async function syncUsersProvider() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const url = buildUrl('/api/users/sync', { lastPulledAt: String(lastPulledAt || 0) });
      const response = await fetch(url, {
        headers: buildAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as any).error);
      }
      
      const { changes, timestamp } = data;
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const url = buildUrl('/api/users/sync');
      const isGas = url.includes('script.google.com');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': isGas ? 'text/plain;charset=utf-8' : 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({ changes, lastPulledAt }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as any).error);
      }
    },
  });
}

