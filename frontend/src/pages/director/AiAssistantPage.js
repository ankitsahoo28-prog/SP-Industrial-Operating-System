import AiBusinessAssistant from '@/components/AiBusinessAssistant';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AiAssistantPage() {
  const { user, token } = useAuth();
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
      <AiBusinessAssistant companyId={companyId} />
    </div>
  );
}
