import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { inventoryApi } from '@/lib/api';
import { Package, Warehouse, AlertTriangle, XCircle, Truck, ArrowDown, ArrowUp, DollarSign } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function StatCard({ icon: Icon, label, value, color = "text-primary", sub }) {
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`inv-stat-${label.toLowerCase().replace(/\s+/g,'-')}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-muted"><Icon size={20} className={color} /></div>
        <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-lg font-heading font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function InvOverviewTab({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = companyId ? { company_id: companyId } : {};
    inventoryApi.dashboard(params).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!data) return <p className="text-muted-foreground text-center py-8">Unable to load inventory dashboard</p>;

  return (
    <div className="space-y-6" data-testid="inv-overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Products" value={data.total_products} color="text-primary" />
        <StatCard icon={DollarSign} label="Stock Value" value={fmt(data.total_value)} color="text-success" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={data.low_stock} color="text-warning" />
        <StatCard icon={XCircle} label="Out of Stock" value={data.out_of_stock} color="text-error" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ArrowDown} label="Pending Receipts" value={data.pending_receipts} />
        <StatCard icon={ArrowUp} label="Pending Deliveries" value={data.pending_deliveries} />
        <StatCard icon={Truck} label="Moves Today" value={data.total_moves_today} />
        <StatCard icon={Warehouse} label="Warehouses" value={data.warehouses} />
      </div>
    </div>
  );
}
