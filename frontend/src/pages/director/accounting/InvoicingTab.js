import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { odooApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Send, XCircle, Receipt, Loader2 } from 'lucide-react';
import { fmt, fmtd, stateBadge, payBadge, LoadingSpinner, EmptyState, cleanParams } from './helpers';

export function InvoicingTab({ companyId }) {
  const [invoices, setInvoices] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('invoices');
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({ move_type: 'out_invoice', partner_id: '', ref: '', invoice_lines: [{ product_name: '', quantity: 1, unit_price: 0, discount: 0, tax_ids: [] }] });
  const [detailMove, setDetailMove] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = cleanParams({ company_id: companyId });
    Promise.all([
      odooApi.moves.list({ ...params, move_type: filter, limit: 100 }),
      odooApi.partners.list(params),
    ]).then(([m, p]) => {
      setInvoices(m.data); setPartners(p.data);
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

  const handlePost = async (id) => { try { await odooApi.moves.post(id); toast.success('Posted'); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed to post'); } };
  const handleCancel = async (id) => { try { await odooApi.moves.cancel(id); toast.success('Cancelled'); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };
  const viewDetail = async (id) => { try { const r = await odooApi.moves.get(id); setDetailMove(r.data); } catch { toast.error('Failed to load details'); } };

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
              <div className="space-y-1"><Label>Reference</Label><Input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder="PO#, Bill#, etc." /></div>
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

      {loading ? <LoadingSpinner /> : invoices.length === 0 ? (
        <EmptyState icon={Receipt} message={`No ${filter} yet. Create one to get started.`} />
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
