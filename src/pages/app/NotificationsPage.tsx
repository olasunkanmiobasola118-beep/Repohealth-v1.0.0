import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  linkPath: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsPage() {
  const { apiFetch, refreshSession } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setItems(res.notifications);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read.');
    }
  };

  const markAllRead = async () => {
    setError(null);
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read.');
    }
  };

  return (
    <AppShell title="Notifications">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#555562] dark:text-[#9898A6]">
            Scan completions, critical vulnerability alerts, verification failures, and PR updates.
          </p>
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] text-xs font-semibold hover:border-[#7656D6]"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Mark all read</span>
          </button>
        </div>

        {error ? (
          <div role="alert" className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#777783]">Loading notifications...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#777783]">No notifications yet.</div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  n.isRead ? 'opacity-70' : 'bg-[#F8F8FA]/60 dark:bg-[#19191F]/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.isRead ? 'text-[#777783]' : 'text-[#7656D6]'}`} />
                  <div>
                    <div className="text-sm font-semibold">{n.title}</div>
                    <p className="text-xs text-[#555562] dark:text-[#9898A6] mt-0.5">{n.message}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs">
                      <Link to={n.linkPath} className="text-[#7656D6] font-medium hover:underline">
                        View details
                      </Link>
                      <span className="font-mono text-[#777783] tabular-nums">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                {!n.isRead ? (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="text-xs font-medium text-[#7656D6] hover:underline shrink-0"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
