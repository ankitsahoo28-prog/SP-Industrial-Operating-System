import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiAssistantApi, exportApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  ShieldCheck, ShieldX, Clock, FileText, RefreshCw, Filter,
  ArrowUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import ExportButton from '@/components/ExportButton';

const PAGE_SIZE = 15;

export default function AiAuditTrail({ companyId }) {
  const [trail, setTrail] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [trailRes, statsRes] = await Promise.all([
        aiAssistantApi.auditTrail(companyId),
        aiAssistantApi.auditStats(companyId),
      ]);
      setTrail(trailRes.data || []);
      setStats(statsRes.data || null);
    } catch { toast.error('Failed to load audit trail'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filter === 'all' ? trail : trail.filter(t => t.action === filter);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4" data-testid="ai-audit-trail">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<ShieldCheck size={18} className="text-green-500" />} label="Approved" value={stats.total_approved} color="green" />
          <StatCard icon={<ShieldX size={18} className="text-red-500" />} label="Rejected" value={stats.total_rejected} color="red" />
          <StatCard icon={<Clock size={18} className="text-yellow-500" />} label="Pending" value={stats.total_pending} color="yellow" />
          <StatCard icon={<FileText size={18} className="text-blue-500" />} label="Total Actions" value={stats.total_actions} color="blue" />
        </div>
      )}

      {/* Filter & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <Select value={filter} onValueChange={v => { setFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44 h-8 text-xs" data-testid="audit-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="approved_and_posted">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} records</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} data-testid="audit-refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <ExportButton
            fetchData={async () => { const res = await exportApi.auditTrail(companyId); return res.data; }}
            filenameBase="audit-trail"
            title="AI Audit Trail"
            columns={[
              { header: 'Action', accessor: r => r.action },
              { header: 'Type', accessor: r => r.action_type || '' },
              { header: 'Reviewed By', accessor: r => r.reviewed_by || '' },
              { header: 'Role', accessor: r => r.user_role || '' },
              { header: 'Source', accessor: r => r.source || '' },
              { header: 'Timestamp', accessor: r => r.timestamp || '' },
            ]}
          />
        </div>
      </div>

      {/* Trail List */}
      {paged.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No audit trail entries yet</p>
          <p className="text-xs">Actions will appear here as the AI assistant is used</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((entry, i) => (
            <AuditRow key={entry.id || i} entry={entry} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const bgMap = { green: 'bg-green-500/10', red: 'bg-red-500/10', yellow: 'bg-yellow-500/10', blue: 'bg-blue-500/10' };
  return (
    <Card className="border-0 shadow-sm" data-testid={`audit-stat-${label.toLowerCase()}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgMap[color]}`}>{icon}</div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditRow({ entry }) {
  const isApproved = entry.action === 'approved_and_posted';
  const ts = entry.timestamp ? new Date(entry.timestamp) : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors" data-testid={`audit-row-${entry.id}`}>
      <div className={`mt-0.5 p-1.5 rounded-full ${isApproved ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
        {isApproved ? <ShieldCheck size={14} className="text-green-600" /> : <ShieldX size={14} className="text-red-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isApproved ? 'default' : 'destructive'} className="text-[10px]">
            {isApproved ? 'Approved & Posted' : 'Rejected'}
          </Badge>
          {entry.action_type && (
            <Badge variant="outline" className="text-[10px]">{entry.action_type?.replace('_', ' ')}</Badge>
          )}
          {entry.source && (
            <Badge variant="secondary" className="text-[10px]">{entry.source}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>By: <strong className="text-foreground">{entry.reviewed_by || 'Unknown'}</strong></span>
          {entry.user_role && <span className="capitalize">({entry.user_role})</span>}
        </div>
        {entry.results && entry.results.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            {entry.results.map((r, i) => (
              <span key={i} className="mr-2">
                {r.type === 'journal_entry' ? `Journal: ${r.name || r.id}` : `Inv. Adj: ${r.product_id}`}
              </span>
            ))}
          </div>
        )}
        {entry.file_url && (
          <div className="mt-1 text-xs text-blue-500 flex items-center gap-1">
            <FileText size={10} />From uploaded file
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {ts ? (
          <div className="text-right">
            <div>{ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div>{ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ) : '—'}
      </div>
    </div>
  );
}
