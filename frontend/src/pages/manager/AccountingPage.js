import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/context/CompanyContext';
import { DollarSign, Receipt, CreditCard, BookOpen, BarChart3, Settings, Bot } from 'lucide-react';
import { OverviewTab } from '../director/accounting/OverviewTab';
import { InvoicingTab } from '../director/accounting/InvoicingTab';
import { PaymentsTab } from '../director/accounting/PaymentsTab';
import { JournalEntriesTab } from '../director/accounting/JournalEntriesTab';
import { ReportsTab } from '../director/accounting/ReportsTab';
import { ConfigTab } from '../director/accounting/ConfigTab';
import { AiAssistantTab } from '../director/accounting/AiAssistantTab';

export default function AccountingPage() {
  const { companyId } = useCompany();

  return (
    <div className="space-y-6" data-testid="manager-accounting-page">
      <div>
        <h1 className="text-4xl font-heading font-bold">Accounting</h1>
        <p className="text-muted-foreground mt-1">Complete double-entry bookkeeping system</p>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-4xl grid-cols-7">
          <TabsTrigger value="overview" data-testid="acc-tab-overview"><DollarSign size={14} className="mr-1 hidden sm:inline" />Overview</TabsTrigger>
          <TabsTrigger value="ai" data-testid="acc-tab-ai"><Bot size={14} className="mr-1 hidden sm:inline" />AI Assistant</TabsTrigger>
          <TabsTrigger value="invoicing" data-testid="acc-tab-invoicing"><Receipt size={14} className="mr-1 hidden sm:inline" />Invoicing</TabsTrigger>
          <TabsTrigger value="payments" data-testid="acc-tab-payments"><CreditCard size={14} className="mr-1 hidden sm:inline" />Payments</TabsTrigger>
          <TabsTrigger value="entries" data-testid="acc-tab-entries"><BookOpen size={14} className="mr-1 hidden sm:inline" />Entries</TabsTrigger>
          <TabsTrigger value="reports" data-testid="acc-tab-reports"><BarChart3 size={14} className="mr-1 hidden sm:inline" />Reports</TabsTrigger>
          <TabsTrigger value="config" data-testid="acc-tab-config"><Settings size={14} className="mr-1 hidden sm:inline" />Config</TabsTrigger>
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
