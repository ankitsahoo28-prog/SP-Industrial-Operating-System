import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToPDF, exportToExcel } from '@/lib/export';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

/**
 * Reusable export button with Excel/PDF dropdown.
 * @param {Function} fetchData - async fn that returns array of data objects
 * @param {string} filenameBase - e.g. "journal-entries"
 * @param {string} title - PDF title, e.g. "Journal Entries Report"
 * @param {Array} columns - [{header: 'Name', accessor: row => row.name}, ...]
 * @param {Array} excelFields - [{label: 'Name', key: 'name'}, ...] optional, for cleaner Excel headers
 */
export default function ExportButton({ fetchData, filenameBase, title, columns, excelFields, size = 'sm' }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format) => {
    setLoading(true);
    try {
      const data = await fetchData();
      if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const now = new Date().toISOString().slice(0, 10);

      if (format === 'excel') {
        // Prepare Excel data with clean headers
        const excelData = data.map(row => {
          const obj = {};
          (excelFields || columns).forEach(col => {
            const key = col.label || col.header;
            obj[key] = col.key ? row[col.key] : col.accessor ? col.accessor(row) : '';
          });
          return obj;
        });
        exportToExcel(excelData, `${filenameBase}_${now}.xlsx`, title);
        toast.success(`Exported ${data.length} rows to Excel`);
      } else {
        exportToPDF(data, `${filenameBase}_${now}.pdf`, title, columns);
        toast.success(`Exported ${data.length} rows to PDF`);
      }
    } catch (err) {
      toast.error('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={loading} data-testid={`export-${filenameBase}`}>
          {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Download size={14} className="mr-1" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('excel')} data-testid={`export-excel-${filenameBase}`}>
          <FileSpreadsheet size={14} className="mr-2 text-green-600" />
          Download Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')} data-testid={`export-pdf-${filenameBase}`}>
          <FileText size={14} className="mr-2 text-red-600" />
          Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
