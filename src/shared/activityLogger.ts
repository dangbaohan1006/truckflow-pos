export interface ActivityRecord {
  id: string;
  username: string;
  displayName: string;
  role: string;
  action: string;
  details: string;
  timestamp: number;
}

const DB_NAME = 'truckflow-activity-log-db';
const STORE_NAME = 'activity-logs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('username', 'username', { unique: false });
        store.createIndex('role', 'role', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function logActivity(
  user: { username: string; displayName: string; role: string } | null,
  action: string,
  details: string
) {
  if (!user) return;
  const record: ActivityRecord = {
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    action,
    details,
    timestamp: Date.now(),
  };

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    tx.oncomplete = () => db.close();
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

export async function getActivityLogs(): Promise<ActivityRecord[]> {
  try {
    const db = await openDB();
    const records = await new Promise<ActivityRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        // sort by timestamp descending
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return records;
  } catch (err) {
    console.error('Failed to get activity logs:', err);
    return [];
  }
}

export async function clearActivityLogs(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (err) {
    console.error('Failed to clear activity logs:', err);
  }
}
