import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { odooApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Send, XCircle, Receipt, Loader2, ArrowDown, ArrowUp } from 'lucide-react';
import { fmt, fmtd, stateBadge, payBadge, LoadingSpinner, EmptyState, cleanParams } from './helpers';

const GST_RATES = [
  { value: 0, label: 'No GST (0%)' },
  { value: 5, label: 'GST 5%' },
  { value: 12, label: 'GST 12%' },
  { value: 18, label: 'GST 18%' },
  { value: 28, label: 'GST 28%' },
];

export function InvoicingTab({ companyId }) {
  const [invoices, setInvoices] = useState([]);
  const [partners, setPartners] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('invoices');
  const [dlgOpen, setDlgOpen] = useState(false);
  const [gstType, setGstType] = useState('intra'); // intra = CGST+SGST, inter = IGST
  const [form, setForm] = useState({
    move_type: 'out_invoice', partner_id: '', ref: '',
    invoice_lines: [{ product_name: '', quantity: 1, unit_price: 0, discount: 0, gst_rate: 18, tax_ids: [] }],
    apply_advance: false, advance_amount: 0,
  });
  const [detailMove, setDetailMove] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = cleanParams({ company_id: companyId });
    Promise.all([
      odooApi.moves.list({ ...params, move_type: filter, limit: 100 }),
      odooApi.partners.list(params),
      odooApi.payments.list({ ...params, is_advance: true }),
    ]).then(([m, p, adv]) => {
      setInvoices(m.data); setPartners(p.data);
      setAdvances(adv.data?.filter?.(a => a.advance_balance > 0) || []);
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [companyId, filter]);
  useEffect(() => { load(); }, [load]);

  const addLine = () => setForm(f => ({ ...f, invoice_lines: [...f.invoice_lines, { product_name: '', quantity: 1, unit_price: 0, discount: 0, gst_rate: 18, tax_ids: [] }] }));
  const updateLine = (i, field, val) => setForm(f => ({ ...f, invoice_lines: f.invoice_lines.map((l, j) => j === i ? { ...l, [field]: val } : l) }));
  const removeLine = (i) => setForm(f => ({ ...f, invoice_lines: f.invoice_lines.filter((_, j) => j !== i) }));

  const calcLineTotal = (l) => l.quantity * l.unit_price * (1 - (l.discount || 0) / 100);
  const calcLineTax = (l) => calcLineTotal(l) * (l.gst_rate || 0) / 100;
  const subtotal = form.invoice_lines.reduce((s, l) => s + calcLineTotal(l), 0);
  const totalTax = form.invoice_lines.reduce((s, l) => s + calcLineTax(l), 0);
  const grandTotal = subtotal + totalTax - (form.apply_advance ? (form.advance_amount || 0) : 0);

  const partnerAdvances = advances.filter(a => a.partner_id === form.partner_id);
  const maxAdvance = partnerAdvances.reduce((s, a) => s + (a.advance_balance || 0), 0);

  const handleCreate = async () => {
    if (!form.partner_id) { toast.error('Select a partner'); return; }
    if (!form.invoice_lines.some(l => l.product_name && l.unit_price > 0)) { toast.error('Add at least one line item'); return; }
    try {
      const payload = {
        ...form,
        gst_type: gstType,
        invoice_lines: form.invoice_lines.filter(l => l.product_name).map(l => ({
          ...l,
          gst_rate: l.gst_rate,
          gst_type: gstType,
        })),
        advance_adjustment: form.apply_advance ? form.advance_amount : 0,
      };
      await odooApi.invoices.create(payload);
      toast.success('Invoice created'); setDlgOpen(false);
      setForm({ move_type: 'out_invoice', partner_id: '', ref: '', invoice_lines: [{ product_name: '', quantity: 1, unit_price: 0, discount: 0, gst_rate: 18, tax_ids: [] }], apply_advance: false, advance_amount: 0 });
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
            <DialogHeader>
              <DialogTitle>Create {form.move_type === 'out_invoice' ? 'Customer Invoice' : form.move_type === 'in_invoice' ? 'Vendor Bill' : form.move_type === 'out_refund' ? 'Credit Note' : 'Debit Note'}</DialogTitle>
              <DialogDescription>Fill in the details below with GST information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
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
                <div className="space-y-1">
                  <Label>GST Type</Label>
                  <Select value={gstType} onValueChange={setGstType}>
                    <SelectTrigger data-testid="inv-gst-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intra">Intra-State (CGST + SGST)</SelectItem>
                      <SelectItem value="inter">Inter-State (IGST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Reference</Label><Input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder="PO#, Bill#, etc." /></div>

              {/* Line Items with GST */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="font-semibold">Line Items</Label>
                  <Button size="sm" variant="outline" onClick={addLine}><Plus size={14} className="mr-1" />Add Line</Button>
                </div>
                <div className="space-y-2">
                  {form.invoice_lines.map((line, i) => (
                    <div key={i} className="p-2 bg-muted/50 rounded space-y-1">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4"><Input placeholder="Product/Service" value={line.product_name} onChange={e => updateLine(i, 'product_name', e.target.value)} data-testid={`inv-line-name-${i}`} /></div>
                        <div className="col-span-2"><Input type="number" placeholder="Qty" value={line.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                        <div className="col-span-2"><Input type="number" placeholder="Price" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} data-testid={`inv-line-price-${i}`} /></div>
                        <div className="col-span-2">
                          <Select value={String(line.gst_rate)} onValueChange={v => updateLine(i, 'gst_rate', parseFloat(v))}>
                            <SelectTrigger className="text-xs" data-testid={`inv-line-gst-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{GST_RATES.map(r => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 text-right font-semibold text-xs pt-2">{fmt(calcLineTotal(line))}</div>
                        <div className="col-span-1"><Button variant="ghost" size="sm" className="text-error" onClick={() => removeLine(i)}><XCircle size={14} /></Button></div>
                      </div>
                      {line.gst_rate > 0 && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          {gstType === 'intra'
                            ? `CGST ${line.gst_rate / 2}%: ${fmt(calcLineTax(line) / 2)} + SGST ${line.gst_rate / 2}%: ${fmt(calcLineTax(line) / 2)}`
                            : `IGST ${line.gst_rate}%: ${fmt(calcLineTax(line))}`
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* GST Summary */}
              <div className="bg-muted/50 rounded p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                {gstType === 'intra' ? (
                  <>
                    <div className="flex justify-between text-muted-foreground"><span>CGST</span><span>{fmt(totalTax / 2)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>SGST</span><span>{fmt(totalTax / 2)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between text-muted-foreground"><span>IGST</span><span>{fmt(totalTax)}</span></div>
                )}
                {form.apply_advance && form.advance_amount > 0 && (
                  <div className="flex justify-between text-success"><span>Advance Adjustment</span><span>-{fmt(form.advance_amount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1"><span>Grand Total</span><span>{fmt(grandTotal)}</span></div>
              </div>

              {/* Advance Payment Adjustment */}
              {form.partner_id && maxAdvance > 0 && (
                <Card className="border-info/30 bg-info/5">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch id="apply-adv" checked={form.apply_advance} onCheckedChange={v => setForm(f => ({ ...f, apply_advance: v, advance_amount: v ? Math.min(maxAdvance, subtotal + totalTax) : 0 }))} data-testid="apply-advance" />
                        <Label htmlFor="apply-adv" className="text-xs font-medium">Apply Advance Payment</Label>
                      </div>
                      <Badge className="bg-info/20 text-info border-0 text-[10px]">Available: {fmt(maxAdvance)}</Badge>
                    </div>
                    {form.apply_advance && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">Amount:</Label>
                        <Input type="number" value={form.advance_amount} onChange={e => setForm(f => ({ ...f, advance_amount: Math.min(parseFloat(e.target.value) || 0, maxAdvance) }))} className="w-32" data-testid="advance-amount" />
                        <span className="text-xs text-muted-foreground">max {fmt(maxAdvance)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
              <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">GST</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Due</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => viewDetail(inv.id)}>
                  <TableCell className="font-mono text-sm font-medium">{inv.name}</TableCell>
                  <TableCell>{inv.partner_name || '-'}</TableCell>
                  <TableCell className="text-sm">{inv.date}</TableCell>
                  <TableCell className="text-sm">{inv.due_date || '-'}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(inv.amount_untaxed)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{fmt(inv.amount_tax)}</TableCell>
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
                  <Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">GST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>{detailMove.invoice_lines.map((l, i) => (
                      <TableRow key={i}><TableCell>{l.product_name}</TableCell><TableCell className="text-right">{l.quantity}</TableCell><TableCell className="text-right">{fmt(l.unit_price)}</TableCell><TableCell className="text-right text-xs text-muted-foreground">{l.gst_rate ? `${l.gst_rate}%` : '-'}</TableCell><TableCell className="text-right font-semibold">{fmt(l.total)}</TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="bg-muted/50 p-3 rounded"><p className="text-muted-foreground text-xs">Untaxed</p><p className="font-bold">{fmt(detailMove.amount_untaxed)}</p></div>
                <div className="bg-muted/50 p-3 rounded"><p className="text-muted-foreground text-xs">GST</p><p className="font-bold">{fmt(detailMove.amount_tax)}</p>
                  {detailMove.gst_type && <p className="text-[10px] text-muted-foreground">{detailMove.gst_type === 'intra' ? 'CGST+SGST' : 'IGST'}</p>}
                </div>
                <div className="bg-primary/10 p-3 rounded"><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-primary">{fmt(detailMove.amount_total)}</p></div>
                <div className="bg-muted/50 p-3 rounded"><p className="text-muted-foreground text-xs">Due</p><p className="font-bold text-error">{fmt(detailMove.amount_residual)}</p></div>
              </div>
              {detailMove.advance_adjustment > 0 && (
                <Badge className="bg-info/20 text-info border-0">Advance applied: {fmt(detailMove.advance_adjustment)}</Badge>
              )}
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
