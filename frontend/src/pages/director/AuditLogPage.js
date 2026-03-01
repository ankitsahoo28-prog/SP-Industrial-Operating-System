import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { auditApi } from '@/lib/api';
import { toast } from 'sonner';
import { History, ArrowRight } from 'lucide-react';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  const fetchLogs = async () => {
    try {
      const params = {};
      if (entityFilter !== 'all') params.entity_type = entityFilter;
      const response = await auditApi.getLogs(params);
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action) => {
    const styles = {
      create: 'bg-success/20 text-success border-success/30',
      update: 'bg-info/20 text-info border-info/30',
      delete: 'bg-error/20 text-error border-error/30',
    };
    return styles[action] || 'bg-secondary text-foreground';
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const renderChanges = (log) => {
    if (!log.old_data && !log.new_data) return null;

    if (log.action === 'delete' && log.old_data) {
      return (
        <div className="mt-3 p-3 bg-error/5 rounded-lg border border-error/10">
          <p className="text-xs font-semibold text-error mb-2">Deleted Record:</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(log.old_data).filter(([k]) => !['_id', 'password_hash'].includes(k)).slice(0, 6).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-muted-foreground">{key}:</span> <span className="font-medium">{formatValue(value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (log.action === 'update' && log.old_data && log.new_data) {
      const changedKeys = Object.keys(log.new_data).filter(
        k => !['_id', 'password_hash'].includes(k) && JSON.stringify(log.old_data[k]) !== JSON.stringify(log.new_data[k])
      );
      if (changedKeys.length === 0) return null;

      return (
        <div className="mt-3 p-3 bg-info/5 rounded-lg border border-info/10">
          <p className="text-xs font-semibold text-info mb-2">Changes:</p>
          <div className="space-y-1">
            {changedKeys.slice(0, 8).map(key => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground min-w-[80px]">{key}:</span>
                <span className="text-error line-through">{formatValue(log.old_data[key])}</span>
                <ArrowRight size={12} className="text-muted-foreground" />
                <span className="text-success font-medium">{formatValue(log.new_data[key])}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="audit-log-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Audit Trail</h1>
          <p className="text-muted-foreground mt-1">Complete edit history and change log</p>
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[180px]" data-testid="audit-entity-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Changes</SelectItem>
            <SelectItem value="transaction">Transactions</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <History size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No audit logs found. Changes will appear here when edits or deletions are made.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow" data-testid={`audit-log-${log.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <History size={18} className="text-muted-foreground" />
                      <span className={`text-xs px-2 py-1 rounded border font-semibold uppercase ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground capitalize">
                        {log.entity_type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Entity ID: <span className="font-mono text-xs">{log.entity_id}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      By User: <span className="font-mono text-xs">{log.user_id}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                {renderChanges(log)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
