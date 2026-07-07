import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { taskApi } from '@/lib/api';
import { toast } from 'sonner';
import { Clock, CheckCircle2, PlayCircle, Calendar } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await taskApi.getTasks();
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await taskApi.updateTask(taskId, { status });
      toast.success('Task updated successfully');
      fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-success/20 text-success border-success/30',
      in_progress: 'bg-info/20 text-info border-info/30',
      pending: 'bg-warning/20 text-warning border-warning/30',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={20} className="text-success" />;
      case 'in_progress':
        return <PlayCircle size={20} className="text-info" />;
      default:
        return <Clock size={20} className="text-warning" />;
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
    <div className="space-y-6" data-testid="ground-staff-tasks-page">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">My Tasks</h1>
        <p className="text-muted-foreground mt-1">View and update your assigned tasks</p>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-4">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <h3 className="font-heading font-semibold text-lg mb-2">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className={`text-xs px-3 py-1 rounded-full border ${getStatusBadge(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {task.deadline && (
                      <span className="text-xs px-3 py-1 rounded-full bg-secondary text-foreground flex items-center gap-1">
                        <Calendar size={12} />
                        Due: {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {task.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => updateTaskStatus(task.id, 'in_progress')}
                        className="bg-info hover:bg-info/90"
                        data-testid="start-task-button"
                      >
                        <PlayCircle size={16} className="mr-2" />
                        Start Task
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className="bg-success hover:bg-success/90"
                        data-testid="complete-task-button"
                      >
                        <CheckCircle2 size={16} className="mr-2" />
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks assigned yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}