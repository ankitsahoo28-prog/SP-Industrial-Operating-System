import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API functions
export const userApi = {
  getUsers: () => api.get('/users'),
  createUser: (userData) => api.post('/users', userData),
};

export const taskApi = {
  getTasks: () => api.get('/tasks'),
  createTask: (taskData) => api.post('/tasks', taskData),
  updateTask: (taskId, updateData) => api.patch(`/tasks/${taskId}`, updateData),
};

export const locationApi = {
  recordLocation: (locationData) => api.post('/locations', locationData),
  getUserLocations: (userId) => api.get(`/locations/${userId}`),
};

export const reportApi = {
  createReport: (reportData) => api.post('/reports', reportData),
  getReports: (type) => api.get('/reports', { params: { report_type: type } }),
};

export const indentApi = {
  getIndents: () => api.get('/indents'),
  createIndent: (indentData) => api.post('/indents', indentData),
  authorizeIndent: (indentId, authData) => api.patch(`/indents/${indentId}/authorize`, authData),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};