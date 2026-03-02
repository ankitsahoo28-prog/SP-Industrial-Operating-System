import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { reconciliationApi, companyApi } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus, Trash2, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

export default function ReconciliationPage() {
  const [records, setRecords] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({ from_company_id: '', to_company_id: '', amount: '', description: '', reference: '' });

  useEffect(() => {
    Promise.all([
      reconciliationApi.getAll(),
      companyApi.getAll(false),
    ]).then(([recRes, compRes]) => {
      setRecords(recRes.data);
      setCompanies(compRes.data);
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const fetchRecords = async () => {
    try {
      const r = await reconciliationApi.getAll(statusFilter !== 'all' ? statusFilter : undefined);
      setRecords(r.data);
    } catch { toast.error('Failed to load records'); }
  };

  useEffect(() => { if (!loading) fetchRecords(); }, [statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.from_company_id === form.to_company_id) {
      toast.error('From and To companies must be different');
      return;
    }
    try {
      await reconciliationApi.create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Reconciliation entry created');
      setDialogOpen(false);
      setForm({ from_company_id: '', to_company_id: '', amount: '', description: '', reference: '' });
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await reconciliationApi.updateStatus(id, newStatus);
      toast.success(`Status updated to ${newStatus}`);
      fetchRecords();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this reconciliation entry?')) return;
    try {
      await reconciliationApi.remove(id);
      toast.success('Deleted');
      fetchRecords();
    } catch { toast.error('Failed to delete'); }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'matched': return <Badge className="bg-green-100 text-green-700"><CheckCircle2 size={12} className="mr-1" />Matched</Badge>;
      case 'disputed': return <Badge className="bg-red-100 text-red-700"><AlertCircle size={12} className="mr-1" />Disputed</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-700"><Clock size={12} className="mr-1" />Pending</Badge>;
    }
  };

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  const totalPending = records.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const totalMatched = records.filter(r => r.status === 'matched').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6" data-testid="reconciliation-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary flex items-center gap-3"><ArrowLeftRight size={28} />Inter-Company Reconciliation</h1>
          <p className="text-muted-foreground mt-1">Track and match transactions between companies</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90" data-testid="create-reconciliation-btn"><Plus size={16} className="mr-2" />New Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>New Reconciliation Entry</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>From Company</Label>
                  <Select value={form.from_company_id} onValueChange={v => setForm(f => ({ ...f, from_company_id: v }))}>
                    <SelectTrigger data-testid="from-company"><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Company</Label>
                  <Select value={form.to_company_id} onValueChange={v => setForm(f => ({ ...f, to_company_id: v }))}>
                    <SelectTrigger data-testid="to-company"><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required data-testid="rec-amount" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required rows={2} data-testid="rec-description" />
                </div>
                <div className="space-y-2">
                  <Label>Reference (Invoice/Bill No.)</Label>
                  <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} data-testid="rec-reference" />
                </div>
                <Button type="submit" className="w-full" data-testid="rec-submit">Create Entry</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Entries</p><p className="text-2xl font-bold">{records.length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-yellow-500"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Pending Amount</p><p className="text-2xl font-bold text-yellow-600">{fmt(totalPending)}</p></CardContent></Card>
        <Card className="border-l-4 border-l-green-500"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Matched Amount</p><p className="text-2xl font-bold text-green-600">{fmt(totalMatched)}</p></CardContent></Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(rec => (
                <TableRow key={rec.id} data-testid={`rec-row-${rec.id}`}>
                  <TableCell className="text-sm">{new Date(rec.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium text-sm">{rec.from_company_name}</TableCell>
                  <TableCell className="font-medium text-sm">{rec.to_company_name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(rec.amount)}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{rec.description}</TableCell>
                  <TableCell className="text-sm">{rec.reference || '-'}</TableCell>
                  <TableCell>{getStatusBadge(rec.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {rec.status === 'pending' && (
                        <>
                          <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleStatusChange(rec.id, 'matched')} data-testid={`match-${rec.id}`}>Match</Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleStatusChange(rec.id, 'disputed')} data-testid={`dispute-${rec.id}`}>Dispute</Button>
                        </>
                      )}
                      {rec.status !== 'pending' && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(rec.id, 'pending')} data-testid={`reset-${rec.id}`}>Reset</Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-error" onClick={() => handleDelete(rec.id)} data-testid={`delete-rec-${rec.id}`}><Trash2 size={14} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No reconciliation entries</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
