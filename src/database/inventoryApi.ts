import { getAccessToken, buildUrl } from '../auth/authApi.js';

type InventoryItemPayload = {
  product_id: string;
  quantity?: string;
  counted_quantity?: string;
  delta_quantity?: string;
};

async function postInventoryAction<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const token = getAccessToken();
  const url = buildUrl(endpoint);
  const isGas = url.includes('script.google.com');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': isGas ? 'text/plain;charset=utf-8' : 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || errorBody.error || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }

  const data = await response.json();
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as any).error);
  }

  return data as T;
}

export async function receiveInventory(items: InventoryItemPayload[], locationId?: string, reference?: string, note?: string) {
  return postInventoryAction('/api/inventory/receive', {
    items,
    location_id: locationId,
    reference,
    note,
  });
}

export async function issueInventory(items: InventoryItemPayload[], locationId?: string, reference?: string, note?: string) {
  return postInventoryAction('/api/inventory/issue', {
    items,
    location_id: locationId,
    reference,
    note,
  });
}

export async function countInventory(items: InventoryItemPayload[], locationId?: string, reference?: string, note?: string) {
  return postInventoryAction('/api/inventory/count', {
    items,
    location_id: locationId,
    reference,
    note,
  });
}

export async function adjustInventory(items: InventoryItemPayload[], locationId?: string, reference?: string, note?: string) {
  return postInventoryAction('/api/inventory/adjust', {
    items,
    location_id: locationId,
    reference,
    note,
  });
}
