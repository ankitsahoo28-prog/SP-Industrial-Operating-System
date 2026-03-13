import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AiBusinessAssistant from '@/components/AiBusinessAssistant';
import AiAuditTrail from '@/components/AiAuditTrail';
import AiSmartLearning from '@/components/AiSmartLearning';
import { Bot, ShieldCheck, Brain } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AiAssistantPage() {
  const { token } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/companies`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setCompanies(list);
        if (list.length > 0 && !companyId) setCompanyId(list[0].id);
      })
      .catch(() => {});
  }, [token]);

  return (
    <div className="space-y-4" data-testid="ai-assistant-page">
      {companies.length > 1 && (
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-64" data-testid="ai-company-select">
            <SelectValue placeholder="Select Company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md" data-testid="ai-tabs">
          <TabsTrigger value="chat" className="flex items-center gap-1.5 text-xs" data-testid="tab-chat">
            <Bot size={14} />Chat
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5 text-xs" data-testid="tab-audit">
            <ShieldCheck size={14} />Audit Trail
          </TabsTrigger>
          <TabsTrigger value="learning" className="flex items-center gap-1.5 text-xs" data-testid="tab-learning">
            <Brain size={14} />Smart Learning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <AiBusinessAssistant companyId={companyId} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AiAuditTrail companyId={companyId} />
        </TabsContent>

        <TabsContent value="learning" className="mt-4">
          <AiSmartLearning companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
