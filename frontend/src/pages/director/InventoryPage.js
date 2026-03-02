import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BusinessFilter } from '@/components/BusinessFilter';
import { invApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Package, TrendingUp, TrendingDown, AlertTriangle, ArrowRightLeft,
  BarChart3, Layers, ScanLine, Plus, Search, Filter
} from 'lucide-react';

const BUSINESS_LABELS = {
  petrol_pump: 'Petrol Pump', hotel: 'Hotel', fl_shop: 'FL Shop',
  transport: 'Transport', slag_crushing: 'Slag Crushing', stone_crusher: 'Stone Crusher',
};

export default function DirectorInventoryPage() {
  const [tab, setTab] = useState('dashboard');
  const [bizFilter, setBizFilter] = useState('all');
  const [dashboard, setDashboard] = useState(null);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [productions, setProductions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [lidarScans, setLidarScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [transferDialog, setTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_business: '', to_business: '', item_name: '', quantity: '', notes: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = bizFilter !== 'all' ? { business_type: bizFilter } : {};
    try {
      const [dashRes, itemsRes, lowRes] = await Promise.all([
        invApi.getDashboard(),
        invApi.getItems(params),
        invApi.getLowStock(params),
      ]);
      setDashboard(dashRes.data);
      setItems(itemsRes.data);
      setLowStock(lowRes.data);
    } catch (e) {
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, [bizFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchMovements = useCallback(async () => {
    const params = bizFilter !== 'all' ? { business_type: bizFilter } : {};
    const res = await invApi.getMovements(params);
    setMovements(res.data);
  }, [bizFilter]);

  const fetchProductions = useCallback(async () => {
    const params = bizFilter !== 'all' ? { business_type: bizFilter } : {};
    const res = await invApi.getProductions(params);
    setProductions(res.data);
  }, [bizFilter]);

  const fetchTransfers = async () => {
    const res = await invApi.getTransfers();
    setTransfers(res.data);
  };

  const fetchLidar = useCallback(async () => {
    const params = bizFilter !== 'all' ? { business_type: bizFilter } : {};
    const res = await invApi.getLidarScans(params);
    setLidarScans(res.data);
  }, [bizFilter]);

  useEffect(() => {
    if (tab === 'movements') fetchMovements();
    if (tab === 'production') fetchProductions();
    if (tab === 'transfers') fetchTransfers();
    if (tab === 'lidar') fetchLidar();
  }, [tab, bizFilter, fetchMovements, fetchProductions, fetchLidar]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      await invApi.recordTransfer({ ...transferForm, quantity: parseFloat(transferForm.quantity) });
      toast.success('Transfer completed');
      setTransferDialog(false);
      setTransferForm({ from_business: '', to_business: '', item_name: '', quantity: '', notes: '' });
      fetchAll();
      if (tab === 'transfers') fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transfer failed');
    }
  };

  const filteredItems = items.filter(i =>
    (searchTerm === '' || i.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (catFilter === 'all' || i.category === catFilter)
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="director-inventory-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-heading font-bold text-primary">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Multi-business stock overview & operations</p>
        </div>
        <div className="flex items-center gap-3">
          <BusinessFilter value={bizFilter} onChange={setBizFilter} />
          <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="transfer-btn">
                <ArrowRightLeft size={16} className="mr-2" />Transfer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Inter-Business Transfer</DialogTitle></DialogHeader>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>From Business</Label>
                    <Select value={transferForm.from_business} onValueChange={v => setTransferForm(f => ({ ...f, from_business: v }))}>
                      <SelectTrigger data-testid="transfer-from"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{Object.entries(BUSINESS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>To Business</Label>
                    <Select value={transferForm.to_business} onValueChange={v => setTransferForm(f => ({ ...f, to_business: v }))}>
                      <SelectTrigger data-testid="transfer-to"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{Object.entries(BUSINESS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Item Name</Label>
                  <Input value={transferForm.item_name} onChange={e => setTransferForm(f => ({ ...f, item_name: e.target.value }))} required data-testid="transfer-item" />
                </div>
                <div className="space-y-1">
                  <Label>Quantity</Label>
                  <Input type="number" step="0.001" value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} required data-testid="transfer-qty" />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" data-testid="transfer-submit">Execute Transfer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard"><BarChart3 size={14} className="mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock"><Package size={14} className="mr-1" />Stock Register</TabsTrigger>
          <TabsTrigger value="movements" data-testid="tab-movements"><TrendingUp size={14} className="mr-1" />Movements</TabsTrigger>
          <TabsTrigger value="production" data-testid="tab-production"><Layers size={14} className="mr-1" />Production</TabsTrigger>
          <TabsTrigger value="transfers" data-testid="tab-transfers"><ArrowRightLeft size={14} className="mr-1" />Transfers</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts"><AlertTriangle size={14} className="mr-1" />Alerts ({lowStock.length})</TabsTrigger>
          <TabsTrigger value="lidar" data-testid="tab-lidar"><ScanLine size={14} className="mr-1" />LiDAR</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-xl font-bold text-primary">₹{(dashboard?.total_stock_value || 0).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Items</p><p className="text-xl font-bold">{dashboard?.total_items || 0}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-xl font-bold text-error">{dashboard?.low_stock_alerts || 0}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Daily Sales</p><p className="text-xl font-bold text-success">₹{(dashboard?.daily_sales || 0).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Movements Today</p><p className="text-xl font-bold">{dashboard?.daily_movements || 0}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Productions Today</p><p className="text-xl font-bold">{dashboard?.daily_productions || 0}</p></CardContent></Card>
          </div>
          {dashboard?.business_stats?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">By Business</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard.business_stats.map(b => (
                  <Card key={b.business_type} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2"><CardTitle className="text-base">{BUSINESS_LABELS[b.business_type] || b.business_type}</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Items</span><span className="font-medium">{b.total_items}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Value</span><span className="font-medium">₹{b.total_value.toLocaleString()}</span></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Stock Register Tab */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search items..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" data-testid="stock-search" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[160px]" data-testid="cat-filter"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="raw_materials">Raw Materials</SelectItem>
                <SelectItem value="finished_goods">Finished Goods</SelectItem>
                <SelectItem value="consumables">Consumables</SelectItem>
                <SelectItem value="spare_parts">Spare Parts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min Level</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => {
                    const isLow = item.current_stock < item.min_stock_level;
                    return (
                      <TableRow key={item.id} data-testid={`stock-row-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><Badge variant="outline">{BUSINESS_LABELS[item.business_type] || item.business_type}</Badge></TableCell>
                        <TableCell className="capitalize">{item.category?.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right font-mono">{item.current_stock} {item.unit}</TableCell>
                        <TableCell className="text-right font-mono">{item.min_stock_level}</TableCell>
                        <TableCell className="text-right font-mono">₹{(item.avg_cost || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">₹{(item.total_value || 0).toLocaleString()}</TableCell>
                        <TableCell>{isLow ? <Badge variant="destructive">Low</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredItems.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Party</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{m.item_name}</TableCell>
                      <TableCell><Badge variant={m.movement_type === 'in' ? 'default' : 'destructive'}>{m.movement_type === 'in' ? 'IN' : 'OUT'}</Badge></TableCell>
                      <TableCell className="capitalize">{m.reference_type}</TableCell>
                      <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                      <TableCell className="text-right font-mono">₹{(m.unit_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">₹{(m.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{m.party_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {movements.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No movements recorded</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead className="text-right">Input Qty</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Yield %</TableHead>
                    <TableHead className="text-right">Loss %</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productions.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{p.input_item_name}</TableCell>
                      <TableCell className="text-right font-mono">{p.input_quantity}</TableCell>
                      <TableCell className="text-right font-mono">{p.total_output}</TableCell>
                      <TableCell className="text-right font-mono text-success">{p.yield_percentage}%</TableCell>
                      <TableCell className="text-right font-mono text-error">{p.loss_percentage}%</TableCell>
                      <TableCell className="text-sm">{p.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {productions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No production batches</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfers Tab */}
        <TabsContent value="transfers">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{t.item_name}</TableCell>
                      <TableCell><Badge variant="outline">{BUSINESS_LABELS[t.from_business] || t.from_business}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{BUSINESS_LABELS[t.to_business] || t.to_business}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                      <TableCell className="text-right font-mono">₹{(t.unit_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{t.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {transfers.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transfers yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          {lowStock.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">All stock levels are healthy</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStock.map(item => (
                <Card key={item.id} className="border-l-4 border-l-error">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{BUSINESS_LABELS[item.business_type] || item.business_type} &middot; {item.category?.replace('_', ' ')}</p>
                      </div>
                      <AlertTriangle size={18} className="text-error" />
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current</span><span className="font-bold text-error">{item.current_stock} {item.unit}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Min Level</span><span>{item.min_stock_level} {item.unit}</span></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LiDAR Tab */}
        <TabsContent value="lidar">
          <Card>
            <CardHeader><CardTitle>LiDAR Stock Verification Scans</CardTitle><CardDescription>Comparison between physical scans and system records</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Volume (m³)</TableHead>
                    <TableHead className="text-right">Scanned (MT)</TableHead>
                    <TableHead className="text-right">System (MT)</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lidarScans.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{s.item_name}</TableCell>
                      <TableCell className="text-right font-mono">{s.volume_m3}</TableCell>
                      <TableCell className="text-right font-mono">{s.scanned_weight_mt}</TableCell>
                      <TableCell className="text-right font-mono">{s.system_stock_mt}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={s.variance_mt >= 0 ? 'text-success' : 'text-error'}>
                          {s.variance_mt > 0 ? '+' : ''}{s.variance_mt} MT ({s.variance_pct}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{s.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {lidarScans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No LiDAR scans recorded</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
