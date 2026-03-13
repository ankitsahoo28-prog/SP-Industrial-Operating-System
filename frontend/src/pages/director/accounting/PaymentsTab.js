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
import { Plus, CreditCard, ArrowDown, ArrowUp } from 'lucide-react';
import { fmt, LoadingSpinner, cleanParams } from './helpers';

export function PaymentsTab({ companyId }) {
  const [payments, setPayments] = useState([]);
  const [journals, setJournals] = useState([]);
  const [partners, setPartners] = useState([]);
  const [unpaid, setUnpaid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({ payment_type: 'inbound', partner_id: '', amount: '', journal_id: '', ref: '', invoice_ids: [], is_advance: false });

  const load = useCallback(() => {
    setLoading(true);
    const params = cleanParams({ company_id: companyId });
    Promise.all([
      odooApi.payments.list(params),
      odooApi.journals.list({ ...params, journal_type: 'cash' }),
      odooApi.journals.list({ ...params, journal_type: 'bank' }),
      odooApi.partners.list(params),
      odooApi.moves.list({ ...params, state: 'posted', limit: 500 }),
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
      toast.success(form.is_advance ? 'Advance payment registered' : 'Payment registered');
      setDlgOpen(false);
      setForm({ payment_type: 'inbound', partner_id: '', amount: '', journal_id: '', ref: '', invoice_ids: [], is_advance: false });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const advancePayments = payments.filter(p => p.is_advance);
  const regularPayments = payments.filter(p => !p.is_advance);

  return (
    <div className="space-y-4" data-testid="acc-payments">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Payments</h2>
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-payment-btn"><Plus size={16} className="mr-1" />Register Payment</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register Payment</DialogTitle>
              <DialogDescription>Record a regular or advance payment</DialogDescription>
            </DialogHeader>
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

              {/* Advance Payment Toggle */}
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Checkbox id="is-advance" checked={form.is_advance} onCheckedChange={v => setForm(f => ({ ...f, is_advance: v, invoice_ids: v ? [] : f.invoice_ids }))} data-testid="is-advance" />
                <Label htmlFor="is-advance" className="text-sm font-medium">This is an Advance Payment</Label>
              </div>
              {form.is_advance && (
                <p className="text-xs text-info">Advance will be tracked and can be adjusted against future invoices</p>
              )}

              {!form.is_advance && unpaid.length > 0 && (
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

      {/* Advance Payments Summary */}
      {advancePayments.length > 0 && (
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-3">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><ArrowDown size={14} className="text-info" />Advance Payments</h3>
            <div className="space-y-1">
              {advancePayments.map(p => (
                <div key={p.id} className="flex justify-between items-center text-sm bg-background/50 p-2 rounded">
                  <div>
                    <span className="font-medium">{p.partner_name || 'N/A'}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{fmt(p.amount)}</span>
                    <Badge className={`text-[10px] border-0 ${(p.advance_balance || 0) > 0 ? 'bg-info/20 text-info' : 'bg-muted'}`}>
                      Balance: {fmt(p.advance_balance || 0)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? <LoadingSpinner /> : regularPayments.length === 0 && advancePayments.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No payments yet</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Partner</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Advance</TableHead></TableRow></TableHeader>
          <TableBody>{payments.map(p => (
            <TableRow key={p.id}><TableCell>{p.date}</TableCell><TableCell><Badge variant="outline">{p.payment_type === 'inbound' ? 'Received' : 'Sent'}</Badge></TableCell><TableCell>{p.partner_name || '-'}</TableCell><TableCell className="capitalize">{p.payment_method}</TableCell><TableCell className={`text-right font-semibold ${p.payment_type === 'inbound' ? 'text-success' : 'text-error'}`}>{fmt(p.amount)}</TableCell><TableCell><Badge className={p.state === 'posted' ? 'bg-success/20 text-success border-0' : ''}>{p.state}</Badge></TableCell><TableCell>{p.is_advance ? <Badge className="bg-info/20 text-info border-0 text-[10px]">ADV</Badge> : '-'}</TableCell></TableRow>
          ))}</TableBody></Table></div>
      )}
    </div>
  );
}
