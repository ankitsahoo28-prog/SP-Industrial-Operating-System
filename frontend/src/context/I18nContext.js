import { createContext, useContext, useState, useEffect } from 'react';
import { i18nApi } from '@/lib/api';

const I18nContext = createContext();

const DEFAULT_TRANSLATIONS = {
  dashboard: 'Dashboard', tasks: 'Tasks', reports: 'Reports', users: 'Users',
  accounting: 'Accounting', inventory: 'Inventory', indents: 'Indents',
  tracking: 'Tracking', audit_trail: 'Audit Trail', settings: 'Settings',
  login: 'Sign In', logout: 'Logout', welcome: 'Welcome', submit: 'Submit',
  cancel: 'Cancel', edit: 'Edit', delete: 'Delete', save: 'Save',
  search: 'Search', loading: 'Loading...', language: 'Language',
  my_team: 'My Team', my_tasks: 'My Tasks',
};

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('sp_lang') || 'en');
  const [translations, setTranslations] = useState(DEFAULT_TRANSLATIONS);

  useEffect(() => {
    localStorage.setItem('sp_lang', lang);
    if (lang === 'en') {
      setTranslations(DEFAULT_TRANSLATIONS);
      return;
    }
    i18nApi.getTranslations(lang).then(r => setTranslations(r.data)).catch(() => {});
  }, [lang]);

  const t = (key) => translations[key] || key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
