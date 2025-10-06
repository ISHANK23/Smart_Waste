import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as LocalAuthentication from 'expo-local-authentication';
import api, { setAuthToken, configureAuthHandlers } from '../services/api';
const extras = (globalThis.Expo || {}).Constants?.expoConfig?.extra ?? (globalThis.Expo || {}).Constants?.manifestExtra ?? {};
const API_URL = extras?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const AuthStateContext = createContext();
const AuthDispatchContext = createContext();
const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  expiresAt: null,
  loading: true
};
function authReducer(state, action) {
  switch (action.type) {
    case 'RESTORE':
      return { ...state, ...action.payload, loading: false };
    case 'LOGIN':
      return { ...state, ...action.payload, loading: false };
    case 'LOGOUT':
      return { ...state, token: null, refreshToken: null, user: null, expiresAt: null, loading: false };
    default:
      return state;
  }
}
const STORAGE_KEYS = {
  token: 'smartwaste_token',
  refresh: 'smartwaste_refresh',
  user: 'smartwaste_user',
  expires: 'smartwaste_expires'
};
const persistAuth = async ({ token, refreshToken, user, expiresAt }) => {
  const entries = [];
  if (token) entries.push([STORAGE_KEYS.token, token]);
  if (refreshToken) entries.push([STORAGE_KEYS.refresh, refreshToken]);
  if (user) entries.push([STORAGE_KEYS.user, JSON.stringify(user)]);
  if (expiresAt) entries.push([STORAGE_KEYS.expires, expiresAt]);
  if (entries.length > 0) {
    await AsyncStorage.multiSet(entries);
  }
};
const clearPersisted = async () => {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
};
const attemptBiometricUnlock = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return true;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Smart Waste',
      fallbackLabel: 'Enter passcode',
      disableDeviceFallback: false
    });
    return result.success;
  } catch (error) {
    console.warn('Biometric unlock error', error.message);
    return false;
  }
};
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const refreshTimer = useRef(null);
  const refreshTokensRef = useRef(null);
  const logoutRef = useRef(null);
  const scheduleRefresh = useCallback((expiresAt) => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }
    if (!expiresAt) return;
    const msUntilRefresh = new Date(expiresAt).getTime() - Date.now() - 30000;
    if (Number.isNaN(msUntilRefresh)) return;
    const timeout = msUntilRefresh > 0 ? msUntilRefresh : 0;
    refreshTimer.current = setTimeout(() => {
      if (refreshTokensRef.current) {
        refreshTokensRef
          .current()
          .catch(() => {
            if (logoutRef.current) {
              logoutRef.current({ silent: true });
            }
          });
      }
    }, timeout);
  }, []);
  const refreshTokens = useCallback(async () => {
    const storedRefresh = state.refreshToken || (await AsyncStorage.getItem(STORAGE_KEYS.refresh));
    if (!storedRefresh) {
      throw new Error('No refresh token');
    }
    const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken: storedRefresh });
    setAuthToken(data.token);
    await persistAuth(data);
    dispatch({ type: 'LOGIN', payload: data });
    scheduleRefresh(data.expiresAt);
    return data;
  }, [state.refreshToken, scheduleRefresh]);
  const logout = useCallback(
    async ({ silent } = {}) => {
      const refreshToRevoke = state.refreshToken || (await AsyncStorage.getItem(STORAGE_KEYS.refresh));
      setAuthToken(null);
      dispatch({ type: 'LOGOUT' });
      scheduleRefresh(null);
      await clearPersisted();
      if (refreshToRevoke && !silent) {
        try {
          await axios.post(`${API_URL}/api/auth/logout`, { refreshToken: refreshToRevoke });
        } catch (error) {
          console.warn('Failed to revoke refresh token', error.message);
        }
      }
    },
    [state.refreshToken, scheduleRefresh]
  );
  useEffect(() => {
    configureAuthHandlers({
      onRefresh: refreshTokens,
      onLogout: () => logout({ silent: true })
    });
  }, [refreshTokens, logout]);
  useEffect(() => {
    refreshTokensRef.current = refreshTokens;
  }, [refreshTokens]);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [[, token], [, refresh], [, userRaw], [, expiresAt]] = await AsyncStorage.multiGet(Object.values(STORAGE_KEYS));
        if (token && refresh) {
          const biometricOk = await attemptBiometricUnlock();
          if (!biometricOk) {
            await clearPersisted();
            dispatch({ type: 'RESTORE', payload: {} });
            return;
          }
          setAuthToken(token);
          const parsedUser = userRaw ? JSON.parse(userRaw) : null;
          dispatch({ type: 'RESTORE', payload: { token, refreshToken: refresh, user: parsedUser, expiresAt } });
          scheduleRefresh(expiresAt);
          try {
            const { data } = await api.get('/api/auth/me');
            await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data));
            dispatch({ type: 'LOGIN', payload: { token, refreshToken: refresh, user: data, expiresAt } });
          } catch (error) {
            console.warn('Failed to validate token', error.message);
            await logout({ silent: true });
          }
        } else {
          dispatch({ type: 'RESTORE', payload: {} });
        }
      } catch (error) {
        console.warn('Failed to restore auth state', error.message);
        dispatch({ type: 'RESTORE', payload: {} });
      }
    };
    bootstrap();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [scheduleRefresh, logout]);
  const login = useCallback(
    async (credentials) => {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, credentials);
      setAuthToken(data.token);
      await persistAuth(data);
      dispatch({ type: 'LOGIN', payload: data });
      scheduleRefresh(data.expiresAt);
    },
    [scheduleRefresh]
  );
  const register = useCallback(
    async (payload) => {
      const { data } = await axios.post(`${API_URL}/api/auth/register`, payload);
      setAuthToken(data.token);
      await persistAuth(data);
      dispatch({ type: 'LOGIN', payload: data });
      scheduleRefresh(data.expiresAt);
    },
    [scheduleRefresh]
  );
  const stateValue = useMemo(() => ({ ...state }), [state]);
  const actions = useMemo(
    () => ({
      login,
      register,
      logout,
      refreshTokens
    }),
    [login, register, logout, refreshTokens]
  );
  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthDispatchContext.Provider value={actions}>{children}</AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  );
};
export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  return context;
};
export const useAuthActions = () => {
  const context = useContext(AuthDispatchContext);
  if (context === undefined) {
    throw new Error('useAuthActions must be used within an AuthProvider');
  }
  return context;
};