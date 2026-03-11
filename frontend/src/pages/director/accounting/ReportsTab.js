import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { odooApi } from '@/lib/api';
import { toast } from 'sonner';
import { Scale, TrendingUp, BarChart3, Clock, AlertTriangle, ArrowUpDown, Calculator, BookOpen } from 'lucide-react';
import { fmt, fmtd, LoadingSpinner, cleanParams } from './helpers';

export function ReportsTab({ companyId }) {
  const [reportType, setReportType] = useState('trial-balance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true); setData(null);
    try {
      const params = cleanParams({ company_id: companyId, date_from: dateFrom, date_to: dateTo });
      let res;
      switch (reportType) {
        case 'trial-balance': res = await odooApi.reports.trialBalance(params); break;
        case 'profit-loss': res = await odooApi.reports.profitLoss(params); break;
        case 'balance-sheet': res = await odooApi.reports.balanceSheet(params); break;
        case 'general-ledger': res = await odooApi.reports.generalLedger(params); break;
        case 'aged-receivables': res = await odooApi.reports.agedReceivables(params); break;
        case 'aged-payables': res = await odooApi.reports.agedPayables(params); break;
        case 'cash-flow': res = await odooApi.reports.cashFlow(params); break;
        case 'tax-report': res = await odooApi.reports.taxReport(params); break;
        default: return;
      }
      setData(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [companyId, reportType, dateFrom, dateTo]);
  useEffect(() => { loadReport(); }, [loadReport]);

  const reportOptions = [
    { value: 'trial-balance', label: 'Trial Balance', icon: Scale },
    { value: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
    { value: 'balance-sheet', label: 'Balance Sheet', icon: BarChart3 },
    { value: 'general-ledger', label: 'General Ledger', icon: BookOpen },
    { value: 'aged-receivables', label: 'Aged Receivables', icon: Clock },
    { value: 'aged-payables', label: 'Aged Payables', icon: AlertTriangle },
    { value: 'cash-flow', label: 'Cash Flow', icon: ArrowUpDown },
    { value: 'tax-report', label: 'Tax Report', icon: Calculator },
  ];

  return (
    <div className="space-y-4" data-testid="acc-reports">
      <div className="flex flex-wrap gap-2">
        {reportOptions.map(r => (
          <Button key={r.value} variant={reportType === r.value ? 'default' : 'outline'} size="sm"
            onClick={() => setReportType(r.value)} data-testid={`report-${r.value}`}>
            <r.icon size={14} className="mr-1" />{r.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" data-testid="report-date-from" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" data-testid="report-date-to" />
        </div>
        <Button size="sm" variant="outline" onClick={loadReport} data-testid="report-refresh">Refresh</Button>
      </div>

      {loading ? <LoadingSpinner /> : !data ? null : (
        <Card>
          <CardHeader><CardTitle>{reportOptions.find(r => r.value === reportType)?.label}</CardTitle></CardHeader>
          <CardContent>
            {reportType === 'trial-balance' && data.rows && (
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                  <TableBody>{data.rows.map((r, i) => (
                    <TableRow key={i}><TableCell className="font-mono text-sm">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{r.account_type}</Badge></TableCell><TableCell className="text-right">{fmtd(r.debit)}</TableCell><TableCell className="text-right">{fmtd(r.credit)}</TableCell><TableCell className="text-right font-semibold">{fmtd(r.balance)}</TableCell></TableRow>
                  ))}</TableBody></Table>
                <div className={`mt-3 p-3 rounded flex justify-between ${data.is_balanced ? 'bg-success/10' : 'bg-error/10'}`}>
                  <span>Total Debit: {fmtd(data.total_debit)} | Total Credit: {fmtd(data.total_credit)}</span>
                  <Badge className={data.is_balanced ? 'bg-success/20 text-success border-0' : 'bg-error/20 text-error border-0'}>{data.is_balanced ? 'Balanced' : 'NOT Balanced'}</Badge>
                </div>
              </div>
            )}

            {reportType === 'profit-loss' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-heading font-bold text-success mb-2">Income ({fmt(data.total_income)})</h3>
                  {(data.income || []).length > 0 ? data.income.map((item, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{item.name}</span><span>{fmt(item.amount)}</span></div>) : <p className="text-sm text-muted-foreground">No income recorded</p>}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-error mb-2">Expenses ({fmt(data.total_expense)})</h3>
                  {(data.expenses || []).length > 0 ? data.expenses.map((item, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{item.name}</span><span>{fmt(item.amount)}</span></div>) : <p className="text-sm text-muted-foreground">No expenses recorded</p>}
                </div>
                <div className="md:col-span-2 p-4 rounded-lg bg-primary/10 text-center"><p className="text-lg font-heading font-bold">Net Profit: <span className={data.net_profit >= 0 ? 'text-success' : 'text-error'}>{fmt(data.net_profit)}</span></p></div>
              </div>
            )}

            {reportType === 'balance-sheet' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><h3 className="font-heading font-bold mb-2">Assets ({fmt(data.total_assets)})</h3>{(data.assets || []).map((a, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{a.name}</span><span>{fmt(a.amount)}</span></div>)}</div>
                <div>
                  <h3 className="font-heading font-bold mb-2">Liabilities ({fmt(data.total_liabilities)})</h3>{(data.liabilities || []).map((a, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{a.name}</span><span>{fmt(a.amount)}</span></div>)}
                  <h3 className="font-heading font-bold mt-4 mb-2">Equity ({fmt(data.total_equity)})</h3>{(data.equity || []).map((a, i) => <div key={i} className="flex justify-between py-1 border-b text-sm"><span>{a.name}</span><span>{fmt(a.amount)}</span></div>)}
                </div>
                <div className="md:col-span-2 p-3 rounded bg-muted text-sm flex justify-between">
                  <span>Total Assets: {fmt(data.total_assets)}</span>
                  <span>Total Liabilities + Equity: {fmt(data.total_liabilities_equity)}</span>
                </div>
              </div>
            )}

            {reportType === 'general-ledger' && Array.isArray(data) && (
              <div className="space-y-4">
                {data.length === 0 ? <p className="text-muted-foreground text-center py-8">No posted transactions found</p> : data.map((acct, i) => (
                  <details key={i} className="border rounded-lg">
                    <summary className="p-3 cursor-pointer hover:bg-muted/30 flex justify-between items-center">
                      <span className="font-medium"><span className="font-mono text-sm mr-2">{acct.account_code}</span>{acct.account_name}</span>
                      <span className="text-sm">Dr: {fmtd(acct.total_debit)} | Cr: {fmtd(acct.total_credit)} | <span className="font-bold">{fmtd(acct.balance)}</span></span>
                    </summary>
                    <div className="border-t">
                      <Table>
                        <TableHeader><TableRow className="bg-muted/30"><TableHead>Date</TableHead><TableHead>Entry</TableHead><TableHead>Ref</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                        <TableBody>{(acct.lines || []).map((l, li) => (
                          <TableRow key={li}><TableCell className="text-xs">{l.date}</TableCell><TableCell className="text-xs font-mono">{l.move_name}</TableCell><TableCell className="text-xs">{l.move_ref || '-'}</TableCell><TableCell className="text-xs">{l.name || '-'}</TableCell><TableCell className="text-right text-xs">{l.debit ? fmtd(l.debit) : ''}</TableCell><TableCell className="text-right text-xs">{l.credit ? fmtd(l.credit) : ''}</TableCell></TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  </details>
                ))}
              </div>
            )}

            {reportType === 'aged-receivables' && (
              <div><div className="grid grid-cols-5 gap-2 mb-4">
                {[['Current', data.buckets?.current], ['1-30 Days', data.buckets?.['1_30']], ['31-60 Days', data.buckets?.['31_60']], ['61-90 Days', data.buckets?.['61_90']], ['90+ Days', data.buckets?.over_90]].map(([label, val], i) => (
                  <div key={i} className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{fmt(val)}</p></div>
                ))}</div>
                <p className="text-lg font-bold">Total Outstanding: {fmt(data.total)}</p>
                {data.by_partner?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-semibold text-sm">By Partner</h4>
                    {data.by_partner.map((p, i) => (
                      <div key={i} className="p-3 bg-muted/50 rounded">
                        <div className="flex justify-between"><span className="font-medium">{p.partner_name}</span><span className="font-bold">{fmt(p.total)}</span></div>
                        {p.invoices?.map((inv, j) => (
                          <div key={j} className="flex justify-between text-xs mt-1 text-muted-foreground"><span>{inv.name} (due: {inv.due_date})</span><span>{inv.days_overdue}d overdue - {fmt(inv.residual)}</span></div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportType === 'aged-payables' && (
              <div><div className="grid grid-cols-5 gap-2 mb-4">
                {[['Current', data.buckets?.current], ['1-30 Days', data.buckets?.['1_30']], ['31-60 Days', data.buckets?.['31_60']], ['61-90 Days', data.buckets?.['61_90']], ['90+ Days', data.buckets?.over_90]].map(([label, val], i) => (
                  <div key={i} className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{fmt(val)}</p></div>
                ))}</div>
                <p className="text-lg font-bold">Total Payable: {fmt(data.total)}</p>
              </div>
            )}

            {reportType === 'cash-flow' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">Operating</p><p className="font-bold">{fmt(data.operating)}</p></div>
                <div className="p-4 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">Investing</p><p className="font-bold">{fmt(data.investing)}</p></div>
                <div className="p-4 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">Financing</p><p className="font-bold">{fmt(data.financing)}</p></div>
                <div className="p-4 bg-primary/10 rounded text-center"><p className="text-xs text-muted-foreground">Net Change</p><p className="font-bold text-primary">{fmt(data.net_change)}</p></div>
              </div>
            )}

            {reportType === 'tax-report' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">GST Output</p><p className="font-bold">{fmt(data.gst_output)}</p></div>
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">GST Input</p><p className="font-bold">{fmt(data.gst_input)}</p></div>
                  <div className="p-3 bg-primary/10 rounded text-center"><p className="text-xs text-muted-foreground">Net GST Payable</p><p className="font-bold">{fmt(data.net_gst_payable)}</p></div>
                </div>
                {data.taxes?.filter(t => t.base_amount > 0).length > 0 && (
                  <Table><TableHeader><TableRow><TableHead>Tax</TableHead><TableHead>Group</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">Tax Amount</TableHead></TableRow></TableHeader>
                    <TableBody>{data.taxes.filter(t => t.base_amount > 0).map((t, i) => (
                      <TableRow key={i}><TableCell>{t.name}</TableCell><TableCell>{t.tax_group}</TableCell><TableCell className="text-right">{fmtd(t.base_amount)}</TableCell><TableCell className="text-right">{fmtd(t.tax_amount)}</TableCell></TableRow>
                    ))}</TableBody></Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
