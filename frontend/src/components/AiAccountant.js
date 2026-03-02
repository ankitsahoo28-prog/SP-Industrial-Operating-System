import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { bookkeepingApi } from '@/lib/api';
import { Send, CheckCircle, AlertTriangle, BookOpen, ArrowRight, Loader2 } from 'lucide-react';

export default function AiAccountant({ onEntryPosted }) {
  const [statement, setStatement] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!statement.trim()) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const response = await bookkeepingApi.analyzeTransaction(statement.trim());
      setAnalysis(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'AI analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPost = async () => {
    if (!analysis?.journal_lines?.length) return;
    setPosting(true);
    try {
      const response = await bookkeepingApi.postJournalEntry(
        analysis.narration || statement,
        analysis.journal_lines
      );
      toast.success(response.data.message);
      setAnalysis(null);
      setStatement('');
      if (onEntryPosted) onEntryPosted();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post journal entry');
    } finally {
      setPosting(false);
    }
  };

  const totalDebit = (analysis?.journal_lines || []).reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = (analysis?.journal_lines || []).reduce((s, l) => s + (l.credit || 0), 0);

  return (
    <div className="space-y-5" data-testid="ai-accountant">
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen size={20} className="text-accent" />
            AI Chartered Accountant
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Type a transaction in plain language. AI generates journal entries using double-entry bookkeeping.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="flex gap-3">
            <Input
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder='e.g., "Sold goods worth 200000 to Ramesh on credit"'
              className="flex-1"
              disabled={loading}
              data-testid="ai-statement-input"
            />
            <Button type="submit" disabled={loading || !statement.trim()} className="bg-accent hover:bg-accent/90 min-w-[120px]" data-testid="ai-analyze-button">
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {['Sold goods worth 200000 to Ramesh on credit', 'Paid salary 30000 by bank', 'Purchased materials 50000 cash', 'Received 100000 from Suresh against outstanding'].map((ex, i) => (
              <button key={i} type="button" onClick={() => setStatement(ex)} className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors" data-testid={`example-${i}`}>
                {ex.length > 45 ? ex.substring(0, 45) + '...' : ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {analysis?.needs_clarification && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-warning mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm mb-1">Clarification Needed</p>
              <p className="text-sm text-muted-foreground">{analysis.clarification_question}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && !analysis.needs_clarification && (
        <div className="space-y-4">
          {/* A. Understanding */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">A. Transaction Understanding</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {[
                  ['Type', analysis.understanding?.transaction_type],
                  ['Parties', analysis.understanding?.parties],
                  ['Amount', `₹${Number(analysis.understanding?.amount || 0).toLocaleString('en-IN')}`],
                  ['Payment', analysis.understanding?.payment_mode],
                  ['Tax', analysis.understanding?.tax_applicable ? 'Yes' : 'No'],
                  analysis.understanding?.tax_details ? ['Tax Details', analysis.understanding.tax_details] : null,
                ].filter(Boolean).map(([label, val], i) => (
                  <div key={i}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="font-medium capitalize">{val}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* B. Journal Entry */}
          {analysis.journal_lines?.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">B. Journal Entry</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="p-3 text-left text-sm font-semibold">Account</th>
                      <th className="p-3 text-right text-sm font-semibold">Debit (₹)</th>
                      <th className="p-3 text-right text-sm font-semibold">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.journal_lines.map((line, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? '' : 'bg-secondary/20'}>
                        <td className="p-3 text-sm">{line.credit > 0 && <span className="ml-4">To </span>}{line.account_name}</td>
                        <td className="p-3 text-sm text-right font-medium">{line.debit > 0 ? `₹${Number(line.debit).toLocaleString('en-IN')}` : '-'}</td>
                        <td className="p-3 text-sm text-right font-medium">{line.credit > 0 ? `₹${Number(line.credit).toLocaleString('en-IN')}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-primary/20 font-bold">
                    <tr>
                      <td className="p-3 text-sm">Total</td>
                      <td className="p-3 text-sm text-right">₹{totalDebit.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-sm text-right">₹{totalCredit.toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
                {Math.abs(totalDebit - totalCredit) > 0.01 && (
                  <p className="text-error text-xs mt-2 font-semibold">Warning: Entry is unbalanced!</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* C. Ledger Impact */}
          {analysis.ledger_impact?.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">C. Ledger Impact</CardTitle></CardHeader>
              <CardContent>
                {analysis.ledger_impact.map((impact, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm py-1">
                    <ArrowRight size={14} className="text-accent shrink-0" />
                    <span>{impact}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* D. Financial Impact */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">D. Financial Statement Impact</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Profit & Loss</p>
                  <p className="text-sm">{analysis.financial_impact?.pnl_effect}</p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance Sheet</p>
                  <p className="text-sm">{analysis.financial_impact?.balance_sheet_effect}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* E. Assumptions */}
          {analysis.assumptions?.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">E. Assumptions</CardTitle></CardHeader>
              <CardContent>
                {analysis.assumptions.map((a, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground py-0.5">* {a}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Confirm */}
          {analysis.journal_lines?.length > 0 && Math.abs(totalDebit - totalCredit) < 0.01 && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm">Ready to Post to Ledger</p>
                  <p className="text-xs text-muted-foreground mt-1">This will create a journal entry and update all affected ledger balances.</p>
                </div>
                <Button onClick={handleConfirmPost} disabled={posting} className="bg-success hover:bg-success/90 min-w-[160px]" data-testid="confirm-post-button">
                  {posting ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                  {posting ? 'Posting...' : 'Confirm & Post'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
