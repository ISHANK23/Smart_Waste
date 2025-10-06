import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../services/apiClient';
import { AuthContext } from './AuthContext';
import { ConnectivityContext } from './ConnectivityContext';
const STORAGE_KEY = 'smartwaste_web_sync_cache';
const loadCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cache: {}, lastSync: null };
    const parsed = JSON.parse(raw);
    return {
      cache: parsed.cache || {},
      lastSync: parsed.lastSync || null
    };
  } catch (error) {
    console.warn('Failed to parse sync cache', error);
    return { cache: {}, lastSync: null };
  }
};
const saveCache = (payload) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};
const deriveKey = (item = {}) => {
  if (!item) return null;
  const candidate =
    item._id ||
    item.clientReference ||
    item.id ||
    item.binId ||
    item.bin?.binId ||
    item.transactionId ||
    item.pickupId;
  if (candidate) return candidate;
  const descriptor = [
    item.type,
    item.status,
    item.wasteType,
    item.location,
    item.description,
    item.amount,
    item.weight
  ]
    .filter(Boolean)
    .join('-');
  const timestamp =
    item.updatedAt || item.updatedAtLocal || item.timestamp || item.createdAt || item.scheduledDate;
  if (!timestamp && !descriptor) return null;
  return `${descriptor || 'item'}-${timestamp}`;
};
const mergeCollections = (existing = [], updates = []) => {
  const map = new Map();
  const stamp = (item) =>
    new Date(item.updatedAt || item.timestamp || item.createdAt || item.updatedAtLocal || item.scheduledDate || 0).getTime();
  existing.forEach((item) => {
    const key = deriveKey(item);
    if (key) {
      map.set(key, item);
    }
  });
  updates.forEach((item) => {
    const key = deriveKey(item);
    if (!key) return;
    const current = map.get(key);
    if (!current || stamp(item) >= stamp(current)) {
      map.set(key, { ...current, ...item });
    }
  });
  return Array.from(map.values()).sort((a, b) => stamp(b) - stamp(a));
};
export const SyncContext = createContext({
  data: {},
  lastSync: null,
  loading: false,
  error: null,
  refresh: async () => {}
});
export const SyncProvider = ({ children }) => {
  const { token, user } = useContext(AuthContext);
  const { online } = useContext(ConnectivityContext);
  const [{ cache, lastSync }, setCache] = useState(() => loadCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const syncTimer = useRef();
  const lastSyncRef = useRef(lastSync);
  useEffect(() => {
    lastSyncRef.current = lastSync;
  }, [lastSync]);
  const persist = useCallback((nextCache, nextSync) => {
    saveCache({ cache: nextCache, lastSync: nextSync });
    lastSyncRef.current = nextSync;
    setCache({ cache: nextCache, lastSync: nextSync });
  }, []);
  const refresh = useCallback(async () => {
    if (!token || !online) return;
    setLoading(true);
    setError(null);
    try {
      const params = lastSyncRef.current ? { since: lastSyncRef.current } : {};
      const { data } = await apiClient.get('/api/sync/updates', { params });
      setCache((prev) => {
        const prevCache = prev.cache || {};
        const merged = {
          bins: mergeCollections(prevCache.bins, data.bins),
          pickups: mergeCollections(prevCache.pickups, data.pickups),
          transactions: mergeCollections(prevCache.transactions, data.transactions),
          collections: mergeCollections(prevCache.collections, data.collections)
        };
        const nextState = { cache: merged, lastSync: data.serverTime };
        saveCache(nextState);
        lastSyncRef.current = data.serverTime;
        return nextState;
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token, online]);
  useEffect(() => {
    if (!token) {
      persist({}, null);
    }
  }, [token, persist]);
  useEffect(() => {
    if (syncTimer.current) {
      clearInterval(syncTimer.current);
    }
    if (token && online) {
      refresh().catch((err) => setError(err));
      syncTimer.current = setInterval(() => {
        refresh().catch((err) => setError(err));
      }, 15000);
    }
    return () => {
      if (syncTimer.current) clearInterval(syncTimer.current);
    };
  }, [token, online, refresh]);
  const value = useMemo(
    () => ({
      data: {
        bins: cache.bins || [],
        pickups: cache.pickups || [],
        transactions: cache.transactions || [],
        collections: cache.collections || []
      },
      lastSync,
      loading,
      error,
      refresh,
      online
    }),
    [cache, lastSync, loading, error, refresh, online]
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};