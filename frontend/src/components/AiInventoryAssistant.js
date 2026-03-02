import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { invApi } from '@/lib/api';
import { toast } from 'sonner';
import { Send, Bot, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function AiInventoryAssistant({ businessType, onComplete }) {
  const [statement, setStatement] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [parsed, setParsed] = useState(null);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!statement.trim()) return;
    setLoading(true);
    setParsed(null);
    try {
      const res = await invApi.aiAssistant(statement, businessType);
      setParsed(res.data);
      if (res.data.needs_clarification) {
        toast.info(res.data.clarification_question || 'Please provide more details');
      }
    } catch (err) {
      toast.error('AI analysis failed. Try rephrasing.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!parsed?.movements?.length) return;
    setExecuting(true);
    try {
      const res = await invApi.aiExecute(parsed.movements);
      const results = res.data.results;
      const success = results.filter(r => r.status === 'success').length;
      const failed = results.filter(r => r.status === 'error').length;
      toast.success(`Executed: ${success} movements${failed ? `, ${failed} failed` : ''}`);
      setStatement('');
      setParsed(null);
      if (onComplete) onComplete();
    } catch (err) {
      toast.error('Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Card data-testid="ai-inventory-assistant">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot size={20} />AI Inventory Assistant</CardTitle>
        <CardDescription>Describe your inventory transaction in natural language</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAnalyze} className="flex gap-2">
          <Input
            value={statement}
            onChange={e => setStatement(e.target.value)}
            placeholder='e.g. "Purchased 500 MT slag at Rs 2000/MT from ABC Suppliers"'
            className="flex-1"
            data-testid="ai-inv-input"
          />
          <Button type="submit" disabled={loading || !statement.trim()} data-testid="ai-inv-analyze">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </form>

        {parsed && parsed.understood && (
          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <p className="text-sm font-medium">{parsed.summary}</p>
            {parsed.movements?.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded bg-background border text-sm">
                <Badge variant={m.movement_type === 'in' ? 'default' : 'destructive'}>{m.movement_type === 'in' ? 'IN' : 'OUT'}</Badge>
                <div className="flex-1">
                  <span className="font-medium">{m.item_name || m.item_id}</span>
                  <span className="text-muted-foreground ml-2">{m.quantity} @ ₹{m.unit_price}</span>
                  {m.party_name && <span className="text-muted-foreground ml-2">from {m.party_name}</span>}
                </div>
                <span className="font-bold">₹{(m.quantity * m.unit_price).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setParsed(null)} data-testid="ai-inv-discard"><XCircle size={14} className="mr-1" />Discard</Button>
              <Button onClick={handleExecute} disabled={executing} data-testid="ai-inv-execute">
                {executing ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
                Execute {parsed.movements?.length} Movement{parsed.movements?.length > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {parsed && parsed.needs_clarification && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10 p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">{parsed.clarification_question}</p>
          </div>
        )}

        {parsed && parsed.create_new_item && parsed.new_item_suggestion && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-50 dark:bg-blue-900/10 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">Item not found. Suggested: <strong>{JSON.stringify(parsed.new_item_suggestion)}</strong></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
