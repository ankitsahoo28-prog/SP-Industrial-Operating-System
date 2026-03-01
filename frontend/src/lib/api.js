import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const userApi = {
  getUsers: () => api.get('/users'),
  createUser: (userData) => api.post('/users', userData),
};

export const taskApi = {
  getTasks: (params) => api.get('/tasks', { params }),
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

export const accountingApi = {
  createTransaction: (transactionData) => api.post('/transactions', transactionData),
  getTransactions: () => api.get('/transactions'),
  updateTransaction: (id, data) => api.put(`/transactions/${id}`, data),
  getLedger: () => api.get('/ledger'),
  getSummary: () => api.get('/accounting/summary'),
  exportPdf: () => api.get('/export/transactions/pdf', { responseType: 'blob' }),
  exportCsv: () => api.get('/export/ledger/csv', { responseType: 'blob' }),
};

export const inventoryApi = {
  createItem: (itemData) => api.post('/inventory', itemData),
  getItems: () => api.get('/inventory'),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

export const auditApi = {
  getLogs: (params) => api.get('/audit-logs', { params }),
};

export const deleteUser = (userId) => api.delete(`/users/${userId}`);