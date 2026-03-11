import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { odooApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Banknote, Building2, TrendingUp, TrendingDown, Receipt, FileText, BookOpen, CreditCard, DollarSign } from 'lucide-react';
import { StatCard, LoadingSpinner, fmt, cleanParams } from './helpers';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function OverviewTab({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plData, setPlData] = useState(null);

  useEffect(() => {
    setLoading(true);
    const params = cleanParams({ company_id: companyId });
    Promise.all([
      odooApi.dashboard(params),
      odooApi.reports.profitLoss(params).catch(() => ({ data: null })),
    ]).then(([d, pl]) => {
      setData(d.data);
      setPlData(pl.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-muted-foreground py-8 text-center">Unable to load dashboard. Please select a company.</p>;

  const summaryChart = [
    { name: 'Income', amount: data.monthly_income, fill: '#10B981' },
    { name: 'Expense', amount: data.monthly_expense, fill: '#EF4444' },
    { name: 'Profit', amount: data.monthly_profit, fill: data.monthly_profit >= 0 ? '#3B82F6' : '#F59E0B' },
  ];

  const balanceChart = [
    { name: 'Cash', value: Math.abs(data.cash_balance) || 0 },
    { name: 'Bank', value: Math.abs(data.bank_balance) || 0 },
    { name: 'Receivable', value: Math.abs(data.total_receivable) || 0 },
    { name: 'Payable', value: Math.abs(data.total_payable) || 0 },
  ].filter(d => d.value > 0);

  const incomeExpenseChart = [];
  if (plData) {
    (plData.income || []).forEach(i => incomeExpenseChart.push({ name: i.name, income: i.amount, expense: 0 }));
    (plData.expenses || []).forEach(e => {
      const existing = incomeExpenseChart.find(x => x.name === e.name);
      if (existing) existing.expense = e.amount;
      else incomeExpenseChart.push({ name: e.name, income: 0, expense: e.amount });
    });
  }

  return (
    <div className="space-y-6" data-testid="acc-overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Banknote} label="Cash" value={fmt(data.cash_balance)} color="text-success" />
        <StatCard icon={Building2} label="Bank" value={fmt(data.bank_balance)} color="text-info" />
        <StatCard icon={TrendingUp} label="Receivable" value={fmt(data.total_receivable)} color="text-warning" />
        <StatCard icon={TrendingDown} label="Payable" value={fmt(data.total_payable)} color="text-error" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Receipt} label="Invoices" value={data.total_invoices} sub={`${data.draft_invoices} draft, ${data.overdue_invoices} overdue`} />
        <StatCard icon={FileText} label="Bills" value={data.total_bills} sub={`${data.draft_bills} draft`} />
        <StatCard icon={BookOpen} label="Entries" value={data.total_entries} />
        <StatCard icon={CreditCard} label="Payments" value={data.total_payments} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Monthly Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryChart} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {summaryChart.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Balance Distribution</CardTitle></CardHeader>
          <CardContent>
            {balanceChart.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={balanceChart} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={3}>
                      {balanceChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No balance data yet. Create some transactions to see the chart.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="Monthly Income" value={fmt(data.monthly_income)} color="text-success" />
        <StatCard icon={TrendingDown} label="Monthly Expense" value={fmt(data.monthly_expense)} color="text-error" />
        <StatCard icon={DollarSign} label="Monthly Profit" value={fmt(data.monthly_profit)} color={data.monthly_profit >= 0 ? "text-success" : "text-error"} />
      </div>

      {incomeExpenseChart.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Income vs Expenses by Category</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpenseChart} barGap={2}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#EF4444" name="Expense" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
