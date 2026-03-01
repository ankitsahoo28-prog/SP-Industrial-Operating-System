import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { taskApi, locationApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ClipboardList, MapPin, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import TasksPage from './ground-staff/TasksPage';
import ReportsPage from './ground-staff/ReportsPage';

const DashboardHome = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [locationInterval, setLocationInterval] = useState(null);

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

  const startTracking = () => {
    if ('geolocation' in navigator) {
      setTrackingEnabled(true);
      toast.success('Location tracking started');

      // Send location every 5 minutes
      const interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await locationApi.recordLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              });
              console.log('Location recorded');
            } catch (error) {
              console.error('Failed to record location:', error);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            toast.error('Failed to get location');
          },
          { enableHighAccuracy: true }
        );
      }, 5 * 60 * 1000); // 5 minutes

      // Send initial location immediately
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await locationApi.recordLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          } catch (error) {
            console.error('Failed to record location:', error);
          }
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true }
      );

      setLocationInterval(interval);
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  const stopTracking = () => {
    if (locationInterval) {
      clearInterval(locationInterval);
      setLocationInterval(null);
    }
    setTrackingEnabled(false);
    toast.info('Location tracking stopped');
  };

  useEffect(() => {
    return () => {
      if (locationInterval) {
        clearInterval(locationInterval);
      }
    };
  }, [locationInterval]);

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

      {/* Location Tracking Card */}
      <Card className="border-l-4 border-l-accent">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <MapPin size={24} className="text-accent" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-lg mb-1">Location Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  {trackingEnabled
                    ? 'Your location is being tracked during work hours'
                    : 'Enable tracking to mark your attendance'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    trackingEnabled ? 'bg-success animate-pulse' : 'bg-muted'
                  }`} />
                  <span className="text-xs font-medium">
                    {trackingEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <Button
              onClick={trackingEnabled ? stopTracking : startTracking}
              variant={trackingEnabled ? 'outline' : 'default'}
              className={trackingEnabled ? '' : 'bg-accent hover:bg-accent/90'}
              data-testid="tracking-toggle-button"
            >
              {trackingEnabled ? 'Stop Tracking' : 'Start Tracking'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Task Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-accent/10 rounded-xl">
                <ClipboardList size={20} className="text-accent" />
              </div>
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
              <div className="p-3 bg-warning/10 rounded-xl">
                <Clock size={20} className="text-warning" />
              </div>
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
              <div className="p-3 bg-info/10 rounded-xl">
                <CheckCircle2 size={20} className="text-info" />
              </div>
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
          <a
            href="/ground-staff/tasks"
            className="block p-6 bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl hover:shadow-md transition-all border border-accent/20"
            data-testid="quick-action-tasks"
          >
            <ClipboardList size={32} className="text-accent mb-3" />
            <p className="font-heading font-semibold text-lg">View Tasks</p>
            <p className="text-sm text-muted-foreground mt-1">Check and update your assigned tasks</p>
          </a>

          <a
            href="/ground-staff/reports"
            className="block p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl hover:shadow-md transition-all border border-primary/20"
            data-testid="quick-action-reports"
          >
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
      </Routes>
    </Layout>
  );
}