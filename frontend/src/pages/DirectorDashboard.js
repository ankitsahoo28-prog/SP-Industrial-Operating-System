import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardApi } from '@/lib/api';
import { Users, ClipboardList, FileText, Package, TrendingUp, AlertCircle } from 'lucide-react';
import UsersPage from './director/UsersPage';
import TasksPage from './director/TasksPage';
import TrackingPage from './director/TrackingPage';
import ReportsPage from './director/ReportsPage';
import IndentsPage from './director/IndentsPage';
import AccountingPage from './director/AccountingPage';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await dashboardApi.getStats();
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="director-dashboard">
      <div>
        <h1 className="text-4xl font-heading font-bold text-primary mb-2">Director Dashboard</h1>
        <p className="text-muted-foreground">Complete overview of all operations</p>
      </div>

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
        <Route path="payroll" element={<PayrollPage />} />
      </Routes>
    </Layout>
  );
}