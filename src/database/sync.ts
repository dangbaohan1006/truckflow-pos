import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { buildUrl, getSessionToken } from '../auth/authApi';
import MenuItem from './models/MenuItem.js';

function buildAuthHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { 'X-Session-Token': token, Authorization: `Bearer ${token}` } : {};
}

export async function syncProvider() {
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
      const { changes, timestamp } = await response.json();
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const url = buildUrl('/api/sales/sync');
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
    },
  });

  // Automatically publish cashier's local menu items to the customer-facing backend
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
    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!syncResponse.ok) {
      console.warn('Failed to publish menu items to customer order backend:', await syncResponse.text());
    } else {
      console.log('Successfully synchronized menu items to backend for customers!');
    }
  } catch (err) {
    console.error('Error synchronizing menu items with customer order backend:', err);
  }
}

