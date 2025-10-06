import { useCallback, useEffect, useRef, useState } from 'react';
const readStorage = (key) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to parse offline queue', error);
    return [];
  }
};
export const useOfflineQueue = (storageKey, submitFn, isOnline) => {
  const [queue, setQueue] = useState(() => readStorage(storageKey));
  const syncingRef = useRef(false);
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(queue));
  }, [queue, storageKey]);
  const remove = useCallback((id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);
  const enqueue = useCallback((payload) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      payload,
      updatedAt: new Date().toISOString()
    };
    setQueue((prev) => [...prev, entry]);
    return entry;
  }, []);
  const sync = useCallback(async () => {
    if (!isOnline || syncingRef.current || queue.length === 0) return;
    syncingRef.current = true;
    try {
      for (const item of queue) {
        try {
          await submitFn(item);
          remove(item.id);
        } catch (error) {
          if (error?.response?.status === 409 || error?.response?.data?.duplicate) {
            remove(item.id);
          } else {
            throw error;
          }
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [isOnline, queue, remove, submitFn]);
  useEffect(() => {
    if (isOnline) {
      sync().catch((error) => console.warn('Offline sync failed', error));
    }
  }, [isOnline, sync]);
  return { queue, enqueue, remove, sync, isSyncing: syncingRef.current };
};
export default useOfflineQueue;