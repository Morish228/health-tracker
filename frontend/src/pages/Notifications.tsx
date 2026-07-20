import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bell, CalendarDays, Siren, TrendingUp, Pill, Users, CheckCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { backend } from '../lib/api';
import { SkeletonRows, EmptyState, PageTitle } from '../components/ui';

interface Notification {
  _id: string;
  type: 'APPOINTMENT' | 'SOS' | 'THRESHOLD' | 'MISSED_DOSE' | 'CAREGIVER_INVITE' | 'GENERAL';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const ICON: Record<Notification['type'], { Icon: LucideIcon; cls: string }> = {
  APPOINTMENT: { Icon: CalendarDays, cls: 'bg-sky-50 text-sky-500' },
  SOS: { Icon: Siren, cls: 'bg-red-50 text-red-500' },
  THRESHOLD: { Icon: TrendingUp, cls: 'bg-amber-50 text-amber-500' },
  MISSED_DOSE: { Icon: Pill, cls: 'bg-rose-50 text-rose-500' },
  CAREGIVER_INVITE: { Icon: Users, cls: 'bg-violet-50 text-violet-500' },
  GENERAL: { Icon: Bell, cls: 'bg-indigo-50 text-indigo-500' },
};

export default function Notifications() {
  const qc = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await backend.get('/api/notifications');
      return res.data as { unreadCount: number; data: Notification[] };
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await backend.patch(`/api/notifications/${id}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await backend.patch('/api/notifications/read-all');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const list = notifications.data?.data ?? [];
  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <PageTitle
          icon={Bell}
          sub={unread > 0 ? `${unread} unread` : 'All caught up'}
        >
          Notifications
        </PageTitle>
        <button
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending || unread === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </button>
      </div>

      <div className="space-y-2">
        {notifications.isLoading && <SkeletonRows rows={4} />}
        {list.length === 0 && !notifications.isLoading && (
          <EmptyState icon={Bell} title="No notifications yet" hint="Bookings, alerts and reminders will appear here." />
        )}
        {list.map((n, i) => {
          const { Icon, cls } = ICON[n.type] ?? ICON.GENERAL;
          return (
            <motion.div
              key={n._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className={`flex items-start gap-3 rounded-xl border p-4 transition hover:shadow-sm ${
                n.read ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/50'
              }`}
            >
              <span className={`rounded-lg p-2 ${cls}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{n.title}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                </div>
                <p className="text-sm text-slate-600">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead.mutate(n._id)}
                  disabled={markRead.isPending}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  Mark read
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
