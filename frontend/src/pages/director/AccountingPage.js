import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { odooApi, uploadApi } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, FileText, BookOpen, Scale, PieChart,
  Users, Plus, Send, XCircle, ChevronRight, Banknote, CreditCard,
  Calculator, Receipt, Building2, Clock, AlertTriangle, CheckCircle2,
  Loader2, Upload, Paperclip, BarChart3, ArrowUpDown, Lock, Repeat,
  Settings, Eye
} from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtd = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

function StatCard({ icon: Icon, label, value, color = "text-primary", sub }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl bg-muted`}><Icon size={20} className={color} /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-lg font-heading font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== OVERVIEW TAB =====
function OverviewTab({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { odooApi.dashboard({ company_id: companyId }).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)); }, [companyId]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!data) return <p className="text-muted-foreground">No data</p>;
  return (
    <div className="space-y-6" data-testid="acc-overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Banknote} label="Cash" value={fmt(data.cash_balance)} color="text-success" />
        <StatCard icon={Building2} label="Bank" value={fmt(data.bank_balance)} color="text-info" />
        <StatCard icon={TrendingUp} label="Receivable" value={fmt(data.total_receivable)} color="text-warning" />
        <StatCard icon={TrendingDown} label="Payable" value={fmt(data.total_payable)} color="text-error" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Receipt} label="Invoices" value={data.total_invoices} sub={`${data.draft_invoices} draft, ${data.overdue_invoices} overdue`} />
        <StatCard icon={FileText} label="Bills" value={data.total_bills} sub={`${data.draft_bills} draft`} />
        <StatCard icon={BookOpen} label="Journal Entries" value={data.total_entries} />
        <StatCard icon={CreditCard} label="Payments" value={data.total_payments} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="Monthly Income" value={fmt(data.monthly_income)} color="text-success" />
        <StatCard icon={TrendingDown} label="Monthly Expense" value={fmt(data.monthly_expense)} color="text-error" />
        <StatCard icon={DollarSign} label="Monthly Profit" value={fmt(data.monthly_profit)} color={data.monthly_profit >= 0 ? "text-success" : "text-error"} />
      </div>
    </div>
  );
}

// ===== INVOICING TAB =====
function InvoicingTab({ companyId }) {
  const [invoices, setInvoices] = useState([]);
  const [partners, setPartners] = useState([]);
  const [journals, setJournals] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('invoices');
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({ move_type: 'out_invoice', partner_id: '', ref: '', invoice_lines: [{ product_name: '', quantity: 1, unit_price: 0, discount: 0, tax_ids: [] }] });
  const [detailMove, setDetailMove] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      odooApi.moves.list({ company_id: companyId, move_type: filter, limit: 100 }),
      odooApi.partners.list({ company_id: companyId }),
      odooApi.journals.list({ company_id: companyId }),
      odooApi.taxes.list({ company_id: companyId }),
      odooApi.accounts.list({ company_id: companyId }),
    ]).then(([m, p, j, t, a]) => {
      setInvoices(m.data); setPartners(p.data); setJournals(j.data); setTaxes(t.data); setAccounts(a.data);
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [companyId, filter]);
  useEffect(() => { load(); }, [load]);

  const addLine = () => setForm(f => ({ ...f, invoice_lines: [...f.invoice_lines, { product_name: '', quantity: 1, unit_price: 0, discount: 0, tax_ids: [] }] }));
  const updateLine = (i, field, val) => setForm(f => ({ ...f, invoice_lines: f.invoice_lines.map((l, j) => j === i ? { ...l, [field]: val } : l) }));
  const removeLine = (i) => setForm(f => ({ ...f, invoice_lines: f.invoice_lines.filter((_, j) => j !== i) }));

  const handleCreate = async () => {
    if (!form.partner_id) { toast.error('Select a partner'); return; }
    if (!form.invoice_lines.some(l => l.product_name && l.unit_price > 0)) { toast.error('Add at least one line item'); return; }
    try {
      await odooApi.invoices.create({ ...form, invoice_lines: form.invoice_lines.filter(l => l.product_name) });
      toast.success('Invoice created'); setDlgOpen(false);
      setForm({ move_type: 'out_invoice', partner_id: '', ref: '', invoice_lines: [{ product_name: '', quantity: 1, unit_price: 0, discount: 0, tax_ids: [] }] });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handlePost = async (id) => {
    try { await odooApi.moves.post(id); toast.success('Posted'); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to post'); }
  };

  const handleCancel = async (id) => {
    try { await odooApi.moves.cancel(id); toast.success('Cancelled'); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const viewDetail = async (id) => {
    try { const r = await odooApi.moves.get(id); setDetailMove(r.data); }
    catch { toast.error('Failed to load details'); }
  };

  const stateBadge = (state) => {
    if (state === 'draft') return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Draft</Badge>;
    if (state === 'posted') return <Badge className="bg-success/20 text-success">Posted</Badge>;
    return <Badge variant="outline" className="text-error border-error/30">Cancelled</Badge>;
  };

  const payBadge = (ps) => {
    if (ps === 'paid') return <Badge className="bg-success/20 text-success text-[10px]">Paid</Badge>;
    if (ps === 'partial') return <Badge className="bg-warning/20 text-warning text-[10px]">Partial</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Not Paid</Badge>;
  };

  return (
    <div className="space-y-4" data-testid="acc-invoicing">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1">
          {[['invoices', 'Invoices'], ['bills', 'Bills']].map(([k, v]) =>
            <Button key={k} variant={filter === k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(k)} data-testid={`filter-${k}`}>{v}</Button>)}
        </div>
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="new-invoice-btn"><Plus size={16} className="mr-1" />New {filter === 'invoices' ? 'Invoice' : 'Bill'}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create {form.move_type === 'out_invoice' ? 'Customer Invoice' : form.move_type === 'in_invoice' ? 'Vendor Bill' : form.move_type === 'out_refund' ? 'Credit Note' : 'Debit Note'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={form.move_type} onValueChange={v => setForm(f => ({ ...f, move_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="out_invoice">Customer Invoice</SelectItem>
                      <SelectItem value="in_invoice">Vendor Bill</SelectItem>
                      <SelectItem value="out_refund">Credit Note</SelectItem>
                      <SelectItem value="in_refund">Debit Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Partner</Label>
                  <Select value={form.partner_id} onValueChange={v => setForm(f => ({ ...f, partner_id: v }))}>
                    <SelectTrigger data-testid="inv-partner"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder="PO#, Bill#, etc." />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="font-semibold">Line Items</Label>
                  <Button size="sm" variant="outline" onClick={addLine}><Plus size={14} className="mr-1" />Add Line</Button>
                </div>
                <div className="space-y-2">
                  {form.invoice_lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 bg-muted/50 rounded">
                      <div className="col-span-4"><Input placeholder="Product/Service" value={line.product_name} onChange={e => updateLine(i, 'product_name', e.target.value)} data-testid={`inv-line-name-${i}`} /></div>
                      <div className="col-span-2"><Input type="number" placeholder="Qty" value={line.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                      <div className="col-span-3"><Input type="number" placeholder="Unit Price" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} data-testid={`inv-line-price-${i}`} /></div>
                      <div className="col-span-2 text-right font-semibold text-sm pt-2">{fmt(line.quantity * line.unit_price * (1 - (line.discount || 0) / 100))}</div>
                      <div className="col-span-1"><Button variant="ghost" size="sm" className="text-error" onClick={() => removeLine(i)}><XCircle size={14} /></Button></div>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-3 font-heading font-bold text-lg">
                  Total: {fmt(form.invoice_lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount || 0) / 100), 0))}
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full" data-testid="create-invoice-submit"><Receipt size={16} className="mr-2" />Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div> : invoices.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><Receipt size={48} className="mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No {filter} yet</p></CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Number</TableHead><TableHead>Partner</TableHead><TableHead>Date</TableHead><TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Due</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => viewDetail(inv.id)}>
                  <TableCell className="font-mono text-sm font-medium">{inv.name}</TableCell>
                  <TableCell>{inv.partner_name || '-'}</TableCell>
                  <TableCell className="text-sm">{inv.date}</TableCell>
                  <TableCell className="text-sm">{inv.due_date || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(inv.amount_total)}</TableCell>
                  <TableCell className="text-right">{fmt(inv.amount_residual)}</TableCell>
                  <TableCell>{stateBadge(inv.state)}</TableCell>
                  <TableCell>{inv.payment_state ? payBadge(inv.payment_state) : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {inv.state === 'draft' && <Button size="sm" variant="ghost" className="text-success h-7" onClick={() => handlePost(inv.id)} data-testid={`post-${inv.id}`}><Send size={12} className="mr-1" />Post</Button>}
                      {inv.state === 'posted' && <Button size="sm" variant="ghost" className="text-error h-7" onClick={() => handleCancel(inv.id)}><XCircle size={12} /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailMove} onOpenChange={(o) => { if (!o) setDetailMove(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailMove && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{detailMove.name} {stateBadge(detailMove.state)}</DialogTitle>
                <DialogDescription>{detailMove.partner_name} - {detailMove.date} {detailMove.ref ? `(${detailMove.ref})` : ''}</DialogDescription>
              </DialogHeader>
              {detailMove.invoice_lines?.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>{detailMove.invoice_lines.map((l, i) => (
                      <TableRow key={i}><TableCell>{l.product_name}</TableCell><TableCell className="text-right">{l.quantity}</TableCell><TableCell className="text-right">{fmt(l.unit_price)}</TableCell><TableCell className="text-right font-semibold">{fmt(l.total)}</TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/50 p-3 rounded"><p className="text-muted-foreground text-xs">Untaxed</p><p className="font-bold">{fmt(detailMove.amount_untaxed)}</p></div>
                <div className="bg-muted/50 p-3 rounded"><p className="text-muted-foreground text-xs">Tax</p><p className="font-bold">{fmt(detailMove.amount_tax)}</p></div>
                <div className="bg-primary/10 p-3 rounded"><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-primary">{fmt(detailMove.amount_total)}</p></div>
              </div>
              {detailMove.lines?.length > 0 && (
                <details className="text-sm"><summary className="cursor-pointer font-medium text-muted-foreground">Journal Items ({detailMove.lines.length})</summary>
                  <Table className="mt-2"><TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                    <TableBody>{detailMove.lines.map((l, i) => (
                      <TableRow key={i}><TableCell className="text-xs">{l.account_name}</TableCell><TableCell className="text-right text-xs">{fmtd(l.debit)}</TableCell><TableCell className="text-right text-xs">{fmtd(l.credit)}</TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                </details>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== PAYMENTS TAB =====
function PaymentsTab({ companyId }) {
  const [payments, setPayments] = useState([]);
  const [journals, setJournals] = useState([]);
  const [partners, setPartners] = useState([]);
  const [unpaid, setUnpaid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({ payment_type: 'inbound', partner_id: '', amount: '', journal_id: '', ref: '', invoice_ids: [] });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      odooApi.payments.list({ company_id: companyId }),
      odooApi.journals.list({ company_id: companyId, journal_type: 'cash' }),
      odooApi.journals.list({ company_id: companyId, journal_type: 'bank' }),
      odooApi.partners.list({ company_id: companyId }),
      odooApi.moves.list({ company_id: companyId, state: 'posted', limit: 500 }),
    ]).then(([pay, cj, bj, p, m]) => {
      setPayments(pay.data); setJournals([...cj.data, ...bj.data]); setPartners(p.data);
      setUnpaid(m.data.filter(mv => mv.payment_state && mv.payment_state !== 'paid' && ['out_invoice', 'in_invoice'].includes(mv.move_type)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.amount || !form.journal_id) { toast.error('Fill amount and journal'); return; }
    try {
      await odooApi.payments.create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Payment registered'); setDlgOpen(false);
      setForm({ payment_type: 'inbound', partner_id: '', amount: '', journal_id: '', ref: '', invoice_ids: [] });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4" data-testid="acc-payments">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Payments</h2>
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-payment-btn"><Plus size={16} className="mr-1" />Register Payment</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Register Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Type</Label>
                  <Select value={form.payment_type} onValueChange={v => setForm(f => ({ ...f, payment_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="inbound">Receive Money</SelectItem><SelectItem value="outbound">Send Money</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} data-testid="pay-amount" /></div>
              </div>
              <div className="space-y-1"><Label>Journal</Label>
                <Select value={form.journal_id} onValueChange={v => setForm(f => ({ ...f, journal_id: v }))}>
                  <SelectTrigger data-testid="pay-journal"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{journals.map(j => <SelectItem key={j.id} value={j.id}>{j.name} ({j.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Partner</Label>
                <Select value={form.partner_id || 'none'} onValueChange={v => setForm(f => ({ ...f, partner_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Reference</Label><Input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder="Payment ref" /></div>
              {unpaid.length > 0 && (
                <div className="space-y-1"><Label>Link to Invoice</Label>
                  <Select value={form.invoice_ids[0] || 'none'} onValueChange={v => setForm(f => ({ ...f, invoice_ids: v === 'none' ? [] : [v] }))}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem>{unpaid.map(u => <SelectItem key={u.id} value={u.id}>{u.name} - {fmt(u.amount_residual)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleCreate} className="w-full" data-testid="create-payment-submit"><CreditCard size={16} className="mr-2" />Register</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div> : payments.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No payments yet</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Partner</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{payments.map(p => (
            <TableRow key={p.id}><TableCell>{p.date}</TableCell><TableCell><Badge variant="outline">{p.payment_type === 'inbound' ? 'Received' : 'Sent'}</Badge></TableCell><TableCell>{p.partner_name || '-'}</TableCell><TableCell className="capitalize">{p.payment_method}</TableCell><TableCell className={`text-right font-semibold ${p.payment_type === 'inbound' ? 'text-success' : 'text-error'}`}>{fmt(p.amount)}</TableCell><TableCell><Badge className={p.state === 'posted' ? 'bg-success/20 text-success' : ''}>{p.state}</Badge></TableCell></TableRow>
          ))}</TableBody></Table></div>
      )}
    </div>
  );
}

// ===== JOURNAL ENTRIES TAB =====
function JournalEntriesTab({ companyId }) {
  const [entries, setEntries] = useState([]);
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({ journal_id: '', narration: '', lines: [{ account_id: '', debit: 0, credit: 0, name: '' }, { account_id: '', debit: 0, credit: 0, name: '' }] });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      odooApi.moves.list({ company_id: companyId, move_type: 'entry', limit: 200 }),
      odooApi.journals.list({ company_id: companyId }),
      odooApi.accounts.list({ company_id: companyId }),
    ]).then(([m, j, a]) => { setEntries(m.data); setJournals(j.data); setAccounts(a.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { account_id: '', debit: 0, credit: 0, name: '' }] }));
  const updateLine = (i, field, val) => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [field]: val } : l) }));

  const handleCreate = async () => {
    if (!form.journal_id) { toast.error('Select a journal'); return; }
    const validLines = form.lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) { toast.error('At least 2 lines required'); return; }
    const totalD = validLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalC = validLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalD - totalC) > 0.01) { toast.error(`Entry must balance! Debit=${totalD.toFixed(2)}, Credit=${totalC.toFixed(2)}`); return; }
    try {
      const res = await odooApi.moves.create({ ...form, lines: validLines.map(l => ({ ...l, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 })) });
      await odooApi.moves.post(res.data.id);
      toast.success('Journal entry posted'); setDlgOpen(false);
      setForm({ journal_id: '', narration: '', lines: [{ account_id: '', debit: 0, credit: 0, name: '' }, { account_id: '', debit: 0, credit: 0, name: '' }] });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-4" data-testid="acc-entries">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Journal Entries</h2>
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-entry-btn"><Plus size={16} className="mr-1" />New Entry</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Journal Entry</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Journal</Label>
                  <Select value={form.journal_id} onValueChange={v => setForm(f => ({ ...f, journal_id: v }))}>
                    <SelectTrigger data-testid="je-journal"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{journals.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Narration</Label><Input value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} /></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2"><Label className="font-semibold">Lines</Label><Button size="sm" variant="outline" onClick={addLine}><Plus size={14} className="mr-1" />Line</Button></div>
                {form.lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2 p-2 bg-muted/50 rounded">
                    <div className="col-span-5">
                      <Select value={line.account_id} onValueChange={v => updateLine(i, 'account_id', v)}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Account..." /></SelectTrigger>
                        <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.code} - {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input type="number" placeholder="Debit" value={line.debit || ''} onChange={e => updateLine(i, 'debit', e.target.value)} /></div>
                    <div className="col-span-3"><Input type="number" placeholder="Credit" value={line.credit || ''} onChange={e => updateLine(i, 'credit', e.target.value)} /></div>
                    <div className="col-span-1"><Button variant="ghost" size="sm" className="text-error" onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}><XCircle size={14} /></Button></div>
                  </div>
                ))}
                <div className={`flex justify-between items-center mt-2 p-2 rounded ${balanced ? 'bg-success/10' : 'bg-error/10'}`}>
                  <span className="text-sm">Debit: {fmtd(totalDebit)} | Credit: {fmtd(totalCredit)}</span>
                  <Badge className={balanced ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}>{balanced ? 'Balanced' : `Diff: ${fmtd(totalDebit - totalCredit)}`}</Badge>
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!balanced} data-testid="create-entry-submit"><BookOpen size={16} className="mr-2" />Create & Post</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div> : entries.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No journal entries yet</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Journal</TableHead><TableHead>Narration</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{entries.map(e => (
            <TableRow key={e.id}><TableCell className="font-mono text-sm">{e.name}</TableCell><TableCell>{e.date}</TableCell><TableCell>{e.journal_name}</TableCell><TableCell className="max-w-[200px] truncate">{e.narration || e.ref || '-'}</TableCell><TableCell className="text-right">{fmtd(e.total_debit)}</TableCell><TableCell className="text-right">{fmtd(e.total_credit)}</TableCell><TableCell><Badge variant="outline" className={e.state === 'posted' ? 'text-success' : ''}>{e.state}</Badge></TableCell></TableRow>
          ))}</TableBody></Table></div>
      )}
    </div>
  );
}

// ===== REPORTS TAB =====
function ReportsTab({ companyId }) {
  const [reportType, setReportType] = useState('trial-balance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true); setData(null);
    try {
      const params = { company_id: companyId };
      let res;
      switch (reportType) {
        case 'trial-balance': res = await odooApi.reports.trialBalance(params); break;
        case 'profit-loss': res = await odooApi.reports.profitLoss(params); break;
        case 'balance-sheet': res = await odooApi.reports.balanceSheet(params); break;
        case 'aged-receivables': res = await odooApi.reports.agedReceivables(params); break;
        case 'aged-payables': res = await odooApi.reports.agedPayables(params); break;
        case 'cash-flow': res = await odooApi.reports.cashFlow(params); break;
        case 'tax-report': res = await odooApi.reports.taxReport(params); break;
        default: return;
      }
      setData(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [companyId, reportType]);
  useEffect(() => { loadReport(); }, [loadReport]);

  const reportOptions = [
    { value: 'trial-balance', label: 'Trial Balance', icon: Scale },
    { value: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
    { value: 'balance-sheet', label: 'Balance Sheet', icon: BarChart3 },
    { value: 'aged-receivables', label: 'Aged Receivables', icon: Clock },
    { value: 'aged-payables', label: 'Aged Payables', icon: AlertTriangle },
    { value: 'cash-flow', label: 'Cash Flow', icon: ArrowUpDown },
    { value: 'tax-report', label: 'Tax Report', icon: Calculator },
  ];

  return (
    <div className="space-y-4" data-testid="acc-reports">
      <div className="flex flex-wrap gap-2">
        {reportOptions.map(r => (
          <Button key={r.value} variant={reportType === r.value ? 'default' : 'outline'} size="sm"
            onClick={() => setReportType(r.value)} data-testid={`report-${r.value}`}>
            <r.icon size={14} className="mr-1" />{r.label}
          </Button>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div> : !data ? null : (
        <Card>
          <CardHeader><CardTitle>{reportOptions.find(r => r.value === reportType)?.label}</CardTitle></CardHeader>
          <CardContent>
            {reportType === 'trial-balance' && data.rows && (
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                  <TableBody>{data.rows.map((r, i) => (
                    <TableRow key={i}><TableCell className="font-mono text-sm">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{fmtd(r.debit)}</TableCell><TableCell className="text-right">{fmtd(r.credit)}</TableCell><TableCell className="text-right font-semibold">{fmtd(r.balance)}</TableCell></TableRow>
                  ))}</TableBody></Table>
                <div className={`mt-3 p-3 rounded flex justify-between ${data.is_balanced ? 'bg-success/10' : 'bg-error/10'}`}>
                  <span>Total Debit: {fmtd(data.total_debit)} | Total Credit: {fmtd(data.total_credit)}</span>
                  <Badge className={data.is_balanced ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}>{data.is_balanced ? 'Balanced' : 'NOT Balanced'}</Badge>
                </div>
              </div>
            )}
            {reportType === 'profit-loss' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-heading font-bold text-success mb-2">Income ({fmt(data.total_income)})</h3>
                  {data.income?.map((item, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{item.name}</span><span>{fmt(item.amount)}</span></div>)}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-error mb-2">Expenses ({fmt(data.total_expense)})</h3>
                  {data.expenses?.map((item, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{item.name}</span><span>{fmt(item.amount)}</span></div>)}
                </div>
                <div className="md:col-span-2 p-4 rounded-lg bg-primary/10 text-center"><p className="text-lg font-heading font-bold">Net Profit: <span className={data.net_profit >= 0 ? 'text-success' : 'text-error'}>{fmt(data.net_profit)}</span></p></div>
              </div>
            )}
            {reportType === 'balance-sheet' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><h3 className="font-heading font-bold mb-2">Assets ({fmt(data.total_assets)})</h3>{data.assets?.map((a, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{a.name}</span><span>{fmt(a.amount)}</span></div>)}</div>
                <div>
                  <h3 className="font-heading font-bold mb-2">Liabilities ({fmt(data.total_liabilities)})</h3>{data.liabilities?.map((a, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{a.name}</span><span>{fmt(a.amount)}</span></div>)}
                  <h3 className="font-heading font-bold mt-4 mb-2">Equity ({fmt(data.total_equity)})</h3>{data.equity?.map((a, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{a.name}</span><span>{fmt(a.amount)}</span></div>)}
                </div>
              </div>
            )}
            {reportType === 'aged-receivables' && (
              <div><div className="grid grid-cols-5 gap-2 mb-4">
                {[['Current', data.buckets?.current], ['1-30 Days', data.buckets?.['1_30']], ['31-60 Days', data.buckets?.['31_60']], ['61-90 Days', data.buckets?.['61_90']], ['90+ Days', data.buckets?.over_90]].map(([label, val], i) => (
                  <div key={i} className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{fmt(val)}</p></div>
                ))}</div>
                <p className="text-lg font-bold">Total Outstanding: {fmt(data.total)}</p>
              </div>
            )}
            {reportType === 'aged-payables' && (
              <div><div className="grid grid-cols-5 gap-2 mb-4">
                {[['Current', data.buckets?.current], ['1-30 Days', data.buckets?.['1_30']], ['31-60 Days', data.buckets?.['31_60']], ['61-90 Days', data.buckets?.['61_90']], ['90+ Days', data.buckets?.over_90]].map(([label, val], i) => (
                  <div key={i} className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{fmt(val)}</p></div>
                ))}</div>
                <p className="text-lg font-bold">Total Payable: {fmt(data.total)}</p>
              </div>
            )}
            {reportType === 'cash-flow' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">Operating</p><p className="font-bold">{fmt(data.operating)}</p></div>
                <div className="p-4 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">Investing</p><p className="font-bold">{fmt(data.investing)}</p></div>
                <div className="p-4 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">Financing</p><p className="font-bold">{fmt(data.financing)}</p></div>
                <div className="p-4 bg-primary/10 rounded text-center"><p className="text-xs text-muted-foreground">Net Change</p><p className="font-bold text-primary">{fmt(data.net_change)}</p></div>
              </div>
            )}
            {reportType === 'tax-report' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">GST Output</p><p className="font-bold">{fmt(data.gst_output)}</p></div>
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">GST Input</p><p className="font-bold">{fmt(data.gst_input)}</p></div>
                  <div className="p-3 bg-primary/10 rounded text-center"><p className="text-xs text-muted-foreground">Net GST Payable</p><p className="font-bold">{fmt(data.net_gst_payable)}</p></div>
                </div>
                {data.taxes?.filter(t => t.base_amount > 0).length > 0 && (
                  <Table><TableHeader><TableRow><TableHead>Tax</TableHead><TableHead>Group</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">Tax Amount</TableHead></TableRow></TableHeader>
                    <TableBody>{data.taxes.filter(t => t.base_amount > 0).map((t, i) => (
                      <TableRow key={i}><TableCell>{t.name}</TableCell><TableCell>{t.tax_group}</TableCell><TableCell className="text-right">{fmtd(t.base_amount)}</TableCell><TableCell className="text-right">{fmtd(t.tax_amount)}</TableCell></TableRow>
                    ))}</TableBody></Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== CONFIG TAB =====
function ConfigTab({ companyId }) {
  const [subTab, setSubTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [journals, setJournals] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partnerDlg, setPartnerDlg] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: '', partner_type: 'customer', email: '', phone: '', gst_number: '', payment_terms_days: 30 });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      odooApi.accounts.list({ company_id: companyId }),
      odooApi.partners.list({ company_id: companyId }),
      odooApi.taxes.list({ company_id: companyId }),
      odooApi.journals.list({ company_id: companyId }),
      odooApi.fiscalYears.list({ company_id: companyId }),
    ]).then(([a, p, t, j, fy]) => { setAccounts(a.data); setPartners(p.data); setTaxes(t.data); setJournals(j.data); setFiscalYears(fy.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const createPartner = async () => {
    if (!partnerForm.name) { toast.error('Name required'); return; }
    try { await odooApi.partners.create(partnerForm); toast.success('Partner created'); setPartnerDlg(false); setPartnerForm({ name: '', partner_type: 'customer', email: '', phone: '', gst_number: '', payment_terms_days: 30 }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-4" data-testid="acc-config">
      <div className="flex flex-wrap gap-2">
        {[['accounts','Chart of Accounts'], ['partners','Partners'], ['taxes','Taxes'], ['journals','Journals'], ['fiscal','Fiscal Years']].map(([k,v]) =>
          <Button key={k} variant={subTab === k ? 'default' : 'outline'} size="sm" onClick={() => setSubTab(k)}>{v}</Button>
        )}
      </div>

      {subTab === 'accounts' && (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Reconcile</TableHead></TableRow></TableHeader>
          <TableBody>{accounts.map(a => (
            <TableRow key={a.id}><TableCell className="font-mono text-sm font-medium">{a.code}</TableCell><TableCell>{a.name}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{a.account_type}</Badge></TableCell><TableCell className="text-right font-semibold">{fmtd(a.balance)}</TableCell><TableCell>{a.reconcile ? <CheckCircle2 size={14} className="text-success" /> : '-'}</TableCell></TableRow>
          ))}</TableBody></Table></div>
      )}

      {subTab === 'partners' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={partnerDlg} onOpenChange={setPartnerDlg}>
              <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-partner-btn"><Plus size={16} className="mr-1" />New Partner</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create Partner</DialogTitle></DialogHeader>
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
          <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Email</TableHead><TableHead>GST</TableHead><TableHead className="text-right">Receivable</TableHead><TableHead className="text-right">Payable</TableHead></TableRow></TableHeader>
            <TableBody>{partners.map(p => (
              <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell><Badge variant="outline" className="capitalize">{p.partner_type}</Badge></TableCell><TableCell className="text-sm">{p.email || '-'}</TableCell><TableCell className="text-sm">{p.gst_number || '-'}</TableCell><TableCell className="text-right text-success">{fmt(p.total_receivable)}</TableCell><TableCell className="text-right text-error">{fmt(p.total_payable)}</TableCell></TableRow>
            ))}</TableBody></Table></div>
        </div>
      )}

      {subTab === 'taxes' && (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Group</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Rate</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
          <TableBody>{taxes.map(t => (
            <TableRow key={t.id}><TableCell className="font-medium">{t.name}</TableCell><TableCell>{t.tax_group}</TableCell><TableCell>{t.tax_type}</TableCell><TableCell className="text-right font-semibold">{t.amount}%</TableCell><TableCell>{t.active ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-error" />}</TableCell></TableRow>
          ))}</TableBody></Table></div>
      )}

      {subTab === 'journals' && (
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
      )}

      {subTab === 'fiscal' && (
        <div className="space-y-3">
          {fiscalYears.map(fy => (
            <Card key={fy.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div><h3 className="font-bold">{fy.name}</h3><p className="text-sm text-muted-foreground">{fy.start_date} to {fy.end_date}</p></div>
                <div className="flex items-center gap-2">
                  <Badge className={fy.state === 'open' ? 'bg-success/20 text-success' : 'bg-muted'}>{fy.state}</Badge>
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

// ===== MAIN PAGE =====
export default function OdooAccountingPage() {
  const { companyId } = useCompany();

  return (
    <div className="space-y-6" data-testid="odoo-accounting-page">
      <div>
        <h1 className="text-4xl font-heading font-bold">Accounting</h1>
        <p className="text-muted-foreground mt-1">Complete double-entry bookkeeping system</p>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-3xl grid-cols-6">
          <TabsTrigger value="overview" data-testid="acc-tab-overview"><DollarSign size={14} className="mr-1 hidden sm:inline" />Overview</TabsTrigger>
          <TabsTrigger value="invoicing" data-testid="acc-tab-invoicing"><Receipt size={14} className="mr-1 hidden sm:inline" />Invoicing</TabsTrigger>
          <TabsTrigger value="payments" data-testid="acc-tab-payments"><CreditCard size={14} className="mr-1 hidden sm:inline" />Payments</TabsTrigger>
          <TabsTrigger value="entries" data-testid="acc-tab-entries"><BookOpen size={14} className="mr-1 hidden sm:inline" />Entries</TabsTrigger>
          <TabsTrigger value="reports" data-testid="acc-tab-reports"><BarChart3 size={14} className="mr-1 hidden sm:inline" />Reports</TabsTrigger>
          <TabsTrigger value="config" data-testid="acc-tab-config"><Settings size={14} className="mr-1 hidden sm:inline" />Config</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab companyId={companyId} /></TabsContent>
        <TabsContent value="invoicing"><InvoicingTab companyId={companyId} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab companyId={companyId} /></TabsContent>
        <TabsContent value="entries"><JournalEntriesTab companyId={companyId} /></TabsContent>
        <TabsContent value="reports"><ReportsTab companyId={companyId} /></TabsContent>
        <TabsContent value="config"><ConfigTab companyId={companyId} /></TabsContent>
      </Tabs>
    </div>
  );
}
