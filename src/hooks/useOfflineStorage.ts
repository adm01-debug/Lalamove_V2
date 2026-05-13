import { openDB, IDBPDatabase } from 'idb';
import { useCallback, useEffect, useState } from 'react';

// Database value type
interface OfflineItem {
  id: string;
  data: unknown;
  timestamp: number;
  synced: boolean;
}

interface PendingAction {
  id: string;
  type: 'approve' | 'reject' | 'dismiss' | 'update';
  entityType: 'approval' | 'alert' | 'driver' | 'order';
  entityId: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

interface Setting {
  key: string;
  value: unknown;
  timestamp: number;
}

const DB_NAME = 'lalamove-offline-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Pending Approvals store
      if (!db.objectStoreNames.contains('pendingApprovals')) {
        const approvalStore = db.createObjectStore('pendingApprovals', { keyPath: 'id' });
        approvalStore.createIndex('by-synced', 'synced');
      }

      // Alerts store
      if (!db.objectStoreNames.contains('alerts')) {
        const alertStore = db.createObjectStore('alerts', { keyPath: 'id' });
        alertStore.createIndex('by-synced', 'synced');
      }

      // Drivers store
      if (!db.objectStoreNames.contains('drivers')) {
        const driverStore = db.createObjectStore('drivers', { keyPath: 'id' });
        driverStore.createIndex('by-synced', 'synced');
      }

      // Orders store
      if (!db.objectStoreNames.contains('orders')) {
        const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
        orderStore.createIndex('by-synced', 'synced');
      }

      // Pending Actions store (for offline mutations)
      if (!db.objectStoreNames.contains('pendingActions')) {
        const actionStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
        actionStore.createIndex('by-type', 'type');
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

type StoreName = 'pendingApprovals' | 'alerts' | 'drivers' | 'orders';

export function useOfflineStorage<T>(storeName: StoreName) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache data locally
  const cacheData = useCallback(async (items: { id: string; data: T }[]) => {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const item of items) {
      await store.put({
        id: item.id,
        data: item.data,
        timestamp: Date.now(),
        synced: true,
      } as OfflineItem);
    }

    await tx.done;
  }, [storeName]);

  // Get cached data
  const getCachedData = useCallback(async (): Promise<T[]> => {
    const db = await getDB();
    const items = await db.getAll(storeName) as OfflineItem[];
    return items.map(item => item.data as T);
  }, [storeName]);

  // Get single item
  const getCachedItem = useCallback(async (id: string): Promise<T | undefined> => {
    const db = await getDB();
    const item = await db.get(storeName, id) as OfflineItem | undefined;
    return item?.data as T | undefined;
  }, [storeName]);

  // Queue an action for offline sync
  const queueAction = useCallback(async (
    type: 'approve' | 'reject' | 'dismiss' | 'update',
    entityType: 'approval' | 'alert' | 'driver' | 'order',
    entityId: string,
    payload: unknown
  ) => {
    const db = await getDB();
    const id = `${type}-${entityId}-${Date.now()}`;
    
    await db.put('pendingActions', {
      id,
      type,
      entityType,
      entityId,
      payload,
      timestamp: Date.now(),
      retries: 0,
    } as PendingAction);

    setPendingSync(prev => prev + 1);
    return id;
  }, []);

  // Get pending actions
  const getPendingActions = useCallback(async (): Promise<PendingAction[]> => {
    const db = await getDB();
    return db.getAll('pendingActions') as Promise<PendingAction[]>;
  }, []);

  // Remove pending action (after successful sync)
  const removePendingAction = useCallback(async (id: string) => {
    const db = await getDB();
    await db.delete('pendingActions', id);
    setPendingSync(prev => Math.max(0, prev - 1));
  }, []);

  // Clear all cached data for a store
  const clearCache = useCallback(async () => {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).clear();
    await tx.done;
  }, [storeName]);

  // Check pending sync count on mount
  useEffect(() => {
    getPendingActions().then(actions => {
      setPendingSync(actions.length);
    });
  }, [getPendingActions]);

  return {
    isOnline,
    pendingSync,
    cacheData,
    getCachedData,
    getCachedItem,
    queueAction,
    getPendingActions,
    removePendingAction,
    clearCache,
  };
}

// Settings storage hook
export function useOfflineSettings() {
  const getSetting = useCallback(async <T>(key: string, defaultValue: T): Promise<T> => {
    const db = await getDB();
    const item = await db.get('settings', key) as Setting | undefined;
    return (item?.value as T) ?? defaultValue;
  }, []);

  const setSetting = useCallback(async <T>(key: string, value: T) => {
    const db = await getDB();
    await db.put('settings', {
      key,
      value,
      timestamp: Date.now(),
    } as Setting);
  }, []);

  return { getSetting, setSetting };
}

// Sync manager for background sync
export class OfflineSyncManager {
  private static instance: OfflineSyncManager;
  private syncInProgress = false;
  private listeners: Set<(status: 'syncing' | 'synced' | 'error') => void> = new Set();

  static getInstance(): OfflineSyncManager {
    if (!OfflineSyncManager.instance) {
      OfflineSyncManager.instance = new OfflineSyncManager();
    }
    return OfflineSyncManager.instance;
  }

  addListener(listener: (status: 'syncing' | 'synced' | 'error') => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(status: 'syncing' | 'synced' | 'error') {
    this.listeners.forEach(listener => listener(status));
  }

  async syncPendingActions(
    syncFn: (action: {
      type: string;
      entityType: string;
      entityId: string;
      payload: unknown;
    }) => Promise<boolean>
  ) {
    if (this.syncInProgress || !navigator.onLine) return;

    this.syncInProgress = true;
    this.notify('syncing');

    try {
      const db = await getDB();
      const pendingActions = await db.getAll('pendingActions') as PendingAction[];

      for (const action of pendingActions) {
        try {
          const success = await syncFn({
            type: action.type,
            entityType: action.entityType,
            entityId: action.entityId,
            payload: action.payload,
          });

          if (success) {
            await db.delete('pendingActions', action.id);
          } else {
            // Increment retry count
            await db.put('pendingActions', {
              ...action,
              retries: action.retries + 1,
            });
          }
        } catch (error) {
          console.error('Error syncing action:', error);
          // Increment retry count
          await db.put('pendingActions', {
            ...action,
            retries: action.retries + 1,
          });
        }
      }

      this.notify('synced');
    } catch (error) {
      console.error('Error during sync:', error);
      this.notify('error');
    } finally {
      this.syncInProgress = false;
    }
  }
}
