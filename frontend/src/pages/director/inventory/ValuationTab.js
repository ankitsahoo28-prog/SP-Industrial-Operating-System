import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, DollarSign, TrendingUp, Package } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export function ValuationTab({ companyId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = companyId ? { company_id: companyId } : {};
      const res = await inventoryApi.products.list(params);
      setProducts(res.data || []);
    } catch { toast.error('Failed to load valuation data'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = method === 'all' ? products : products.filter(p => p.valuation_method === method);
  const totalValue = filtered.reduce((sum, p) => sum + (p.cost_price || 0) * (p.quantity_on_hand || 0), 0);
  const totalItems = filtered.reduce((sum, p) => sum + (p.quantity_on_hand || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-6" data-testid="valuation-tab">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10"><DollarSign className="text-green-500" size={24} /></div>
            <div><p className="text-sm text-muted-foreground">Total Inventory Value</p><p className="text-2xl font-bold">{fmt(totalValue)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10"><Package className="text-blue-500" size={24} /></div>
            <div><p className="text-sm text-muted-foreground">Total Items</p><p className="text-2xl font-bold">{totalItems}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10"><TrendingUp className="text-purple-500" size={24} /></div>
            <div><p className="text-sm text-muted-foreground">Avg. Cost/Item</p><p className="text-2xl font-bold">{fmt(totalItems > 0 ? totalValue / totalItems : 0)}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-48" data-testid="valuation-method-filter"><SelectValue placeholder="Filter by method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="average">Average Cost</SelectItem>
            <SelectItem value="fifo">FIFO</SelectItem>
            <SelectItem value="standard">Standard Cost</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} data-testid="valuation-refresh-btn">Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Inventory Valuation</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No products found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty On Hand</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} data-testid={`valuation-row-${p.id}`}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku || '-'}</TableCell>
                    <TableCell className="text-right">{p.quantity_on_hand || 0}</TableCell>
                    <TableCell className="text-right">{fmt(p.cost_price)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt((p.cost_price || 0) * (p.quantity_on_hand || 0))}</TableCell>
                    <TableCell><Badge variant="outline">{p.valuation_method || 'average'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
