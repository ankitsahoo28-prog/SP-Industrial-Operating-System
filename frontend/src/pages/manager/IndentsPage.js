import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { indentApi } from '@/lib/api';
import { toast } from 'sonner';
import { Package, Plus, Trash2 } from 'lucide-react';

export default function IndentsPage() {
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [items, setItems] = useState([{ name: '', quantity: '', unit: '' }]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchIndents();
  }, []);

  const fetchIndents = async () => {
    try {
      const response = await indentApi.getIndents();
      setIndents(response.data);
    } catch (error) {
      console.error('Failed to fetch indents:', error);
      toast.error('Failed to load indents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await indentApi.createIndent({ items, notes });
      toast.success('Indent created successfully');
      setDialogOpen(false);
      setItems([{ name: '', quantity: '', unit: '' }]);
      setNotes('');
      fetchIndents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create indent');
    }
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: '', unit: '' }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: 'bg-success/20 text-success border-success/30',
      rejected: 'bg-error/20 text-error border-error/30',
      pending: 'bg-warning/20 text-warning border-warning/30',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="manager-indents-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Indents</h1>
          <p className="text-muted-foreground mt-1">Request stock and materials</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="create-indent-button">
              <Plus size={18} className="mr-2" />
              New Indent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Indent</DialogTitle>
              <DialogDescription>Request materials or stock</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Item {index + 1}</span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 size={16} className="text-error" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Item Name</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          placeholder="kg, pcs, L"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" onClick={addItem} className="w-full">
                <Plus size={16} className="mr-2" />
                Add Another Item
              </Button>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requirements"
                />
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="submit-indent-button">
                Submit Indent
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {indents.map((indent) => (
          <Card key={indent.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Package size={20} className="text-accent" />
                    <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(indent.status)}`}>
                      {indent.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(indent.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Requested Items:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {indent.items.map((item, idx) => (
                        <div key={idx} className="p-3 bg-secondary/50 rounded">
                          <p className="font-medium text-sm">{item.name || item.item}</p>
                          <p className="text-xs text-muted-foreground">
                            Quantity: {item.quantity} {item.unit || ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {indent.notes && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
                      <p className="text-sm">{indent.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {indents.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No indents yet. Create your first indent to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}