import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Send, CheckCircle, AlertTriangle, BookOpen, ArrowRight, Loader2 } from 'lucide-react';

export default function AiAccountant({ onTransactionPosted }) {
  const [statement, setStatement] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [history, setHistory] = useState([]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!statement.trim()) return;

    setLoading(true);
    setAnalysis(null);

    try {
      const response = await api.post('/ai-accountant/analyze', { statement: statement.trim() });
      setAnalysis(response.data);
      setHistory(prev => [{ statement: statement.trim(), timestamp: new Date() }, ...prev.slice(0, 9)]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'AI analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPost = async () => {
    if (!analysis?.transactions_to_create?.length) return;
    setPosting(true);

    try {
      const response = await api.post('/ai-accountant/confirm', {
        entries: analysis.transactions_to_create,
      });
      toast.success(response.data.message);
      setAnalysis(null);
      setStatement('');
      if (onTransactionPosted) onTransactionPosted();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post transactions');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="ai-accountant">
      {/* Input Section */}
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen size={20} className="text-accent" />
            AI Chartered Accountant
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter a business transaction in plain language. The AI will generate complete journal entries.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="flex gap-3">
            <Input
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="e.g., Paid ₹50,000 salary to staff via bank transfer"
              className="flex-1"
              disabled={loading}
              data-testid="ai-statement-input"
            />
            <Button
              type="submit"
              disabled={loading || !statement.trim()}
              className="bg-accent hover:bg-accent/90 min-w-[120px]"
              data-testid="ai-analyze-button"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Send size={16} className="mr-2" />
              )}
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {['Paid ₹25,000 rent for office via bank', 'Received ₹1,00,000 from customer for goods sold on credit', 'Purchased raw materials worth ₹50,000 + 18% GST, paid by cheque'].map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStatement(example)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                data-testid={`example-${i}`}
              >
                {example.length > 50 ? example.substring(0, 50) + '...' : example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Clarification Needed */}
      {analysis?.needs_clarification && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-warning mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm mb-1">Clarification Needed</p>
                <p className="text-sm text-muted-foreground">{analysis.clarification_question}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Result */}
      {analysis && !analysis.needs_clarification && (
        <div className="space-y-4">
          {/* Transaction Understanding */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">A. Transaction Understanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
                  <p className="font-medium text-sm">{analysis.understanding?.transaction_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Parties</p>
                  <p className="font-medium text-sm">{analysis.understanding?.parties}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
                  <p className="font-medium text-sm">₹{Number(analysis.understanding?.amount || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Mode</p>
                  <p className="font-medium text-sm capitalize">{analysis.understanding?.payment_mode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Tax Applicable</p>
                  <p className="font-medium text-sm">{analysis.understanding?.tax_applicable ? 'Yes' : 'No'}</p>
                </div>
                {analysis.understanding?.tax_details && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Tax Details</p>
                    <p className="font-medium text-sm">{analysis.understanding.tax_details}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Journal Entry */}
          {analysis.journal_entries?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">B. Journal Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="p-3 text-left text-sm font-semibold">Account</th>
                        <th className="p-3 text-right text-sm font-semibold">Debit (₹)</th>
                        <th className="p-3 text-right text-sm font-semibold">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.journal_entries.map((entry, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}>
                          <td className="p-3 text-sm">
                            {entry.type === 'credit' && <span className="ml-6">To </span>}
                            {entry.account}
                          </td>
                          <td className="p-3 text-sm text-right font-medium">
                            {entry.type === 'debit' ? `₹${Number(entry.amount).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="p-3 text-sm text-right font-medium">
                            {entry.type === 'credit' ? `₹${Number(entry.amount).toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-primary/20">
                      <tr className="font-bold">
                        <td className="p-3 text-sm">Total</td>
                        <td className="p-3 text-sm text-right">
                          ₹{analysis.journal_entries.filter(e => e.type === 'debit').reduce((s, e) => s + Number(e.amount), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-sm text-right">
                          ₹{analysis.journal_entries.filter(e => e.type === 'credit').reduce((s, e) => s + Number(e.amount), 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ledger Impact */}
          {analysis.ledger_impact?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">C. Ledger Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.ledger_impact.map((impact, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <ArrowRight size={14} className="text-accent shrink-0" />
                      <span>{impact}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Statement Impact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">D. Financial Statement Impact</CardTitle>
            </CardHeader>
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

          {/* Assumptions */}
          {analysis.assumptions?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">E. Assumptions Made</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {analysis.assumptions.map((a, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-warning mt-1">*</span> {a}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Confirm & Post */}
          {analysis.transactions_to_create?.length > 0 && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm mb-1">Ready to Post</p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.transactions_to_create.length} transaction(s) will be created in the ledger.
                    </p>
                    <div className="mt-2 space-y-1">
                      {analysis.transactions_to_create.map((t, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {t.transaction_type === 'income' ? '+' : '-'} ₹{Number(t.amount).toLocaleString('en-IN')} — {t.category} ({t.payment_mode})
                        </p>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleConfirmPost}
                    disabled={posting}
                    className="bg-success hover:bg-success/90 min-w-[160px]"
                    data-testid="confirm-post-button"
                  >
                    {posting ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                      <CheckCircle size={16} className="mr-2" />
                    )}
                    {posting ? 'Posting...' : 'Confirm & Post'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && !analysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">Recent Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setStatement(h.statement)}
                  className="w-full text-left p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <p className="text-sm">{h.statement}</p>
                  <p className="text-xs text-muted-foreground mt-1">{h.timestamp.toLocaleTimeString()}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
