import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { taskApi, userApi } from '@/lib/api';
import { BusinessFilter } from '@/components/BusinessFilter';
import { toast } from 'sonner';
import { Plus, Clock, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [businessFilter, setBusinessFilter] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    deadline: '',
  });

  useEffect(() => {
    fetchData();
  }, [businessFilter]);

  const fetchData = async () => {
    try {
      const params = {};
      if (businessFilter !== 'all') params.business_type = businessFilter;
      const [tasksRes, usersRes] = await Promise.all([
        taskApi.getTasks(params),
        userApi.getUsers(),
      ]);
      setTasks(tasksRes.data);
      setUsers(usersRes.data);
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
      toast.success('Task created successfully');
      setDialogOpen(false);
      setFormData({ title: '', description: '', assigned_to: '', deadline: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={18} className="text-success" />;
      case 'in_progress': return <Clock size={18} className="text-info" />;
      case 'overdue': return <AlertCircle size={18} className="text-error" />;
      default: return <Clock size={18} className="text-warning" />;
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
    <div className="space-y-6" data-testid="tasks-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Task Management</h1>
          <p className="text-muted-foreground mt-1">Allocate and track tasks</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BusinessFilter value={businessFilter} onChange={setBusinessFilter} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90" data-testid="create-task-button">
                <Plus size={18} className="mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Assign a task to a team member</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required data-testid="task-title-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} data-testid="task-description-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })} required>
                    <SelectTrigger data-testid="task-assignee-select"><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.name} ({user.role.replace('_', ' ')})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <Input id="deadline" type="datetime-local" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} data-testid="task-deadline-input" />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="task-submit-button">Create Task</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => {
          const assignedUser = users.find((u) => u.id === task.assigned_to);
          return (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-2">
                      {getStatusIcon(task.status)}
                      <div className="flex-1">
                        <h3 className="font-heading font-semibold text-lg">{task.title}</h3>
                        {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(task.status)}`}>{task.status.replace('_', ' ')}</span>
                      {assignedUser && (
                        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">{assignedUser.name}</span>
                      )}
                      {task.business_type && (
                        <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground capitalize">{task.business_type.replace('_', ' ')}</span>
                      )}
                      {task.deadline && (
                        <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground flex items-center gap-1">
                          <Calendar size={12} />{new Date(task.deadline).toLocaleDateString()}
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
            <p className="text-muted-foreground">No tasks found{businessFilter !== 'all' ? ' for this business' : ''}. Create your first task to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
