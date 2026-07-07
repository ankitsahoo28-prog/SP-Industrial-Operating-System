import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/context/CompanyContext';
import { Package, LayoutDashboard, Truck, ArrowUpDown, Warehouse, AlertTriangle, BarChart3, Settings } from 'lucide-react';
import { InvOverviewTab } from './inventory/OverviewTab';
import { ProductsTab } from './inventory/ProductsTab';
import { StockMovesTab } from './inventory/StockMovesTab';
import { AdjustmentsTab } from './inventory/AdjustmentsTab';
import { WarehousesTab } from './inventory/WarehousesTab';
import { ReorderTab } from './inventory/ReorderTab';
import { ValuationTab } from './inventory/ValuationTab';
import { InvConfigTab } from './inventory/ConfigTab';

export default function InventoryPage() {
  const { companyId } = useCompany();
  return (
    <div className="space-y-4 animate-fade-in" data-testid="odoo-inventory-page">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Warehouse & inventory management</p>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-4xl grid-cols-8 h-9">
          <TabsTrigger value="overview" className="text-xs" data-testid="inv-tab-overview"><LayoutDashboard size={13} className="mr-1 hidden sm:inline" />Overview</TabsTrigger>
          <TabsTrigger value="products" className="text-xs" data-testid="inv-tab-products"><Package size={13} className="mr-1 hidden sm:inline" />Products</TabsTrigger>
          <TabsTrigger value="moves" className="text-xs" data-testid="inv-tab-moves"><Truck size={13} className="mr-1 hidden sm:inline" />Moves</TabsTrigger>
          <TabsTrigger value="adjustments" className="text-xs" data-testid="inv-tab-adjustments"><ArrowUpDown size={13} className="mr-1 hidden sm:inline" />Adjust</TabsTrigger>
          <TabsTrigger value="warehouses" className="text-xs" data-testid="inv-tab-warehouses"><Warehouse size={13} className="mr-1 hidden sm:inline" />Warehouses</TabsTrigger>
          <TabsTrigger value="reorder" className="text-xs" data-testid="inv-tab-reorder"><AlertTriangle size={13} className="mr-1 hidden sm:inline" />Reorder</TabsTrigger>
          <TabsTrigger value="valuation" className="text-xs" data-testid="inv-tab-valuation"><BarChart3 size={13} className="mr-1 hidden sm:inline" />Valuation</TabsTrigger>
          <TabsTrigger value="config" className="text-xs" data-testid="inv-tab-config"><Settings size={13} className="mr-1 hidden sm:inline" />Config</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><InvOverviewTab companyId={companyId} /></TabsContent>
        <TabsContent value="products"><ProductsTab companyId={companyId} /></TabsContent>
        <TabsContent value="moves"><StockMovesTab companyId={companyId} /></TabsContent>
        <TabsContent value="adjustments"><AdjustmentsTab companyId={companyId} /></TabsContent>
        <TabsContent value="warehouses"><WarehousesTab companyId={companyId} /></TabsContent>
        <TabsContent value="reorder"><ReorderTab companyId={companyId} /></TabsContent>
        <TabsContent value="valuation"><ValuationTab companyId={companyId} /></TabsContent>
        <TabsContent value="config"><InvConfigTab companyId={companyId} /></TabsContent>
      </Tabs>
    </div>
  );
}
