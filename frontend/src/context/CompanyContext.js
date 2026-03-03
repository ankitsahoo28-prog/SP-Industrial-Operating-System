import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const CompanyContext = createContext();

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setSelectedCompany(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/companies/my-companies');
      setCompanies(res.data);
      // Directors default to "All Companies" (null), others pick first
      const stored = localStorage.getItem('sp_company_id');
      if (stored === 'all' && user.role === 'director') {
        setSelectedCompany(null);
      } else if (stored && stored !== 'all') {
        const found = res.data.find(c => c.id === stored);
        if (found) {
          setSelectedCompany(found);
        } else if (user.role === 'director') {
          setSelectedCompany(null);
        } else if (res.data.length > 0) {
          setSelectedCompany(res.data[0]);
          localStorage.setItem('sp_company_id', res.data[0].id);
        }
      } else if (user.role === 'director') {
        // Director defaults to "All Companies"
        setSelectedCompany(null);
        localStorage.setItem('sp_company_id', 'all');
      } else if (res.data.length > 0) {
        setSelectedCompany(res.data[0]);
        localStorage.setItem('sp_company_id', res.data[0].id);
      }
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const selectCompany = (company) => {
    setSelectedCompany(company);
    if (company) {
      localStorage.setItem('sp_company_id', company.id);
    } else {
      localStorage.setItem('sp_company_id', 'all');
    }
  };

  const companyId = selectedCompany?.id || null;

  return (
    <CompanyContext.Provider value={{
      companies, selectedCompany, selectCompany, companyId,
      loading, refetchCompanies: fetchCompanies,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
