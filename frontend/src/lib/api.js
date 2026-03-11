import axios from 'axios';

export const API = process.env.REACT_APP_BACKEND_URL + '/api';

export const api = axios.create({ baseURL: API });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Legacy APIs (kept for backward compat)
export const authApi = {
  selfRegister: (data) => api.post('/auth/self-register', data),
  approveUser: (userId, action) => api.patch(`/auth/approve/${userId}?action=${action}`),
  getPendingUsers: () => api.get('/auth/pending-users'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, new_password: password }),
};
export const userApi = {
  getUsers: () => api.get('/users'),
  createUser: (userData) => api.post('/users', userData),
  getUserCompanies: (userId) => api.get(`/users/${userId}/companies`),
  updateJobRole: (userId, jobRoleId) => api.patch(`/users/${userId}/job-role`, null, { params: { job_role_id: jobRoleId } }),
};
export const deleteUser = (userId) => api.delete(`/users/${userId}`);
export const companyApi = {
  getAll: (includeDeleted = false) => api.get('/companies', { params: { include_deleted: includeDeleted } }),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  remove: (id) => api.delete(`/companies/${id}`),
  restore: (id) => api.post(`/companies/${id}/restore`),
  activate: (id) => api.post(`/companies/${id}/activate`),
  deactivate: (id) => api.post(`/companies/${id}/deactivate`),
  assignUser: (userId, companyId) => api.post('/companies/assign-user', { user_id: userId, company_id: companyId }),
  removeUser: (userId, companyId) => api.post('/companies/remove-user', { user_id: userId, company_id: companyId }),
  assignMultiple: (userId, companyIds) => api.post('/companies/assign-multiple', { user_id: userId, company_ids: companyIds }),
  getUsers: (companyId) => api.get(`/companies/${companyId}/users`),
  getMyCompanies: () => api.get('/companies/my-companies'),
};
export const taskApi = {
  getTasks: (params) => api.get('/tasks', { params }),
  createTask: (taskData) => api.post('/tasks', taskData),
  updateTask: (taskId, data) => api.patch(`/tasks/${taskId}`, data),
  deleteTask: (taskId) => api.delete(`/tasks/${taskId}`),
};
export const reportApi = {
  getReports: (params) => api.get('/reports', { params }),
  createReport: (data) => api.post('/reports', data),
  deleteReport: (id) => api.delete(`/reports/${id}`),
};
export const indentApi = {
  getIndents: (params) => api.get('/indents', { params }),
  createIndent: (data) => api.post('/indents', data),
  authorizeIndent: (id, data) => api.patch(`/indents/${id}/authorize`, data),
  deleteIndent: (id) => api.delete(`/indents/${id}`),
};
export const inventoryApi = {
  getItems: (params) => api.get('/inventory', { params }),
  createItem: (data) => api.post('/inventory', data),
};
export const locationApi = {
  record: (data) => api.post('/locations', data),
  getForUser: (userId) => api.get(`/locations/${userId}`),
};
export const dashboardApi = { getStats: () => api.get('/dashboard/stats') };
export const settingsApi = { get: () => api.get('/settings'), update: (data) => api.put('/settings', data) };
export const directorApi = {
  getExecutiveReport: (params) => api.get('/director/executive-report', { params }),
  getDailySummary: () => api.get('/director/daily-summary'),
  changeUserPassword: (userId, newPassword) => api.post('/auth/director-change-password', { user_id: userId, new_password: newPassword }),
  getAiInsights: () => api.get('/dashboard/ai-insights'),
  getPredictions: () => api.get('/dashboard/predictions'),
  getTrends: () => api.get('/dashboard/trends'),
};
export const bookkeepingApi = {
  getAccounts: (params) => api.get('/accounts', { params }),
  postJournalEntry: (data) => api.post('/journal-entries', data),
  getJournalEntries: (params) => api.get('/journal-entries', { params }),
  getAccountLedger: (accountId, params) => api.get(`/account-ledger/${accountId}`, { params }),
  getLedgerBalances: (params) => api.get('/ledger-balances', { params }),
  getTrialBalance: (params) => api.get('/reports/trial-balance', { params }),
  getProfitLoss: (params) => api.get('/reports/profit-loss', { params }),
  getBalanceSheet: (params) => api.get('/reports/balance-sheet', { params }),
  editJournalEntry: (id, data) => api.put(`/director/journal-entries/${id}`, data),
  deleteJournalEntry: (id) => api.delete(`/director/journal-entries/${id}`),
};
export const accountingApi = {
  createTransaction: (d) => api.post('/transactions', d),
  getTransactions: (params) => api.get('/transactions', { params }),
  updateTransaction: (id, d) => api.put(`/transactions/${id}`, d),
  updateAttachments: (id, a) => api.patch(`/transactions/${id}/attachments`, a),
  getLedger: (params) => api.get('/ledger', { params }),
  getSummary: (params) => api.get('/accounting/summary', { params }),
  exportPdf: () => api.get('/export/transactions/pdf', { responseType: 'blob' }),
  exportCsv: () => api.get('/export/ledger/csv', { responseType: 'blob' }),
};
export const invApi = {
  getDashboard: (params) => api.get('/inv/dashboard', { params }),
  getItems: (params) => api.get('/inv/items', { params }),
  createItem: (data) => api.post('/inv/items', data),
  getCategories: () => api.get('/inv/categories'),
  stockMovement: (data) => api.post('/inv/stock-movement', data),
  getMovements: (params) => api.get('/inv/movements', { params }),
  production: (data) => api.post('/inv/production', data),
  getProductions: (params) => api.get('/inv/productions', { params }),
  transfer: (data) => api.post('/inv/transfer', data),
  getTransfers: () => api.get('/inv/transfers'),
  lidarScan: (data) => api.post('/inv/lidar-scan', data),
  getLidarScans: (params) => api.get('/inv/lidar-scans', { params }),
  getLowStock: (params) => api.get('/inv/low-stock', { params }),
  getDipHistory: () => api.get('/inv/dip-history'),
  aiAssistant: (data) => api.post('/inv/ai-assistant', data),
  aiExecute: (data) => api.post('/inv/ai-execute', data),
};
export const roleApi = {
  getAll: () => api.get('/job-roles'),
  create: (data) => api.post('/job-roles', data),
  update: (id, data) => api.put(`/job-roles/${id}`, data),
  remove: (id) => api.delete(`/job-roles/${id}`),
  getPermissions: () => api.get('/job-roles/permissions'),
};
export const reconciliationApi = {
  getAll: (params) => api.get('/reconciliation', { params }),
  create: (data) => api.post('/reconciliation', data),
  update: (id, status, notes) => api.patch(`/reconciliation/${id}?status=${status}${notes ? `&notes=${notes}` : ''}`),
  remove: (id) => api.delete(`/reconciliation/${id}`),
};
export const notificationApi = {
  getAll: (limit = 50) => api.get('/notifications', { params: { limit } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  remove: (id) => api.delete(`/notifications/${id}`),
};
export const uploadApi = {
  upload: (file, category = 'general') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload?category=${category}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadMultiple: (files, category = 'general') => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return api.post(`/upload/multiple?category=${category}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const i18nApi = {
  getTranslations: (lang) => api.get(`/i18n/translations/${lang}`),
};
export const auditApi = {
  getLogs: (params) => api.get('/audit-logs', { params }),
};

// ======== ODOO ACCOUNTING API ========
export const odooApi = {
  // Dashboard
  dashboard: (params) => api.get('/acc/dashboard', { params }),
  // Chart of Accounts
  accounts: { list: (params) => api.get('/acc/accounts', { params }), create: (d) => api.post('/acc/accounts', d), update: (id, d) => api.put(`/acc/accounts/${id}`, d) },
  // Journals
  journals: { list: (params) => api.get('/acc/journals', { params }), create: (d) => api.post('/acc/journals', d) },
  // Partners
  partners: { list: (params) => api.get('/acc/partners', { params }), create: (d) => api.post('/acc/partners', d), update: (id, d) => api.put(`/acc/partners/${id}`, d), remove: (id) => api.delete(`/acc/partners/${id}`) },
  // Taxes
  taxes: { list: (params) => api.get('/acc/taxes', { params }), create: (d) => api.post('/acc/taxes', d) },
  // Moves (Journal Entries + Invoices)
  moves: {
    list: (params) => api.get('/acc/moves', { params }), get: (id) => api.get(`/acc/moves/${id}`),
    create: (d) => api.post('/acc/moves', d), post: (id) => api.post(`/acc/moves/${id}/post`),
    cancel: (id) => api.post(`/acc/moves/${id}/cancel`), remove: (id) => api.delete(`/acc/moves/${id}`),
  },
  // Invoices
  invoices: { create: (d) => api.post('/acc/invoices', d) },
  // Payments
  payments: { list: (params) => api.get('/acc/payments', { params }), create: (d) => api.post('/acc/payments', d) },
  // Bank Statements
  bankStatements: {
    list: (params) => api.get('/acc/bank-statements', { params }), create: (d) => api.post('/acc/bank-statements', d),
    addLine: (id, d) => api.post(`/acc/bank-statements/${id}/lines`, d),
    reconcileLine: (stmtId, lineId, moveLineId) => api.post(`/acc/bank-statements/${stmtId}/reconcile/${lineId}?move_line_id=${moveLineId}`),
  },
  // Fiscal Years
  fiscalYears: { list: (params) => api.get('/acc/fiscal-years', { params }), create: (d) => api.post('/acc/fiscal-years', d), updateLock: (id, d) => api.patch(`/acc/fiscal-years/${id}/lock`, d) },
  // Analytic
  analytic: { list: (params) => api.get('/acc/analytic-accounts', { params }), create: (d) => api.post('/acc/analytic-accounts', d) },
  // Recurring
  recurring: { list: (params) => api.get('/acc/recurring-templates', { params }), create: (d) => api.post('/acc/recurring-templates', d), execute: (id) => api.post(`/acc/recurring-templates/${id}/execute`) },
  // Reports
  reports: {
    generalLedger: (params) => api.get('/acc/reports/general-ledger', { params }),
    trialBalance: (params) => api.get('/acc/reports/trial-balance', { params }),
    profitLoss: (params) => api.get('/acc/reports/profit-loss', { params }),
    balanceSheet: (params) => api.get('/acc/reports/balance-sheet', { params }),
    agedReceivables: (params) => api.get('/acc/reports/aged-receivables', { params }),
    agedPayables: (params) => api.get('/acc/reports/aged-payables', { params }),
    cashFlow: (params) => api.get('/acc/reports/cash-flow', { params }),
    taxReport: (params) => api.get('/acc/reports/tax-report', { params }),
    partnerLedger: (partnerId, params) => api.get(`/acc/reports/partner-ledger/${partnerId}`, { params }),
  },
};
