import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, ClipboardList, MapPin, FileText, DollarSign,
  Package, LogOut, Menu, X, History, Warehouse, Settings, Globe, Building2,
  BarChart3, Calendar, Shield, ArrowLeftRight, Bot, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';
import { CompanySelector } from '@/components/CompanySelector';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';

const NAV_GROUPS = {
  director: [
    {
      label: 'Overview',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '', permission: null },
        { icon: Calendar, label: 'Daily Summary', path: '/daily-summary', permission: 'view_daily_summary' },
        { icon: BarChart3, label: 'Executive', path: '/executive', permission: 'view_executive' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { icon: Building2, label: 'Companies', path: '/companies', permission: 'manage_companies' },
        { icon: Users, label: 'Users', path: '/users', permission: 'manage_users' },
        { icon: ClipboardList, label: 'Tasks', path: '/tasks', permission: 'manage_tasks' },
        { icon: MapPin, label: 'Tracking', path: '/tracking', permission: 'view_tracking' },
        { icon: Package, label: 'Indents', path: '/indents', permission: 'manage_indents' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { icon: DollarSign, label: 'Accounting', path: '/accounting', permission: 'view_accounting' },
        { icon: Warehouse, label: 'Inventory', path: '/inventory', permission: 'view_inventory' },
        { icon: ArrowLeftRight, label: 'Reconciliation', path: '/reconciliation', permission: 'view_reconciliation' },
        { icon: FileText, label: 'Reports', path: '/reports', permission: 'view_reports' },
      ],
    },
    {
      label: 'System',
      items: [
        { icon: Bot, label: 'AI Assistant', path: '/ai-assistant', permission: 'view_accounting' },
        { icon: Shield, label: 'Roles', path: '/roles', permission: 'manage_roles' },
        { icon: History, label: 'Audit Trail', path: '/audit-log', permission: 'view_audit_log' },
        { icon: Settings, label: 'Settings', path: '/settings', permission: 'view_settings' },
      ],
    },
  ],
};

export const Layout = ({ children, role }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const { lang, setLang, t } = useI18n();

  const basePath = `/${role === 'ground_staff' ? 'ground-staff' : role}`;

  const getGroups = () => {
    if (role === 'director') return NAV_GROUPS.director;
    // For non-directors, build flat list
    const allItems = [
      { icon: LayoutDashboard, label: 'Dashboard', path: '', permission: null },
      { icon: Users, label: role === 'manager' ? t('my_team') : t('users'), path: '/team', permission: 'manage_users' },
      { icon: ClipboardList, label: role === 'ground_staff' ? t('my_tasks') : t('tasks'), path: '/tasks', permission: 'manage_tasks' },
      { icon: MapPin, label: t('tracking'), path: '/tracking', permission: 'view_tracking' },
      { icon: FileText, label: t('reports'), path: '/reports', permission: 'view_reports' },
      { icon: Package, label: t('indents'), path: '/indents', permission: 'manage_indents' },
      { icon: DollarSign, label: t('accounting'), path: '/accounting', permission: 'view_accounting' },
      { icon: Warehouse, label: t('inventory'), path: '/inventory', permission: 'view_inventory' },
      { icon: Bot, label: 'AI Assistant', path: '/ai-assistant', permission: 'view_accounting' },
    ];
    return [{ label: '', items: allItems }];
  };

  const groups = getGroups();
  const isActive = (path) => {
    const fullPath = `${basePath}${path}`;
    if (path === '') return location.pathname === basePath || location.pathname === basePath + '/';
    return location.pathname.startsWith(fullPath);
  };

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const renderNav = (isMobile = false) => (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
      {groups.map((group) => {
        const filteredItems = group.items.filter(item =>
          item.permission === null || hasPermission(item.permission)
        );
        if (filteredItems.length === 0) return null;
        const isCollapsed = collapsedGroups[group.label];

        return (
          <div key={group.label || 'root'} className="mb-1">
            {group.label && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 hover:text-slate-300 transition-colors"
                data-testid={`nav-group-${group.label.toLowerCase()}`}
              >
                {group.label}
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
            {!isCollapsed && (
              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const fullPath = `${basePath}${item.path}`;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={fullPath}
                      onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200',
                        active
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      )}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <Icon size={16} strokeWidth={active ? 2.5 : 1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-[hsl(var(--sidebar))] flex-col z-40 border-r border-white/5">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold font-heading">IO</span>
            </div>
            <span className="text-white font-heading font-semibold text-sm tracking-tight">Industrial OS</span>
          </div>
        </div>

        {renderNav()}

        {/* User section */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 mb-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-300 text-xs font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-1 mb-2">
            <Globe size={12} className="text-slate-500" />
            {['en', 'hi', 'od'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                  lang === l ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                )}
                data-testid={`lang-${l}`}
              >{l.toUpperCase()}</button>
            ))}
          </div>
          <Button onClick={handleLogout} variant="ghost" size="sm"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/5 h-8 text-xs"
            data-testid="logout-button"
          >
            <LogOut size={14} className="mr-2" />Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 glass-header border-b z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold font-heading">IO</span>
          </div>
          <span className="font-heading font-semibold text-sm">Industrial OS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CompanySelector />
          <ThemeToggle />
          <NotificationBell />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-toggle">
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 bg-[hsl(var(--sidebar))] z-40 overflow-y-auto">
          {renderNav(true)}
          <div className="p-4 border-t border-white/5">
            <Button onClick={handleLogout} variant="ghost" className="w-full text-slate-400 hover:text-white">
              <LogOut size={14} className="mr-2" />Logout
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:ml-60 min-h-screen pt-14 lg:pt-0">
        {/* Top Bar */}
        <div className="hidden lg:flex items-center justify-between h-14 px-6 border-b glass-header sticky top-0 z-30">
          <div />
          <div className="flex items-center gap-2">
            <CompanySelector />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
