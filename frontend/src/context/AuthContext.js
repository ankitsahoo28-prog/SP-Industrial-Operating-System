import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { initializeSocket, disconnectSocket, requestNotificationPermission } from '@/lib/websocket';
import { processSyncQueue } from '@/lib/offlineDb';

const AuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      console.log('\u2713 Back online - syncing data...');
      try {
        await processSyncQueue(axios);
        console.log('\u2713 Sync complete');
      } catch (error) {
        console.error('Sync failed:', error);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('\u26a0 Offline mode activated');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Axios interceptor for adding token
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (token && config.url.includes(API)) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, [token]);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userData = response.data;
        setUser(userData);
        
        // Initialize WebSocket
        initializeSocket(token, userData.id);
        
        // Request notification permission
        await requestNotificationPermission();
      } catch (error) {
        console.error('Failed to fetch user:', error);
        localStorage.removeItem('token');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('\u2713 Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { token: newToken, user: userData } = response.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      
      // Initialize WebSocket
      initializeSocket(newToken, userData.id);
      
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      const { token: newToken, user: newUser } = response.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('token', newToken);
      
      // Initialize WebSocket
      initializeSocket(newToken, newUser.id);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    disconnectSocket();
  };

  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role === 'director') return true;
    const perms = user.permissions || [];
    if (perms.includes('all')) return true;
    return perms.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isOnline, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};