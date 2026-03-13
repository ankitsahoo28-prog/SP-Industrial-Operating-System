import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { aiAssistantApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Send, Upload, Bot, User, FileText, Loader2, CheckCircle, XCircle,
  Edit3, ArrowRight, AlertTriangle, FileSpreadsheet, Image, File as FileIcon,
  History, ChevronDown, ChevronUp,
} from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// ============ PREVIEW PANEL COMPONENT ============
function PreviewPanel({ entries, pendingId, onApprove, onReject, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(entries);
  const [submitting, setSubmitting] = useState(false);
  const [showAccounting, setShowAccounting] = useState(true);
  const [showInventory, setShowInventory] = useState(true);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await aiAssistantApi.approve(pendingId, editing ? editData : null);
      toast.success(res.data?.message || 'Entries posted successfully!');
      onApprove(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to post'); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    try {
      await aiAssistantApi.reject(pendingId);
      toast.info('Entry discarded');
      onReject();
    } catch { toast.error('Failed to discard'); }
  };

  const updateAccLine = (idx, field, value) => {
    setEditData(prev => {
      const next = { ...prev };
      next.accounting_entries = [...(next.accounting_entries || [])];
      next.accounting_entries[idx] = { ...next.accounting_entries[idx], [field]: field === 'debit' || field === 'credit' ? parseFloat(value) || 0 : value };
      return next;
    });
  };

  const updateInvLine = (idx, field, value) => {
    setEditData(prev => {
      const next = { ...prev };
      next.inventory_entries = [...(next.inventory_entries || [])];
      next.inventory_entries[idx] = { ...next.inventory_entries[idx], [field]: field === 'quantity_change' ? parseFloat(value) || 0 : value };
      return next;
    });
  };

  const accEntries = (editing ? editData : entries)?.accounting_entries || [];
  const invEntries = (editing ? editData : entries)?.inventory_entries || [];
  const gst = entries?.gst || {};
  const docType = entries?.document_type;

  return (
    <div className="space-y-3 mt-3 p-4 rounded-xl border bg-card/50" data-testid="ai-preview-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm">Preview — Review Before Posting</span>
        </div>
        {docType && <Badge variant="outline" className="text-xs">{docType.replace('_', ' ')}</Badge>}
      </div>

      {entries?.description && <p className="text-sm text-muted-foreground">{entries.description}</p>}

      {/* Accounting Entries */}
      {accEntries.length > 0 && (
        <div className="space-y-2">
          <button className="flex items-center gap-1 font-semibold text-sm" onClick={() => setShowAccounting(v => !v)}>
            {showAccounting ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            Accounting Entries
          </button>
          {showAccounting && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="text-left p-2">Account</th><th className="text-right p-2">Debit</th><th className="text-right p-2">Credit</th><th className="text-left p-2">Description</th></tr></thead>
                <tbody>
                  {accEntries.map((line, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{editing ? <Input value={line.account_name || ''} onChange={e => updateAccLine(i, 'account_name', e.target.value)} className="h-7 text-xs" /> : <span className="font-mono text-xs">{line.account_code} {line.account_name}</span>}</td>
                      <td className="p-2 text-right">{editing ? <Input type="number" value={line.debit || 0} onChange={e => updateAccLine(i, 'debit', e.target.value)} className="h-7 text-xs w-24 ml-auto" /> : <span className={line.debit > 0 ? 'font-semibold' : 'text-muted-foreground'}>{fmt(line.debit)}</span>}</td>
                      <td className="p-2 text-right">{editing ? <Input type="number" value={line.credit || 0} onChange={e => updateAccLine(i, 'credit', e.target.value)} className="h-7 text-xs w-24 ml-auto" /> : <span className={line.credit > 0 ? 'font-semibold' : 'text-muted-foreground'}>{fmt(line.credit)}</span>}</td>
                      <td className="p-2 text-xs text-muted-foreground">{editing ? <Input value={line.description || ''} onChange={e => updateAccLine(i, 'description', e.target.value)} className="h-7 text-xs" /> : line.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventory Entries */}
      {invEntries.length > 0 && (
        <div className="space-y-2">
          <button className="flex items-center gap-1 font-semibold text-sm" onClick={() => setShowInventory(v => !v)}>
            {showInventory ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            Inventory Updates
          </button>
          {showInventory && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="text-left p-2">Product</th><th className="text-right p-2">Qty Change</th><th className="text-left p-2">Warehouse</th></tr></thead>
                <tbody>
                  {invEntries.map((line, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{editing ? <Input value={line.product_name || ''} onChange={e => updateInvLine(i, 'product_name', e.target.value)} className="h-7 text-xs" /> : line.product_name}</td>
                      <td className="p-2 text-right">{editing ? <Input type="number" value={line.quantity_change || 0} onChange={e => updateInvLine(i, 'quantity_change', e.target.value)} className="h-7 text-xs w-20 ml-auto" /> : <span className={line.quantity_change > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{line.quantity_change > 0 ? '+' : ''}{line.quantity_change} {line.unit || ''}</span>}</td>
                      <td className="p-2 text-xs">{editing ? <Input value={line.warehouse || ''} onChange={e => updateInvLine(i, 'warehouse', e.target.value)} className="h-7 text-xs" /> : line.warehouse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GST */}
      {(gst.cgst > 0 || gst.sgst > 0 || gst.igst > 0) && (
        <div className="flex gap-3 text-xs">
          <span className="font-semibold">GST:</span>
          {gst.cgst > 0 && <span>CGST {fmt(gst.cgst)}</span>}
          {gst.sgst > 0 && <span>SGST {fmt(gst.sgst)}</span>}
          {gst.igst > 0 && <span>IGST {fmt(gst.igst)}</span>}
        </div>
      )}

      {entries?.total_amount > 0 && <p className="text-sm font-semibold">Total: {fmt(entries.total_amount)}</p>}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={handleApprove} disabled={submitting} className="bg-green-600 hover:bg-green-700" data-testid="ai-approve-btn">
          {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle size={14} className="mr-1" />}
          Approve & Post
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setEditing(!editing); if (!editing) setEditData(entries); }} data-testid="ai-edit-btn">
          <Edit3 size={14} className="mr-1" />{editing ? 'Cancel Edit' : 'Edit Before Posting'}
        </Button>
        <Button size="sm" variant="destructive" onClick={handleReject} data-testid="ai-reject-btn">
          <XCircle size={14} className="mr-1" />Discard
        </Button>
      </div>
    </div>
  );
}

// ============ CHAT MESSAGE COMPONENT ============
function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`} data-testid={`chat-msg-${msg.id}`}>
      {!isUser && <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot size={16} className="text-primary" /></div>}
      <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {msg.file && (
          <div className="flex items-center gap-2 mb-2 p-2 rounded bg-background/50 text-xs">
            {msg.file.type === 'image' ? <Image size={14} /> : msg.file.type === 'spreadsheet' ? <FileSpreadsheet size={14} /> : <FileIcon size={14} />}
            <span className="truncate">{msg.file.name}</span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.text}</div>
      </div>
      {isUser && <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0"><User size={16} className="text-accent" /></div>}
    </div>
  );
}

// ============ MAIN AI ASSISTANT COMPONENT ============
export default function AiBusinessAssistant({ companyId }) {
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', text: 'Hello! I\'m your AI Business Assistant. I can help you with:\n\n- Upload invoices, bank statements, stock sheets and convert them to entries\n- Ask questions about your business data\n- Create accounting and inventory entries from natural language\n\nType a message or upload a file to get started.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = (role, text, extra = {}) => {
    const msg = { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, text, ...extra };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    addMessage('user', text);
    setLoading(true);
    try {
      const res = await aiAssistantApi.chat(text, companyId);
      const data = res.data;
      if (data.type === 'preview') {
        addMessage('assistant', data.message);
        setActivePreview({ entries: data.entries, pendingId: data.pending_id });
      } else {
        addMessage('assistant', data.message);
      }
    } catch (err) {
      addMessage('assistant', `Error: ${err.response?.data?.detail || 'Something went wrong'}`);
    }
    finally { setLoading(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const fileType = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'image' : ['xlsx', 'xls', 'csv'].includes(ext) ? 'spreadsheet' : 'document';
    addMessage('user', `Uploaded: ${file.name}`, { file: { name: file.name, type: fileType } });
    setLoading(true);
    try {
      const res = await aiAssistantApi.upload(file, input || '', companyId);
      const data = res.data;
      if (data.type === 'preview') {
        addMessage('assistant', `${data.message}\n\nDocument Type: ${(data.document_type || '').replace('_', ' ')}${data.confidence ? ` (${Math.round(data.confidence * 100)}% confidence)` : ''}`);
        setActivePreview({ entries: data.entries, pendingId: data.pending_id });
      } else if (data.type === 'error') {
        addMessage('assistant', `Could not process file: ${data.message}`);
      }
    } catch (err) {
      addMessage('assistant', `Error processing file: ${err.response?.data?.detail || 'Upload failed'}`);
    }
    finally { setLoading(false); setInput(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleApproved = (result) => {
    addMessage('assistant', `Entries posted successfully! ${result.results?.length || 0} item(s) created.`);
    setActivePreview(null);
  };

  const handleRejected = () => {
    addMessage('assistant', 'Entry discarded. What would you like to do next?');
    setActivePreview(null);
  };

  const loadHistory = async () => {
    try {
      const res = await aiAssistantApi.history(companyId);
      setHistory(res.data || []);
      setShowHistory(true);
    } catch { toast.error('Failed to load history'); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]" data-testid="ai-business-assistant">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"><Bot size={20} className="text-white" /></div>
          <div>
            <h2 className="font-heading font-bold text-lg">AI Business Assistant</h2>
            <p className="text-xs text-muted-foreground">Upload documents or ask questions about your business</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadHistory} data-testid="ai-history-btn"><History size={14} className="mr-1" />History</Button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-2" data-testid="ai-chat-messages">
        {messages.map(msg => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}
        {activePreview && (
          <PreviewPanel
            entries={activePreview.entries}
            pendingId={activePreview.pendingId}
            onApprove={handleApproved}
            onReject={handleRejected}
          />
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot size={16} className="text-primary" /></div>
            <div className="bg-muted rounded-2xl p-3 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /><span className="text-sm text-muted-foreground">Analyzing...</span></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="pt-3 border-t">
        <div className="flex gap-2 items-end">
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp"
            onChange={handleFileUpload} data-testid="ai-file-input" />
          <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading}
            title="Upload file" data-testid="ai-upload-btn">
            <Upload size={18} />
          </Button>
          <div className="flex-1 relative">
            <Input
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Type a message or upload a file..."
              disabled={loading} className="pr-12" data-testid="ai-chat-input"
            />
            <Button size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={handleSend} disabled={loading || !input.trim()} data-testid="ai-send-btn">
              <Send size={14} />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">PDF</Badge>
          <Badge variant="outline" className="text-[10px]">Excel</Badge>
          <Badge variant="outline" className="text-[10px]">CSV</Badge>
          <Badge variant="outline" className="text-[10px]">Images</Badge>
          <span className="ml-auto">Preview → Edit → Approve → Post</span>
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>AI Assistant History</DialogTitle></DialogHeader>
          {history.length === 0 ? <p className="text-muted-foreground text-center py-8">No history yet</p> : (
            <div className="space-y-3">
              {history.map(h => (
                <div key={h.id} className="p-3 rounded-lg border text-sm" data-testid={`history-${h.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={h.status === 'approved' ? 'default' : h.status === 'rejected' ? 'destructive' : 'outline'} className="text-[10px]">
                      {h.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs">{h.original_message?.slice(0, 100) || h.action_type}</p>
                  {h.file_name && <p className="text-xs text-muted-foreground mt-1">File: {h.file_name}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
