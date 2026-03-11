import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { odooApi } from '@/lib/api';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import {
  Bot, Send, Loader2, Sparkles, FileText, Tag, GitMerge, MessageSquare,
  TrendingUp, Shield, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp,
  Zap, Brain, ArrowUpDown, Camera, Upload, X, Image
} from 'lucide-react';
import { cleanParams } from './helpers';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function AiChatSection({ companyId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoPost, setAutoPost] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await odooApi.ai.chat({ message: userMsg, company_id: companyId, auto_post: autoPost });
      setMessages(prev => [...prev, {
        role: 'ai', data: res.data,
        text: res.data.response_text || 'Processed your request.',
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I encountered an error. Please try again.', error: true }]);
    }
    setLoading(false);
  };

  const quickActions = [
    "Record rent payment of ₹25,000 from bank",
    "Create invoice for ABC Corp: 10 hours consulting at ₹5,000/hr",
    "Paid electricity bill ₹8,500 in cash",
    "Received ₹1,50,000 from customer XYZ via bank transfer",
    "What's my total revenue this month?",
  ];

  return (
    <div className="space-y-3" data-testid="ai-chat-section">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Switch id="auto-post" checked={autoPost} onCheckedChange={setAutoPost} data-testid="ai-auto-post" />
          <Label htmlFor="auto-post" className="text-xs">Auto-execute entries</Label>
        </div>
        {autoPost && <Badge className="bg-warning/20 text-warning border-0 text-[10px]">AI will create entries automatically</Badge>}
      </div>

      <div ref={scrollRef} className="h-[380px] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={48} className="mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm mb-4">Ask me to create entries, invoices, or answer financial questions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickActions.map((q, i) => (
                <Button key={i} variant="outline" size="sm" className="text-xs h-auto py-1.5 whitespace-normal text-left max-w-[220px]"
                  onClick={() => { setInput(q); }} data-testid={`quick-action-${i}`}>
                  <Zap size={10} className="mr-1 shrink-0" />{q}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user' ? 'bg-primary text-primary-foreground' :
              msg.error ? 'bg-error/10 text-error border border-error/20' :
              'bg-muted'
            }`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.data?.executed && (
                <Badge className="mt-1.5 bg-success/20 text-success border-0 text-[10px]">
                  <CheckCircle2 size={10} className="mr-1" />Entry created
                </Badge>
              )}
              {msg.data?.action_type === 'journal_entry' && msg.data?.journal_entry && !msg.data?.executed && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">View proposed entry</summary>
                  <div className="mt-1 space-y-0.5 font-mono">
                    {msg.data.journal_entry.lines?.map((l, li) => (
                      <div key={li} className="flex justify-between gap-2">
                        <span className="truncate">{l.account_name}</span>
                        <span>{l.debit > 0 ? `Dr ${fmt(l.debit)}` : `Cr ${fmt(l.credit)}`}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {msg.data?.suggestions?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.data.suggestions.map((s, si) => (
                    <Button key={si} variant="ghost" size="sm" className="text-[10px] h-auto py-0.5 px-1.5"
                      onClick={() => setInput(s)}>{s}</Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2"><Loader2 size={16} className="animate-spin" /></div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g., Record salary payment of ₹50,000..."
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} disabled={loading} data-testid="ai-chat-input" className="flex-1" />
        <Button onClick={sendMessage} disabled={loading || !input.trim()} data-testid="ai-chat-send">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}

function AiInvoiceExtractor({ companyId }) {
  const [desc, setDesc] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const extract = async () => {
    if (!desc.trim()) return;
    setLoading(true);
    try {
      const res = await odooApi.ai.invoiceExtract({ description: desc, company_id: companyId });
      setResult(res.data);
    } catch { toast.error('Extraction failed'); }
    setLoading(false);
  };

  return (
    <div className="space-y-3" data-testid="ai-invoice-extract">
      <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
        placeholder="Describe the invoice... e.g., 'Invoice from ABC Suppliers for 50 bags of cement at ₹350 each, plus 18% GST, invoice number INV-2024-001, due in 30 days'" data-testid="ai-invoice-desc" />
      <Button onClick={extract} disabled={loading || !desc.trim()} className="w-full" data-testid="ai-invoice-extract-btn">
        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <FileText size={16} className="mr-2" />}Extract Invoice Data
      </Button>
      {result && !result.error && (
        <Card><CardContent className="p-3 space-y-2 text-sm">
          <div className="flex justify-between"><Badge variant="outline" className="capitalize">{result.move_type?.replace('_', ' ')}</Badge><Badge className="bg-success/20 text-success border-0">{Math.round((result.confidence || 0) * 100)}% confidence</Badge></div>
          {result.partner_name && <p><span className="text-muted-foreground">Partner:</span> <strong>{result.partner_name}</strong></p>}
          {result.ref && <p><span className="text-muted-foreground">Ref:</span> {result.ref}</p>}
          {result.invoice_lines?.map((l, i) => (
            <div key={i} className="flex justify-between bg-muted/50 p-2 rounded">
              <span>{l.product_name} x{l.quantity}</span>
              <span className="font-semibold">{fmt(l.unit_price * l.quantity)}</span>
            </div>
          ))}
          {result.tax_info && <p className="text-xs text-muted-foreground">Tax: {result.tax_info}</p>}
          {result.notes && <p className="text-xs text-muted-foreground italic">{result.notes}</p>}
          <Button size="sm" className="w-full mt-2" onClick={() => toast.info('Use the Invoicing tab to create this invoice with the extracted data')}>
            <Sparkles size={14} className="mr-1" />Create Invoice from Extraction
          </Button>
        </CardContent></Card>
      )}
    </div>
  );
}

function AiCategorizer({ companyId }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const categorize = async () => {
    if (!desc.trim() || !amount) return;
    setLoading(true);
    try {
      const res = await odooApi.ai.categorize({ description: desc, amount: parseFloat(amount), company_id: companyId });
      setResult(res.data);
    } catch { toast.error('Categorization failed'); }
    setLoading(false);
  };

  return (
    <div className="space-y-3" data-testid="ai-categorize">
      <div className="grid grid-cols-3 gap-2">
        <Input className="col-span-2" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g., Office supplies from Staples" data-testid="ai-cat-desc" />
        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" data-testid="ai-cat-amount" />
      </div>
      <Button onClick={categorize} disabled={loading || !desc.trim() || !amount} size="sm" className="w-full" data-testid="ai-cat-btn">
        {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Tag size={14} className="mr-1" />}Categorize
      </Button>
      {result && !result.error && (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded"><p className="text-[10px] text-muted-foreground">DEBIT</p><p className="font-semibold">{result.debit_account?.code} - {result.debit_account?.name}</p><p className="text-xs text-muted-foreground">{result.debit_account?.reason}</p></div>
            <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded"><p className="text-[10px] text-muted-foreground">CREDIT</p><p className="font-semibold">{result.credit_account?.code} - {result.credit_account?.name}</p><p className="text-xs text-muted-foreground">{result.credit_account?.reason}</p></div>
          </div>
          <div className="flex gap-2"><Badge variant="outline" className="capitalize">{result.category}</Badge><Badge className="bg-primary/20 text-primary border-0">{Math.round((result.confidence || 0) * 100)}%</Badge>{result.tax_applicable && <Badge className="bg-warning/20 text-warning border-0">Tax: {result.suggested_tax_rate || 'applicable'}</Badge>}</div>
          {result.alternative_suggestions?.length > 0 && (
            <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Alternatives</summary>
              {result.alternative_suggestions.map((a, i) => <p key={i} className="mt-1">Dr: {a.debit} → Cr: {a.credit} ({a.reason})</p>)}
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function AiReconciliation({ companyId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await odooApi.ai.reconcileSuggest({ company_id: companyId });
      setResult(res.data);
    } catch { toast.error('Reconciliation analysis failed'); }
    setLoading(false);
  };

  return (
    <div className="space-y-3" data-testid="ai-reconcile">
      <Button onClick={analyze} disabled={loading} className="w-full" data-testid="ai-reconcile-btn">
        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <GitMerge size={16} className="mr-2" />}Analyze for Reconciliation
      </Button>
      {result && (
        <div className="space-y-2">
          {result.summary && <p className="text-sm">{result.summary}</p>}
          {result.suggestions?.map((s, i) => (
            <Card key={i}><CardContent className="p-3 text-sm">
              <div className="flex items-start gap-2">
                <Badge className={s.severity === 'high' ? 'bg-error/20 text-error' : s.severity === 'medium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'} style={{ border: 0, fontSize: '10px' }}>{s.match_type}</Badge>
                <div><p>{s.description}</p><p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                  {s.action && <p className="text-xs mt-1 font-medium">{s.action}</p>}
                </div>
              </div>
            </CardContent></Card>
          ))}
          {result.tips?.length > 0 && (
            <div className="bg-muted/50 p-2 rounded text-xs space-y-1">
              {result.tips.map((t, i) => <p key={i} className="flex items-start gap-1"><Info size={12} className="shrink-0 mt-0.5 text-info" />{t}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiFinancialQA({ companyId }) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await odooApi.ai.financialQA({ question, company_id: companyId });
      setResult(res.data);
    } catch { toast.error('Failed to get answer'); }
    setLoading(false);
  };

  const samples = ["What's my profit this month?", "Top 5 expenses?", "Revenue vs last month?", "Outstanding receivables?"];

  return (
    <div className="space-y-3" data-testid="ai-qa">
      <div className="flex gap-2">
        <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about your finances..."
          onKeyDown={e => e.key === 'Enter' && ask()} className="flex-1" data-testid="ai-qa-input" />
        <Button onClick={ask} disabled={loading || !question.trim()} data-testid="ai-qa-btn">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
        </Button>
      </div>
      {!result && <div className="flex flex-wrap gap-1">{samples.map((s, i) => <Button key={i} variant="outline" size="sm" className="text-xs h-7" onClick={() => setQuestion(s)}>{s}</Button>)}</div>}
      {result && (
        <div className="space-y-2 text-sm">
          <p className="whitespace-pre-wrap">{result.answer}</p>
          {result.key_metrics?.length > 0 && (
            <div className="grid grid-cols-2 gap-2">{result.key_metrics.map((m, i) => (
              <div key={i} className="bg-muted/50 p-2 rounded"><p className="text-[10px] text-muted-foreground">{m.label}</p><p className="font-bold">{m.value}</p>
                {m.trend && <Badge variant="outline" className={`text-[10px] ${m.trend === 'up' ? 'text-success' : m.trend === 'down' ? 'text-error' : ''}`}>{m.trend}</Badge>}
              </div>
            ))}</div>
          )}
          {result.insights?.length > 0 && result.insights.map((ins, i) => <p key={i} className="text-xs flex gap-1"><Sparkles size={12} className="shrink-0 mt-0.5 text-warning" />{ins}</p>)}
        </div>
      )}
    </div>
  );
}

function AiCashForecast({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const forecast = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odooApi.ai.cashForecast(cleanParams({ company_id: companyId }));
      setData(res.data);
    } catch { toast.error('Forecast failed'); }
    setLoading(false);
  }, [companyId]);

  return (
    <div className="space-y-3" data-testid="ai-forecast">
      <Button onClick={forecast} disabled={loading} className="w-full" data-testid="ai-forecast-btn">
        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <TrendingUp size={16} className="mr-2" />}Generate Cash Flow Forecast
      </Button>
      {data && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="bg-muted/50 p-3 rounded flex-1 text-center"><p className="text-[10px] text-muted-foreground">Current Cash</p><p className="text-lg font-bold">{fmt(data.current_cash)}</p></div>
            <div className={`p-3 rounded flex-1 text-center ${data.risk_level === 'low' ? 'bg-success/10' : data.risk_level === 'high' ? 'bg-error/10' : 'bg-warning/10'}`}>
              <p className="text-[10px] text-muted-foreground">Risk Level</p>
              <p className={`text-lg font-bold capitalize ${data.risk_level === 'low' ? 'text-success' : data.risk_level === 'high' ? 'text-error' : 'text-warning'}`}>{data.risk_level}</p>
            </div>
          </div>
          {data.forecast?.length > 0 && (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.forecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="inflow" stroke="#10B981" strokeWidth={2} name="Inflow" />
                  <Line type="monotone" dataKey="outflow" stroke="#EF4444" strokeWidth={2} name="Outflow" />
                  <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} name="Balance" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.insights?.map((ins, i) => <p key={i} className="text-xs flex gap-1"><Info size={12} className="shrink-0 mt-0.5 text-info" />{ins}</p>)}
          {data.recommendations?.map((r, i) => <p key={i} className="text-xs flex gap-1"><Sparkles size={12} className="shrink-0 mt-0.5 text-warning" />{r}</p>)}
        </div>
      )}
    </div>
  );
}

function AiAnomalies({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odooApi.ai.anomalies(cleanParams({ company_id: companyId }));
      setData(res.data);
    } catch { toast.error('Anomaly scan failed'); }
    setLoading(false);
  }, [companyId]);

  return (
    <div className="space-y-3" data-testid="ai-anomalies">
      <Button onClick={scan} disabled={loading} className="w-full" data-testid="ai-anomalies-btn">
        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Shield size={16} className="mr-2" />}Scan for Anomalies
      </Button>
      {data && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className={`p-3 rounded flex-1 text-center ${data.health_score >= 80 ? 'bg-success/10' : data.health_score >= 50 ? 'bg-warning/10' : 'bg-error/10'}`}>
              <p className="text-[10px] text-muted-foreground">Health Score</p>
              <p className={`text-2xl font-bold ${data.health_score >= 80 ? 'text-success' : data.health_score >= 50 ? 'text-warning' : 'text-error'}`}>{data.health_score}/100</p>
            </div>
            <div className="bg-muted/50 p-3 rounded flex-1 text-center">
              <p className="text-[10px] text-muted-foreground">Issues Found</p>
              <p className="text-2xl font-bold">{data.anomalies?.length || 0}</p>
            </div>
          </div>
          {data.summary && <p className="text-sm">{data.summary}</p>}
          {data.anomalies?.map((a, i) => (
            <Card key={i}><CardContent className="p-3 text-sm">
              <div className="flex items-start gap-2">
                {a.severity === 'high' ? <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" /> :
                 a.severity === 'medium' ? <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" /> :
                 <Info size={16} className="text-info shrink-0 mt-0.5" />}
                <div>
                  <div className="flex gap-1 mb-1">
                    <Badge className={`text-[10px] border-0 ${a.severity === 'high' ? 'bg-error/20 text-error' : a.severity === 'medium' ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info'}`}>{a.severity}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.type?.replace('_', ' ')}</Badge>
                  </div>
                  <p>{a.description}</p>
                  {a.recommendation && <p className="text-xs text-muted-foreground mt-1">{a.recommendation}</p>}
                </div>
              </div>
            </CardContent></Card>
          ))}
          {data.recommendations?.map((r, i) => <p key={i} className="text-xs flex gap-1"><Sparkles size={12} className="shrink-0 mt-0.5 text-warning" />{r}</p>)}
        </div>
      )}
    </div>
  );
}

function AiBillScanner({ companyId }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      toast.error('Only JPEG, PNG, WEBP images supported');
      return;
    }
    if (f.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const scan = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (companyId) formData.append('company_id', companyId);
      const res = await odooApi.ai.scanBill(formData);
      setResult(res.data);
      toast.success('Bill scanned successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Scan failed');
    }
    setLoading(false);
  };

  const clear = () => { setFile(null); setPreview(null); setResult(null); };

  return (
    <div className="space-y-4" data-testid="ai-bill-scanner">
      {!file ? (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          data-testid="bill-drop-zone"
        >
          <Camera size={48} className="mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm font-medium">Drop a bill/invoice photo here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse (JPEG, PNG, WEBP - max 10MB)</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleFile(e.target.files?.[0])} data-testid="bill-file-input" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <img src={preview} alt="Bill preview" className="max-h-[250px] rounded-lg border mx-auto object-contain" />
            <Button variant="ghost" size="sm" className="absolute top-1 right-1 bg-background/80 h-7 w-7 p-0" onClick={clear}>
              <X size={14} />
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
            <Button onClick={scan} disabled={loading} data-testid="scan-bill-btn">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Scanning with AI...</> : <><Camera size={16} className="mr-2" />Scan Bill</>}
            </Button>
          </div>
        </div>
      )}

      {result && !result.error && (
        <Card data-testid="scan-result">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base">Extracted Data</h3>
              <Badge className="bg-success/20 text-success border-0">{Math.round((result.confidence || 0) * 100)}% confidence</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {result.vendor_name && <div className="bg-muted/50 p-2 rounded"><p className="text-[10px] text-muted-foreground">Vendor</p><p className="font-semibold">{result.vendor_name}</p>{result.vendor_gstin && <p className="text-xs text-muted-foreground">GSTIN: {result.vendor_gstin}</p>}</div>}
              {result.invoice_number && <div className="bg-muted/50 p-2 rounded"><p className="text-[10px] text-muted-foreground">Invoice #</p><p className="font-semibold">{result.invoice_number}</p></div>}
              {result.invoice_date && <div className="bg-muted/50 p-2 rounded"><p className="text-[10px] text-muted-foreground">Date</p><p className="font-semibold">{result.invoice_date}</p></div>}
              {result.due_date && <div className="bg-muted/50 p-2 rounded"><p className="text-[10px] text-muted-foreground">Due Date</p><p className="font-semibold">{result.due_date}</p></div>}
            </div>

            {result.line_items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1 text-muted-foreground">LINE ITEMS</p>
                <div className="space-y-1">
                  {result.line_items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center bg-muted/30 p-2 rounded text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {fmt(item.unit_price)}
                          {item.hsn_sac ? ` (HSN: ${item.hsn_sac})` : ''}
                          {item.tax_rate ? ` +${item.tax_rate}% tax` : ''}
                        </p>
                      </div>
                      <p className="font-semibold ml-3">{fmt(item.total || (item.quantity * item.unit_price))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-muted/50 p-2 rounded text-center"><p className="text-[10px] text-muted-foreground">Subtotal</p><p className="font-bold">{fmt(result.subtotal)}</p></div>
              <div className="bg-muted/50 p-2 rounded text-center"><p className="text-[10px] text-muted-foreground">Tax</p><p className="font-bold">{fmt(result.tax_details?.total_tax)}</p>
                {result.tax_details && <p className="text-[9px] text-muted-foreground">
                  {result.tax_details.cgst ? `CGST: ${fmt(result.tax_details.cgst)} ` : ''}
                  {result.tax_details.sgst ? `SGST: ${fmt(result.tax_details.sgst)} ` : ''}
                  {result.tax_details.igst ? `IGST: ${fmt(result.tax_details.igst)}` : ''}
                </p>}
              </div>
              <div className="bg-primary/10 p-2 rounded text-center"><p className="text-[10px] text-muted-foreground">Total</p><p className="font-bold text-primary text-lg">{fmt(result.grand_total)}</p></div>
            </div>

            {result.amount_in_words && <p className="text-xs text-muted-foreground italic">{result.amount_in_words}</p>}
            {result.payment_terms && <p className="text-xs"><span className="text-muted-foreground">Terms:</span> {result.payment_terms}</p>}
            {result.bank_details && <p className="text-xs"><span className="text-muted-foreground">Bank:</span> {result.bank_details}</p>}

            <Button size="sm" className="w-full" onClick={() => toast.info('Use the Invoicing tab to create a bill with this extracted data')} data-testid="create-bill-from-scan">
              <Sparkles size={14} className="mr-1" />Create Bill from Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {result?.error && <p className="text-error text-sm">{result.error}</p>}
    </div>
  );
}

// ========= MAIN TAB =========
export function AiAssistantTab({ companyId }) {
  const [activeFeature, setActiveFeature] = useState('chat');
  const [expanded, setExpanded] = useState(true);

  const features = [
    { id: 'chat', label: 'AI Chat', icon: Bot, desc: 'Natural language accounting' },
    { id: 'scanner', label: 'Bill Scanner', icon: Camera, desc: 'Scan bills with AI vision' },
    { id: 'invoice', label: 'Invoice Extract', icon: FileText, desc: 'Auto-extract invoice data' },
    { id: 'categorize', label: 'Categorize', icon: Tag, desc: 'Smart account suggestions' },
    { id: 'reconcile', label: 'Reconcile', icon: GitMerge, desc: 'AI-powered matching' },
    { id: 'qa', label: 'Financial Q&A', icon: MessageSquare, desc: 'Ask about your finances' },
    { id: 'forecast', label: 'Cash Forecast', icon: TrendingUp, desc: 'Predict cash flow' },
    { id: 'anomalies', label: 'Anomaly Scan', icon: Shield, desc: 'Detect issues' },
  ];

  return (
    <div className="space-y-4" data-testid="ai-assistant-tab">
      <div className="flex items-center gap-2 flex-wrap">
        {features.map(f => (
          <Button key={f.id} variant={activeFeature === f.id ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveFeature(f.id)} data-testid={`ai-feature-${f.id}`}
            className="gap-1.5">
            <f.icon size={14} /><span className="hidden sm:inline">{f.label}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Brain size={18} className="text-primary" />
            {features.find(f => f.id === activeFeature)?.label}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {features.find(f => f.id === activeFeature)?.desc}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeFeature === 'chat' && <AiChatSection companyId={companyId} />}
          {activeFeature === 'scanner' && <AiBillScanner companyId={companyId} />}
          {activeFeature === 'invoice' && <AiInvoiceExtractor companyId={companyId} />}
          {activeFeature === 'categorize' && <AiCategorizer companyId={companyId} />}
          {activeFeature === 'reconcile' && <AiReconciliation companyId={companyId} />}
          {activeFeature === 'qa' && <AiFinancialQA companyId={companyId} />}
          {activeFeature === 'forecast' && <AiCashForecast companyId={companyId} />}
          {activeFeature === 'anomalies' && <AiAnomalies companyId={companyId} />}
        </CardContent>
      </Card>
    </div>
  );
}
