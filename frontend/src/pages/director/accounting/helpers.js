import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
export const fmtd = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

export function StatCard({ icon: Icon, label, value, color = "text-primary", sub }) {
  return (
    <Card className="group hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" data-testid={`stat-${label.toLowerCase().replace(/\s+/g,'-')}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-muted transition-transform duration-200 group-hover:scale-110"><Icon size={18} className={color} /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={`text-lg font-heading font-bold`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function LoadingSpinner() {
  return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
}

export function EmptyState({ icon: Icon, message }) {
  return (
    <Card><CardContent className="p-12 text-center">
      <Icon size={48} className="mx-auto text-muted-foreground mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </CardContent></Card>
  );
}

export function stateBadge(state) {
  if (state === 'draft') return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Draft</Badge>;
  if (state === 'posted') return <Badge className="bg-success/20 text-success border-0">Posted</Badge>;
  return <Badge variant="outline" className="text-error border-error/30">Cancelled</Badge>;
}

export function payBadge(ps) {
  if (ps === 'paid') return <Badge className="bg-success/20 text-success text-[10px] border-0">Paid</Badge>;
  if (ps === 'partial') return <Badge className="bg-warning/20 text-warning text-[10px] border-0">Partial</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-[10px]">Not Paid</Badge>;
}

export const cleanParams = (params) => {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') clean[k] = v;
  }
  return clean;
};
