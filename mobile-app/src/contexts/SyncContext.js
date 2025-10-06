import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import api from '../services/api';
import { useAuthState } from './AuthContext';
const STORAGE_KEY = 'smartwaste_mobile_sync_cache';
const NOTIFICATION_TRACK_KEY = 'smartwaste_notification_tracker';
const defaultCache = { bins: [], pickups: [], transactions: [], collections: [] };
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
  const stamp = (item) =>
    new Date(item.updatedAt || item.timestamp || item.createdAt || item.updatedAtLocal || item.scheduledDate || 0).getTime();
  const map = new Map();
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
  data: defaultCache,
  lastSync: null,
  loading: false,
  error: null,
  online: true,
  refresh: async () => {}
});
export const SyncProvider = ({ children }) => {
  const { token } = useAuthState();
  const [cache, setCache] = useState(defaultCache);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(true);
  const lastSyncRef = useRef(null);
  const intervalRef = useRef(null);
  const notificationStateRef = useRef({
    bins: new Set(),
    pickups: new Set(),
    payments: new Set()
  });
  const notificationReadyRef = useRef(false);
  useEffect(() => {
    const restore = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setCache({ ...defaultCache, ...(parsed.cache || {}) });
          setLastSync(parsed.lastSync || null);
          lastSyncRef.current = parsed.lastSync || null;
        }
      } catch (err) {
        console.warn('Failed to restore sync cache', err.message);
      }
    };
    restore();
  }, []);
  useEffect(() => {
    let mounted = true;
    const initialiseNotifications = async () => {
      try {
        const [permissions, stored] = await Promise.all([
          Notifications.getPermissionsAsync(),
          AsyncStorage.getItem(NOTIFICATION_TRACK_KEY)
        ]);
        if (!mounted) return;
        const granted = permissions.status === 'granted';
        notificationReadyRef.current = granted;
        if (stored) {
          const parsed = JSON.parse(stored);
          notificationStateRef.current = {
            bins: new Set(parsed?.bins || []),
            pickups: new Set(parsed?.pickups || []),
            payments: new Set(parsed?.payments || [])
          };
        }
      } catch (err) {
        console.warn('Notification initialisation failed', err.message);
      }
    };
    initialiseNotifications();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
    });
    NetInfo.fetch().then((state) => setOnline(Boolean(state.isConnected)));
    return () => unsubscribe();
  }, []);
  const persistNotificationTracker = useCallback(() => {
    const current = notificationStateRef.current;
    AsyncStorage.setItem(
      NOTIFICATION_TRACK_KEY,
      JSON.stringify({
        bins: Array.from(current.bins),
        pickups: Array.from(current.pickups),
        payments: Array.from(current.payments)
      })
    ).catch((err) => console.warn('Failed to persist notification tracker', err.message));
  }, []);
  const scheduleReminder = useCallback(
    async (type, id, content) => {
      if (!notificationReadyRef.current) {
        try {
          const permissions = await Notifications.getPermissionsAsync();
          const granted = permissions.status === 'granted';
          notificationReadyRef.current = granted;
          if (!granted) return false;
        } catch (err) {
          console.warn('Permission check failed', err.message);
          return false;
        }
      }
      const tracker = notificationStateRef.current[type];
      if (!tracker || tracker.has(id)) return false;
      try {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: null
        });
        tracker.add(id);
        return true;
      } catch (err) {
        console.warn('Failed to schedule notification', err.message);
        return false;
      }
    },
    []
  );
  const dropInactive = useCallback((type, activeIds) => {
    const tracker = notificationStateRef.current[type];
    if (!tracker) return false;
    let mutated = false;
    tracker.forEach((id) => {
      if (!activeIds.has(id)) {
        tracker.delete(id);
        mutated = true;
      }
    });
    return mutated;
  }, []);
  const evaluateReminders = useCallback(
    async (merged) => {
      if (!notificationReadyRef.current) return;
      let mutated = false;
      const criticalBins = (merged.bins || []).filter((bin) => (bin.currentLevel || 0) >= 85);
      const activeBinIds = new Set(criticalBins.map((bin) => bin._id || bin.binId));
      mutated = dropInactive('bins', activeBinIds) || mutated;
      for (const bin of criticalBins) {
        const id = bin._id || bin.binId;
        const scheduled = await scheduleReminder('bins', id, {
          title: 'Bin nearing capacity',
          body: `${bin.type ? bin.type.toUpperCase() : 'Waste'} bin ${bin.binId || ''} is ${bin.currentLevel || 0}% full. Schedule a collection.`,
          data: { type: 'bin', id }
        });
        mutated = scheduled || mutated;
      }
      const upcomingPickups = (merged.pickups || []).filter((pickup) => {
        if (!pickup.scheduledDate) return false;
        if (pickup.status !== 'scheduled') return false;
        const timeUntil = new Date(pickup.scheduledDate).getTime() - Date.now();
        return timeUntil > 0 && timeUntil <= 1000 * 60 * 60 * 24; // within 24h
      });
      const activePickupIds = new Set(upcomingPickups.map((pickup) => pickup._id || pickup.clientReference));
      mutated = dropInactive('pickups', activePickupIds) || mutated;
      for (const pickup of upcomingPickups) {
        const id = pickup._id || pickup.clientReference;
        const scheduled = await scheduleReminder('pickups', id, {
          title: 'Pickup reminder',
          body: `Pickup for ${pickup.wasteType} scheduled ${new Date(pickup.scheduledDate).toLocaleString()}.`,
          data: { type: 'pickup', id }
        });
        mutated = scheduled || mutated;
      }
      const pendingPayments = (merged.transactions || []).filter((tx) => tx.status === 'pending');
      const activePaymentIds = new Set(pendingPayments.map((tx) => tx._id || tx.clientReference));
      mutated = dropInactive('payments', activePaymentIds) || mutated;
      for (const tx of pendingPayments) {
        const id = tx._id || tx.clientReference;
        const scheduled = await scheduleReminder('payments', id, {
          title: 'Payment due',
          body: `You have a ${tx.type} of $${Number(tx.amount || 0).toFixed(2)} awaiting payment.`,
          data: { type: 'payment', id }
        });
        mutated = scheduled || mutated;
      }
      if (mutated) {
        persistNotificationTracker();
      }
    },
    [dropInactive, persistNotificationTracker, scheduleReminder]
  );
  const refresh = useCallback(async () => {
    if (!token || !online) return;
    setLoading(true);
    setError(null);
    try {
      const params = lastSyncRef.current ? { since: lastSyncRef.current } : {};
      const { data } = await api.get('/api/sync/updates', { params });
      setCache((prev) => {
        const merged = {
          bins: mergeCollections(prev.bins, data.bins),
          pickups: mergeCollections(prev.pickups, data.pickups),
          transactions: mergeCollections(prev.transactions, data.transactions),
          collections: mergeCollections(prev.collections, data.collections)
        };
        lastSyncRef.current = data.serverTime;
        setLastSync(data.serverTime);
        AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ cache: merged, lastSync: data.serverTime })
        ).catch((err) => console.warn('Failed to persist sync cache', err.message));
        evaluateReminders(merged).catch((err) => console.warn('Reminder evaluation failed', err.message));
        return merged;
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token, online, evaluateReminders]);
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (token && online) {
      refresh();
      intervalRef.current = setInterval(() => {
        refresh();
      }, 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, online, refresh]);
  useEffect(() => {
    if (!token) {
      setCache(defaultCache);
      setLastSync(null);
      lastSyncRef.current = null;
    }
  }, [token]);
  const value = useMemo(
    () => ({
      data: cache,
      lastSync,
      loading,
      error,
      online,
      refresh
    }),
    [cache, lastSync, loading, error, online, refresh]
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};