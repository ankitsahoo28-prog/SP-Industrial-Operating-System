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
import { Plus, Search, Package, Loader2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export function ProductsTab({ companyId }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', barcode: '', product_type: 'storable', category_id: '', uom_id: '', cost_price: '', sale_price: '', description: '', min_stock: '', max_stock: '', reorder_point: '', reorder_qty: '', tracking: 'none', valuation_method: 'average', hsn_code: '', gst_rate: '18' });

  const load = useCallback(() => {
    setLoading(true);
    const params = companyId ? { company_id: companyId, search: search || undefined } : { search: search || undefined };
    Promise.all([
      inventoryApi.products.list(params),
      inventoryApi.categories.list(companyId ? { company_id: companyId } : {}),
      inventoryApi.uoms.list(companyId ? { company_id: companyId } : {}),
    ]).then(([p, c, u]) => { setProducts(p.data); setCategories(c.data); setUoms(u.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, search]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    try {
      await inventoryApi.products.create({
        ...form,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        min_stock: parseFloat(form.min_stock) || 0,
        max_stock: parseFloat(form.max_stock) || 0,
        reorder_point: parseFloat(form.reorder_point) || 0,
        reorder_qty: parseFloat(form.reorder_qty) || 0,
        gst_rate: parseFloat(form.gst_rate) || 18,
        company_id: companyId,
      });
      toast.success('Product created'); setDlg(false);
      setForm({ name: '', sku: '', barcode: '', product_type: 'storable', category_id: '', uom_id: '', cost_price: '', sale_price: '', description: '', min_stock: '', max_stock: '', reorder_point: '', reorder_qty: '', tracking: 'none', valuation_method: 'average', hsn_code: '', gst_rate: '18' });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4" data-testid="inv-products">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products, SKU, barcode..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="product-search" />
        </div>
        <Dialog open={dlg} onOpenChange={setDlg}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-product-btn"><Plus size={16} className="mr-1" />New Product</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Product</DialogTitle><DialogDescription>Add a new product to inventory</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="prod-name" /></div>
                <div className="space-y-1"><Label>SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Auto-generated if empty" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Type</Label><Select value={form.product_type} onValueChange={v => setForm(f => ({ ...f, product_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="storable">Storable</SelectItem><SelectItem value="consumable">Consumable</SelectItem><SelectItem value="service">Service</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>Category</Label><Select value={form.category_id || 'none'} onValueChange={v => setForm(f => ({ ...f, category_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>UoM</Label><Select value={form.uom_id || 'none'} onValueChange={v => setForm(f => ({ ...f, uom_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{uoms.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.code})</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1"><Label>Cost Price</Label><Input type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} data-testid="prod-cost" /></div>
                <div className="space-y-1"><Label>Sale Price</Label><Input type="number" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} data-testid="prod-sale" /></div>
                <div className="space-y-1"><Label>HSN Code</Label><Input value={form.hsn_code} onChange={e => setForm(f => ({ ...f, hsn_code: e.target.value }))} /></div>
                <div className="space-y-1"><Label>GST %</Label><Input type="number" value={form.gst_rate} onChange={e => setForm(f => ({ ...f, gst_rate: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Barcode</Label><Input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Tracking</Label><Select value={form.tracking} onValueChange={v => setForm(f => ({ ...f, tracking: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No Tracking</SelectItem><SelectItem value="lot">By Lot</SelectItem><SelectItem value="serial">By Serial</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>Valuation</Label><Select value={form.valuation_method} onValueChange={v => setForm(f => ({ ...f, valuation_method: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="average">Average Cost</SelectItem><SelectItem value="fifo">FIFO</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1"><Label>Min Stock</Label><Input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Max Stock</Label><Input type="number" value={form.max_stock} onChange={e => setForm(f => ({ ...f, max_stock: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Reorder Point</Label><Input type="number" value={form.reorder_point} onChange={e => setForm(f => ({ ...f, reorder_point: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Reorder Qty</Label><Input type="number" value={form.reorder_qty} onChange={e => setForm(f => ({ ...f, reorder_qty: e.target.value }))} /></div>
              </div>
              <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full" data-testid="create-product-submit"><Package size={16} className="mr-2" />Create Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div> : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No products yet. Create one to get started.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>UoM</TableHead><TableHead className="text-right">On Hand</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Sale</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Tracking</TableHead></TableRow></TableHeader>
          <TableBody>{products.map(p => (
            <TableRow key={p.id} className={p.qty_on_hand <= 0 && p.product_type === 'storable' ? 'bg-error/5' : p.reorder_point > 0 && p.qty_on_hand <= p.reorder_point ? 'bg-warning/5' : ''}>
              <TableCell className="font-mono text-sm">{p.sku}</TableCell><TableCell className="font-medium">{p.name}</TableCell><TableCell><Badge variant="outline" className="text-[10px] capitalize">{p.product_type}</Badge></TableCell><TableCell className="text-sm">{p.category_name || '-'}</TableCell><TableCell className="text-sm">{p.uom_name || '-'}</TableCell><TableCell className={`text-right font-semibold ${p.qty_on_hand <= 0 && p.product_type === 'storable' ? 'text-error' : ''}`}>{p.qty_on_hand}</TableCell><TableCell className="text-right text-sm">{fmt(p.cost_price)}</TableCell><TableCell className="text-right text-sm">{fmt(p.sale_price)}</TableCell><TableCell className="text-right font-semibold">{fmt(p.total_value)}</TableCell><TableCell>{p.tracking !== 'none' ? <Badge className="bg-info/20 text-info border-0 text-[10px]">{p.tracking}</Badge> : '-'}</TableCell>
            </TableRow>
          ))}</TableBody></Table></div>
      )}
    </div>
  );
}
