import { Card, CardContent } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

export default function PayrollPage() {
  return (
    <div className="space-y-6" data-testid="payroll-page">
      <div>
        <h1 className="text-3xl font-heading font-bold text-primary">Payroll Management</h1>
        <p className="text-muted-foreground mt-1">Manage employee salaries and attendance</p>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <DollarSign size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">Payroll Module</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Payroll calculation based on attendance data will be implemented here.
            This will include salary computation, attendance summaries, and payment processing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}