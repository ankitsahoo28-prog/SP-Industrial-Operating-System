import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { reportApi } from '@/lib/api';
import { toast } from 'sonner';
import { FileText, Filter } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, [filterType]);

  const fetchReports = async () => {
    try {
      const type = filterType !== 'all' ? filterType : null;
      const response = await reportApi.getReports(type);
      setReports(response.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const getReportTypeBadge = (type) => {
    const styles = {
      feeding: 'bg-green-100 text-green-700 border-green-200',
      diesel: 'bg-blue-100 text-blue-700 border-blue-200',
      dispatch: 'bg-purple-100 text-purple-700 border-purple-200',
      incoming_stock: 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return styles[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Reports</h1>
          <p className="text-muted-foreground mt-1">View all ground level entries</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48" data-testid="report-filter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="feeding">Feeding Report</SelectItem>
              <SelectItem value="diesel">Diesel Report</SelectItem>
              <SelectItem value="dispatch">Dispatch Report</SelectItem>
              <SelectItem value="incoming_stock">Incoming Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText size={20} className="text-accent" />
                    <span className={`text-xs px-2 py-1 rounded border ${getReportTypeBadge(report.type)}`}>
                      {report.type.replace('_', ' ')}
                    </span>
                    {report.business_type && (
                      <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground">
                        {report.business_type.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {Object.entries(report.data).map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">
                          {key.replace('_', ' ')}
                        </span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reports.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No reports available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}