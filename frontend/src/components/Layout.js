import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  MapPin,
  FileText,
  DollarSign,
  Package,
  LogOut,
  Menu,
  X,
  History,
  Warehouse,
  Settings,
  Globe,
  Building2,
  BarChart3,
  Calendar,
  Shield,
  ArrowLeftRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';
import { CompanySelector } from '@/components/CompanySelector';

export const Layout = ({ children, role }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useI18n();

  const getNavItems = () => {
    const base = [
      { icon: LayoutDashboard, label: t('dashboard'), path: '' },
    ];

    if (role === 'director') {
      return [
        ...base,
        { icon: Calendar, label: 'Daily Summary', path: '/daily-summary' },
        { icon: Building2, label: 'Companies', path: '/companies' },
        { icon: BarChart3, label: 'Executive', path: '/executive' },
        { icon: Users, label: t('users'), path: '/users' },
        { icon: ClipboardList, label: t('tasks'), path: '/tasks' },
        { icon: MapPin, label: t('tracking'), path: '/tracking' },
        { icon: FileText, label: t('reports'), path: '/reports' },
        { icon: Package, label: t('indents'), path: '/indents' },
        { icon: DollarSign, label: t('accounting'), path: '/accounting' },
        { icon: Warehouse, label: t('inventory'), path: '/inventory' },
        { icon: ArrowLeftRight, label: 'Reconciliation', path: '/reconciliation' },
        { icon: Shield, label: 'Roles', path: '/roles' },
        { icon: History, label: t('audit_trail'), path: '/audit-log' },
        { icon: Settings, label: t('settings'), path: '/settings' },
      ];
    } else if (role === 'manager') {
      return [
        ...base,
        { icon: Users, label: t('my_team'), path: '/team' },
        { icon: ClipboardList, label: t('tasks'), path: '/tasks' },
        { icon: MapPin, label: t('tracking'), path: '/tracking' },
        { icon: FileText, label: t('reports'), path: '/reports' },
        { icon: Package, label: t('indents'), path: '/indents' },
        { icon: DollarSign, label: t('accounting'), path: '/accounting' },
        { icon: Warehouse, label: t('inventory'), path: '/inventory' },
      ];
    } else {
      return [
        ...base,
        { icon: ClipboardList, label: t('my_tasks'), path: '/tasks' },
        { icon: FileText, label: t('reports'), path: '/reports' },
      ];
    }
  };

  const navItems = getNavItems();
  const basePath = `/${role === 'ground_staff' ? 'ground-staff' : role}`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    const fullPath = `${basePath}${path}`;
    return location.pathname === fullPath || (path === '' && location.pathname === basePath);
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r flex-col z-40">
        <div className="p-6 border-b">
          <p className="text-xs text-muted-foreground mt-1">Industrial OS</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const fullPath = `${basePath}${item.path}`;
            return (
              <Link
                key={item.path}
                to={fullPath}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                  isActive(item.path)
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-foreground hover:bg-secondary'
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="px-4 py-3 bg-secondary/50 rounded-lg mb-3">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-accent mt-1 uppercase font-semibold">{user?.role?.replace('_', ' ')}</p>
          </div>
          <div className="flex items-center gap-1 mb-3 px-1">
            <Globe size={14} className="text-muted-foreground" />
            {['en', 'hi', 'od'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={cn('px-2 py-1 rounded text-xs font-medium transition-colors', lang === l ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-secondary')}
                data-testid={`lang-${l}`}
              >{l === 'en' ? 'EN' : l === 'hi' ? 'HI' : 'OD'}</button>
            ))}
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
            data-testid="logout-button"
          >
            <LogOut size={16} className="mr-2" />
            {t('logout')}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-heading font-bold text-primary">Industrial OS</h1>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-toggle">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-card z-40 overflow-y-auto">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const fullPath = `${basePath}${item.path}`;
              return (
                <Link
                  key={item.path}
                  to={fullPath}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                    isActive(item.path)
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground hover:bg-secondary'
                  )}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t">
            <div className="px-4 py-3 bg-secondary/50 rounded-lg mb-3">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-accent mt-1 uppercase font-semibold">{user?.role?.replace('_', ' ')}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="hidden lg:flex items-center justify-end p-3 border-b bg-card/50">
          <CompanySelector />
        </div>
        <div className="p-4 md:p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
};