import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('swasthya_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('swasthya_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.auth.getMe()
        .then(res => {
          setUser(res.user);
          localStorage.setItem('swasthya_user', JSON.stringify(res.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await api.auth.login(username, password);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('swasthya_token', res.token);
    localStorage.setItem('swasthya_user', JSON.stringify(res.user));
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('swasthya_token');
    localStorage.removeItem('swasthya_user');
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) return roles.includes(user.role);
    return user.role === roles;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

