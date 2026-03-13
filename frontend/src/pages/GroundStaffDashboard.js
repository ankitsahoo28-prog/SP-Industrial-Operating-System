import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { taskApi, locationApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ClipboardList, MapPin, FileText, Clock, CheckCircle2 } from 'lucide-react';
import TasksPage from './ground-staff/TasksPage';
import ReportsPage from './ground-staff/ReportsPage';
import AccountingPage from './manager/AccountingPage';
import InventoryPage from './director/InventoryPage';
import IndentsPage from './manager/IndentsPage';
import TrackingPage from './manager/TrackingPage';
import TeamPage from './manager/TeamPage';

const DashboardHome = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingActive, setTrackingActive] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    taskApi.getTasks()
      .then(res => setTasks(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
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

    // Record immediately on load
    recordLocation();
    setTrackingActive(true);

    // Then every 5 minutes
    intervalRef.current = setInterval(recordLocation, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

  return (
    <div className="space-y-6" data-testid="ground-staff-dashboard">
      <div>
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-2">My Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Location Tracking Status — Always ON */}
      <Card className="border-l-4 border-l-accent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent/10 rounded-xl">
              <MapPin size={24} className="text-accent" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg mb-1">Location Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Your location is being tracked automatically during work hours
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${trackingActive ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                <span className="text-xs font-medium" data-testid="tracking-status">
                  {trackingActive ? 'Active' : 'Starting...'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-accent/10 rounded-xl"><ClipboardList size={20} className="text-accent" /></div>
              <div>
                <p className="text-2xl font-heading font-bold">{tasks.length}</p>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-warning/10 rounded-xl"><Clock size={20} className="text-warning" /></div>
              <div>
                <p className="text-2xl font-heading font-bold">{pendingTasks.length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-info/10 rounded-xl"><CheckCircle2 size={20} className="text-info" /></div>
              <div>
                <p className="text-2xl font-heading font-bold">{inProgressTasks.length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Access your daily tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="/ground-staff/tasks" className="block p-6 bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl hover:shadow-md transition-all border border-accent/20" data-testid="quick-action-tasks">
            <ClipboardList size={32} className="text-accent mb-3" />
            <p className="font-heading font-semibold text-lg">View Tasks</p>
            <p className="text-sm text-muted-foreground mt-1">Check and update your assigned tasks</p>
          </a>
          <a href="/ground-staff/reports" className="block p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl hover:shadow-md transition-all border border-primary/20" data-testid="quick-action-reports">
            <FileText size={32} className="text-primary mb-3" />
            <p className="font-heading font-semibold text-lg">Submit Reports</p>
            <p className="text-sm text-muted-foreground mt-1">Enter ground level operational data</p>
          </a>
        </CardContent>
      </Card>
    </div>
  );
};

export default function GroundStaffDashboard() {
  return (
    <Layout role="ground_staff">
      <Routes>
        <Route index element={<DashboardHome />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="accounting" element={<AccountingPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="indents" element={<IndentsPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="team" element={<TeamPage />} />
      </Routes>
    </Layout>
  );
}
