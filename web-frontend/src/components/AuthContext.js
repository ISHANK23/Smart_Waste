import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import apiClient, { configureAuthHandlers, updateAccessToken } from '../services/apiClient';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
export const AuthContext = createContext();
const loadPersisted = () => {
  try {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const expiresAt = localStorage.getItem('tokenExpiresAt');
    const userRaw = localStorage.getItem('authUser');
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token, refreshToken, expiresAt, user };
  } catch (error) {
    console.warn('Failed to load persisted auth state', error);
    return { token: null, refreshToken: null, expiresAt: null, user: null };
  }
};
export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setAuthState] = useState(() => ({
    ...loadPersisted(),
    loading: true
  }));
  const { token, refreshToken, expiresAt, user } = state;
  const refreshTokenRef = useRef(refreshToken);
  const persistState = useCallback((payload) => {
    if (payload.token) {
      localStorage.setItem('token', payload.token);
      updateAccessToken(payload.token);
    } else {
      localStorage.removeItem('token');
      updateAccessToken(null);
    }
    if (payload.refreshToken) {
      localStorage.setItem('refreshToken', payload.refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
    if (payload.expiresAt) {
      localStorage.setItem('tokenExpiresAt', payload.expiresAt);
    } else {
      localStorage.removeItem('tokenExpiresAt');
    }
    if (payload.user) {
      localStorage.setItem('authUser', JSON.stringify(payload.user));
    } else if (payload.user === null) {
      localStorage.removeItem('authUser');
    }
  }, []);
  const setState = useCallback((updater) => {
    setAuthState((prev) => {
      const next = typeof updater === 'function' ? { ...prev, ...updater(prev) } : { ...prev, ...updater };
      refreshTokenRef.current = next.refreshToken;
      return next;
    });
  }, []);
  const refreshTokens = useCallback(async () => {
    const tokenToUse = refreshTokenRef.current || localStorage.getItem('refreshToken');
    if (!tokenToUse) {
      throw new Error('No refresh token');
    }
    const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken: tokenToUse });
    persistState(data);
    setState({ ...data, loading: false });
    return data;
  }, [persistState, setState]);
  const logout = useCallback(
    async ({ silent } = {}) => {
      const tokenToRevoke = refreshTokenRef.current;
      persistState({ token: null, refreshToken: null, expiresAt: null, user: null });
      setState({ token: null, refreshToken: null, expiresAt: null, user: null, loading: false });
      if (tokenToRevoke && !silent) {
        try {
          await axios.post(`${API_URL}/api/auth/logout`, { refreshToken: tokenToRevoke });
        } catch (error) {
          console.warn('Failed to revoke refresh token', error);
        }
      }
      navigate('/login');
    },
    [navigate, persistState, setState]
  );
  const login = useCallback(
    async (credentials) => {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, credentials);
      persistState(data);
      setState({ ...data, loading: false });
      navigate('/dashboard');
    },
    [navigate, persistState, setState]
  );
  const register = useCallback(
    async (payload) => {
      const { data } = await axios.post(`${API_URL}/api/auth/register`, payload);
      persistState(data);
      setState({ ...data, loading: false });
      navigate('/dashboard');
    },
    [navigate, persistState, setState]
  );
  useEffect(() => {
    configureAuthHandlers({
      onRefresh: refreshTokens,
      onLogout: () => logout({ silent: true })
    });
  }, [refreshTokens, logout]);
  useEffect(() => {
    updateAccessToken(token);
  }, [token]);
  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);
  useEffect(() => {
    let isMounted = true;
    const initialise = async () => {
      if (!token || !refreshToken) {
        setState({ loading: false });
        return;
      }
      try {
        const { data } = await apiClient.get('/api/auth/me');
        if (!isMounted) return;
        persistState({ token, refreshToken, expiresAt, user: data });
        setState({ token, refreshToken, expiresAt, user: data, loading: false });
      } catch (error) {
        if (isMounted) {
          await logout({ silent: true });
        }
      } finally {
        if (isMounted) {
          setState({ loading: false });
        }
      }
    };
    initialise();
    return () => {
      isMounted = false;
    };
  }, [token, refreshToken, expiresAt, persistState, setState, logout]);
  useEffect(() => {
    if (!token || !expiresAt) return undefined;
    const expiresInMs = new Date(expiresAt).getTime() - Date.now() - 30000;
    if (Number.isNaN(expiresInMs) || expiresInMs <= 0) {
      refreshTokens().catch(() => logout({ silent: true }));
      return undefined;
    }
    const timeout = setTimeout(() => {
      refreshTokens().catch(() => logout({ silent: true }));
    }, expiresInMs);
    return () => clearTimeout(timeout);
  }, [token, expiresAt, refreshTokens, logout]);
  useEffect(() => {
    if (!token && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [token, location, navigate]);
  const value = useMemo(
    () => ({
      user,
      token,
      refreshToken,
      expiresAt,
      loading: state.loading,
      login,
      logout: () => logout({ silent: false }),
      register,
      refreshTokens
    }),
    [user, token, refreshToken, expiresAt, state.loading, login, logout, register, refreshTokens]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};