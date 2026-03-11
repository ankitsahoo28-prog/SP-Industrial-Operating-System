import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { odooApi } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, XCircle, BookOpen } from 'lucide-react';
import { fmtd, LoadingSpinner, cleanParams } from './helpers';

export function JournalEntriesTab({ companyId }) {
  const [entries, setEntries] = useState([]);
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({ journal_id: '', narration: '', lines: [{ account_id: '', debit: 0, credit: 0, name: '' }, { account_id: '', debit: 0, credit: 0, name: '' }] });

  const load = useCallback(() => {
    setLoading(true);
    const params = cleanParams({ company_id: companyId });
    Promise.all([
      odooApi.moves.list({ ...params, move_type: 'entry', limit: 200 }),
      odooApi.journals.list(params),
      odooApi.accounts.list(params),
    ]).then(([m, j, a]) => { setEntries(m.data); setJournals(j.data); setAccounts(a.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { account_id: '', debit: 0, credit: 0, name: '' }] }));
  const updateLine = (i, field, val) => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [field]: val } : l) }));

  const handleCreate = async () => {
    if (!form.journal_id) { toast.error('Select a journal'); return; }
    const validLines = form.lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) { toast.error('At least 2 lines required'); return; }
    const totalD = validLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalC = validLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalD - totalC) > 0.01) { toast.error(`Entry must balance! Debit=${totalD.toFixed(2)}, Credit=${totalC.toFixed(2)}`); return; }
    try {
      const res = await odooApi.moves.create({ ...form, lines: validLines.map(l => ({ ...l, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 })) });
      await odooApi.moves.post(res.data.id);
      toast.success('Journal entry posted'); setDlgOpen(false);
      setForm({ journal_id: '', narration: '', lines: [{ account_id: '', debit: 0, credit: 0, name: '' }, { account_id: '', debit: 0, credit: 0, name: '' }] });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-4" data-testid="acc-entries">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Journal Entries</h2>
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" data-testid="new-entry-btn"><Plus size={16} className="mr-1" />New Entry</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Journal Entry</DialogTitle><DialogDescription>Create a balanced double-entry journal entry.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Journal</Label>
                  <Select value={form.journal_id} onValueChange={v => setForm(f => ({ ...f, journal_id: v }))}>
                    <SelectTrigger data-testid="je-journal"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{journals.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Narration</Label><Input value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} /></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2"><Label className="font-semibold">Lines</Label><Button size="sm" variant="outline" onClick={addLine}><Plus size={14} className="mr-1" />Line</Button></div>
                {form.lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2 p-2 bg-muted/50 rounded">
                    <div className="col-span-5">
                      <Select value={line.account_id} onValueChange={v => updateLine(i, 'account_id', v)}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Account..." /></SelectTrigger>
                        <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.code} - {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input type="number" placeholder="Debit" value={line.debit || ''} onChange={e => updateLine(i, 'debit', e.target.value)} /></div>
                    <div className="col-span-3"><Input type="number" placeholder="Credit" value={line.credit || ''} onChange={e => updateLine(i, 'credit', e.target.value)} /></div>
                    <div className="col-span-1"><Button variant="ghost" size="sm" className="text-error" onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}><XCircle size={14} /></Button></div>
                  </div>
                ))}
                <div className={`flex justify-between items-center mt-2 p-2 rounded ${balanced ? 'bg-success/10' : 'bg-error/10'}`}>
                  <span className="text-sm">Debit: {fmtd(totalDebit)} | Credit: {fmtd(totalCredit)}</span>
                  <Badge className={balanced ? 'bg-success/20 text-success border-0' : 'bg-error/20 text-error border-0'}>{balanced ? 'Balanced' : `Diff: ${fmtd(totalDebit - totalCredit)}`}</Badge>
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!balanced} data-testid="create-entry-submit"><BookOpen size={16} className="mr-2" />Create & Post</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <LoadingSpinner /> : entries.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No journal entries yet</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Journal</TableHead><TableHead>Narration</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{entries.map(e => (
            <TableRow key={e.id}><TableCell className="font-mono text-sm">{e.name}</TableCell><TableCell>{e.date}</TableCell><TableCell>{e.journal_name}</TableCell><TableCell className="max-w-[200px] truncate">{e.narration || e.ref || '-'}</TableCell><TableCell className="text-right">{fmtd(e.total_debit)}</TableCell><TableCell className="text-right">{fmtd(e.total_credit)}</TableCell><TableCell><Badge variant="outline" className={e.state === 'posted' ? 'text-success' : ''}>{e.state}</Badge></TableCell></TableRow>
          ))}</TableBody></Table></div>
      )}
    </div>
  );
}
