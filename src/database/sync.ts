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
    
    // If local menu database is empty, pull all items from Google Sheets instead of pushing empty payload
    if (menuItems.length === 0) {
      console.log('Local menu database is empty. Pulling menu from backend sheets...');
      const pullUrl = buildUrl('/api/customer-orders/menu', { all: 'true' });
      const pullResponse = await fetch(pullUrl, {
        headers: buildAuthHeaders(),
      });
      if (pullResponse.ok) {
        const pullData = await pullResponse.json();
        if (pullData && Array.isArray(pullData.menu) && pullData.menu.length > 0) {
          console.log(`Pulled ${pullData.menu.length} menu items from backend. Syncing to local DB...`);
          await database.write(async () => {
            for (const item of pullData.menu) {
              await database.get<MenuItem>('menu_items').create((m: any) => {
                m._raw.id = item.id;
                m.name = item.name;
                m.price = String(item.price);
                m.category = item.category;
                m.unit = item.unit || "";
                m.defaultDiscount = item.defaultDiscount || "0";
                m.isActive = item.isActive !== false;
                m.image = item.image || "";
              });
            }
          });
          console.log('Successfully populated local menu items database.');
          
          if (pullData.store) {
            localStorage.setItem('truckflow_config', JSON.stringify({
              storeName: pullData.store.storeName || "Geta Oasis",
              storeAddress: pullData.store.storeAddress || "Xe lưu động",
              storePhone: pullData.store.storePhone || "",
              storeLogo: pullData.store.storeLogo || "",
            }));
          }
          console.log('Successfully populated local menu items database. Reactively updating UI...');
          return;
        }
      }
    }

    const savedConfig = localStorage.getItem('truckflow_config');
    const storeConfig = savedConfig ? JSON.parse(savedConfig) : {
      storeName: "Geta Oasis",
      storeAddress: "Xe lưu động",
      storePhone: "0123456789",
      storeLogo: "",
    };

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
      })),
      store_config: {
        storeName: storeConfig.storeName || "Geta Oasis",
        storeAddress: storeConfig.storeAddress || "Xe lưu động",
        storePhone: storeConfig.storePhone || "",
        storeLogo: storeConfig.storeLogo || "",
      }
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
  console.log('Initiating high-performance Single-Batch Sync for all tables...');
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const url = buildUrl('/api/sync/batch', { lastPulledAt: String(lastPulledAt || 0) });
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
      const url = buildUrl('/api/sync/batch');
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

  // Also publish menu to backend when sync is run (non-blocking)
  try {
    await publishMenuToBackend();
  } catch (err) {
    console.error('Error publishing menu:', err);
  }
}

