import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { notificationApi } from '@/lib/api';
import { Bell, Check, CheckCheck, Trash2, ClipboardList, Package, Users, Building2, FileText, X } from 'lucide-react';

const CATEGORY_ICONS = {
  task: ClipboardList,
  indent: Package,
  report: FileText,
  user: Users,
  company: Building2,
};

const CATEGORY_COLORS = {
  task: 'text-blue-600',
  indent: 'text-amber-600',
  report: 'text-green-600',
  user: 'text-purple-600',
  company: 'text-cyan-600',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationApi.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const res = await notificationApi.getAll(30);
      setNotifications(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id) => {
    await notificationApi.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id) => {
    await notificationApi.remove(id);
    const n = notifications.find(x => x.id === id);
    setNotifications(prev => prev.filter(x => x.id !== id));
    if (n && !n.read) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative" ref={ref} data-testid="notification-bell-wrapper">
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2"
        onClick={() => setOpen(!open)}
        data-testid="notification-bell-btn"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white" data-testid="notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] rounded-xl border bg-card shadow-xl z-50 overflow-hidden" data-testid="notification-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead} data-testid="mark-all-read-btn">
                  <CheckCheck size={14} className="mr-1" />Mark all read
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 p-1" onClick={() => setOpen(false)}><X size={14} /></Button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const Icon = CATEGORY_ICONS[n.category] || Bell;
                const color = CATEGORY_COLORS[n.category] || 'text-muted-foreground';
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                    data-testid={`notif-item-${n.id}`}
                  >
                    <div className={`flex-shrink-0 mt-0.5 ${color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.read ? 'font-semibold' : ''}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {!n.read && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleMarkRead(n.id)} data-testid={`mark-read-${n.id}`}>
                          <Check size={12} />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-error" onClick={() => handleDelete(n.id)} data-testid={`delete-notif-${n.id}`}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
