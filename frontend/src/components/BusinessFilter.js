import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'all', label: 'All Businesses' },
  { value: 'petrol_pump', label: 'Petrol Pump' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'fl_shop', label: 'FL Shop' },
  { value: 'transport', label: 'Transport' },
  { value: 'slag_crushing', label: 'Slag Crushing' },
  { value: 'stone_crusher', label: 'Stone Crusher' },
];

export const BusinessFilter = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <Filter size={16} className="text-muted-foreground" />
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]" data-testid="business-filter">
        <SelectValue placeholder="All Businesses" />
      </SelectTrigger>
      <SelectContent>
        {BUSINESS_TYPES.map((bt) => (
          <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
