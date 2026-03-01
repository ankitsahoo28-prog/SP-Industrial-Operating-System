import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';
import { UserPlus, Mail, Phone, Briefcase, Shield } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'manager',
    phone: '',
    business_type: 'petrol_pump',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await userApi.createUser(formData);
      toast.success('User created successfully');
      setDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'manager',
        phone: '',
        business_type: 'petrol_pump',
      });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      director: 'bg-purple-100 text-purple-700 border-purple-200',
      manager: 'bg-blue-100 text-blue-700 border-blue-200',
      ground_staff: 'bg-green-100 text-green-700 border-green-200',
    };
    return styles[role] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage your workforce</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="add-user-button">
              <UserPlus size={18} className="mr-2" />
              Add Manager
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Manager</DialogTitle>
              <DialogDescription>Create a new manager account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="user-name-input"
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
                  data-testid="user-email-input"
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
                  data-testid="user-password-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="user-phone-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_type">Business Type</Label>
                <Select
                  value={formData.business_type}
                  onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                >
                  <SelectTrigger data-testid="business-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="petrol_pump">Petrol Pump</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="fl_shop">FL Shop</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="slag_crushing">Slag Crushing</SelectItem>
                    <SelectItem value="stone_crusher">Stone Crusher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="create-user-submit">
                Create Manager
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-lg">{user.name}</h3>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${getRoleBadge(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </div>
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
                {user.business_type && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase size={16} />
                    <span className="capitalize">{user.business_type.replace('_', ' ')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No users found. Add your first manager to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}