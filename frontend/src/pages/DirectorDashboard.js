import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { dashboardApi, api } from '@/lib/api';
import { Users, ClipboardList, FileText, Package, TrendingUp, AlertCircle, Sparkles, TrendingDown, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import UsersPage from './director/UsersPage';
import TasksPage from './director/TasksPage';
import TrackingPage from './director/TrackingPage';
import ReportsPage from './director/ReportsPage';
import IndentsPage from './director/IndentsPage';
import AccountingPage from './director/AccountingPage';
import AuditLogPage from './director/AuditLogPage';
import InventoryPage from './director/InventoryPage';
import SettingsPage from './director/SettingsPage';
import CompanyManagement from './director/CompanyManagement';
import ExecutiveReport from './director/ExecutiveReport';
import DailySummaryPage from './director/DailySummaryPage';
import RoleManagementPage from './director/RoleManagementPage';
import ReconciliationPage from './director/ReconciliationPage';

const StatCard = ({ icon: Icon, title, value, description, color }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
          <p className="text-3xl font-heading font-bold text-primary mb-1">{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const DashboardHome = () => {
  const [stats, setStats] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchAIInsights();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    try {
      const response = await api.get('/dashboard/ai-insights');
      setAiInsights(response.data.insights);
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    }
  };

  const fetchPredictions = async () => {
    setLoadingAI(true);
    try {
      const response = await api.get('/dashboard/predictions');
      setPredictions(response.data);
      toast.success('Predictions generated successfully!');
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
      toast.error('Failed to generate predictions');
    } finally {
      setLoadingAI(false);
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
    <div className="space-y-8" data-testid="director-dashboard">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-heading font-bold text-primary mb-2">Director Dashboard</h1>
          <p className="text-muted-foreground">Complete overview of all operations</p>
        </div>
        <Button
          onClick={fetchPredictions}
          disabled={loadingAI}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          data-testid="generate-predictions-button"
        >
          {loadingAI ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={18} className="mr-2" />
              AI Forecast
            </>
          )}
        </Button>
      </div>

      {/* Overall Stats */}
      <div>
        <h2 className="text-2xl font-heading font-semibold mb-4">Overall Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            title="Total Users"
            value={stats?.total_users || 0}
            description="Active workforce"
            color="bg-blue-500"
          />
          <StatCard
            icon={ClipboardList}
            title="Active Tasks"
            value={stats?.total_tasks || 0}
            description={`${stats?.pending_tasks || 0} pending`}
            color="bg-accent"
          />
          <StatCard
            icon={FileText}
            title="Reports"
            value={stats?.total_reports || 0}
            description="Ground level entries"
            color="bg-green-500"
          />
          <StatCard
            icon={Package}
            title="Indents"
            value={stats?.pending_indents || 0}
            description="Awaiting approval"
            color="bg-purple-500"
          />
        </div>
      </div>

      {/* AI Predictions */}
      {predictions && (
        <div>
          <h2 className="text-2xl font-heading font-semibold mb-4 flex items-center gap-2">
            <Sparkles size={24} className="text-purple-600" />
            AI Predictions - Next Month
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-success">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <TrendingUp size={20} />
                  Predicted Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-bold mb-2">₹{predictions.revenue?.toFixed(2) || '0.00'}</p>
                <p className="text-sm text-muted-foreground">{predictions.revenue_trend || 'Based on historical patterns'}</p>
                {predictions.revenue_confidence && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Confidence</span>
                      <span className="font-semibold">{predictions.revenue_confidence}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-success h-2 rounded-full"
                        style={{ width: `${predictions.revenue_confidence}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-error">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-error">
                  <TrendingDown size={20} />
                  Predicted Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-heading font-bold mb-2">₹{predictions.expenses?.toFixed(2) || '0.00'}</p>
                <p className="text-sm text-muted-foreground">{predictions.expense_trend || 'Estimated operational costs'}</p>
                {predictions.expense_breakdown && (
                  <div className="mt-3 space-y-1">
                    {predictions.expense_breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{item.category}</span>
                        <span className="font-semibold">₹{item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <DollarSign size={20} />
                  Net Profit Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-heading font-bold mb-2 ${
                  (predictions.revenue - predictions.expenses) >= 0 ? 'text-success' : 'text-error'
                }`}>
                  ₹{((predictions.revenue || 0) - (predictions.expenses || 0)).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">{predictions.profit_trend || 'Projected net profit'}</p>
                {predictions.recommendations && predictions.recommendations.length > 0 && (
                  <div className="mt-3 p-3 bg-info/10 rounded-lg">
                    <p className="text-xs font-semibold text-info mb-1">Key Recommendations:</p>
                    <ul className="text-xs space-y-1">
                      {predictions.recommendations.slice(0, 2).map((rec, idx) => (
                        <li key={idx} className="text-muted-foreground">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {predictions.inventory_alerts && predictions.inventory_alerts.length > 0 && (
            <Card className="mt-6 border-l-4 border-l-warning">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-warning" />
                  Inventory Alerts
                </CardTitle>
                <CardDescription>Items that may need restocking next month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {predictions.inventory_alerts.map((item, idx) => (
                    <div key={idx} className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                      <p className="font-semibold text-sm">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">Predicted need: {item.predicted_quantity} {item.unit}</p>
                      <p className="text-xs text-warning mt-1">Current: {item.current_stock} {item.unit}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* AI Insights */}
      {aiInsights && (
        <Card className="border-l-4 border-l-purple-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles size={20} className="text-purple-600" />
              AI Business Insights
            </CardTitle>
            <CardDescription>Automated analysis and recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-line text-sm">{aiInsights}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business-wise Data */}
      {stats?.business_stats && stats.business_stats.length > 0 && (
        <div>
          <h2 className="text-2xl font-heading font-semibold mb-4">Business Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.business_stats.filter(b => b.total_users > 0 || b.total_income > 0 || b.total_expense > 0).map((business) => (
              <Card key={business.business_type} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{business.business_name}</CardTitle>
                  <CardDescription className="capitalize">{business.business_type.replace('_', ' ')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Users</span>
                    <span className="font-semibold">{business.total_users}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tasks</span>
                    <span className="font-semibold">{business.total_tasks} ({business.pending_tasks} pending)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Reports</span>
                    <span className="font-semibold">{business.total_reports}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Indents</span>
                    <span className="font-semibold">{business.pending_indents} pending</span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">Income</span>
                      <span className="font-semibold text-success">₹{business.total_income.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">Expense</span>
                      <span className="font-semibold text-error">₹{business.total_expense.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="text-sm font-semibold">Net Profit</span>
                      <span className={`font-bold ${business.net_profit >= 0 ? 'text-success' : 'text-error'}`}>
                        ₹{business.net_profit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-accent" />
              Quick Actions
            </CardTitle>
            <CardDescription>Frequently accessed features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/director/users"
              className="block p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
              data-testid="quick-action-users"
            >
              <p className="font-semibold">Manage Users</p>
              <p className="text-sm text-muted-foreground">Add or edit managers and ground staff</p>
            </a>
            <a
              href="/director/tracking"
              className="block p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
              data-testid="quick-action-tracking"
            >
              <p className="font-semibold">Live Tracking</p>
              <p className="text-sm text-muted-foreground">Monitor team locations in real-time</p>
            </a>
            <a
              href="/director/indents"
              className="block p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
              data-testid="quick-action-indents"
            >
              <p className="font-semibold">Review Indents</p>
              <p className="text-sm text-muted-foreground">Authorize pending stock requests</p>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle size={20} className="text-warning" />
              System Alerts
            </CardTitle>
            <CardDescription>Important notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.pending_indents > 0 && (
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="font-semibold text-warning">Pending Indents</p>
                <p className="text-sm text-muted-foreground">
                  {stats.pending_indents} indent{stats.pending_indents > 1 ? 's' : ''} awaiting your approval
                </p>
              </div>
            )}
            {stats?.pending_tasks > 0 && (
              <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                <p className="font-semibold text-info">Pending Tasks</p>
                <p className="text-sm text-muted-foreground">
                  {stats.pending_tasks} task{stats.pending_tasks > 1 ? 's' : ''} need attention
                </p>
              </div>
            )}
            {(!stats?.pending_indents && !stats?.pending_tasks) && (
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <p className="font-semibold text-success">All Clear</p>
                <p className="text-sm text-muted-foreground">No urgent items requiring attention</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function DirectorDashboard() {
  return (
    <Layout role="director">
      <Routes>
        <Route index element={<DashboardHome />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="indents" element={<IndentsPage />} />
        <Route path="accounting" element={<AccountingPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="companies" element={<CompanyManagement />} />
        <Route path="executive" element={<ExecutiveReport />} />
        <Route path="daily-summary" element={<DailySummaryPage />} />
        <Route path="roles" element={<RoleManagementPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
      </Routes>
    </Layout>
  );
}