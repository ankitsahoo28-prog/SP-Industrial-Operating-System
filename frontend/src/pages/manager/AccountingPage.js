import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { accountingApi } from '@/lib/api';
import AiAccountant from '@/components/AiAccountant';
import { toast } from 'sonner';
import { Plus, DollarSign, TrendingUp, TrendingDown, Wallet, Building, Pencil, Download, FileText } from 'lucide-react';

export default function AccountingPage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    transaction_type: 'expense',
    payment_mode: 'cash',
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
  });
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
  }, []);

  const fetchData = async () => {
    try {
      const [transRes, summaryRes, ledgerRes] = await Promise.all([
        accountingApi.getTransactions(),
        accountingApi.getSummary(),
        accountingApi.getLedger(),
      ]);
      setTransactions(transRes.data);
      setSummary(summaryRes.data);
      setLedger(ledgerRes.data);
    } catch (error) {
      console.error('Failed to fetch accounting data:', error);
      toast.error('Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await accountingApi.createTransaction({
        ...formData,
        amount: parseFloat(formData.amount),
      });
      toast.success('Transaction recorded successfully');
      setDialogOpen(false);
      setFormData({
        transaction_type: 'expense',
        payment_mode: 'cash',
        amount: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record transaction');
    }
  };

  const openEditDialog = (transaction) => {
    setEditingTransaction(transaction);
    setEditFormData({
      transaction_type: transaction.transaction_type,
      payment_mode: transaction.payment_mode,
      amount: String(transaction.amount),
      description: transaction.description,
      category: transaction.category,
      date: new Date(transaction.date).toISOString().split('T')[0],
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
    <div className="space-y-6" data-testid="accounting-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Accounting & Finance</h1>
          <p className="text-muted-foreground mt-1">Manage cash, bank transactions and view ledger</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportPdf} data-testid="export-pdf-button">
            <Download size={16} className="mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} data-testid="export-csv-button">
            <FileText size={16} className="mr-2" />
            CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90" data-testid="add-transaction-button">
                <Plus size={18} className="mr-2" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Transaction</DialogTitle>
                <DialogDescription>Add expense or income entry</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={formData.transaction_type}
                      onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
                    >
                      <SelectTrigger data-testid="transaction-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select
                      value={formData.payment_mode}
                      onValueChange={(value) => setFormData({ ...formData, payment_mode: value })}
                    >
                      <SelectTrigger data-testid="payment-mode-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required data-testid="amount-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="e.g., Salary, Raw Materials, Sales" required data-testid="category-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} required data-testid="description-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required data-testid="date-input" />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="submit-transaction-button">
                  Record Transaction
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
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
          <Card className="border-l-4 border-l-accent">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Cash Balance</p>
                  <p className="text-2xl font-heading font-bold">₹{summary.cash_balance.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl"><Wallet size={24} className="text-accent" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-info">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Bank Balance</p>
                  <p className="text-2xl font-heading font-bold">₹{summary.bank_balance.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-info/10 rounded-xl"><Building size={24} className="text-info" /></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="ai-accountant" data-testid="ai-accountant-tab">AI Accountant</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4 mt-6">
          {transactions.map((transaction) => (
            <Card key={transaction.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <DollarSign size={20} className={transaction.transaction_type === 'income' ? 'text-success' : 'text-error'} />
                      <span className={`text-xs px-2 py-1 rounded border ${transaction.transaction_type === 'income' ? 'bg-success/20 text-success border-success/30' : 'bg-error/20 text-error border-error/30'}`}>
                        {transaction.transaction_type}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground">
                        {transaction.payment_mode}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{transaction.category}</h3>
                    <p className="text-sm text-muted-foreground">{transaction.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className={`text-2xl font-heading font-bold ${transaction.transaction_type === 'income' ? 'text-success' : 'text-error'}`}>
                      {transaction.transaction_type === 'income' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(transaction.date).toLocaleDateString()}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(transaction)}
                      data-testid={`edit-transaction-${transaction.id}`}
                    >
                      <Pencil size={14} className="mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {transactions.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <DollarSign size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions yet. Add your first transaction to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ledger" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Ledger</CardTitle>
              <CardDescription>Complete transaction history with running balance</CardDescription>
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
            <DialogDescription>Update the transaction details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editFormData.transaction_type} onValueChange={(value) => setEditFormData({ ...editFormData, transaction_type: value })}>
                  <SelectTrigger data-testid="edit-transaction-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={editFormData.payment_mode} onValueChange={(value) => setEditFormData({ ...editFormData, payment_mode: value })}>
                  <SelectTrigger data-testid="edit-payment-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={editFormData.amount} onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })} required data-testid="edit-amount-input" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })} required data-testid="edit-category-input" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={2} required data-testid="edit-description-input" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={editFormData.date} onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })} required data-testid="edit-date-input" />
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
