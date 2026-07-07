import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/context/CompanyContext';
import { DollarSign, Receipt, CreditCard, BookOpen, BarChart3, Settings, Bot } from 'lucide-react';
import { OverviewTab } from './accounting/OverviewTab';
import { InvoicingTab } from './accounting/InvoicingTab';
import { PaymentsTab } from './accounting/PaymentsTab';
import { JournalEntriesTab } from './accounting/JournalEntriesTab';
import { ReportsTab } from './accounting/ReportsTab';
import { ConfigTab } from './accounting/ConfigTab';
import { AiAssistantTab } from './accounting/AiAssistantTab';

export default function OdooAccountingPage() {
  const { companyId } = useCompany();

  return (
    <div className="space-y-4 animate-fade-in" data-testid="odoo-accounting-page">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Accounting</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Double-entry bookkeeping system</p>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-4xl grid-cols-7 h-9">
          <TabsTrigger value="overview" className="text-xs" data-testid="acc-tab-overview"><DollarSign size={13} className="mr-1 hidden sm:inline" />Overview</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs" data-testid="acc-tab-ai"><Bot size={13} className="mr-1 hidden sm:inline" />AI</TabsTrigger>
          <TabsTrigger value="invoicing" className="text-xs" data-testid="acc-tab-invoicing"><Receipt size={13} className="mr-1 hidden sm:inline" />Invoicing</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs" data-testid="acc-tab-payments"><CreditCard size={13} className="mr-1 hidden sm:inline" />Payments</TabsTrigger>
          <TabsTrigger value="entries" className="text-xs" data-testid="acc-tab-entries"><BookOpen size={13} className="mr-1 hidden sm:inline" />Entries</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs" data-testid="acc-tab-reports"><BarChart3 size={13} className="mr-1 hidden sm:inline" />Reports</TabsTrigger>
          <TabsTrigger value="config" className="text-xs" data-testid="acc-tab-config"><Settings size={13} className="mr-1 hidden sm:inline" />Config</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab companyId={companyId} /></TabsContent>
        <TabsContent value="ai"><AiAssistantTab companyId={companyId} /></TabsContent>
        <TabsContent value="invoicing"><InvoicingTab companyId={companyId} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab companyId={companyId} /></TabsContent>
        <TabsContent value="entries"><JournalEntriesTab companyId={companyId} /></TabsContent>
        <TabsContent value="reports"><ReportsTab companyId={companyId} /></TabsContent>
        <TabsContent value="config"><ConfigTab companyId={companyId} /></TabsContent>
      </Tabs>
    </div>
  );
}
