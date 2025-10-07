import axios from 'axios';
import Constants from 'expo-constants';
const extras = Constants.expoConfig?.extra ?? Constants.manifestExtra ?? {};
const baseURL = extras.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';
const api = axios.create({
  baseURL,
  timeout: 10000
});
let accessToken = null;
let refreshHandler = null;
let logoutHandler = null;
let isRefreshing = false;
const pendingQueue = [];
const setHeader = (token) => {
  accessToken = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
export const setAuthToken = (token) => {
  setHeader(token);
};
export const configureAuthHandlers = ({ onRefresh, onLogout }) => {
  refreshHandler = onRefresh;
  logoutHandler = onLogout;
};
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
const flushQueue = (error, token) => {
  while (pendingQueue.length) {
    const { resolve, reject, originalRequest } = pendingQueue.shift();
    if (error) {
      reject(error);
    } else {
      originalRequest.headers.Authorization = `Bearer ${token}`;
      resolve(api(originalRequest));
    }
  }
};
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;
    if (status === 401 && refreshHandler) {
      if (originalRequest._retry) {
        if (logoutHandler) logoutHandler();
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject, originalRequest });
        });
      }
      isRefreshing = true;
      try {
        const tokens = await refreshHandler();
        const newToken = tokens?.token;
        setHeader(newToken);
        flushQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        if (logoutHandler) logoutHandler();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
export default api;