import React, { createContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../services/apiClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (token && !user) {
      apiClient
        .get('/api/auth/me')
        .then((response) => {
          setUser(response.data);
        })
        .catch(() => {
          logout();
        });
    }
  }, [token, user]);

  useEffect(() => {
    if (!token && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [token, location, navigate]);

  const login = async (credentials) => {
    const response = await apiClient.post('/api/auth/login', credentials);
    const { token: jwt, user: loggedInUser } = response.data;
    localStorage.setItem('token', jwt);
    setToken(jwt);
    setUser(loggedInUser);
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  const value = {
    user,
    token,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
