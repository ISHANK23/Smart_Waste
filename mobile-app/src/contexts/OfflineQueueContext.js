import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api';
const OfflineContext = createContext();
const initialState = {
  isConnected: true,
  pendingCollections: []
};
function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONNECTION':
      return { ...state, isConnected: action.payload };
    case 'RESTORE':
      return { ...state, pendingCollections: action.payload };
    case 'QUEUE_COLLECTION':
      return { ...state, pendingCollections: [...state.pendingCollections, action.payload] };
    case 'REMOVE_COLLECTION':
      return {
        ...state,
        pendingCollections: state.pendingCollections.filter((item) => item.id !== action.payload)
      };
    default:
      return state;
  }
}
const STORAGE_KEY = 'smartwaste_pending_collections';
export const OfflineQueueProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const syncingRef = useRef(false);
  useEffect(() => {
    const restore = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        dispatch({ type: 'RESTORE', payload: JSON.parse(stored) });
      }
    };
    restore();
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingCollections));
  }, [state.pendingCollections]);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((stateInfo) => {
      dispatch({ type: 'SET_CONNECTION', payload: !!stateInfo.isConnected });
    });
    NetInfo.fetch().then((stateInfo) => {
      dispatch({ type: 'SET_CONNECTION', payload: !!stateInfo.isConnected });
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (state.isConnected && state.pendingCollections.length > 0) {
      syncPendingCollections();
    }
  }, [state.isConnected, state.pendingCollections, syncPendingCollections]);
  const syncPendingCollections = useCallback(async () => {
    if (syncingRef.current || !state.isConnected || state.pendingCollections.length === 0) {
      return;
    }
    syncingRef.current = true;
    try {
      for (const record of state.pendingCollections) {
        try {
          await api.post('/api/collections/scan', record.payload);
          dispatch({ type: 'REMOVE_COLLECTION', payload: record.id });
        } catch (error) {
          console.warn('Failed to sync record', error?.message || error);
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [state.isConnected, state.pendingCollections]);
  const queueCollection = useCallback((payload) => {
    const item = {
      id: `${Date.now()}-${Math.random()}`,
      payload: {
        ...payload,
        clientReference: payload.clientReference || `collection-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: payload.timestamp || new Date().toISOString()
      }
    };
    dispatch({ type: 'QUEUE_COLLECTION', payload: item });
  }, []);
  const value = useMemo(
    () => ({
      isConnected: state.isConnected,
      pendingCollections: state.pendingCollections,
      queueCollection,
      syncPendingCollections
    }),
    [queueCollection, state.isConnected, state.pendingCollections, syncPendingCollections]
  );
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
};
export const useOfflineQueue = () => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  }
  return context;
};