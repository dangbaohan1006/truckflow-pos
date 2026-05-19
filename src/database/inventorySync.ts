/**
 * Inventory Sync Provider & Queue
 * 
 * Provides a WatermelonDB-compatible sync provider for inventory data,
 * plus a persistent offline queue for inventory operations.
 * 
 * Architecture:
 *   - syncProvider(): WatermelonDB sync function (pull/push inventory_items, stock_movements)
 *   - InventorySyncQueue: IndexedDB-backed queue for offline inventory operations
 *   - processQueue(): Drains the queue when online
 */

import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { getSessionToken } from '../auth/authApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const QUEUE_DB_NAME = 'inventory-sync-queue';
const QUEUE_STORE_NAME = 'pending-operations';

// ============================================================
// 1. WatermelonDB Sync Provider (pull/push for inventory tables)
// ============================================================

export async function inventorySyncProvider() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/sync?lastPulledAt=${lastPulledAt || 0}`,
        {
          headers: buildAuthHeaders(),
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const { changes, timestamp } = await response.json();
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`${API_BASE_URL}/api/inventory/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

function buildAuthHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { 'X-Session-Token': token } : {};
}

// ============================================================
// 2. Offline Queue for Inventory Operations
// ============================================================

export type InventoryOperation =
  | 'receive'
  | 'issue'
  | 'count'
  | 'adjust';

export interface QueuedInventoryOp {
  id: string;
  operation: InventoryOperation;
  items: Array<{
    product_id: string;
    quantity?: string;
    counted_quantity?: string;
    delta_quantity?: string;
  }>;
  location_id?: string;
  reference?: string;
  note?: string;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

/**
 * Opens (or creates) the IndexedDB for the inventory sync queue.
 */
function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        const store = db.createObjectStore(QUEUE_STORE_NAME, {
          keyPath: 'id',
        });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('retryCount', 'retryCount', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueue an inventory operation for later processing.
 * Used when the device is offline or the API call fails.
 */
export async function enqueueInventoryOp(op: Omit<QueuedInventoryOp, 'id' | 'createdAt' | 'retryCount' | 'maxRetries'>): Promise<string> {
  const db = await openQueueDB();
  const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const record: QueuedInventoryOp = {
    ...op,
    id,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 5,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.add(record);
    request.onsuccess = () => {
      resolve(id);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get all pending (unprocessed) inventory operations from the queue.
 */
export async function getPendingOps(): Promise<QueuedInventoryOp[]> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove a processed operation from the queue.
 */
async function removeOp(id: string): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Update retry count / error for a failed operation.
 */
async function updateOp(id: string, updates: Partial<QueuedInventoryOp>): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        resolve();
        return;
      }
      Object.assign(record, updates);
      store.put(record);
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => db.close();
    resolve();
  });
}

// ============================================================
// 3. Queue Processor
// ============================================================

/**
 * Process all pending inventory operations in the queue.
 * Calls the appropriate API endpoint for each operation.
 * Removes successfully processed items; updates retry count on failure.
 * 
 * Returns { processed: number, failed: number, errors: string[] }
 */
export async function processInventoryQueue(): Promise<{ processed: number; failed: number; errors: string[] }> {
  const pending = await getPendingOps();
  if (pending.length === 0) {
    return { processed: 0, failed: 0, errors: [] };
  }

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const op of pending) {
    try {
      await executeInventoryOp(op);
      await removeOp(op.id);
      processed++;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const newRetryCount = op.retryCount + 1;

      if (newRetryCount >= op.maxRetries) {
        // Max retries exceeded — keep in queue with error for visibility
        await updateOp(op.id, {
          retryCount: newRetryCount,
          lastError: errorMsg,
        });
        errors.push(`[${op.operation}:${op.id}] ${errorMsg} (max retries exceeded)`);
        failed++;
      } else {
        await updateOp(op.id, {
          retryCount: newRetryCount,
          lastError: errorMsg,
        });
        errors.push(`[${op.operation}:${op.id}] ${errorMsg} (retry ${newRetryCount}/${op.maxRetries})`);
        failed++;
      }
    }
  }

  return { processed, failed, errors };
}

/**
 * Execute a single queued inventory operation against the API.
 */
async function executeInventoryOp(op: QueuedInventoryOp): Promise<void> {
  const token = getSessionToken();
  const endpoint = `${API_BASE_URL}/api/inventory/${op.operation}`;

  const body: Record<string, any> = { items: op.items };
  if (op.location_id) body.location_id = op.location_id;
  if (op.reference) body.reference = op.reference;
  if (op.note) body.note = op.note;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Session-Token': token } : {}),
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
}

// ============================================================
// 4. Convenience: Queue-aware inventory operations
//    These try the API first, fall back to queue on failure.
// ============================================================

async function queueAwareOp(
  operation: InventoryOperation,
  items: Array<{ product_id: string; quantity?: string; counted_quantity?: string; delta_quantity?: string }>,
  locationId?: string,
  reference?: string,
  note?: string,
): Promise<{ queued: boolean; id?: string }> {
  // Try API first
  try {
    await executeInventoryOp({
      id: '',
      operation,
      items,
      location_id: locationId,
      reference,
      note,
      createdAt: 0,
      retryCount: 0,
      maxRetries: 5,
    });
    return { queued: false };
  } catch (err) {
    // Fall back to queue
    const id = await enqueueInventoryOp({
      operation,
      items,
      location_id: locationId,
      reference,
      note,
    });
    console.warn(`[InventorySync] ${operation} queued (id=${id}):`, err);
    return { queued: true, id };
  }
}

export async function queueAwareReceive(
  items: Array<{ product_id: string; quantity: string }>,
  locationId?: string,
  reference?: string,
  note?: string,
) {
  return queueAwareOp('receive', items, locationId, reference, note);
}

export async function queueAwareIssue(
  items: Array<{ product_id: string; quantity: string }>,
  locationId?: string,
  reference?: string,
  note?: string,
) {
  return queueAwareOp('issue', items, locationId, reference, note);
}

export async function queueAwareCount(
  items: Array<{ product_id: string; counted_quantity: string }>,
  locationId?: string,
  reference?: string,
  note?: string,
) {
  return queueAwareOp('count', items, locationId, reference, note);
}

export async function queueAwareAdjust(
  items: Array<{ product_id: string; delta_quantity: string }>,
  locationId?: string,
  reference?: string,
  note?: string,
) {
  return queueAwareOp('adjust', items, locationId, reference, note);
}
