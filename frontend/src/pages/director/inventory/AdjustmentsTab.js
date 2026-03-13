import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowUpDown, Loader2 } from 'lucide-react';

export function AdjustmentsTab({ companyId }) {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ product_id: '', new_quantity: '', location_id: '', reason: '', unit_cost: '' });
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = companyId ? { company_id: companyId } : {};
    Promise.all([
      inventoryApi.products.list(params),
      inventoryApi.locations.list(params),
    ]).then(([p, l]) => { setProducts(p.data); setLocations(l.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const selectedProduct = products.find(p => p.id === form.product_id);

  const handleSubmit = async () => {
    if (!form.product_id || form.new_quantity === '') { toast.error('Select product and enter new quantity'); return; }
    setSubmitting(true);
    try {
      const res = await inventoryApi.adjustments.create({ ...form, new_quantity: parseFloat(form.new_quantity), unit_cost: parseFloat(form.unit_cost) || undefined, company_id: companyId });
      setResult(res.data); toast.success('Inventory adjusted'); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="max-w-lg mx-auto space-y-4" data-testid="inv-adjustments">
      <h2 className="text-lg font-heading font-semibold">Inventory Adjustment</h2>
      <Card><CardContent className="p-4 space-y-3">
        <div className="space-y-1"><Label>Product</Label>
          <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
            <SelectTrigger data-testid="adj-product"><SelectValue placeholder="Select product..." /></SelectTrigger>
            <SelectContent>{products.filter(p => p.product_type === 'storable').map(p => <SelectItem key={p.id} value={p.id}>{p.name} (Current: {p.qty_on_hand})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {selectedProduct && <p className="text-sm text-muted-foreground">Current stock: <strong>{selectedProduct.qty_on_hand}</strong> {selectedProduct.uom_name}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>New Quantity</Label><Input type="number" value={form.new_quantity} onChange={e => setForm(f => ({ ...f, new_quantity: e.target.value }))} data-testid="adj-qty" /></div>
          <div className="space-y-1"><Label>Unit Cost (optional)</Label><Input type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} /></div>
        </div>
        <div className="space-y-1"><Label>Location</Label>
          <Select value={form.location_id || 'none'} onValueChange={v => setForm(f => ({ ...f, location_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Default</SelectItem>{locations.filter(l => l.location_type === 'internal').map(l => <SelectItem key={l.id} value={l.id}>{l.code || l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Reason</Label><Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g., Physical count, Damage, etc." data-testid="adj-reason" /></div>
        <Button onClick={handleSubmit} disabled={submitting} className="w-full" data-testid="adj-submit">
          {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <ArrowUpDown size={16} className="mr-2" />}Apply Adjustment
        </Button>
      </CardContent></Card>
      {result && result.status !== 'no_change' && (
        <Card className="border-success/30 bg-success/5"><CardContent className="p-4 text-sm">
          <p className="font-semibold text-success">Adjustment Applied</p>
          <p>Old: {result.old_qty} → New: {result.new_qty} (Diff: {result.diff > 0 ? '+' : ''}{result.diff})</p>
        </CardContent></Card>
      )}
    </div>
  );
}
