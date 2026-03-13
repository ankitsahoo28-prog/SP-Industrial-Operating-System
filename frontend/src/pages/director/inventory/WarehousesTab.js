import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Warehouse, MapPin, Loader2 } from 'lucide-react';

export function WarehousesTab({ companyId }) {
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = companyId ? { company_id: companyId } : {};
    Promise.all([inventoryApi.warehouses.list(params), inventoryApi.locations.list(params)])
      .then(([w, l]) => { setWarehouses(w.data); setLocations(l.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.code) { toast.error('Name and code required'); return; }
    try { await inventoryApi.warehouses.create({ ...form, company_id: companyId }); toast.success('Warehouse created'); setDlg(false); setForm({ name: '', code: '', address: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-4" data-testid="inv-warehouses">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Warehouses & Locations</h2>
        <Dialog open={dlg} onOpenChange={setDlg}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-warehouse-btn"><Plus size={16} className="mr-1" />New Warehouse</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Warehouse</DialogTitle><DialogDescription>Add a new warehouse</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="wh-name" /></div>
                <div className="space-y-1"><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} data-testid="wh-code" /></div>
              </div>
              <div className="space-y-1"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full" data-testid="create-wh-submit"><Warehouse size={16} className="mr-2" />Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouses.map(wh => {
          const whLocs = locations.filter(l => l.warehouse_id === wh.id);
          return (
            <Card key={wh.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2"><Warehouse size={18} className="text-primary" /><h3 className="font-heading font-bold">{wh.name}</h3></div>
                  <Badge variant="outline" className="font-mono">{wh.code}</Badge>
                </div>
                {wh.address && <p className="text-xs text-muted-foreground mb-2">{wh.address}</p>}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">LOCATIONS ({whLocs.length})</p>
                  {whLocs.map(loc => (
                    <div key={loc.id} className="flex items-center gap-2 text-sm bg-muted/50 p-1.5 rounded">
                      <MapPin size={12} className="text-muted-foreground" />
                      <span className="font-mono text-xs">{loc.code}</span>
                      <span>{loc.name}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto capitalize">{loc.location_type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
