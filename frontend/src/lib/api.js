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
  getReports: (type, businessType) => api.get('/reports', { params: { report_type: type, business_type: businessType } }),
};

export const indentApi = {
  getIndents: (params) => api.get('/indents', { params }),
  createIndent: (indentData) => api.post('/indents', indentData),
  authorizeIndent: (indentId, authData) => api.patch(`/indents/${indentId}/authorize`, authData),
};

export const accountingApi = {
  createTransaction: (transactionData) => api.post('/transactions', transactionData),
  getTransactions: (params) => api.get('/transactions', { params }),
  updateTransaction: (id, data) => api.put(`/transactions/${id}`, data),
  getLedger: (params) => api.get('/ledger', { params }),
  getSummary: (params) => api.get('/accounting/summary', { params }),
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

// Double-Entry Bookkeeping APIs
export const bookkeepingApi = {
  analyzeTransaction: (statement) => api.post('/ai-accountant/analyze', { statement }),
  postJournalEntry: (narration, lines) => api.post('/journal-entries', { narration, lines }),
  getJournalEntries: () => api.get('/journal-entries'),
  getAccounts: () => api.get('/accounts'),
  getAccountLedger: (accountId) => api.get(`/account-ledger/${accountId}`),
  getLedgerBalances: () => api.get('/ledger-balances'),
  getTrialBalance: () => api.get('/reports/trial-balance'),
  getProfitLoss: () => api.get('/reports/profit-loss'),
  getBalanceSheet: () => api.get('/reports/balance-sheet'),
};