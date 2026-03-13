import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Loader2, FolderTree, Ruler } from 'lucide-react';

export function InvConfigTab({ companyId }) {
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catDlg, setCatDlg] = useState(false);
  const [uomDlg, setUomDlg] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [uomForm, setUomForm] = useState({ name: '', symbol: '', category: 'Unit' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = companyId ? { company_id: companyId } : {};
      const [c, u] = await Promise.all([
        inventoryApi.categories.list(params),
        inventoryApi.uoms.list(params),
      ]);
      setCategories(c.data || []);
      setUoms(u.data || []);
    } catch { toast.error('Failed to load configuration'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const createCategory = async () => {
    if (!catForm.name) { toast.error('Name required'); return; }
    try {
      await inventoryApi.categories.create({ ...catForm, company_id: companyId });
      toast.success('Category created');
      setCatDlg(false);
      setCatForm({ name: '', description: '' });
      load();
    } catch { toast.error('Failed to create category'); }
  };

  const createUom = async () => {
    if (!uomForm.name) { toast.error('Name required'); return; }
    try {
      await inventoryApi.uoms.create ? await inventoryApi.uoms.create({ ...uomForm, company_id: companyId }) : toast.info('UOM creation not available yet');
      toast.success('UOM created');
      setUomDlg(false);
      setUomForm({ name: '', symbol: '', category: 'Unit' });
      load();
    } catch { toast.error('Failed to create UOM'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-6" data-testid="inv-config-tab">
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories"><FolderTree size={14} className="mr-1" />Categories</TabsTrigger>
          <TabsTrigger value="uoms"><Ruler size={14} className="mr-1" />Units of Measure</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={catDlg} onOpenChange={setCatDlg}>
              <DialogTrigger asChild>
                <Button data-testid="add-category-btn"><Plus size={16} className="mr-2" />Add Category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} data-testid="cat-name-input" /></div>
                  <div><Label>Description</Label><Input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} /></div>
                  <Button onClick={createCategory} className="w-full" data-testid="save-category-btn">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardHeader><CardTitle>Product Categories</CardTitle></CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No categories yet</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {categories.map(c => (
                      <TableRow key={c.id} data-testid={`category-row-${c.id}`}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uoms" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={uomDlg} onOpenChange={setUomDlg}>
              <DialogTrigger asChild>
                <Button data-testid="add-uom-btn"><Plus size={16} className="mr-2" />Add UOM</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Unit of Measure</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={uomForm.name} onChange={e => setUomForm(f => ({ ...f, name: e.target.value }))} data-testid="uom-name-input" /></div>
                  <div><Label>Symbol</Label><Input value={uomForm.symbol} onChange={e => setUomForm(f => ({ ...f, symbol: e.target.value }))} /></div>
                  <Button onClick={createUom} className="w-full" data-testid="save-uom-btn">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardHeader><CardTitle>Units of Measure</CardTitle></CardHeader>
            <CardContent>
              {uoms.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No UOMs yet</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Symbol</TableHead><TableHead>Category</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {uoms.map(u => (
                      <TableRow key={u.id} data-testid={`uom-row-${u.id}`}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.symbol || '-'}</TableCell>
                        <TableCell>{u.category || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
