import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { userApi, deleteUser, authApi, directorApi } from '@/lib/api';
import { toast } from 'sonner';
import { UserPlus, Mail, Phone, Briefcase, Shield, Trash2, CheckCircle2, XCircle, Clock, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
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
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const response = await authApi.getPendingUsers();
      setPendingUsers(response.data);
    } catch { /* ignore if no pending users */ }
  };

  const handleApprove = async (userId, action) => {
    try {
      await authApi.approveUser(userId, action);
      toast.success(`User ${action}`);
      fetchPendingUsers();
      fetchUsers();
    } catch (err) {
      toast.error('Action failed');
    }
  };

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

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      toast.success(`User ${userToDelete.name} deleted`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwUser || !newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await directorApi.changeUserPassword(pwUser.id, newPassword);
      toast.success(`Password changed for ${pwUser.name}`);
      setPwDialogOpen(false);
      setPwUser(null);
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
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
    <div className="space-y-6" data-testid="users-page">
      {/* Pending Users Approval */}
      {pendingUsers.length > 0 && (
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock size={18} className="text-yellow-500" />Pending Approval ({pendingUsers.length})</CardTitle>
            <CardDescription>New accounts waiting for your approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50/50 dark:bg-yellow-900/10" data-testid={`pending-user-${u.id}`}>
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email} &middot; <span className="capitalize">{u.role?.replace('_', ' ')}</span> &middot; {u.business_type?.replace('_', ' ') || 'No business'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(u.id, 'approved')} data-testid={`approve-${u.id}`}><CheckCircle2 size={14} className="mr-1" />Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleApprove(u.id, 'rejected')} data-testid={`reject-${u.id}`}><XCircle size={14} className="mr-1" />Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage your workforce</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="add-user-button">
              <UserPlus size={18} className="mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new director, manager, or ground staff account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="ground_staff">Ground Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                Create {formData.role === 'director' ? 'Director' : formData.role === 'manager' ? 'Manager' : 'Ground Staff'}
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
                {user.role !== 'director' && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => { setPwUser(user); setPwDialogOpen(true); setNewPassword(''); }}
                      data-testid={`change-pw-${user.id}`}
                    >
                      <KeyRound size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-error hover:text-error hover:bg-error/10"
                      onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }}
                      data-testid={`delete-user-${user.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-error">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name}</strong> ({userToDelete?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="cancel-delete-button">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              data-testid="confirm-delete-button"
            >
              <Trash2 size={16} className="mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={(open) => { setPwDialogOpen(open); if (!open) { setPwUser(null); setNewPassword(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound size={20} className="text-primary" />Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{pwUser?.name}</strong> ({pwUser?.email})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                minLength={6}
                required
                data-testid="new-password-input"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" type="button" onClick={() => setPwDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="confirm-change-pw">
                <KeyRound size={16} className="mr-2" />Change Password
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}