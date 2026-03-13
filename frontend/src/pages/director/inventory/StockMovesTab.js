import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Truck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const MOVE_TYPES = [
  { value: 'receipt', label: 'Receipt (In)', color: 'text-success' },
  { value: 'delivery', label: 'Delivery (Out)', color: 'text-error' },
  { value: 'internal', label: 'Internal Transfer', color: 'text-info' },
  { value: 'scrap', label: 'Scrap', color: 'text-warning' },
];

export function StockMovesTab({ companyId }) {
  const [moves, setMoves] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '', source_location_id: '', dest_location_id: '', move_type: 'receipt', reference: '', lot_number: '', unit_cost: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = { company_id: companyId };
    if (filter !== 'all') params.move_type = filter;
    Promise.all([
      inventoryApi.stockMoves.list(params),
      inventoryApi.products.list({ company_id: companyId }),
      inventoryApi.locations.list({ company_id: companyId }),
    ]).then(([m, p, l]) => { setMoves(m.data); setProducts(p.data); setLocations(l.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, filter]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.product_id || !form.quantity) { toast.error('Product and quantity required'); return; }
    try {
      const move = await inventoryApi.stockMoves.create({ ...form, quantity: parseFloat(form.quantity), unit_cost: parseFloat(form.unit_cost) || 0, company_id: companyId });
      await inventoryApi.stockMoves.confirm(move.data.id);
      toast.success('Stock move confirmed'); setDlg(false);
      setForm({ product_id: '', quantity: '', source_location_id: '', dest_location_id: '', move_type: 'receipt', reference: '', lot_number: '', unit_cost: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const confirmMove = async (id) => { try { await inventoryApi.stockMoves.confirm(id); toast.success('Confirmed'); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };
  const cancelMove = async (id) => { try { await inventoryApi.stockMoves.cancel(id); toast.success('Cancelled'); load(); } catch (err) { toast.error('Failed'); } };

  return (
    <div className="space-y-4" data-testid="inv-moves">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1">
          {[{ value: 'all', label: 'All' }, ...MOVE_TYPES].map(t =>
            <Button key={t.value} variant={filter === t.value ? 'default' : 'outline'} size="sm" onClick={() => setFilter(t.value)} data-testid={`move-filter-${t.value}`}>{t.label}</Button>)}
        </div>
        <Dialog open={dlg} onOpenChange={setDlg}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-move-btn"><Plus size={16} className="mr-1" />New Move</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Stock Move</DialogTitle><DialogDescription>Record inventory movement</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Type</Label><Select value={form.move_type} onValueChange={v => setForm(f => ({ ...f, move_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MOVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Product</Label><Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}><SelectTrigger data-testid="move-product"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} data-testid="move-qty" /></div>
                <div className="space-y-1"><Label>Unit Cost</Label><Input type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} /></div>
              </div>
              {(form.move_type === 'delivery' || form.move_type === 'internal' || form.move_type === 'scrap') && (
                <div className="space-y-1"><Label>Source Location</Label><Select value={form.source_location_id || 'none'} onValueChange={v => setForm(f => ({ ...f, source_location_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code || l.name}</SelectItem>)}</SelectContent></Select></div>
              )}
              {(form.move_type === 'receipt' || form.move_type === 'internal') && (
                <div className="space-y-1"><Label>Destination Location</Label><Select value={form.dest_location_id || 'none'} onValueChange={v => setForm(f => ({ ...f, dest_location_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code || l.name}</SelectItem>)}</SelectContent></Select></div>
              )}
              <div className="space-y-1"><Label>Lot/Batch Number</Label><Input value={form.lot_number} onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))} placeholder="Optional" /></div>
              <div className="space-y-1"><Label>Reference</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="PO#, SO#, etc." /></div>
              <Button onClick={handleCreate} className="w-full" data-testid="create-move-submit"><Truck size={16} className="mr-2" />Create & Confirm</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div> : moves.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No stock moves yet</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Product</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Lot</TableHead><TableHead>Ref</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>{moves.map(m => (
            <TableRow key={m.id}><TableCell className="text-sm">{(m.done_date || m.created_at || '').slice(0,10)}</TableCell><TableCell><Badge variant="outline" className={`text-[10px] capitalize ${MOVE_TYPES.find(t => t.value === m.move_type)?.color || ''}`}>{m.move_type}</Badge></TableCell><TableCell className="font-medium">{m.product_name}</TableCell><TableCell className="text-sm">{m.source_location_name || '-'}</TableCell><TableCell className="text-sm">{m.dest_location_name || '-'}</TableCell><TableCell className="text-right font-semibold">{m.quantity}</TableCell><TableCell className="text-sm">{m.lot_number || '-'}</TableCell><TableCell className="text-sm">{m.reference || '-'}</TableCell><TableCell><Badge className={m.state === 'done' ? 'bg-success/20 text-success border-0' : m.state === 'cancelled' ? 'bg-error/20 text-error border-0' : 'bg-warning/20 text-warning border-0'}>{m.state}</Badge></TableCell>
              <TableCell>{m.state === 'draft' && <div className="flex gap-1"><Button size="sm" variant="ghost" className="text-success h-7" onClick={() => confirmMove(m.id)}><CheckCircle2 size={12} /></Button><Button size="sm" variant="ghost" className="text-error h-7" onClick={() => cancelMove(m.id)}><XCircle size={12} /></Button></div>}</TableCell>
            </TableRow>
          ))}</TableBody></Table></div>
      )}
    </div>
  );
}
