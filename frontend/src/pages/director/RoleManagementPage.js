import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { roleApi } from '@/lib/api';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, Edit, Loader2, Lock } from 'lucide-react';

const PERMISSION_LABELS = {
  view_dashboard: 'View Dashboard',
  view_inventory: 'View Inventory',
  edit_inventory: 'Edit Inventory',
  view_accounting: 'View Accounting',
  edit_accounting: 'Edit Accounting',
  manage_tasks: 'Manage Tasks',
  manage_users: 'Manage Users / Team',
  manage_indents: 'Manage Indents',
  view_reports: 'View Reports',
  create_reports: 'Create Reports',
  manage_companies: 'Manage Companies',
  view_audit_log: 'View Audit Log',
  view_tracking: 'View Tracking',
  view_reconciliation: 'Reconciliation',
  manage_roles: 'Manage Roles',
  view_settings: 'View Settings',
  view_executive: 'Executive Dashboard',
  view_daily_summary: 'Daily Summary',
  view_payroll: 'View Payroll',
};

export default function RoleManagementPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', permissions: [] });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([roleApi.getAll(), roleApi.getPermissions()]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } catch { toast.error('Failed to load roles'); }
    finally { setLoading(false); }
  };

  const togglePermission = (perm) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await roleApi.update(editingRole.id, form);
        toast.success('Role updated');
      } else {
        await roleApi.create(form);
        toast.success('Role created');
      }
      setDialogOpen(false);
      setEditingRole(null);
      setForm({ name: '', description: '', permissions: [] });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save role');
    }
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setForm({ name: role.name, description: role.description || '', permissions: role.permissions || [] });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this role?')) return;
    try {
      await roleApi.remove(id);
      toast.success('Role deleted');
      fetchData();
    } catch { toast.error('Failed to delete role'); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  return (
    <div className="space-y-6" data-testid="role-management-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary flex items-center gap-3"><Shield size={28} />Role Management</h1>
          <p className="text-muted-foreground mt-1">Define custom job roles and permissions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingRole(null); setForm({ name: '', description: '', permissions: [] }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="create-role-btn"><Plus size={16} className="mr-2" />Create Role</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required data-testid="role-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} data-testid="role-desc-input" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Lock size={14} />Permissions</Label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-secondary/50">
                  {permissions.map(perm => (
                    <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-secondary">
                      <Checkbox checked={form.permissions.includes(perm)} onCheckedChange={() => togglePermission(perm)} data-testid={`perm-${perm}`} />
                      {PERMISSION_LABELS[perm] || perm.replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="save-role-btn">{editingRole ? 'Update Role' : 'Create Role'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {roles.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><Shield size={48} className="mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No custom roles defined yet. Create your first role to get started.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(role => (
            <Card key={role.id} className="hover:shadow-md transition-shadow" data-testid={`role-card-${role.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2"><Shield size={18} className="text-accent" />{role.name}</CardTitle>
                    {role.description && <CardDescription className="mt-1">{role.description}</CardDescription>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(role)} data-testid={`edit-role-${role.id}`}><Edit size={14} /></Button>
                    <Button variant="ghost" size="sm" className="text-error hover:text-error" onClick={() => handleDelete(role.id)} data-testid={`delete-role-${role.id}`}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2 uppercase">Permissions ({role.permissions?.length || 0})</p>
                <div className="flex flex-wrap gap-1">
                  {(role.permissions || []).map(p => (
                    <Badge key={p} variant="outline" className="text-xs">{PERMISSION_LABELS[p] || p.replace(/_/g, ' ')}</Badge>
                  ))}
                  {(!role.permissions || role.permissions.length === 0) && <p className="text-xs text-muted-foreground">No permissions assigned</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
