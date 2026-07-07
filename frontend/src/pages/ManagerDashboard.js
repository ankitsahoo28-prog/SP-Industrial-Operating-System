import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { taskApi, locationApi } from '@/lib/api';
import { ClipboardList, Users, FileText, CheckCircle2, Clock, MapPin } from 'lucide-react';
import TeamPage from './manager/TeamPage';
import TasksPage from './manager/TasksPage';
import TrackingPage from './manager/TrackingPage';
import ReportsPage from './manager/ReportsPage';
import IndentsPage from './manager/IndentsPage';
import AccountingPage from './manager/AccountingPage';
import InventoryPage from './director/InventoryPage';
import AiAssistantPage from './director/AiAssistantPage';

const StatCard = ({ icon: Icon, title, value, description, color }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-heading font-bold tracking-tight mb-1">{value}</p>
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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingActive, setTrackingActive] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await taskApi.getTasks();
        setTasks(response.data);
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Auto-start location tracking — always on, no toggle
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const recordLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await locationApi.record({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          } catch (err) { console.error('Location record failed:', err); }
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true }
      );
    };

    recordLocation();
    setTrackingActive(true);
    intervalRef.current = setInterval(recordLocation, 5 * 60 * 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-8" data-testid="manager-dashboard">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight mb-2">Manager Dashboard</h1>
        <p className="text-muted-foreground">Manage your team and operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={ClipboardList} title="Total Tasks" value={tasks.length} description="Assigned to your team" color="bg-accent" />
        <StatCard icon={Clock} title="Pending" value={pendingTasks} description="Awaiting action" color="bg-warning" />
        <StatCard icon={CheckCircle2} title="Completed" value={completedTasks} description="Successfully done" color="bg-success" />
        <StatCard icon={Users} title="Team" value="View" description="Manage ground staff" color="bg-blue-500" />
      </div>

      {/* Location Tracking Status — Always ON */}
      <Card className="border-l-4 border-l-accent">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <MapPin size={18} className="text-accent" />
            <span className="text-sm font-medium">Location Tracking</span>
            <div className={`w-2 h-2 rounded-full ${trackingActive ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
            <span className="text-xs text-muted-foreground" data-testid="manager-tracking-status">{trackingActive ? 'Active' : 'Starting...'}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Latest assigned tasks</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="p-3 bg-secondary/50 rounded-lg">
                    <p className="font-semibold text-sm">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        task.status === 'completed' ? 'bg-success/20 text-success' :
                        task.status === 'in_progress' ? 'bg-info/20 text-info' :
                        'bg-warning/20 text-warning'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      {task.deadline && (
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/manager/team"
              className="block p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
              data-testid="quick-action-team"
            >
              <p className="font-semibold">Manage Team</p>
              <p className="text-sm text-muted-foreground">Add or view ground staff members</p>
            </a>
            <a
              href="/manager/tasks"
              className="block p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
              data-testid="quick-action-tasks"
            >
              <p className="font-semibold">Assign Tasks</p>
              <p className="text-sm text-muted-foreground">Create and track tasks for your team</p>
            </a>
            <a
              href="/manager/reports"
              className="block p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
              data-testid="quick-action-reports"
            >
              <p className="font-semibold">Enter Reports</p>
              <p className="text-sm text-muted-foreground">Submit ground level operational data</p>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function ManagerDashboard() {
  return (
    <Layout role="manager">
      <Routes>
        <Route index element={<DashboardHome />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="indents" element={<IndentsPage />} />
        <Route path="accounting" element={<AccountingPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="ai-assistant" element={<AiAssistantPage />} />
      </Routes>
    </Layout>
  );
}