import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { userApi, deleteUser, authApi, directorApi, companyApi, roleApi } from '@/lib/api';
import { toast } from 'sonner';
import { UserPlus, Mail, Phone, Briefcase, Shield, Trash2, CheckCircle2, XCircle, Clock, KeyRound, Building2, Edit, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState([]);
  const [selectedJobRoleId, setSelectedJobRoleId] = useState('none');
  const [userCompanyMap, setUserCompanyMap] = useState({});
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '',
    role: 'manager', business_type: 'petrol_pump', company_ids: [], job_role_id: '',
  });

  const fetchUsers = useCallback(async () => {
    try {
      const [usersRes, pendingRes, compRes, rolesRes] = await Promise.all([
        userApi.getUsers(), authApi.getPendingUsers(),
        companyApi.getAll(false), roleApi.getAll().catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data);
      setPendingUsers(pendingRes.data);
      setCompanies(compRes.data);
      setJobRoles(rolesRes.data);
      const map = {};
      for (const u of usersRes.data) {
        try { const res = await userApi.getUserCompanies(u.id); map[u.id] = res.data; }
        catch { map[u.id] = []; }
      }
      setUserCompanyMap(map);
    } catch { toast.error('Failed to fetch users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { company_ids, ...userData } = formData;
      const res = await userApi.createUser(userData);
      if (company_ids.length > 0) await companyApi.assignMultiple(res.data.id, company_ids);
      toast.success(`User created successfully`);
      setDialogOpen(false);
      setFormData({ name: '', email: '', password: '', phone: '', role: 'manager', business_type: 'petrol_pump', company_ids: [], job_role_id: '' });
      fetchUsers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create user'); }
  };

  const handleApprove = async (userId, action) => {
    try { await authApi.approveUser(userId, action); toast.success(`User ${action === 'approve' ? 'approved' : 'rejected'}`); fetchUsers(); }
    catch { toast.error('Action failed'); }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try { await deleteUser(userToDelete.id); toast.success(`User ${userToDelete.name} deleted`); setDeleteDialogOpen(false); setUserToDelete(null); fetchUsers(); }
    catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete user'); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwUser || !newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    try { await directorApi.changeUserPassword(pwUser.id, newPassword); toast.success(`Password changed for ${pwUser.name}`); setPwDialogOpen(false); setPwUser(null); setNewPassword(''); }
    catch (error) { toast.error(error.response?.data?.detail || 'Failed to change password'); }
  };

  const openCompanyEdit = (user) => {
    setEditingUser(user); setSelectedCompanyIds((userCompanyMap[user.id] || []).map(c => c.id)); setCompanyDialogOpen(true);
  };

  const openRoleEdit = (user) => {
    setEditingUser(user); setSelectedJobRoleId(user.job_role_id || 'none'); setRoleDialogOpen(true);
  };

  const handleSaveCompanies = async () => {
    if (!editingUser) return;
    try { await companyApi.assignMultiple(editingUser.id, selectedCompanyIds); toast.success(`Company assignments updated`); setCompanyDialogOpen(false); setEditingUser(null); fetchUsers(); }
    catch (error) { toast.error(error.response?.data?.detail || 'Failed to update companies'); }
  };

  const handleSaveJobRole = async () => {
    if (!editingUser) return;
    try {
      await userApi.updateJobRole(editingUser.id, selectedJobRoleId === 'none' ? null : selectedJobRoleId);
      toast.success(`Job role updated for ${editingUser.name}`);
      setRoleDialogOpen(false); setEditingUser(null); fetchUsers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to update job role'); }
  };

  const toggleCompanyId = (id) => setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleFormCompany = (id) => setFormData(f => ({ ...f, company_ids: f.company_ids.includes(id) ? f.company_ids.filter(c => c !== id) : [...f.company_ids, id] }));

  const getJobRoleName = (roleId) => {
    if (!roleId) return null;
    const jr = jobRoles.find(r => r.id === roleId);
    return jr ? jr.name : null;
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'director': return <Badge className="bg-purple-100 text-purple-700"><Shield size={12} className="mr-1" />Director</Badge>;
      case 'manager': return <Badge className="bg-blue-100 text-blue-700"><Briefcase size={12} className="mr-1" />Manager</Badge>;
      default: return <Badge className="bg-green-100 text-green-700">Ground Staff</Badge>;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-96 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-heading font-bold tracking-tight">Users</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="add-user-button"><UserPlus size={18} className="mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user and assign them to companies</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>System Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="ground_staff">Ground Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {jobRoles.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Tag size={14} />Job Role</Label>
                  <Select value={formData.job_role_id || 'none'} onValueChange={(v) => setFormData({ ...formData, job_role_id: v === 'none' ? '' : v })}>
                    <SelectTrigger data-testid="user-job-role-select"><SelectValue placeholder="Select job role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {jobRoles.map(jr => (
                        <SelectItem key={jr.id} value={jr.id}>{jr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="user-name-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required data-testid="user-email-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required data-testid="user-password-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} data-testid="user-phone-input" />
              </div>
              <div className="space-y-2">
                <Label>Business Type</Label>
                <Select value={formData.business_type} onValueChange={(v) => setFormData({ ...formData, business_type: v })}>
                  <SelectTrigger data-testid="user-business-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="petrol_pump">Petrol Pump</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="fl_shop">FL Shop</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="slag_crushing">Slag Crushing</SelectItem>
                    <SelectItem value="stone_crusher">Stone Crusher</SelectItem>
                    <SelectItem value="rice_mill">Rice Mill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role !== 'director' && companies.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Building2 size={14} />Assign Companies</Label>
                  <div className="grid grid-cols-1 gap-1.5 p-3 rounded-lg bg-secondary/50 max-h-[160px] overflow-y-auto">
                    {companies.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-secondary">
                        <Checkbox checked={formData.company_ids.includes(c.id)} onCheckedChange={() => toggleFormCompany(c.id)} data-testid={`assign-co-${c.id}`} />
                        {c.name} <span className="text-xs text-muted-foreground">({c.business_type})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="create-user-submit">
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {pendingUsers.length > 0 && (
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock size={20} className="text-yellow-500" />Pending Approvals ({pendingUsers.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50" data-testid={`pending-${user.id}`}>
                  <div><p className="font-medium text-sm">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleApprove(user.id, 'approve')} data-testid={`approve-${user.id}`}><CheckCircle2 size={16} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleApprove(user.id, 'reject')} data-testid={`reject-${user.id}`}><XCircle size={16} /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => {
          const userCompanies = userCompanyMap[user.id] || [];
          const jobRoleName = getJobRoleName(user.job_role_id);
          return (
            <Card key={user.id} className="hover:shadow-md transition-shadow" data-testid={`user-card-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-base">{user.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><Mail size={12} />{user.email}</div>
                    {user.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone size={12} />{user.phone}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getRoleBadge(user.role)}
                    {jobRoleName && <Badge variant="outline" className="text-[10px]"><Tag size={10} className="mr-1" />{jobRoleName}</Badge>}
                  </div>
                </div>
                {user.business_type && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2"><Briefcase size={12} />{user.business_type.replace(/_/g, ' ')}</div>
                )}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase flex items-center gap-1"><Building2 size={10} />Companies</p>
                    <Button variant="ghost" size="sm" className="h-5 text-xs text-primary p-0" onClick={() => openCompanyEdit(user)} data-testid={`edit-companies-${user.id}`}>
                      <Edit size={10} className="mr-1" />Edit
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {userCompanies.length > 0 ? userCompanies.map(c => (
                      <Badge key={c.id} variant="outline" className="text-[10px]">{c.name}</Badge>
                    )) : <span className="text-xs text-muted-foreground italic">No companies assigned</span>}
                  </div>
                </div>
                <div className="flex gap-1 border-t pt-2 flex-wrap">
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => { setPwUser(user); setPwDialogOpen(true); setNewPassword(''); }} data-testid={`change-pw-${user.id}`}>
                    <KeyRound size={14} className="mr-1" />Password
                  </Button>
                  {jobRoles.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-info hover:text-info hover:bg-info/10" onClick={() => openRoleEdit(user)} data-testid={`change-role-${user.id}`}>
                      <Tag size={14} className="mr-1" />Role
                    </Button>
                  )}
                  {user.role !== 'director' && (
                    <Button variant="ghost" size="sm" className="text-error hover:text-error hover:bg-error/10 ml-auto" onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }} data-testid={`delete-user-${user.id}`}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-error">Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} data-testid="confirm-delete-button"><Trash2 size={16} className="mr-2" />Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={(open) => { setPwDialogOpen(open); if (!open) { setPwUser(null); setNewPassword(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound size={20} className="text-primary" />Change Password</DialogTitle>
            <DialogDescription>Set a new password for <strong>{pwUser?.name}</strong></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" minLength={6} required data-testid="new-password-input" />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" type="button" onClick={() => setPwDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="confirm-change-pw"><KeyRound size={16} className="mr-2" />Change</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Company Assignments Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={(open) => { setCompanyDialogOpen(open); if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 size={20} className="text-primary" />Edit Companies</DialogTitle>
            <DialogDescription>Assign <strong>{editingUser?.name}</strong> to companies</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {companies.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-secondary">
                <Checkbox checked={selectedCompanyIds.includes(c.id)} onCheckedChange={() => toggleCompanyId(c.id)} data-testid={`co-check-${c.id}`} />
                <div><span className="font-medium">{c.name}</span><span className="text-xs text-muted-foreground ml-1">({c.business_type})</span></div>
              </label>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCompanies} data-testid="save-companies-btn"><Building2 size={16} className="mr-2" />Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Job Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={(open) => { setRoleDialogOpen(open); if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag size={20} className="text-primary" />Change Job Role</DialogTitle>
            <DialogDescription>Select a job role for <strong>{editingUser?.name}</strong></DialogDescription>
          </DialogHeader>
          <Select value={selectedJobRoleId} onValueChange={setSelectedJobRoleId}>
            <SelectTrigger data-testid="edit-job-role-select"><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Job Role</SelectItem>
              {jobRoles.map(jr => (
                <SelectItem key={jr.id} value={jr.id}>{jr.name} {jr.description ? `- ${jr.description}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveJobRole} data-testid="save-job-role-btn"><Tag size={16} className="mr-2" />Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
