import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { odooApi } from '@/lib/api';
import { toast } from 'sonner';
import { Scale, TrendingUp, BarChart3, Clock, AlertTriangle, ArrowUpDown, Calculator, BookOpen, FileSpreadsheet, Receipt } from 'lucide-react';
import { fmt, fmtd, LoadingSpinner, cleanParams } from './helpers';

export function ReportsTab({ companyId }) {
  const [reportType, setReportType] = useState('trial-balance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [gstMonth, setGstMonth] = useState(String(new Date().getMonth() + 1));
  const [gstYear, setGstYear] = useState(String(new Date().getFullYear()));

  const loadReport = useCallback(async () => {
    setLoading(true); setData(null);
    try {
      const params = cleanParams({ company_id: companyId, date_from: dateFrom, date_to: dateTo });
      const gstParams = cleanParams({ company_id: companyId, month: gstMonth, year: gstYear });
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
        case 'gstr1': res = await odooApi.reports.gstr1(gstParams); break;
        case 'gstr3b': res = await odooApi.reports.gstr3b(gstParams); break;
        default: return;
      }
      setData(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [companyId, reportType, dateFrom, dateTo, gstMonth, gstYear]);
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
    { value: 'gstr1', label: 'GSTR-1', icon: FileSpreadsheet },
    { value: 'gstr3b', label: 'GSTR-3B', icon: Receipt },
  ];

  const isGstReport = reportType === 'gstr1' || reportType === 'gstr3b';

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

      {isGstReport ? (
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <select value={gstMonth} onChange={e => setGstMonth(e.target.value)}
              className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm"
              data-testid="gst-month-select">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>{new Date(2000, i).toLocaleString('en', { month: 'short' })}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <select value={gstYear} onChange={e => setGstYear(e.target.value)}
              className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm"
              data-testid="gst-year-select">
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return <option key={y} value={String(y)}>{y}</option>;
              })}
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={loadReport} data-testid="report-refresh">Refresh</Button>
        </div>
      ) : (
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
      )}

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

            {reportType === 'gstr1' && data && (
              <div className="space-y-6" data-testid="gstr1-report">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="text-lg px-4 py-1">GSTR-1 — {data.period}</Badge>
                </div>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">Taxable Value</p><p className="font-bold">{fmt(data.totals?.taxable_value)}</p></div>
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">CGST</p><p className="font-bold">{fmt(data.totals?.cgst)}</p></div>
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">SGST</p><p className="font-bold">{fmt(data.totals?.sgst)}</p></div>
                  <div className="p-3 bg-muted rounded text-center"><p className="text-xs text-muted-foreground">IGST</p><p className="font-bold">{fmt(data.totals?.igst)}</p></div>
                  <div className="p-3 bg-primary/10 rounded text-center"><p className="text-xs text-muted-foreground">Invoice Value</p><p className="font-bold text-primary">{fmt(data.totals?.invoice_value)}</p></div>
                </div>
                <div className="text-sm text-muted-foreground">B2B: {data.totals?.b2b_count} invoices | B2C: {data.totals?.b2c_count} invoices | Total: {data.totals?.total_invoices}</div>
                {/* B2B Section */}
                {data.b2b?.length > 0 && (
                  <details open>
                    <summary className="font-semibold cursor-pointer mb-2">B2B Invoices (with GSTIN)</summary>
                    <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Partner</TableHead><TableHead>GSTIN</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>{data.b2b.map((r, i) => (
                        <TableRow key={i} className={r.is_refund ? 'text-destructive' : ''}>
                          <TableCell className="font-mono text-sm">{r.invoice_number}{r.is_refund && <Badge variant="destructive" className="ml-1 text-[10px]">CN</Badge>}</TableCell>
                          <TableCell>{r.invoice_date}</TableCell><TableCell>{r.partner_name}</TableCell><TableCell className="font-mono text-xs">{r.gstin}</TableCell>
                          <TableCell className="text-right">{fmtd(r.taxable_value)}</TableCell><TableCell className="text-right">{fmtd(r.cgst)}</TableCell><TableCell className="text-right">{fmtd(r.sgst)}</TableCell><TableCell className="text-right">{fmtd(r.igst)}</TableCell><TableCell className="text-right font-semibold">{fmtd(r.total)}</TableCell>
                        </TableRow>
                      ))}</TableBody></Table>
                  </details>
                )}
                {/* B2C Section */}
                {data.b2c_small?.length > 0 && (
                  <details>
                    <summary className="font-semibold cursor-pointer mb-2">B2C Invoices (without GSTIN)</summary>
                    <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Partner</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>{data.b2c_small.map((r, i) => (
                        <TableRow key={i}><TableCell className="font-mono text-sm">{r.invoice_number}</TableCell><TableCell>{r.invoice_date}</TableCell><TableCell>{r.partner_name}</TableCell>
                          <TableCell className="text-right">{fmtd(r.taxable_value)}</TableCell><TableCell className="text-right">{fmtd(r.cgst)}</TableCell><TableCell className="text-right">{fmtd(r.sgst)}</TableCell><TableCell className="text-right">{fmtd(r.igst)}</TableCell><TableCell className="text-right font-semibold">{fmtd(r.total)}</TableCell>
                        </TableRow>
                      ))}</TableBody></Table>
                  </details>
                )}
                {/* HSN Summary */}
                {data.hsn_summary?.length > 0 && (
                  <details>
                    <summary className="font-semibold cursor-pointer mb-2">HSN Summary</summary>
                    <Table><TableHeader><TableRow><TableHead>HSN</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead></TableRow></TableHeader>
                      <TableBody>{data.hsn_summary.map((r, i) => (
                        <TableRow key={i}><TableCell className="font-mono text-sm">{r.hsn_code}</TableCell><TableCell>{r.description}</TableCell>
                          <TableCell className="text-right">{r.gst_rate}%</TableCell><TableCell className="text-right">{r.quantity}</TableCell>
                          <TableCell className="text-right">{fmtd(r.taxable_value)}</TableCell><TableCell className="text-right">{fmtd(r.cgst)}</TableCell><TableCell className="text-right">{fmtd(r.sgst)}</TableCell><TableCell className="text-right">{fmtd(r.igst)}</TableCell>
                        </TableRow>
                      ))}</TableBody></Table>
                  </details>
                )}
              </div>
            )}

            {reportType === 'gstr3b' && data && (
              <div className="space-y-6" data-testid="gstr3b-report">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="text-lg px-4 py-1">GSTR-3B — {data.period}</Badge>
                </div>
                {/* 3.1 Outward Supplies */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="py-3"><CardTitle className="text-sm">3.1 Outward Supplies (Sales)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">Taxable</p><p className="font-bold text-sm">{fmt(data.outward_supplies?.taxable_value)}</p></div>
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">CGST</p><p className="font-bold text-sm">{fmt(data.outward_supplies?.cgst)}</p></div>
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">SGST</p><p className="font-bold text-sm">{fmt(data.outward_supplies?.sgst)}</p></div>
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">IGST</p><p className="font-bold text-sm">{fmt(data.outward_supplies?.igst)}</p></div>
                      <div className="p-2 bg-blue-500/10 rounded text-center"><p className="text-[10px] text-muted-foreground">Total Tax</p><p className="font-bold text-sm">{fmt(data.outward_supplies?.total_tax)}</p></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{data.outward_supplies?.invoice_count} invoices</p>
                  </CardContent>
                </Card>
                {/* 3.2 Inward Supplies (ITC) */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="py-3"><CardTitle className="text-sm">4. Eligible ITC (Purchases)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">CGST Credit</p><p className="font-bold text-sm">{fmt(data.itc_available?.cgst)}</p></div>
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">SGST Credit</p><p className="font-bold text-sm">{fmt(data.itc_available?.sgst)}</p></div>
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">IGST Credit</p><p className="font-bold text-sm">{fmt(data.itc_available?.igst)}</p></div>
                      <div className="p-2 bg-green-500/10 rounded text-center"><p className="text-[10px] text-muted-foreground">Total ITC</p><p className="font-bold text-sm">{fmt(data.itc_available?.total)}</p></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{data.inward_supplies?.bill_count} bills</p>
                  </CardContent>
                </Card>
                {/* 6.1 Tax Payable */}
                <Card className="border-l-4 border-l-red-500">
                  <CardHeader className="py-3"><CardTitle className="text-sm">6.1 Payment of Tax</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">CGST Payable</p><p className="font-bold text-sm">{fmt(data.tax_payable?.cgst)}</p></div>
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">SGST Payable</p><p className="font-bold text-sm">{fmt(data.tax_payable?.sgst)}</p></div>
                      <div className="p-2 bg-muted rounded text-center"><p className="text-[10px] text-muted-foreground">IGST Payable</p><p className="font-bold text-sm">{fmt(data.tax_payable?.igst)}</p></div>
                      <div className={`p-2 rounded text-center ${data.net_payable >= 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                        <p className="text-[10px] text-muted-foreground">Net Payable</p>
                        <p className={`font-bold text-sm ${data.net_payable >= 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(data.net_payable)}</p>
                      </div>
                    </div>
                    {data.itc_refund?.total > 0 && (
                      <p className="text-xs text-green-600 mt-2">ITC Refund available: {fmt(data.itc_refund.total)}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
