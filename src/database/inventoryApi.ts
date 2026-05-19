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
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }

  return response.json();
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
