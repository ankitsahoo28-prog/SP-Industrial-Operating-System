import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { aiAssistantApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Brain, Plus, Trash2, RefreshCw, ArrowRight, BookOpen, Loader2,
} from 'lucide-react';

export default function AiSmartLearning({ companyId }) {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newOriginal, setNewOriginal] = useState('');
  const [newCorrected, setNewCorrected] = useState('');
  const [newField, setNewField] = useState('name');
  const [saving, setSaving] = useState(false);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiAssistantApi.mappings(companyId);
      setMappings(res.data || []);
    } catch { toast.error('Failed to load mappings'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  const handleAdd = async () => {
    if (!newOriginal.trim() || !newCorrected.trim()) {
      toast.error('Both fields are required');
      return;
    }
    setSaving(true);
    try {
      await aiAssistantApi.learn({
        original: newOriginal.trim(),
        corrected: newCorrected.trim(),
        field: newField,
        company_id: companyId,
      });
      toast.success('Correction saved! AI will use this in future.');
      setNewOriginal('');
      setNewCorrected('');
      setShowAdd(false);
      loadMappings();
    } catch { toast.error('Failed to save correction'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (mappingId) => {
    try {
      await aiAssistantApi.deleteMapping(mappingId);
      toast.success('Mapping deleted');
      setMappings(prev => prev.filter(m => m.id !== mappingId));
    } catch { toast.error('Failed to delete'); }
  };

  const fieldGroups = {
    name: mappings.filter(m => m.field === 'name' || !m.field),
    account: mappings.filter(m => m.field === 'account'),
    product: mappings.filter(m => m.field === 'product'),
    partner: mappings.filter(m => m.field === 'partner'),
    other: mappings.filter(m => m.field && !['name', 'account', 'product', 'partner'].includes(m.field)),
  };

  return (
    <div className="space-y-4" data-testid="ai-smart-learning">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Brain size={16} className="text-primary" />
            Learned Corrections ({mappings.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            The AI uses these corrections to better interpret your documents and messages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadMappings} disabled={loading} data-testid="mappings-refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="add-mapping-btn">
            <Plus size={14} className="mr-1" />Add Correction
          </Button>
        </div>
      </div>

      {/* How it works */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <BookOpen size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How Smart Learning works:</p>
              <p>When you edit an AI-generated entry before approving, the system detects changes and asks if you want to save the correction.</p>
              <p>You can also manually add corrections here. For example: if a vendor's invoice says "ABC Traders" but your system uses "ABC Trading Co.", add that mapping.</p>
              <p>The AI will automatically apply these corrections in future document processing.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mappings List */}
      {mappings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No corrections learned yet</p>
          <p className="text-xs">Add corrections manually or they'll be captured as you edit AI entries</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(fieldGroups).map(([group, items]) => {
            if (items.length === 0) return null;
            const labels = { name: 'Name Corrections', account: 'Account Mappings', product: 'Product Mappings', partner: 'Partner Mappings', other: 'Other' };
            return (
              <div key={group}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {labels[group]} ({items.length})
                </h4>
                <div className="space-y-1.5">
                  {items.map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card/50 hover:bg-card group transition-colors" data-testid={`mapping-${m.id}`}>
                      <div className="flex-1 flex items-center gap-2 min-w-0 text-sm">
                        <code className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 text-xs truncate max-w-[200px]">{m.original}</code>
                        <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                        <code className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 text-xs truncate max-w-[200px]">{m.corrected}</code>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{m.field || 'name'}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(m.id)} data-testid={`delete-mapping-${m.id}`}>
                        <Trash2 size={12} className="text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={16} />Add Correction Mapping
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Original Text (what appears in documents)</Label>
              <Input value={newOriginal} onChange={e => setNewOriginal(e.target.value)}
                placeholder='e.g. "ABC Traders"' className="mt-1" data-testid="mapping-original-input" />
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight size={20} className="text-muted-foreground" />
            </div>
            <div>
              <Label className="text-xs">Corrected Text (what it should map to)</Label>
              <Input value={newCorrected} onChange={e => setNewCorrected(e.target.value)}
                placeholder='e.g. "ABC Trading Co."' className="mt-1" data-testid="mapping-corrected-input" />
            </div>
            <div>
              <Label className="text-xs">Field Type</Label>
              <Select value={newField} onValueChange={setNewField}>
                <SelectTrigger className="mt-1" data-testid="mapping-field-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">General Name</SelectItem>
                  <SelectItem value="product">Product Name</SelectItem>
                  <SelectItem value="partner">Partner/Vendor Name</SelectItem>
                  <SelectItem value="account">Account Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !newOriginal.trim() || !newCorrected.trim()} data-testid="save-mapping-btn">
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
