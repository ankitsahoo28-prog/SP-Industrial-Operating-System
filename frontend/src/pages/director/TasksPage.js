import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { taskApi, userApi } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { ClipboardList, Plus, CheckCircle2, Clock, AlertCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TasksPage() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', deadline: '' });

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        taskApi.getTasks({ company_id: companyId }),
        userApi.getUsers(),
      ]);
      setTasks(tasksRes.data);
      setUsers(usersRes.data);
    } catch { toast.error('Failed to fetch tasks'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await taskApi.updateTask(editingTask.id, formData);
        toast.success('Task updated');
      } else {
        await taskApi.createTask({ ...formData, company_id: companyId });
        toast.success('Task created');
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskApi.updateTask(taskId, { status: newStatus });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      fetchData();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await taskApi.deleteTask(taskId);
      toast.success('Task deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority || 'medium',
      deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormData({ title: '', description: '', assigned_to: '', priority: 'medium', deadline: '' });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700"><CheckCircle2 size={12} className="mr-1" />Completed</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-700"><Clock size={12} className="mr-1" />In Progress</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle size={12} className="mr-1" />Pending</Badge>;
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'high': return <Badge variant="destructive" className="text-xs">High</Badge>;
      case 'low': return <Badge variant="outline" className="text-xs">Low</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Medium</Badge>;
    }
  };

  const getUserName = (id) => users.find(u => u.id === id)?.name || 'Unknown';
  const isDirector = user?.role === 'director';

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  return (
    <div className="space-y-6" data-testid="tasks-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-2"><ClipboardList size={18} />Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">{tasks.length} tasks total</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="create-task-btn"><Plus size={16} className="mr-2" />New Task</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
              <DialogDescription>An email notification will be sent to the assigned user.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} required data-testid="task-title" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} data-testid="task-desc" />
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={formData.assigned_to} onValueChange={v => setFormData(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger data-testid="task-assign"><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>{users.filter(u => u.role !== 'director').map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData(f => ({ ...f, priority: v }))}>
                    <SelectTrigger data-testid="task-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="date" value={formData.deadline} onChange={e => setFormData(f => ({ ...f, deadline: e.target.value }))} data-testid="task-deadline" />
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="task-submit">{editingTask ? 'Update Task' : 'Create Task'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><ClipboardList size={48} className="mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No tasks yet</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <Card key={task.id} className="hover:shadow-sm transition-shadow" data-testid={`task-${task.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{task.title}</h3>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Assigned: {getUserName(task.assigned_to)}</span>
                      {task.deadline && <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Status change buttons */}
                    {task.status !== 'completed' && (
                      <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v)}>
                        <SelectTrigger className="w-[120px] h-8 text-xs" data-testid={`status-${task.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {isDirector && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(task)} data-testid={`edit-task-${task.id}`}><Edit size={14} /></Button>
                        <Button variant="ghost" size="sm" className="text-error" onClick={() => handleDelete(task.id)} data-testid={`delete-task-${task.id}`}><Trash2 size={14} /></Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
