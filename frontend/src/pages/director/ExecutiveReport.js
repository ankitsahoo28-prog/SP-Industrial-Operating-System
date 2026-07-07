import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { companyApi, directorApi } from '@/lib/api';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Wallet, Package, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ExecutiveReport() {
  const [period, setPeriod] = useState('monthly');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [companies, setCompanies] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companyApi.getAll(false).then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { period };
    if (companyFilter !== 'all') params.company_id = companyFilter;
    directorApi.getExecutiveReport(params)
      .then(r => setReport(r.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  }, [period, companyFilter]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  const barData = (report?.companies || []).map(c => ({
    name: c.company_name?.split(' ').slice(1).join(' ') || c.company_name,
    Revenue: c.revenue,
    Expenses: c.expenses,
    Profit: c.profit,
  }));

  const pieData = (report?.companies || []).filter(c => c.revenue > 0 || c.expenses > 0).map(c => ({
    name: c.company_name, value: c.revenue + c.expenses,
  }));

  return (
    <div className="space-y-6" data-testid="executive-report-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-3"><BarChart3 size={20} />Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">Consolidated financial insights across all companies</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]" data-testid="period-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[180px]" data-testid="company-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><TrendingUp size={20} className="text-green-600" /></div>
              <div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold text-green-600" data-testid="kpi-revenue">₹{(report?.totals?.revenue || 0).toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><TrendingDown size={20} className="text-red-600" /></div>
              <div><p className="text-xs text-muted-foreground">Expenses</p><p className="text-xl font-bold text-red-600" data-testid="kpi-expenses">₹{(report?.totals?.expenses || 0).toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><DollarSign size={20} className="text-blue-600" /></div>
              <div><p className="text-xs text-muted-foreground">Profit</p><p className="text-xl font-bold text-blue-600" data-testid="kpi-profit">₹{(report?.totals?.profit || 0).toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Wallet size={20} className="text-purple-600" /></div>
              <div><p className="text-xs text-muted-foreground">Cash Position</p><p className="text-xl font-bold text-purple-600" data-testid="kpi-cash">₹{(report?.totals?.cash_position || 0).toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Company Performance ({period})</CardTitle></CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                  <Bar dataKey="Revenue" fill="#10b981" />
                  <Bar dataKey="Expenses" fill="#ef4444" />
                  <Bar dataKey="Profit" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No financial data for this period</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Revenue Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name }) => name?.split(' ').slice(1).join(' ')}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data to display</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Detail Table */}
      <Card>
        <CardHeader><CardTitle>Company Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Cash</TableHead>
                <TableHead className="text-right">Inventory Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.companies || []).map(c => (
                <TableRow key={c.company_id}>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell className="capitalize">{c.business_type?.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">₹{c.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">₹{c.expenses.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-mono ${c.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>₹{c.profit.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">₹{c.cash_position.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">₹{c.inventory_value.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(report?.companies || []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
