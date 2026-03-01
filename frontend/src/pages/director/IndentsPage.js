import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { indentApi } from '@/lib/api';
import { BusinessFilter } from '@/components/BusinessFilter';
import { toast } from 'sonner';
import { Package, CheckCircle, XCircle } from 'lucide-react';

export default function IndentsPage() {
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessFilter, setBusinessFilter] = useState('all');

  useEffect(() => {
    fetchIndents();
  }, [businessFilter]);

  const fetchIndents = async () => {
    try {
      const params = {};
      if (businessFilter !== 'all') params.business_type = businessFilter;
      const response = await indentApi.getIndents(params);
      setIndents(response.data);
    } catch (error) {
      console.error('Failed to fetch indents:', error);
      toast.error('Failed to load indents');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = async (indentId, status) => {
    try {
      await indentApi.authorizeIndent(indentId, { status, notes: '' });
      toast.success(`Indent ${status}`);
      fetchIndents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to authorize indent');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: 'bg-success/20 text-success border-success/30',
      rejected: 'bg-error/20 text-error border-error/30',
      pending: 'bg-warning/20 text-warning border-warning/30',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="indents-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Indents Management</h1>
          <p className="text-muted-foreground mt-1">Review and authorize stock requests</p>
        </div>
        <BusinessFilter value={businessFilter} onChange={setBusinessFilter} />
      </div>

      <div className="space-y-4">
        {indents.map((indent) => (
          <Card key={indent.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Package size={20} className="text-accent" />
                    <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(indent.status)}`}>
                      {indent.status}
                    </span>
                    {indent.business_type && (
                      <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground capitalize">
                        {indent.business_type.replace('_', ' ')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(indent.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Requested Items:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {indent.items.map((item, idx) => (
                        <div key={idx} className="p-3 bg-secondary/50 rounded">
                          <p className="font-medium text-sm">{item.name || item.item}</p>
                          <p className="text-xs text-muted-foreground">Quantity: {item.quantity} {item.unit || ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {indent.notes && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
                      <p className="text-sm">{indent.notes}</p>
                    </div>
                  )}
                </div>

                {indent.status === 'pending' && (
                  <div className="flex lg:flex-col gap-2">
                    <Button onClick={() => handleAuthorize(indent.id, 'approved')} className="bg-success hover:bg-success/90" data-testid="approve-indent-button">
                      <CheckCircle size={16} className="mr-2" />Approve
                    </Button>
                    <Button onClick={() => handleAuthorize(indent.id, 'rejected')} variant="destructive" data-testid="reject-indent-button">
                      <XCircle size={16} className="mr-2" />Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {indents.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No indents found{businessFilter !== 'all' ? ' for this business' : ''}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
