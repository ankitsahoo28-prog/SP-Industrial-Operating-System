import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    item_name: '',
    category: '',
    opening_stock: '',
    unit: '',
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await inventoryApi.getItems();
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.createItem({
        ...formData,
        opening_stock: parseFloat(formData.opening_stock),
      });
      toast.success('Inventory item added successfully');
      setDialogOpen(false);
      setFormData({
        item_name: '',
        category: '',
        opening_stock: '',
        unit: '',
      });
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add inventory item');
    }
  };

  const getStockStatus = (item) => {
    const percentage = (item.current_stock / item.opening_stock) * 100;
    if (percentage <= 20) return { color: 'text-error', bg: 'bg-error/10', icon: AlertTriangle, label: 'Low Stock' };
    if (percentage <= 50) return { color: 'text-warning', bg: 'bg-warning/10', icon: TrendingDown, label: 'Medium' };
    return { color: 'text-success', bg: 'bg-success/10', icon: TrendingUp, label: 'Good' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="inventory-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Track stock levels and manage inventory</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="add-inventory-button">
              <Plus size={18} className="mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
              <DialogDescription>Set opening stock for a new item</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item_name">Item Name</Label>
                <Input
                  id="item_name"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  required
                  data-testid="item-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Raw Materials, Fuel, Parts"
                  required
                  data-testid="category-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="opening_stock">Opening Stock</Label>
                  <Input
                    id="opening_stock"
                    type="number"
                    step="0.01"
                    value={formData.opening_stock}
                    onChange={(e) => setFormData({ ...formData, opening_stock: e.target.value })}
                    required
                    data-testid="opening-stock-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="kg, L, pcs"
                    required
                    data-testid="unit-input"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="submit-inventory-button">
                Add to Inventory
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          const status = getStockStatus(item);
          const StatusIcon = status.icon;
          const stockChange = item.current_stock - item.opening_stock;

          return (
            <Card key={item.id} className={`hover:shadow-md transition-shadow border-l-4 ${status.bg.replace('/10', '/30')}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 ${status.bg} rounded-xl`}>
                      <Package size={24} className={status.color} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.item_name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${status.bg} ${status.color}`}>
                    <StatusIcon size={12} />
                    <span>{status.label}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Stock</span>
                    <span className="text-xl font-heading font-bold">
                      {item.current_stock} {item.unit}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Opening Stock</span>
                    <span className="text-sm font-medium">
                      {item.opening_stock} {item.unit}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Change</span>
                    <span className={`text-sm font-semibold ${
                      stockChange > 0 ? 'text-success' : stockChange < 0 ? 'text-error' : 'text-muted-foreground'
                    }`}>
                      {stockChange > 0 ? '+' : ''}{stockChange} {item.unit}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${status.bg.replace('/10', '')}`}
                        style={{ width: `${Math.min(100, (item.current_stock / item.opening_stock) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {((item.current_stock / item.opening_stock) * 100).toFixed(1)}% of opening stock
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No inventory items yet. Add your first item to start tracking stock.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Tip: Stock will auto-update when you submit incoming stock and dispatch reports.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}