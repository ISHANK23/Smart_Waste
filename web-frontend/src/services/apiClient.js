import axios from 'axios';
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
});
let accessToken = localStorage.getItem('token');
let refreshHandler = null;
let logoutHandler = null;
let isRefreshing = false;
let refreshPromise = null;
const requestQueue = [];
const setAuthHeader = (token) => {
  accessToken = token;
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};
setAuthHeader(accessToken);
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
const flushQueue = (error, token) => {
  requestQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  requestQueue.length = 0;
};
apiClient.interceptors.response.use(
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
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshHandler()
          .then((tokens) => {
            const newToken = tokens?.token;
            setAuthHeader(newToken);
            flushQueue(null, newToken);
            return newToken;
          })
          .catch((refreshError) => {
            flushQueue(refreshError, null);
            if (logoutHandler) logoutHandler();
            throw refreshError;
          })
          .finally(() => {
            isRefreshing = false;
          });
      }
      return new Promise((resolve, reject) => {
        requestQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject
        });
      });
    }
    return Promise.reject(error);
  }
);
export const configureAuthHandlers = ({ onRefresh, onLogout }) => {
  refreshHandler = onRefresh;
  logoutHandler = onLogout;
};
export const updateAccessToken = (token) => {
  setAuthHeader(token);
};
export default apiClient;