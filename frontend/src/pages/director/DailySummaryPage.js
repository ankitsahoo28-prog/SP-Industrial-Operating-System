import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { directorApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Calendar, BookOpen, Package, ClipboardList, Users, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle, Loader2, Building2
} from 'lucide-react';

export default function DailySummaryPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    directorApi.getDailySummary()
      .then(r => setSummary(r.data))
      .catch(() => toast.error('Failed to load daily summary'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6" data-testid="daily-summary-page">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-3">
          <Calendar size={20} />Daily Summary
        </h1>
        <p className="text-muted-foreground mt-1">Activity overview for {summary?.date || 'today'}</p>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Income Today</p>
                <p className="text-xl font-bold text-green-600" data-testid="income-today">{fmt(summary?.income_today)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingDown size={20} className="text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Expense Today</p>
                <p className="text-xl font-bold text-red-600" data-testid="expense-today">{fmt(summary?.expense_today)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign size={20} className="text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Net Today</p>
                <p className={`text-xl font-bold ${(summary?.net_today || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="net-today">{fmt(summary?.net_today)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Low Stock</p>
                <p className="text-xl font-bold text-orange-600" data-testid="low-stock-count">{summary?.low_stock_alerts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen size={18} className="text-primary" />Accounting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Journal Entries</span>
              <Badge variant="secondary" data-testid="je-count">{summary?.journal_entries_count || 0}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Debit</span>
              <span className="font-mono font-semibold">{fmt(summary?.total_debit_today)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Package size={18} className="text-accent" />Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stock Movements</span>
              <Badge variant="secondary" data-testid="move-count">{summary?.stock_movements || 0}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stock IN</span>
              <span className="font-mono text-green-600">{summary?.stock_in?.toFixed(2) || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stock OUT</span>
              <span className="font-mono text-red-600">{summary?.stock_out?.toFixed(2) || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList size={18} className="text-info" />Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created Today</span>
              <Badge variant="secondary" data-testid="tasks-created">{summary?.tasks_created || 0}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completed Today</span>
              <Badge variant="default" data-testid="tasks-completed">{summary?.tasks_completed || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users size={18} className="text-purple-600" />Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Approved Today</span>
              <Badge variant="secondary">{summary?.users_approved || 0}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pending Approval</span>
              <Badge variant={summary?.pending_users > 0 ? "destructive" : "secondary"} data-testid="pending-users">{summary?.pending_users || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Activity */}
      {summary?.company_activity?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={20} className="text-primary" />Company Activity Today</CardTitle>
            <CardDescription>Companies with recorded activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.company_activity.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <span className="font-medium text-sm">{c.company_name}</span>
                  <div className="flex gap-4 text-xs">
                    <span><BookOpen size={12} className="inline mr-1" />{c.journal_entries} entries</span>
                    <span><Package size={12} className="inline mr-1" />{c.stock_movements} movements</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
