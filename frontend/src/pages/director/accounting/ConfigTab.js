import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { odooApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, CheckCircle2, XCircle, Users, Lock, Search } from 'lucide-react';
import { fmt, fmtd, LoadingSpinner, cleanParams } from './helpers';

const ACCOUNT_TYPES = [
  { value: 'receivable', label: 'Receivable', group: 'Asset' },
  { value: 'bank', label: 'Bank', group: 'Asset' },
  { value: 'cash', label: 'Cash', group: 'Asset' },
  { value: 'current_asset', label: 'Current Asset', group: 'Asset' },
  { value: 'fixed_asset', label: 'Fixed Asset', group: 'Asset' },
  { value: 'payable', label: 'Payable', group: 'Liability' },
  { value: 'current_liability', label: 'Current Liability', group: 'Liability' },
  { value: 'long_term_liability', label: 'Long Term Liability', group: 'Liability' },
  { value: 'equity', label: 'Equity', group: 'Equity' },
  { value: 'income', label: 'Income', group: 'Income' },
  { value: 'other_income', label: 'Other Income', group: 'Income' },
  { value: 'expense', label: 'Expense', group: 'Expense' },
  { value: 'cost_of_revenue', label: 'Cost of Revenue', group: 'Expense' },
  { value: 'depreciation', label: 'Depreciation', group: 'Expense' },
];

const JOURNAL_TYPES = [
  { value: 'sale', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'general', label: 'General' },
];

export function ConfigTab({ companyId }) {
  const [subTab, setSubTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [journals, setJournals] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [partnerDlg, setPartnerDlg] = useState(false);
  const [accountDlg, setAccountDlg] = useState(false);
  const [taxDlg, setTaxDlg] = useState(false);
  const [journalDlg, setJournalDlg] = useState(false);
  const [fiscalDlg, setFiscalDlg] = useState(false);

  // Forms
  const [partnerForm, setPartnerForm] = useState({ name: '', partner_type: 'customer', email: '', phone: '', gst_number: '', payment_terms_days: 30 });
  const [accountForm, setAccountForm] = useState({ code: '', name: '', account_type: 'expense', reconcile: false, note: '' });
  const [taxForm, setTaxForm] = useState({ name: '', amount: '', tax_type: 'percent', tax_group: 'GST', include_in_price: false });
  const [journalForm, setJournalForm] = useState({ name: '', code: '', journal_type: 'general' });
  const [fiscalForm, setFiscalForm] = useState({ name: '', start_date: '', end_date: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = cleanParams({ company_id: companyId });
    Promise.all([
      odooApi.accounts.list(params),
      odooApi.partners.list(params),
      odooApi.taxes.list(params),
      odooApi.journals.list(params),
      odooApi.fiscalYears.list(params),
    ]).then(([a, p, t, j, fy]) => {
      setAccounts(a.data); setPartners(p.data); setTaxes(t.data); setJournals(j.data); setFiscalYears(fy.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const createPartner = async () => {
    if (!partnerForm.name) { toast.error('Name required'); return; }
    try { await odooApi.partners.create(partnerForm); toast.success('Partner created'); setPartnerDlg(false); setPartnerForm({ name: '', partner_type: 'customer', email: '', phone: '', gst_number: '', payment_terms_days: 30 }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const createAccount = async () => {
    if (!accountForm.code || !accountForm.name) { toast.error('Code and name required'); return; }
    try { await odooApi.accounts.create(accountForm); toast.success('Account created'); setAccountDlg(false); setAccountForm({ code: '', name: '', account_type: 'expense', reconcile: false, note: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const createTax = async () => {
    if (!taxForm.name || !taxForm.amount) { toast.error('Name and rate required'); return; }
    try { await odooApi.taxes.create({ ...taxForm, amount: parseFloat(taxForm.amount) }); toast.success('Tax created'); setTaxDlg(false); setTaxForm({ name: '', amount: '', tax_type: 'percent', tax_group: 'GST', include_in_price: false }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const createJournal = async () => {
    if (!journalForm.name || !journalForm.code) { toast.error('Name and code required'); return; }
    try { await odooApi.journals.create(journalForm); toast.success('Journal created'); setJournalDlg(false); setJournalForm({ name: '', code: '', journal_type: 'general' }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const createFiscalYear = async () => {
    if (!fiscalForm.name || !fiscalForm.start_date || !fiscalForm.end_date) { toast.error('All fields required'); return; }
    try { await odooApi.fiscalYears.create(fiscalForm); toast.success('Fiscal year created'); setFiscalDlg(false); setFiscalForm({ name: '', start_date: '', end_date: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const deletePartner = async (id) => {
    try { await odooApi.partners.remove(id); toast.success('Partner deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <LoadingSpinner />;

  const filteredAccounts = accounts.filter(a =>
    !searchTerm || a.code.includes(searchTerm) || a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.account_type.includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4" data-testid="acc-config">
      <div className="flex flex-wrap gap-2">
        {[['accounts','Chart of Accounts'], ['partners','Partners'], ['taxes','Taxes'], ['journals','Journals'], ['fiscal','Fiscal Years']].map(([k,v]) =>
          <Button key={k} variant={subTab === k ? 'default' : 'outline'} size="sm" onClick={() => { setSubTab(k); setSearchTerm(''); }} data-testid={`config-${k}`}>{v} <Badge variant="secondary" className="ml-1.5 text-[10px]">{k === 'accounts' ? accounts.length : k === 'partners' ? partners.length : k === 'taxes' ? taxes.length : k === 'journals' ? journals.length : fiscalYears.length}</Badge></Button>
        )}
      </div>

      {/* ====== CHART OF ACCOUNTS ====== */}
      {subTab === 'accounts' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by code, name, type..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" data-testid="account-search" />
            </div>
            <Dialog open={accountDlg} onOpenChange={setAccountDlg}>
              <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-account-btn"><Plus size={16} className="mr-1" />New Account</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create Account</DialogTitle><DialogDescription>Add a new account to the chart of accounts.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Code</Label><Input value={accountForm.code} onChange={e => setAccountForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 4100" data-testid="account-code" /></div>
                    <div className="space-y-1"><Label>Type</Label>
                      <Select value={accountForm.account_type} onValueChange={v => setAccountForm(f => ({ ...f, account_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.group} - {t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1"><Label>Name</Label><Input value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sales Revenue" data-testid="account-name" /></div>
                  <div className="space-y-1"><Label>Note</Label><Input value={accountForm.note} onChange={e => setAccountForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional description" /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="acct-reconcile" checked={accountForm.reconcile} onCheckedChange={v => setAccountForm(f => ({ ...f, reconcile: v }))} />
                    <Label htmlFor="acct-reconcile" className="text-sm">Allow Reconciliation</Label>
                  </div>
                  <Button onClick={createAccount} className="w-full" data-testid="create-account-submit">Create Account</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Reconcile</TableHead></TableRow></TableHeader>
              <TableBody>{filteredAccounts.map(a => (
                <TableRow key={a.id}><TableCell className="font-mono text-sm font-medium">{a.code}</TableCell><TableCell>{a.name}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{a.account_type}</Badge></TableCell><TableCell className="text-right font-semibold">{fmtd(a.balance)}</TableCell><TableCell>{a.reconcile ? <CheckCircle2 size={14} className="text-success" /> : '-'}</TableCell></TableRow>
              ))}</TableBody></Table>
          </div>
        </div>
      )}

      {/* ====== PARTNERS ====== */}
      {subTab === 'partners' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={partnerDlg} onOpenChange={setPartnerDlg}>
              <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-partner-btn"><Plus size={16} className="mr-1" />New Partner</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create Partner</DialogTitle><DialogDescription>Add a customer or vendor partner.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Name</Label><Input value={partnerForm.name} onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))} data-testid="partner-name" /></div>
                    <div className="space-y-1"><Label>Type</Label><Select value={partnerForm.partner_type} onValueChange={v => setPartnerForm(f => ({ ...f, partner_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="vendor">Vendor</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="space-y-1"><Label>Email</Label><Input value={partnerForm.email} onChange={e => setPartnerForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Phone</Label><Input value={partnerForm.phone} onChange={e => setPartnerForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>GST Number</Label><Input value={partnerForm.gst_number} onChange={e => setPartnerForm(f => ({ ...f, gst_number: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1"><Label>Payment Terms (days)</Label><Input type="number" value={partnerForm.payment_terms_days} onChange={e => setPartnerForm(f => ({ ...f, payment_terms_days: parseInt(e.target.value) || 30 }))} /></div>
                  <Button onClick={createPartner} className="w-full" data-testid="create-partner-submit"><Users size={16} className="mr-2" />Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Email</TableHead><TableHead>GST</TableHead><TableHead className="text-right">Receivable</TableHead><TableHead className="text-right">Payable</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{partners.map(p => (
              <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell><Badge variant="outline" className="capitalize">{p.partner_type}</Badge></TableCell><TableCell className="text-sm">{p.email || '-'}</TableCell><TableCell className="text-sm">{p.gst_number || '-'}</TableCell><TableCell className="text-right text-success">{fmt(p.total_receivable)}</TableCell><TableCell className="text-right text-error">{fmt(p.total_payable)}</TableCell>
                <TableCell><Button variant="ghost" size="sm" className="text-error h-7" onClick={() => deletePartner(p.id)} data-testid={`delete-partner-${p.id}`}><XCircle size={14} /></Button></TableCell>
              </TableRow>
            ))}</TableBody></Table></div>
        </div>
      )}

      {/* ====== TAXES ====== */}
      {subTab === 'taxes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={taxDlg} onOpenChange={setTaxDlg}>
              <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-tax-btn"><Plus size={16} className="mr-1" />New Tax</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create Tax</DialogTitle><DialogDescription>Define a new tax rate.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1"><Label>Name</Label><Input value={taxForm.name} onChange={e => setTaxForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. GST 18%" data-testid="tax-name" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Rate (%)</Label><Input type="number" value={taxForm.amount} onChange={e => setTaxForm(f => ({ ...f, amount: e.target.value }))} placeholder="18" data-testid="tax-rate" /></div>
                    <div className="space-y-1"><Label>Type</Label>
                      <Select value={taxForm.tax_type} onValueChange={v => setTaxForm(f => ({ ...f, tax_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="percent">Percentage</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1"><Label>Tax Group</Label><Input value={taxForm.tax_group} onChange={e => setTaxForm(f => ({ ...f, tax_group: e.target.value }))} /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="tax-incl" checked={taxForm.include_in_price} onCheckedChange={v => setTaxForm(f => ({ ...f, include_in_price: v }))} />
                    <Label htmlFor="tax-incl" className="text-sm">Include in Price</Label>
                  </div>
                  <Button onClick={createTax} className="w-full" data-testid="create-tax-submit">Create Tax</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Group</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Rate</TableHead><TableHead>In Price</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
            <TableBody>{taxes.map(t => (
              <TableRow key={t.id}><TableCell className="font-medium">{t.name}</TableCell><TableCell>{t.tax_group}</TableCell><TableCell>{t.tax_type}</TableCell><TableCell className="text-right font-semibold">{t.amount}{t.tax_type === 'percent' ? '%' : ''}</TableCell><TableCell>{t.include_in_price ? <CheckCircle2 size={14} className="text-info" /> : '-'}</TableCell><TableCell>{t.active ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-error" />}</TableCell></TableRow>
            ))}</TableBody></Table></div>
        </div>
      )}

      {/* ====== JOURNALS ====== */}
      {subTab === 'journals' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={journalDlg} onOpenChange={setJournalDlg}>
              <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-journal-btn"><Plus size={16} className="mr-1" />New Journal</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create Journal</DialogTitle><DialogDescription>Add a new accounting journal.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1"><Label>Name</Label><Input value={journalForm.name} onChange={e => setJournalForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Petty Cash" data-testid="journal-name" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Code</Label><Input value={journalForm.code} onChange={e => setJournalForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. PC" data-testid="journal-code" /></div>
                    <div className="space-y-1"><Label>Type</Label>
                      <Select value={journalForm.journal_type} onValueChange={v => setJournalForm(f => ({ ...f, journal_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{JOURNAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={createJournal} className="w-full" data-testid="create-journal-submit">Create Journal</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {journals.map(j => (
              <Card key={j.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold">{j.name}</h3><p className="text-xs text-muted-foreground font-mono">{j.code}</p></div>
                    <Badge variant="outline" className="capitalize">{j.journal_type}</Badge>
                  </div>
                  <p className="text-sm mt-2">{j.entry_count || 0} entries</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ====== FISCAL YEARS ====== */}
      {subTab === 'fiscal' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={fiscalDlg} onOpenChange={setFiscalDlg}>
              <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-fiscal-btn"><Plus size={16} className="mr-1" />New Fiscal Year</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create Fiscal Year</DialogTitle><DialogDescription>Define a new fiscal year period.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1"><Label>Name</Label><Input value={fiscalForm.name} onChange={e => setFiscalForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. FY 2025-26" data-testid="fiscal-name" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={fiscalForm.start_date} onChange={e => setFiscalForm(f => ({ ...f, start_date: e.target.value }))} data-testid="fiscal-start" /></div>
                    <div className="space-y-1"><Label>End Date</Label><Input type="date" value={fiscalForm.end_date} onChange={e => setFiscalForm(f => ({ ...f, end_date: e.target.value }))} data-testid="fiscal-end" /></div>
                  </div>
                  <Button onClick={createFiscalYear} className="w-full" data-testid="create-fiscal-submit">Create Fiscal Year</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {fiscalYears.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">No fiscal years defined. Create one to track accounting periods.</CardContent></Card>
          ) : fiscalYears.map(fy => (
            <Card key={fy.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div><h3 className="font-bold">{fy.name}</h3><p className="text-sm text-muted-foreground">{fy.start_date} to {fy.end_date}</p></div>
                <div className="flex items-center gap-2">
                  <Badge className={fy.state === 'open' ? 'bg-success/20 text-success border-0' : 'bg-muted border-0'}>{fy.state}</Badge>
                  {fy.lock_date && <Badge variant="outline" className="text-[10px]"><Lock size={10} className="mr-1" />Locked: {fy.lock_date}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
