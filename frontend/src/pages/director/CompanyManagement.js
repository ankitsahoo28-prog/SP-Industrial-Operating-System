import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { companyApi, userApi } from '@/lib/api';
import { toast } from 'sonner';
import { Building2, Plus, Edit, Trash2, RotateCcw, Users, Power, PowerOff, UserPlus, UserMinus } from 'lucide-react';

const BIZ_TYPES = [
  { value: 'petrol_pump', label: 'Petrol Pump' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'fl_shop', label: 'FL Shop' },
  { value: 'transport', label: 'Transport' },
  { value: 'slag_crushing', label: 'Slag Crushing' },
  { value: 'stone_crusher', label: 'Stone Crusher' },
  { value: 'rice_mill', label: 'Rice Mill' },
  { value: 'custom', label: '+ Custom Type...' },
];

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [form, setForm] = useState({ name: '', business_type: 'petrol_pump', fy_start: 'April', gst_number: '', currency: 'INR' });
  const [customBizType, setCustomBizType] = useState('');
  const [assignUserId, setAssignUserId] = useState('');

  const fetchCompanies = async () => {
    const res = await companyApi.getAll(showDeleted);
    setCompanies(res.data);
  };

  useEffect(() => { fetchCompanies(); }, [showDeleted]);
  useEffect(() => { userApi.getUsers().then(r => setAllUsers(r.data)).catch(() => {}); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...form };
      if (form.business_type === 'custom') {
        if (!customBizType.trim()) { toast.error('Please enter a custom business type'); return; }
        submitData.business_type = customBizType.trim().toLowerCase().replace(/\s+/g, '_');
      }
      await companyApi.create(submitData);
      toast.success('Company created with Chart of Accounts');
      setCreateDialog(false);
      setForm({ name: '', business_type: 'petrol_pump', fy_start: 'April', gst_number: '', currency: 'INR' });
      setCustomBizType('');
      fetchCompanies();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await companyApi.update(selectedCompany.id, form);
      toast.success('Company updated');
      setEditDialog(false);
      fetchCompanies();
    } catch (err) { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this company? Data will be preserved but hidden.')) return;
    await companyApi.remove(id);
    toast.success('Company deleted');
    fetchCompanies();
  };

  const handleRestore = async (id) => {
    await companyApi.restore(id);
    toast.success('Company restored');
    fetchCompanies();
  };

  const openAssign = async (company) => {
    setSelectedCompany(company);
    const res = await companyApi.getUsers(company.id);
    setCompanyUsers(res.data);
    setAssignDialog(true);
  };

  const handleAssign = async () => {
    if (!assignUserId) return;
    await companyApi.assignUser(assignUserId, selectedCompany.id);
    toast.success('User assigned');
    const res = await companyApi.getUsers(selectedCompany.id);
    setCompanyUsers(res.data);
    setAssignUserId('');
  };

  const handleRemoveUser = async (userId) => {
    await companyApi.removeUser(userId, selectedCompany.id);
    toast.success('User removed');
    const res = await companyApi.getUsers(selectedCompany.id);
    setCompanyUsers(res.data);
  };

  const statusColor = (s) => s === 'active' ? 'default' : s === 'inactive' ? 'secondary' : 'destructive';

  return (
    <div className="space-y-6" data-testid="company-management-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-heading font-bold text-primary flex items-center gap-3"><Building2 size={32} />Company Management</h1>
          <p className="text-muted-foreground mt-1">Create, manage, and control multi-company data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDeleted(!showDeleted)} data-testid="toggle-deleted">
            {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
          </Button>
          <Dialog open={createDialog} onOpenChange={setCreateDialog}>
            <DialogTrigger asChild><Button data-testid="create-company-btn"><Plus size={16} className="mr-2" />New Company</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Company</DialogTitle><DialogDescription>Auto-generates Chart of Accounts and default settings</DialogDescription></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1"><Label>Company Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required data-testid="company-name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Business Type</Label>
                    <Select value={form.business_type} onValueChange={v => setForm(f => ({ ...f, business_type: v }))}>
                      <SelectTrigger data-testid="company-biz-type"><SelectValue /></SelectTrigger>
                      <SelectContent>{BIZ_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.business_type === 'custom' && (
                      <Input
                        value={customBizType}
                        onChange={e => setCustomBizType(e.target.value)}
                        placeholder="Enter custom type (e.g. bakery)"
                        className="mt-2"
                        required
                        data-testid="custom-biz-type-input"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>FY Start</Label>
                    <Select value={form.fy_start} onValueChange={v => setForm(f => ({ ...f, fy_start: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['January','April','July','October'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>GST Number</Label><Input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="Optional" data-testid="company-gst" /></div>
                  <div className="space-y-1"><Label>Currency</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} data-testid="company-currency" /></div>
                </div>
                <Button type="submit" className="w-full" data-testid="company-create-submit">Create Company</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Business Type</TableHead>
                <TableHead>FY Start</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map(c => (
                <TableRow key={c.id} data-testid={`company-row-${c.id}`}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="capitalize">{c.business_type?.replace('_', ' ')}</TableCell>
                  <TableCell>{c.fy_start}</TableCell>
                  <TableCell>{c.gst_number || '-'}</TableCell>
                  <TableCell>{c.currency}</TableCell>
                  <TableCell><Badge variant={statusColor(c.status)}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setSelectedCompany(c); setForm({ name: c.name, business_type: c.business_type, fy_start: c.fy_start, gst_number: c.gst_number || '', currency: c.currency }); setEditDialog(true); }}><Edit size={14} /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openAssign(c)} data-testid={`assign-users-${c.id}`}><Users size={14} /></Button>
                      {c.status === 'active' && <Button size="icon" variant="ghost" onClick={async () => { await companyApi.deactivate(c.id); fetchCompanies(); }}><PowerOff size={14} /></Button>}
                      {c.status === 'inactive' && <Button size="icon" variant="ghost" onClick={async () => { await companyApi.activate(c.id); fetchCompanies(); }}><Power size={14} /></Button>}
                      {c.status !== 'deleted' && <Button size="icon" variant="ghost" className="text-error" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></Button>}
                      {c.status === 'deleted' && <Button size="icon" variant="ghost" className="text-success" onClick={() => handleRestore(c.id)} data-testid={`restore-${c.id}`}><RotateCcw size={14} /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Company</DialogTitle><DialogDescription>Update company details</DialogDescription></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <div className="space-y-1"><Label>Company Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-1">
              <Label>Business Type</Label>
              <Select value={form.business_type} onValueChange={v => setForm(f => ({ ...f, business_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BIZ_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Users Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage Users — {selectedCompany?.name}</DialogTitle><DialogDescription>Assign or remove users from this company</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger className="flex-1" data-testid="assign-user-select"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {allUsers.filter(u => u.role !== 'director' && !companyUsers.find(cu => cu.id === u.id)).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssign} data-testid="assign-user-btn"><UserPlus size={14} className="mr-1" />Assign</Button>
            </div>
            {companyUsers.length > 0 && (
              <div className="space-y-2">
                {companyUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded border">
                    <div><span className="font-medium">{u.name}</span><span className="text-sm text-muted-foreground ml-2">{u.email} - {u.role}</span></div>
                    <Button size="sm" variant="ghost" className="text-error" onClick={() => handleRemoveUser(u.id)}><UserMinus size={14} /></Button>
                  </div>
                ))}
              </div>
            )}
            {companyUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users assigned yet</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
