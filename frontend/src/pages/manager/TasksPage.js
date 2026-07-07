// Manager TasksPage (similar to Director but Manager-specific)
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { taskApi, userApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Clock, CheckCircle2, Calendar } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    deadline: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        taskApi.getTasks(),
        userApi.getUsers(),
      ]);
      setTasks(tasksRes.data);
      setUsers(usersRes.data.filter(u => u.role === 'ground_staff'));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const taskData = {
        ...formData,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
      };
      await taskApi.createTask(taskData);
      toast.success('Task assigned successfully');
      setDialogOpen(false);
      setFormData({ title: '', description: '', assigned_to: '', deadline: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-success/20 text-success border-success/30',
      in_progress: 'bg-info/20 text-info border-info/30',
      overdue: 'bg-error/20 text-error border-error/30',
      pending: 'bg-warning/20 text-warning border-warning/30',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="manager-tasks-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Assign and track team tasks</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="create-task-button">
              <Plus size={18} className="mr-2" />
              Assign Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign New Task</DialogTitle>
              <DialogDescription>Create a task for your team member</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  data-testid="task-title-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  data-testid="task-description-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To</Label>
                <Select
                  value={formData.assigned_to}
                  onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                  required
                >
                  <SelectTrigger data-testid="task-assignee-select">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  data-testid="task-deadline-input"
                />
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="task-submit-button">
                Assign Task
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => {
          const assignedUser = users.find((u) => u.id === task.assigned_to);
          return (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-heading font-semibold text-lg mb-2">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      {assignedUser && (
                        <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20">
                          {assignedUser.name}
                        </span>
                      )}
                      {task.deadline && (
                        <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks yet. Create your first task to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}