import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { bookkeepingApi, accountingApi, uploadApi } from '@/lib/api';
import { API } from '@/lib/api';
import { BusinessFilter } from '@/components/BusinessFilter';
import AiAccountant from '@/components/AiAccountant';
import { useCompany } from '@/context/CompanyContext';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, Download, FileText,
  BookOpen, Scale, PieChart, Wallet, Plus, Upload, Image, Loader2, X, Paperclip, Eye
} from 'lucide-react';

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('home');
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountLedger, setAccountLedger] = useState(null);
  const [trialBalance, setTrialBalance] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [cashBalance, setCashBalance] = useState(0);
  const [profitSummary, setProfitSummary] = useState(0);
  const [loading, setLoading] = useState(false);
  const { companyId } = useCompany();
  const [transactions, setTransactions] = useState([]);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [txnUploading, setTxnUploading] = useState(false);
  const [txnAttachments, setTxnAttachments] = useState([]);
  const [viewAttachments, setViewAttachments] = useState(null);
  const txnFileRef = useRef(null);
  const [txnForm, setTxnForm] = useState({
    transaction_type: 'expense', payment_mode: 'cash',
    amount: '', description: '', category: 'General',
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      const [pnlRes, bsRes] = await Promise.all([
        bookkeepingApi.getProfitLoss(companyId),
        bookkeepingApi.getBalanceSheet(companyId),
      ]);
      setProfitSummary(pnlRes.data.net_profit || 0);
      const cashAcc = (bsRes.data.assets || []).find(a => a.name === 'Cash');
      const bankAcc = (bsRes.data.assets || []).find(a => a.name === 'Bank');
      setCashBalance((cashAcc?.amount || 0) + (bankAcc?.amount || 0));
    } catch {}
  }, [companyId]);

  useEffect(() => {
    fetchDashboardData();
    bookkeepingApi.getAccounts(companyId).then(r => setAccounts(r.data)).catch(() => {});
  }, [fetchDashboardData, companyId]);

  const fetchJournals = async () => {
    setLoading(true);
    try {
      const res = await bookkeepingApi.getJournalEntries(companyId);
      setJournals(res.data);
    } catch { toast.error('Failed to load journals'); }
    finally { setLoading(false); }
  };

  const fetchAccountLedger = async (accId) => {
    if (!accId) return;
    setLoading(true);
    try {
      const res = await bookkeepingApi.getAccountLedger(accId, companyId);
      setAccountLedger(res.data);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLoading(false); }
  };

  const fetchReports = async (type) => {
    setLoading(true);
    try {
      if (type === 'trial' || !type) {
        const res = await bookkeepingApi.getTrialBalance(companyId);
        setTrialBalance(res.data);
      }
      if (type === 'pnl' || !type) {
        const res = await bookkeepingApi.getProfitLoss(companyId);
        setPnl(res.data);
      }
      if (type === 'bs' || !type) {
        const res = await bookkeepingApi.getBalanceSheet(companyId);
        setBalanceSheet(res.data);
      }
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'journals') fetchJournals();
    if (tab === 'reports') fetchReports();
    if (tab === 'transactions') fetchTransactions();
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await accountingApi.getTransactions({ company_id: companyId });
      setTransactions(res.data);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  };

  const handleTxnFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setTxnUploading(true);
    try {
      for (const file of files) {
        const res = await uploadApi.upload(file, 'bill');
        setTxnAttachments(prev => [...prev, { url: res.data.url, name: res.data.original_name }]);
      }
      toast.success('File(s) uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setTxnUploading(false); if (txnFileRef.current) txnFileRef.current.value = ''; }
  };

  const handleCreateTxn = async (e) => {
    e.preventDefault();
    try {
      await accountingApi.createTransaction({
        ...txnForm, amount: parseFloat(txnForm.amount),
        attachments: txnAttachments.map(a => a.url),
      });
      toast.success('Transaction recorded');
      setTxnDialogOpen(false);
      setTxnForm({ transaction_type: 'expense', payment_mode: 'cash', amount: '', description: '', category: 'General' });
      setTxnAttachments([]);
      fetchTransactions();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record transaction'); }
  };

  const resolveUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/api/')) return `${API.replace('/api', '')}${url}`;
    return url;
  };

  const handleExportPdf = async () => {
    try {
      const res = await accountingApi.exportPdf();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `transactions_${new Date().toISOString().split('T')[0]}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch { toast.error('Export failed'); }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6" data-testid="director-accounting-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Accounting</h1>
          <p className="text-muted-foreground mt-1">AI-powered double-entry bookkeeping</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} data-testid="export-pdf-button">
            <Download size={16} className="mr-2" />PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="home" data-testid="tab-home">Home</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
          <TabsTrigger value="journals" data-testid="tab-journals">Journals</TabsTrigger>
          <TabsTrigger value="ledgers" data-testid="tab-ledgers">Ledgers</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
        </TabsList>

        {/* HOME TAB */}
        <TabsContent value="home" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-accent">
              <CardContent className="p-6 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Cash + Bank</p>
                  <p className="text-2xl font-heading font-bold">{fmt(cashBalance)}</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl"><Wallet size={24} className="text-accent" /></div>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${profitSummary >= 0 ? 'border-l-success' : 'border-l-error'}`}>
              <CardContent className="p-6 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Net Profit/Loss</p>
                  <p className={`text-2xl font-heading font-bold ${profitSummary >= 0 ? 'text-success' : 'text-error'}`}>{fmt(profitSummary)}</p>
                </div>
                <div className="p-3 bg-success/10 rounded-xl">{profitSummary >= 0 ? <TrendingUp size={24} className="text-success" /> : <TrendingDown size={24} className="text-error" />}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-info">
              <CardContent className="p-6 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Accounts</p>
                  <p className="text-2xl font-heading font-bold">{accounts.length}</p>
                </div>
                <div className="p-3 bg-info/10 rounded-xl"><BookOpen size={24} className="text-info" /></div>
              </CardContent>
            </Card>
          </div>

          <AiAccountant onEntryPosted={() => { fetchDashboardData(); }} />
        </TabsContent>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="transactions" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-heading font-semibold">Cash & Bank Transactions</h2>
            <Dialog open={txnDialogOpen} onOpenChange={(open) => { setTxnDialogOpen(open); if (!open) { setTxnAttachments([]); } }}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90" data-testid="add-transaction-btn"><Plus size={16} className="mr-1" />New Transaction</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Record Transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateTxn} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select value={txnForm.transaction_type} onValueChange={v => setTxnForm(f => ({ ...f, transaction_type: v }))}>
                        <SelectTrigger data-testid="txn-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Payment Mode</Label>
                      <Select value={txnForm.payment_mode} onValueChange={v => setTxnForm(f => ({ ...f, payment_mode: v }))}>
                        <SelectTrigger data-testid="txn-mode"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Amount (INR)</Label>
                    <Input type="number" step="0.01" min="0" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} required data-testid="txn-amount" />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input value={txnForm.description} onChange={e => setTxnForm(f => ({ ...f, description: e.target.value }))} required data-testid="txn-description" />
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Input value={txnForm.category} onChange={e => setTxnForm(f => ({ ...f, category: e.target.value }))} data-testid="txn-category" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Paperclip size={14} />Bills / Photos</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => txnFileRef.current?.click()}>
                      <input type="file" accept="image/*,application/pdf" multiple onChange={handleTxnFileUpload} ref={txnFileRef} className="hidden" />
                      {txnUploading ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Uploading...</div>
                      ) : (
                        <div className="space-y-1">
                          <Upload size={24} className="mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Click to upload bills, receipts, or photos</p>
                        </div>
                      )}
                    </div>
                    {txnAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {txnAttachments.map((a, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-secondary/50 rounded px-2 py-1 text-xs">
                            <Image size={12} /><span className="max-w-[120px] truncate">{a.name}</span>
                            <button type="button" onClick={() => setTxnAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full" data-testid="txn-submit"><Plus size={16} className="mr-1" />Record Transaction</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
          ) : transactions.length === 0 ? (
            <Card><CardContent className="p-12 text-center"><FileText size={48} className="mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No transactions yet. Click "New Transaction" to record one.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {transactions.map(t => (
                <Card key={t.id} className={`hover:shadow-md transition-shadow border-l-4 ${t.transaction_type === 'income' ? 'border-l-success' : 'border-l-error'}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${t.transaction_type === 'income' ? 'bg-success/10' : 'bg-error/10'}`}>
                      {t.transaction_type === 'income' ? <TrendingUp size={20} className="text-success" /> : <TrendingDown size={20} className="text-error" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.category} - {t.payment_mode} - {new Date(t.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.attachments?.length > 0 && (
                        <Button variant="ghost" size="sm" className="text-primary" onClick={() => setViewAttachments(t.attachments)} data-testid={`view-bills-${t.id}`}>
                          <Paperclip size={14} className="mr-1" />{t.attachments.length}
                        </Button>
                      )}
                      <span className={`font-heading font-bold text-base ${t.transaction_type === 'income' ? 'text-success' : 'text-error'}`}>
                        {t.transaction_type === 'income' ? '+' : '-'}{fmt(t.amount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* View Attachments Dialog */}
        <Dialog open={!!viewAttachments} onOpenChange={(open) => { if (!open) setViewAttachments(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Paperclip size={18} />Attached Bills</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {(viewAttachments || []).map((url, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  {url.match(/\.(jpg|jpeg|png|webp|gif)$/i) || url.includes('image') ? (
                    <img src={resolveUrl(url)} alt={`Bill ${i + 1}`} className="w-full h-40 object-cover" />
                  ) : (
                    <a href={resolveUrl(url)} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-40 bg-muted hover:bg-muted/80 transition-colors">
                      <FileText size={32} className="text-muted-foreground" />
                      <span className="text-xs mt-2 text-primary">View Document</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* JOURNALS TAB */}
        <TabsContent value="journals" className="mt-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
          ) : journals.length === 0 ? (
            <Card><CardContent className="p-12 text-center"><BookOpen size={48} className="mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No journal entries yet. Use the AI Accountant to create your first entry.</p></CardContent></Card>
          ) : (
            journals.map((j) => (
              <Card key={j.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-sm">{j.narration}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(j.date).toLocaleString()}</p>
                    </div>
                    <span className="text-sm font-heading font-bold text-accent">{fmt(j.total_debit)}</span>
                  </div>
                  <table className="w-full">
                    <thead className="bg-secondary/40"><tr><th className="p-2 text-left text-xs font-semibold">Account</th><th className="p-2 text-right text-xs font-semibold">Dr</th><th className="p-2 text-right text-xs font-semibold">Cr</th></tr></thead>
                    <tbody>
                      {(j.lines || []).map((l, i) => (
                        <tr key={i} className={i % 2 ? 'bg-secondary/20' : ''}>
                          <td className="p-2 text-xs">{l.credit > 0 && <span className="ml-3">To </span>}{l.account_name}</td>
                          <td className="p-2 text-xs text-right">{l.debit > 0 ? fmt(l.debit) : '-'}</td>
                          <td className="p-2 text-xs text-right">{l.credit > 0 ? fmt(l.credit) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* LEDGERS TAB */}
        <TabsContent value="ledgers" className="mt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedAccountId} onValueChange={(v) => { setSelectedAccountId(v); fetchAccountLedger(v); }}>
              <SelectTrigger className="w-[280px]" data-testid="ledger-account-select"><SelectValue placeholder="Select an account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.code} - {a.name} ({a.type})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
          ) : accountLedger ? (
            <Card>
              <CardHeader>
                <CardTitle>{accountLedger.account.name}</CardTitle>
                <CardDescription className="flex gap-6 mt-2">
                  <span>Opening: {fmt(accountLedger.summary.opening_balance)}</span>
                  <span className="text-success">Total Dr: {fmt(accountLedger.summary.total_debit)}</span>
                  <span className="text-error">Total Cr: {fmt(accountLedger.summary.total_credit)}</span>
                  <span className="font-bold">Closing: {fmt(accountLedger.summary.balance)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accountLedger.transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No transactions in this account.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary/50"><tr>
                        <th className="p-3 text-left text-sm font-semibold">Date</th>
                        <th className="p-3 text-left text-sm font-semibold">Narration</th>
                        <th className="p-3 text-right text-sm font-semibold">Debit</th>
                        <th className="p-3 text-right text-sm font-semibold">Credit</th>
                        <th className="p-3 text-right text-sm font-semibold">Balance</th>
                      </tr></thead>
                      <tbody>
                        {accountLedger.transactions.map((t, i) => (
                          <tr key={i} className={i % 2 ? 'bg-secondary/20' : ''}>
                            <td className="p-3 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                            <td className="p-3 text-sm">{t.narration}</td>
                            <td className="p-3 text-sm text-right">{t.debit > 0 ? fmt(t.debit) : '-'}</td>
                            <td className="p-3 text-sm text-right">{t.credit > 0 ? fmt(t.credit) : '-'}</td>
                            <td className="p-3 text-sm text-right font-semibold">{fmt(t.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-12 text-center"><BookOpen size={48} className="mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Select an account to view its ledger.</p></CardContent></Card>
          )}
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="mt-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
          ) : (
            <>
              {/* Trial Balance */}
              {trialBalance && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Scale size={20} className="text-primary" /> Trial Balance</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full">
                      <thead className="bg-secondary/50"><tr>
                        <th className="p-3 text-left text-sm font-semibold">Account</th>
                        <th className="p-3 text-left text-sm font-semibold">Type</th>
                        <th className="p-3 text-right text-sm font-semibold">Debit (₹)</th>
                        <th className="p-3 text-right text-sm font-semibold">Credit (₹)</th>
                      </tr></thead>
                      <tbody>
                        {trialBalance.rows.map((r, i) => (
                          <tr key={i} className={i % 2 ? 'bg-secondary/20' : ''}>
                            <td className="p-3 text-sm">{r.account_name}</td>
                            <td className="p-3 text-sm capitalize">{r.account_type}</td>
                            <td className="p-3 text-sm text-right">{r.debit > 0 ? fmt(r.debit) : '-'}</td>
                            <td className="p-3 text-sm text-right">{r.credit > 0 ? fmt(r.credit) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-primary/20 font-bold">
                        <tr><td className="p-3 text-sm" colSpan={2}>Total</td><td className="p-3 text-sm text-right">{fmt(trialBalance.total_debit)}</td><td className="p-3 text-sm text-right">{fmt(trialBalance.total_credit)}</td></tr>
                      </tfoot>
                    </table>
                    {Math.abs(trialBalance.total_debit - trialBalance.total_credit) < 0.01 ? (
                      <p className="text-success text-xs mt-2 font-semibold">Trial Balance is balanced.</p>
                    ) : (
                      <p className="text-error text-xs mt-2 font-semibold">Warning: Trial Balance does not tally!</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* P&L */}
              {pnl && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><PieChart size={20} className="text-accent" /> Profit & Loss Statement</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-sm text-success mb-3 uppercase tracking-wider">Income</h4>
                        {pnl.income.length === 0 ? <p className="text-xs text-muted-foreground">No income recorded</p> : pnl.income.map((item, i) => (
                          <div key={i} className="flex justify-between py-1.5 text-sm border-b border-secondary/50">
                            <span>{item.name}</span><span className="font-medium">{fmt(item.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-2 font-bold text-sm text-success border-t border-success/30 mt-1">
                          <span>Total Income</span><span>{fmt(pnl.total_income)}</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-error mb-3 uppercase tracking-wider">Expenses</h4>
                        {pnl.expenses.length === 0 ? <p className="text-xs text-muted-foreground">No expenses recorded</p> : pnl.expenses.map((item, i) => (
                          <div key={i} className="flex justify-between py-1.5 text-sm border-b border-secondary/50">
                            <span>{item.name}</span><span className="font-medium">{fmt(item.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-2 font-bold text-sm text-error border-t border-error/30 mt-1">
                          <span>Total Expenses</span><span>{fmt(pnl.total_expense)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`mt-6 p-4 rounded-lg text-center ${pnl.net_profit >= 0 ? 'bg-success/10' : 'bg-error/10'}`}>
                      <p className="text-sm text-muted-foreground">Net {pnl.net_profit >= 0 ? 'Profit' : 'Loss'}</p>
                      <p className={`text-3xl font-heading font-bold ${pnl.net_profit >= 0 ? 'text-success' : 'text-error'}`}>{fmt(pnl.net_profit)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Balance Sheet */}
              {balanceSheet && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign size={20} className="text-primary" /> Balance Sheet</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-sm text-primary mb-3 uppercase tracking-wider">Assets</h4>
                        {balanceSheet.assets.length === 0 ? <p className="text-xs text-muted-foreground">No assets</p> : balanceSheet.assets.map((item, i) => (
                          <div key={i} className="flex justify-between py-1.5 text-sm border-b border-secondary/50">
                            <span>{item.name}</span><span className="font-medium">{fmt(item.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-2 font-bold text-sm border-t border-primary/30 mt-1">
                          <span>Total Assets</span><span>{fmt(balanceSheet.total_assets)}</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-accent mb-3 uppercase tracking-wider">Liabilities + Equity</h4>
                        {balanceSheet.liabilities.map((item, i) => (
                          <div key={i} className="flex justify-between py-1.5 text-sm border-b border-secondary/50">
                            <span>{item.name}</span><span className="font-medium">{fmt(item.amount)}</span>
                          </div>
                        ))}
                        {balanceSheet.equity.map((item, i) => (
                          <div key={i} className="flex justify-between py-1.5 text-sm border-b border-secondary/50">
                            <span>{item.name}</span><span className="font-medium">{fmt(item.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-2 font-bold text-sm border-t border-accent/30 mt-1">
                          <span>Total L + E</span><span>{fmt(balanceSheet.total_liabilities_equity)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
