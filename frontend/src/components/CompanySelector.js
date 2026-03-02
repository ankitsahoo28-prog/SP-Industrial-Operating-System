import { useCompany } from '@/context/CompanyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export function CompanySelector() {
  const { companies, selectedCompany, selectCompany } = useCompany();

  if (!companies.length) return null;

  return (
    <div className="flex items-center gap-2" data-testid="company-selector">
      <Building2 size={16} className="text-muted-foreground" />
      <Select
        value={selectedCompany?.id || ''}
        onValueChange={(id) => {
          const c = companies.find(co => co.id === id);
          if (c) selectCompany(c);
        }}
      >
        <SelectTrigger className="w-[200px] h-8 text-sm" data-testid="company-select-trigger">
          <SelectValue placeholder="Select company" />
        </SelectTrigger>
        <SelectContent>
          {companies.map(c => (
            <SelectItem key={c.id} value={c.id} data-testid={`company-option-${c.id}`}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
