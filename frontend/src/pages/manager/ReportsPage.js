// Manager ReportsPage (with ability to create reports)
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { reportApi } from '@/lib/api';
import { toast } from 'sonner';
import { FileText, Plus } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportType, setReportType] = useState('feeding');
  const [reportData, setReportData] = useState({});

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await reportApi.getReports(null);
      setReports(response.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await reportApi.createReport({
        type: reportType,
        data: reportData,
      });
      toast.success('Report submitted successfully');
      setDialogOpen(false);
      setReportData({});
      fetchReports();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit report');
    }
  };

  const getReportForm = () => {
    switch (reportType) {
      case 'feeding':
        return (
          <>
            <div className="space-y-2">
              <Label>Feed Type</Label>
              <Input
                value={reportData.feed_type || ''}
                onChange={(e) => setReportData({ ...reportData, feed_type: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity (kg)</Label>
              <Input
                type="number"
                value={reportData.quantity || ''}
                onChange={(e) => setReportData({ ...reportData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={reportData.notes || ''}
                onChange={(e) => setReportData({ ...reportData, notes: e.target.value })}
              />
            </div>
          </>
        );
      case 'diesel':
      case 'petrol':
      case 'lubricant':
        return (
          <>
            <div className="space-y-2">
              <Label>Equipment/Vehicle ID</Label>
              <Input
                value={reportData.equipment_id || ''}
                onChange={(e) => setReportData({ ...reportData, equipment_id: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{reportType === 'lubricant' ? 'Lubricant Type' : 'Quantity (Liters)'}</Label>
              <Input
                type={reportType === 'lubricant' ? 'text' : 'number'}
                value={reportType === 'lubricant' ? (reportData.lubricant_type || '') : (reportData.quantity || '')}
                onChange={(e) => setReportData({ 
                  ...reportData, 
                  [reportType === 'lubricant' ? 'lubricant_type' : 'quantity']: e.target.value 
                })}
                required
              />
            </div>
            {reportType === 'lubricant' && (
              <div className="space-y-2">
                <Label>Quantity (Liters)</Label>
                <Input
                  type="number"
                  value={reportData.quantity || ''}
                  onChange={(e) => setReportData({ ...reportData, quantity: e.target.value })}
                  required
                />
              </div>
            )}
            {reportType === 'diesel' && (
              <div className="space-y-2">
                <Label>Running Hours</Label>
                <Input
                  type="number"
                  value={reportData.running_hours || ''}
                  onChange={(e) => setReportData({ ...reportData, running_hours: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={reportData.notes || ''}
                onChange={(e) => setReportData({ ...reportData, notes: e.target.value })}
              />
            </div>
          </>
        );
      case 'running_hours':
        return (
          <>
            <div className="space-y-2">
              <Label>Equipment/Machine ID</Label>
              <Input
                value={reportData.equipment_id || ''}
                onChange={(e) => setReportData({ ...reportData, equipment_id: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Equipment Type</Label>
              <Select
                value={reportData.equipment_type || ''}
                onValueChange={(value) => setReportData({ ...reportData, equipment_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"crusher\">Crusher</SelectItem>
                  <SelectItem value=\"slag_crusher\">Slag Crusher</SelectItem>
                  <SelectItem value=\"stone_crusher\">Stone Crusher</SelectItem>
                  <SelectItem value=\"other\">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Running Hours</Label>
              <Input
                type="number"
                step="0.1"
                value={reportData.running_hours || ''}
                onChange={(e) => setReportData({ ...reportData, running_hours: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Production Output (if applicable)</Label>
              <Input
                value={reportData.production_output || ''}
                onChange={(e) => setReportData({ ...reportData, production_output: e.target.value })}
                placeholder="e.g., 500 tons"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={reportData.notes || ''}
                onChange={(e) => setReportData({ ...reportData, notes: e.target.value })}
              />
            </div>
          </>
        );
      case 'dispatch':
        return (
          <>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                value={reportData.item_name || ''}
                onChange={(e) => setReportData({ ...reportData, item_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={reportData.quantity || ''}
                onChange={(e) => setReportData({ ...reportData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input
                value={reportData.destination || ''}
                onChange={(e) => setReportData({ ...reportData, destination: e.target.value })}
                required
              />
            </div>
          </>
        );
      case 'incoming_stock':
        return (
          <>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                value={reportData.item_name || ''}
                onChange={(e) => setReportData({ ...reportData, item_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={reportData.quantity || ''}
                onChange={(e) => setReportData({ ...reportData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={reportData.supplier || ''}
                onChange={(e) => setReportData({ ...reportData, supplier: e.target.value })}
                required
              />
            </div>
          </>
        );
      default:
        return null;
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
    <div className="space-y-6" data-testid="manager-reports-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">Reports</h1>
          <p className="text-muted-foreground mt-1">Submit and view ground level entries</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90" data-testid="create-report-button">
              <Plus size={18} className="mr-2" />
              New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Report</DialogTitle>
              <DialogDescription>Enter ground level operational data</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={(val) => { setReportType(val); setReportData({}); }}>
                  <SelectTrigger data-testid="report-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feeding">Feeding Report</SelectItem>
                    <SelectItem value="diesel">Diesel Report</SelectItem>
                    <SelectItem value="dispatch">Dispatch Report</SelectItem>
                    <SelectItem value="incoming_stock">Incoming Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {getReportForm()}

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" data-testid="submit-report-button">
                Submit Report
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
            <p className="text-muted-foreground">No reports yet. Submit your first report to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}