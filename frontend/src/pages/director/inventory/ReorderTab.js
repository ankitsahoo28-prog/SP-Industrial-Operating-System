import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Package, ShoppingCart } from 'lucide-react';

export function ReorderTab({ companyId }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi.reorderCheck(companyId ? { company_id: companyId } : {})
      .then(r => setSuggestions(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-4" data-testid="inv-reorder">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Reorder Alerts</h2>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>
      {suggestions.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><Package size={48} className="mx-auto text-muted-foreground mb-3 opacity-50" /><p className="text-muted-foreground">All stock levels are healthy. No reorder needed.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          <Badge className="bg-warning/20 text-warning border-0">{suggestions.length} products need reordering</Badge>
          {suggestions.map((s, i) => (
            <Card key={i} className="border-warning/30 bg-warning/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-warning" />
                  <div>
                    <p className="font-heading font-bold">{s.product_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm"><span className="text-muted-foreground">Current:</span> <strong className="text-error">{s.current_qty}</strong></p>
                  <p className="text-sm"><span className="text-muted-foreground">Reorder at:</span> {s.reorder_point}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Suggested order:</span> <strong className="text-success">{s.reorder_qty}</strong></p>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.info('Create a Receipt stock move to reorder this product')} data-testid={`reorder-${i}`}>
                  <ShoppingCart size={14} className="mr-1" />Reorder
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
