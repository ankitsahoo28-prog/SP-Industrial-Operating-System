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
  getUserCompanies: (userId) => api.get(`/users/${userId}/companies`),
};

export const taskApi = {
  getTasks: (params) => api.get('/tasks', { params }),
  createTask: (taskData) => api.post('/tasks', taskData),
  updateTask: (taskId, updateData) => api.patch(`/tasks/${taskId}`, updateData),
  deleteTask: (taskId) => api.delete(`/tasks/${taskId}`),
};

export const locationApi = {
  recordLocation: (locationData) => api.post('/locations', locationData),
  getUserLocations: (userId) => api.get(`/locations/${userId}`),
};

export const reportApi = {
  createReport: (reportData) => api.post('/reports', reportData),
  getReports: (type, businessType) => api.get('/reports', { params: { report_type: type, business_type: businessType } }),
  deleteReport: (reportId) => api.delete(`/reports/${reportId}`),
  updateReport: (reportId, data) => api.put(`/reports/${reportId}`, data),
};

export const indentApi = {
  getIndents: (params) => api.get('/indents', { params }),
  createIndent: (indentData) => api.post('/indents', indentData),
  authorizeIndent: (indentId, authData) => api.patch(`/indents/${indentId}/authorize`, authData),
  deleteIndent: (indentId) => api.delete(`/indents/${indentId}`),
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

// New Comprehensive Inventory APIs
export const invApi = {
  getDashboard: (params) => api.get('/inv/dashboard', { params }),
  getItems: (params) => api.get('/inv/items', { params }),
  createItem: (data) => api.post('/inv/items', data),
  getCategories: () => api.get('/inv/categories'),
  recordMovement: (data) => api.post('/inv/stock-movement', data),
  getMovements: (params) => api.get('/inv/movements', { params }),
  recordProduction: (data) => api.post('/inv/production', data),
  getProductions: (params) => api.get('/inv/productions', { params }),
  recordTransfer: (data) => api.post('/inv/transfer', data),
  getTransfers: () => api.get('/inv/transfers'),
  recordLidarScan: (data) => api.post('/inv/lidar-scan', data),
  getLidarScans: (params) => api.get('/inv/lidar-scans', { params }),
  getLowStock: (params) => api.get('/inv/low-stock', { params }),
  getDipHistory: () => api.get('/inv/dip-history'),
  aiAssistant: (statement, business_type) => api.post('/inv/ai-assistant', { statement, business_type }),
  aiExecute: (movements) => api.post('/inv/ai-execute', movements),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getPredictions: () => api.get('/dashboard/predictions'),
};

export const auditApi = {
  getLogs: (params) => api.get('/audit-logs', { params }),
};

export const deleteUser = (userId) => api.delete(`/users/${userId}`);

// Self-registration & Password Reset
export const authApi = {
  selfRegister: (data) => api.post('/auth/self-register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
  getPendingUsers: () => api.get('/auth/pending-users'),
  approveUser: (userId, action) => api.patch(`/auth/approve/${userId}?action=${action}`),
};

// App Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Translations
export const i18nApi = {
  getTranslations: (lang) => api.get(`/translations/${lang}`),
};

// Double-Entry Bookkeeping APIs (company-scoped)
export const bookkeepingApi = {
  analyzeTransaction: (statement) => api.post('/ai-accountant/analyze', { statement }),
  postJournalEntry: (narration, lines, company_id) => api.post('/journal-entries', { narration, lines }, { params: { company_id } }),
  getJournalEntries: (company_id) => api.get('/journal-entries', { params: { company_id } }),
  getAccounts: (company_id) => api.get('/accounts', { params: { company_id } }),
  getAccountLedger: (accountId, company_id) => api.get(`/account-ledger/${accountId}`, { params: { company_id } }),
  getLedgerBalances: (company_id) => api.get('/ledger-balances', { params: { company_id } }),
  getTrialBalance: (company_id) => api.get('/reports/trial-balance', { params: { company_id } }),
  getProfitLoss: (company_id) => api.get('/reports/profit-loss', { params: { company_id } }),
  getBalanceSheet: (company_id) => api.get('/reports/balance-sheet', { params: { company_id } }),
};

// Company Management
export const companyApi = {
  getAll: (include_deleted) => api.get('/companies', { params: { include_deleted } }),
  getMyCompanies: () => api.get('/companies/my-companies'),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  remove: (id) => api.delete(`/companies/${id}`),
  restore: (id) => api.post(`/companies/${id}/restore`),
  activate: (id) => api.post(`/companies/${id}/activate`),
  deactivate: (id) => api.post(`/companies/${id}/deactivate`),
  assignUser: (user_id, company_id) => api.post('/companies/assign-user', { user_id, company_id }),
  assignMultiple: (user_id, company_ids) => api.post('/companies/assign-multiple', { user_id, company_ids }),
  removeUser: (user_id, company_id) => api.post('/companies/remove-user', { user_id, company_id }),
  getUsers: (company_id) => api.get(`/companies/${company_id}/users`),
  getExecutiveReport: (params) => api.get('/director/executive-report', { params }),
};

// Director Features
export const directorApi = {
  getDailySummary: () => api.get('/director/daily-summary'),
  updateJournalEntry: (id, data) => api.put(`/director/journal-entries/${id}`, data),
  deleteJournalEntry: (id) => api.delete(`/director/journal-entries/${id}`),
  changeUserPassword: (user_id, new_password) => api.post('/auth/director-change-password', { user_id, new_password }),
};

// Job Role Management
export const roleApi = {
  getAll: () => api.get('/job-roles'),
  create: (data) => api.post('/job-roles', data),
  update: (id, data) => api.put(`/job-roles/${id}`, data),
  remove: (id) => api.delete(`/job-roles/${id}`),
  getPermissions: () => api.get('/job-roles/permissions'),
};

// Inter-Company Reconciliation
export const reconciliationApi = {
  getAll: (status) => api.get('/reconciliation', { params: { status } }),
  create: (data) => api.post('/reconciliation', data),
  updateStatus: (id, status, notes) => api.patch(`/reconciliation/${id}`, null, { params: { status, notes } }),
  remove: (id) => api.delete(`/reconciliation/${id}`),
};