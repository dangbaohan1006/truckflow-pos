import { useState, useCallback } from 'react';
import { syncProvider } from '../../database/sync';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const triggerSync = useCallback(async () => {
    try {
      setStatus('syncing');
      setError(null);
      await syncProvider();
      setStatus('success');
    } catch (err: any) {
      console.error('Sync failed:', err);
      setStatus('error');
      setError(err.message || 'Unknown sync error');
    }
  }, []);

  return { status, error, triggerSync };
}
