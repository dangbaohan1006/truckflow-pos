import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { buildUrl, getSessionToken } from '../auth/authApi';

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
}

