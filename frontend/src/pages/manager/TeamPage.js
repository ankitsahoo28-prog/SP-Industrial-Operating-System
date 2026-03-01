import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';
import { UserPlus, Mail, Phone, Shield } from 'lucide-react';

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'ground_staff',
    phone: '',
    shift_start: '',
    shift_end: '',
  });

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const response = await userApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch team:', error);
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await userApi.createUser(formData);
      toast.success('Ground staff added successfully');
      setDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'ground_staff',
        phone: '',
        shift_start: '',
        shift_end: '',
      });
      fetchTeam();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add ground staff');
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
    <div className="space-y-6" data-testid="team-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">My Team</h1>
          <p className="text-muted-foreground mt-1">Manage your ground staff</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="add-staff-button">
              <UserPlus size={18} className="mr-2" />
              Add Ground Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Ground Staff</DialogTitle>
              <DialogDescription>Create a new ground staff account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="staff-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="staff-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  data-testid="staff-password-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="staff-phone-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shift_start">Shift Start</Label>
                  <Input
                    id="shift_start"
                    type="time"
                    value={formData.shift_start}
                    onChange={(e) => setFormData({ ...formData, shift_start: e.target.value })}
                    data-testid="staff-shift-start-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift_end">Shift End</Label>
                  <Input
                    id="shift_end"
                    type="time"
                    value={formData.shift_end}
                    onChange={(e) => setFormData({ ...formData, shift_end: e.target.value })}
                    data-testid="staff-shift-end-input"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="create-staff-submit">
                Add Ground Staff
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.filter(u => u.role === 'ground_staff').map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Shield size={24} className="text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-semibold text-lg">{user.name}</h3>
                  <span className="inline-block text-xs px-2 py-0.5 rounded border bg-green-100 text-green-700 border-green-200">
                    Ground Staff
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail size={16} />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone size={16} />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.shift_start && user.shift_end && (
                  <div className="mt-2 p-2 bg-secondary/50 rounded">
                    <p className="text-xs font-medium">Shift Timing</p>
                    <p className="text-xs text-muted-foreground">
                      {user.shift_start} - {user.shift_end}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users.filter(u => u.role === 'ground_staff').length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No ground staff yet. Add your first team member to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}