// Director AccountingPage - view all business data
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { accountingApi } from '@/lib/api';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export default function AccountingPage() {
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, ledgerRes] = await Promise.all([
        accountingApi.getSummary(),
        accountingApi.getLedger(),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="director-accounting-page">
      <div>
        <h1 className="text-3xl font-heading font-bold text-primary">Accounting Overview</h1>
        <p className="text-muted-foreground mt-1">Complete financial data across all businesses</p>
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
                <div className="p-3 bg-success/10 rounded-xl">
                  <TrendingUp size={24} className="text-success" />
                </div>
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
                <div className="p-3 bg-error/10 rounded-xl">
                  <TrendingDown size={24} className="text-error" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Net Profit</p>
                  <p className={`text-2xl font-heading font-bold ${
                    summary.net_profit >= 0 ? 'text-success' : 'text-error'
                  }`}>
                    ₹{summary.net_profit.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <DollarSign size={24} className="text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-info">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Total Balance</p>
                  <p className="text-2xl font-heading font-bold">
                    ₹{(summary.cash_balance + summary.bank_balance).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                    <td className="p-3 text-sm text-right font-semibold">
                      ₹{entry.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}