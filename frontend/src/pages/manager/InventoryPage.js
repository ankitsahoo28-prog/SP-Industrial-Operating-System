import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AiInventoryAssistant from '@/components/AiInventoryAssistant';
import { invApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Package, TrendingUp, TrendingDown, AlertTriangle, Plus,
  ShoppingCart, Truck, Layers, ScanLine, Search, ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';

export default function InventoryPage() {
  const [tab, setTab] = useState('stock');
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [productions, setProductions] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  // Movement form
  const [moveDialog, setMoveDialog] = useState(false);
  const [moveForm, setMoveForm] = useState({ item_id: '', movement_type: 'in', quantity: '', unit_price: '', reference_type: 'purchase', party_name: '', notes: '' });

  // Production form
  const [prodDialog, setProdDialog] = useState(false);
  const [prodForm, setProdForm] = useState({ input_item_id: '', input_qty: '', notes: '' });
  const [prodOutputs, setProdOutputs] = useState([{ item_id: '', quantity: '', unit_price: '0' }]);

  // Add item form
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'finished_goods', unit: 'MT', min_stock_level: '10', opening_stock: '0', avg_cost: '0' });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, lowRes] = await Promise.all([
        invApi.getItems(),
        invApi.getLowStock(),
      ]);
      setItems(itemsRes.data);
      setLowStock(lowRes.data);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const fetchMovements = useCallback(async () => {
    try { const r = await invApi.getMovements(); setMovements(r.data); } catch {}
  }, []);

  const fetchProductions = useCallback(async () => {
    try { const r = await invApi.getProductions(); setProductions(r.data); } catch {}
  }, []);

  useEffect(() => {
    if (tab === 'movements') fetchMovements();
    if (tab === 'production') fetchProductions();
  }, [tab, fetchMovements, fetchProductions]);

  const rawMaterials = items.filter(i => i.category === 'raw_materials');
  const finishedGoods = items.filter(i => i.category === 'finished_goods');

  const handleMovement = async (e) => {
    e.preventDefault();
    try {
      await invApi.recordMovement({
        ...moveForm,
        quantity: parseFloat(moveForm.quantity),
        unit_price: parseFloat(moveForm.unit_price || 0),
      });
      toast.success('Stock movement recorded');
      setMoveDialog(false);
      setMoveForm({ item_id: '', movement_type: 'in', quantity: '', unit_price: '', reference_type: 'purchase', party_name: '', notes: '' });
      fetchItems();
      if (tab === 'movements') fetchMovements();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Movement failed');
    }
  };

  const handleProduction = async (e) => {
    e.preventDefault();
    try {
      await invApi.recordProduction({
        input_item_id: prodForm.input_item_id,
        input_qty: parseFloat(prodForm.input_qty),
        outputs: prodOutputs.filter(o => o.item_id && o.quantity).map(o => ({
          item_id: o.item_id,
          quantity: parseFloat(o.quantity),
          unit_price: parseFloat(o.unit_price || 0),
        })),
        notes: prodForm.notes,
      });
      toast.success('Production batch recorded');
      setProdDialog(false);
      setProdForm({ input_item_id: '', input_qty: '', notes: '' });
      setProdOutputs([{ item_id: '', quantity: '', unit_price: '0' }]);
      fetchItems();
      if (tab === 'production') fetchProductions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Production failed');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await invApi.createItem({
        ...addForm,
        min_stock_level: parseFloat(addForm.min_stock_level),
        opening_stock: parseFloat(addForm.opening_stock),
        avg_cost: parseFloat(addForm.avg_cost),
        business_type: '', // will be set by backend from user's business_type
      });
      toast.success('Item added');
      setAddDialog(false);
      setAddForm({ name: '', category: 'finished_goods', unit: 'MT', min_stock_level: '10', opening_stock: '0', avg_cost: '0' });
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add item');
    }
  };

  const addProdOutput = () => setProdOutputs(o => [...o, { item_id: '', quantity: '', unit_price: '0' }]);
  const updateProdOutput = (idx, field, val) => setProdOutputs(o => o.map((row, i) => i === idx ? { ...row, [field]: val } : row));

  const filteredItems = items.filter(i =>
    (searchTerm === '' || i.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (catFilter === 'all' || i.category === catFilter)
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="manager-inventory-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Manage stock, purchases, sales & production</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={moveDialog} onOpenChange={setMoveDialog}>
            <DialogTrigger asChild>
              <Button data-testid="record-movement-btn"><ShoppingCart size={16} className="mr-2" />Record Movement</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle><DialogDescription>Record a purchase, sale, or other stock movement</DialogDescription></DialogHeader>
              <form onSubmit={handleMovement} className="space-y-3">
                <div className="space-y-1">
                  <Label>Item</Label>
                  <Select value={moveForm.item_id} onValueChange={v => setMoveForm(f => ({ ...f, item_id: v }))}>
                    <SelectTrigger data-testid="move-item"><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Direction</Label>
                    <Select value={moveForm.movement_type} onValueChange={v => setMoveForm(f => ({ ...f, movement_type: v, reference_type: v === 'in' ? 'purchase' : 'sale' }))}>
                      <SelectTrigger data-testid="move-direction"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">Stock IN</SelectItem>
                        <SelectItem value="out">Stock OUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Select value={moveForm.reference_type} onValueChange={v => setMoveForm(f => ({ ...f, reference_type: v }))}>
                      <SelectTrigger data-testid="move-ref"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {moveForm.movement_type === 'in' ? (
                          <><SelectItem value="purchase">Purchase</SelectItem><SelectItem value="return">Return</SelectItem></>
                        ) : (
                          <><SelectItem value="sale">Sale</SelectItem><SelectItem value="wastage">Wastage</SelectItem><SelectItem value="consumption">Consumption</SelectItem></>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Quantity</Label>
                    <Input type="number" step="0.001" value={moveForm.quantity} onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))} required data-testid="move-qty" />
                  </div>
                  <div className="space-y-1">
                    <Label>Unit Price (₹)</Label>
                    <Input type="number" step="0.01" value={moveForm.unit_price} onChange={e => setMoveForm(f => ({ ...f, unit_price: e.target.value }))} data-testid="move-price" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Party Name</Label>
                  <Input value={moveForm.party_name} onChange={e => setMoveForm(f => ({ ...f, party_name: e.target.value }))} placeholder="Vendor/Customer name" data-testid="move-party" />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input value={moveForm.notes} onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" data-testid="move-submit">Record Movement</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={prodDialog} onOpenChange={setProdDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="record-production-btn"><Layers size={16} className="mr-2" />Production</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Record Production Batch</DialogTitle><DialogDescription>Convert raw materials into finished goods</DialogDescription></DialogHeader>
              <form onSubmit={handleProduction} className="space-y-3">
                <div className="space-y-1">
                  <Label>Input Raw Material</Label>
                  <Select value={prodForm.input_item_id} onValueChange={v => setProdForm(f => ({ ...f, input_item_id: v }))}>
                    <SelectTrigger data-testid="prod-input-item"><SelectValue placeholder="Select raw material" /></SelectTrigger>
                    <SelectContent>{rawMaterials.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Input Quantity</Label>
                  <Input type="number" step="0.001" value={prodForm.input_qty} onChange={e => setProdForm(f => ({ ...f, input_qty: e.target.value }))} required data-testid="prod-input-qty" />
                </div>
                <div className="space-y-1">
                  <Label>Outputs (Finished Goods)</Label>
                  {prodOutputs.map((out, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select value={out.item_id} onValueChange={v => updateProdOutput(idx, 'item_id', v)}>
                          <SelectTrigger data-testid={`prod-out-item-${idx}`}><SelectValue placeholder="Item" /></SelectTrigger>
                          <SelectContent>{finishedGoods.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Input type="number" step="0.001" placeholder="Qty" value={out.quantity} onChange={e => updateProdOutput(idx, 'quantity', e.target.value)} className="w-24" data-testid={`prod-out-qty-${idx}`} />
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={addProdOutput}><Plus size={14} className="mr-1" />Add Output</Button>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input value={prodForm.notes} onChange={e => setProdForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" data-testid="prod-submit">Record Production</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={addDialog} onOpenChange={setAddDialog}>
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="add-item-btn"><Plus size={16} className="mr-2" />Add Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle><DialogDescription>Add a new item to your inventory</DialogDescription></DialogHeader>
              <form onSubmit={handleAddItem} className="space-y-3">
                <div className="space-y-1"><Label>Name</Label><Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required data-testid="add-name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger data-testid="add-cat"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw_materials">Raw Materials</SelectItem>
                        <SelectItem value="finished_goods">Finished Goods</SelectItem>
                        <SelectItem value="consumables">Consumables</SelectItem>
                        <SelectItem value="spare_parts">Spare Parts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Unit</Label><Input value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} required data-testid="add-unit" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Min Level</Label><Input type="number" value={addForm.min_stock_level} onChange={e => setAddForm(f => ({ ...f, min_stock_level: e.target.value }))} data-testid="add-min" /></div>
                  <div className="space-y-1"><Label>Opening</Label><Input type="number" value={addForm.opening_stock} onChange={e => setAddForm(f => ({ ...f, opening_stock: e.target.value }))} data-testid="add-opening" /></div>
                  <div className="space-y-1"><Label>Avg Cost</Label><Input type="number" value={addForm.avg_cost} onChange={e => setAddForm(f => ({ ...f, avg_cost: e.target.value }))} data-testid="add-cost" /></div>
                </div>
                <Button type="submit" className="w-full" data-testid="add-submit">Add Item</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Items</p><p className="text-2xl font-bold">{items.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-2xl font-bold text-primary">₹{items.reduce((s, i) => s + (i.total_value || 0), 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-2xl font-bold text-error">{lowStock.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Raw Materials</p><p className="text-2xl font-bold">{rawMaterials.length}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="stock" data-testid="tab-stock"><Package size={14} className="mr-1" />Stock</TabsTrigger>
          <TabsTrigger value="movements" data-testid="tab-movements"><TrendingUp size={14} className="mr-1" />Movements</TabsTrigger>
          <TabsTrigger value="production" data-testid="tab-production"><Layers size={14} className="mr-1" />Production</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts"><AlertTriangle size={14} className="mr-1" />Alerts ({lowStock.length})</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai"><Package size={14} className="mr-1" />AI Assistant</TabsTrigger>
        </TabsList>

        {/* Stock Register */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search items..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" data-testid="mgr-stock-search" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
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
                      <TableRow key={item.id} data-testid={`mgr-stock-row-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="capitalize">{item.category?.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right font-mono">{item.current_stock} {item.unit}</TableCell>
                        <TableCell className="text-right font-mono">{item.min_stock_level}</TableCell>
                        <TableCell className="text-right font-mono">₹{(item.avg_cost || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">₹{(item.total_value || 0).toLocaleString()}</TableCell>
                        <TableCell>{isLow ? <Badge variant="destructive">Low</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movements */}
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

        {/* Production */}
        <TabsContent value="production">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Input Material</TableHead>
                    <TableHead className="text-right">Input Qty</TableHead>
                    <TableHead className="text-right">Total Output</TableHead>
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

        {/* Alerts */}
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
                        <p className="text-xs text-muted-foreground capitalize">{item.category?.replace('_', ' ')}</p>
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

        {/* AI Assistant Tab */}
        <TabsContent value="ai">
          <AiInventoryAssistant onComplete={fetchItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
