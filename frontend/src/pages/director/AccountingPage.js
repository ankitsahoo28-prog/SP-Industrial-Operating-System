import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { accountingApi } from '@/lib/api';
import { BusinessFilter } from '@/components/BusinessFilter';
import AiAccountant from '@/components/AiAccountant';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, TrendingDown, Download, FileText, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AccountingPage() {
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessFilter, setBusinessFilter] = useState('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editFormData, setEditFormData] = useState({
    transaction_type: 'expense',
    payment_mode: 'cash',
    amount: '',
    description: '',
    category: '',
    date: '',
  });

  useEffect(() => {
    fetchData();
  }, [businessFilter]);

  const fetchData = async () => {
    try {
      const params = {};
      if (businessFilter !== 'all') params.business_type = businessFilter;
      const [summaryRes, ledgerRes] = await Promise.all([
        accountingApi.getSummary(params),
        accountingApi.getLedger(params),
      ]);
      setSummary(summaryRes.data);
      setLedger(ledgerRes.data);
    } catch (error) {
      console.error('Failed to fetch accounting data:', error);
      toast.error('Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (entry) => {
    setEditingTransaction(entry);
    setEditFormData({
      transaction_type: entry.transaction_type,
      payment_mode: entry.payment_mode,
      amount: String(entry.amount),
      description: entry.description,
      category: entry.category,
      date: new Date(entry.date).toISOString().split('T')[0],
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await accountingApi.updateTransaction(editingTransaction.id, {
        ...editFormData,
        amount: parseFloat(editFormData.amount),
      });
      toast.success('Transaction updated successfully');
      setEditDialogOpen(false);
      setEditingTransaction(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update transaction');
    }
  };

  const handleExportPdf = async () => {
    try {
      const response = await accountingApi.exportPdf();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportCsv = async () => {
    try {
      const response = await accountingApi.exportCsv();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledger_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="director-accounting-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Accounting Overview</h1>
          <p className="text-muted-foreground mt-1">Complete financial data across all businesses</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BusinessFilter value={businessFilter} onChange={setBusinessFilter} />
          <Button variant="outline" size="sm" onClick={handleExportPdf} data-testid="export-pdf-button">
            <Download size={16} className="mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} data-testid="export-csv-button">
            <FileText size={16} className="mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Total Income</p>
                  <p className="text-2xl font-heading font-bold text-success">₹{summary.total_income.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-success/10 rounded-xl"><TrendingUp size={24} className="text-success" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-error">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Total Expense</p>
                  <p className="text-2xl font-heading font-bold text-error">₹{summary.total_expense.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-error/10 rounded-xl"><TrendingDown size={24} className="text-error" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Net Profit</p>
                  <p className={`text-2xl font-heading font-bold ${summary.net_profit >= 0 ? 'text-success' : 'text-error'}`}>
                    ₹{summary.net_profit.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl"><DollarSign size={24} className="text-primary" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-info">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Total Balance</p>
                  <p className="text-2xl font-heading font-bold">₹{(summary.cash_balance + summary.bank_balance).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="ai-accountant" data-testid="ai-accountant-tab">AI Accountant</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Complete Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold">Date</th>
                  <th className="p-3 text-left text-sm font-semibold">Description</th>
                  <th className="p-3 text-left text-sm font-semibold">Category</th>
                  <th className="p-3 text-right text-sm font-semibold">Debit</th>
                  <th className="p-3 text-right text-sm font-semibold">Credit</th>
                  <th className="p-3 text-right text-sm font-semibold">Balance</th>
                  <th className="p-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry, index) => (
                  <tr key={entry.id} className={index % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}>
                    <td className="p-3 text-sm">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="p-3 text-sm">{entry.description}</td>
                    <td className="p-3 text-sm">{entry.category}</td>
                    <td className="p-3 text-sm text-right text-error">
                      {entry.transaction_type === 'expense' ? `₹${entry.amount.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-3 text-sm text-right text-success">
                      {entry.transaction_type === 'income' ? `₹${entry.amount.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-3 text-sm text-right font-semibold">₹{entry.balance.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(entry)}
                        data-testid={`edit-ledger-${entry.id}`}
                      >
                        <Pencil size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="ai-accountant" className="mt-6">
          <AiAccountant onTransactionPosted={fetchData} />
        </TabsContent>
      </Tabs>

      {/* Edit Transaction Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Update the transaction details. Changes are tracked in the audit log.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editFormData.transaction_type} onValueChange={(v) => setEditFormData({ ...editFormData, transaction_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={editFormData.payment_mode} onValueChange={(v) => setEditFormData({ ...editFormData, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={editFormData.amount} onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={2} required />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={editFormData.date} onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })} required />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="save-edit-button">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
