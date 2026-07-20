import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bot, Activity, Pill, CalendarDays, FileText, ScanLine,
  Bell, Flame, HeartPulse, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { backend } from '../lib/api';

const CARDS: { to: string; title: string; desc: string; icon: LucideIcon; grad: string }[] = [
  { to: '/assistant', title: 'AI Assistant', desc: 'Ask, book, or describe symptoms in plain language', icon: Bot, grad: 'from-indigo-500 to-violet-600' },
  { to: '/vitals', title: 'Vitals', desc: 'Log BP, sugar, heart rate & see trends', icon: Activity, grad: 'from-emerald-500 to-teal-600' },
  { to: '/medications', title: 'Medications', desc: 'Prescriptions, reminders & adherence', icon: Pill, grad: 'from-rose-500 to-pink-600' },
  { to: '/appointments', title: 'Appointments', desc: 'Find doctors & book slots', icon: CalendarDays, grad: 'from-sky-500 to-blue-600' },
  { to: '/reports', title: 'Reports (AI)', desc: 'Upload reports & ask verified questions', icon: FileText, grad: 'from-amber-500 to-orange-600' },
  { to: '/scanner', title: 'Medicine Scanner', desc: 'Scan a box, find cheaper generics', icon: ScanLine, grad: 'from-fuchsia-500 to-purple-600' },
];

interface Appt { _id: string; dateTime: string; status: string; doctorId?: { name?: string } }
interface Vital { _id: string; type: string; value: number; unit: string }

function Stat({
  label, value, to, icon: Icon, delay,
}: {
  label: string; value: string; to: string; icon: LucideIcon; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Link
        to={to}
        className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
          <Icon className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="mt-1 text-lg font-semibold text-slate-800">{value}</div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const appts = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => (await backend.get('/api/appointments')).data.data as Appt[],
  });
  const notif = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await backend.get('/api/notifications')).data as { unreadCount: number },
  });
  const vitals = useQuery({
    queryKey: ['vitals', 'latest'],
    queryFn: async () => (await backend.get('/api/vitals/latest')).data.data as Vital[],
  });
  const streak = useQuery({
    queryKey: ['adherence', 'streak'],
    queryFn: async () => (await backend.get('/api/adherence/streak')).data.streak as number,
  });

  const now = Date.now();
  const nextAppt = (appts.data ?? [])
    .filter((a) => a.status === 'SCHEDULED' && new Date(a.dateTime).getTime() >= now)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0];

  return (
    <div>
      {/* hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-200/50"
      >
        <h1 className="text-2xl font-semibold">
          Welcome{user?.firstName ? `, ${user.firstName}` : ''} 👋
        </h1>
        <p className="mt-1 text-sm text-indigo-100">
          Your AI-powered health companion — reports, vitals, medications and appointments in one place.
        </p>
        <Link
          to="/assistant"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
        >
          <Bot className="h-4 w-4" />
          Ask the AI Assistant
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>

      {/* Live stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Next appointment"
          value={nextAppt ? new Date(nextAppt.dateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
          to="/appointments"
          icon={CalendarDays}
          delay={0.05}
        />
        <Stat label="Unread alerts" value={String(notif.data?.unreadCount ?? 0)} to="/notifications" icon={Bell} delay={0.1} />
        <Stat label="Adherence streak" value={`${streak.data ?? 0} day${streak.data === 1 ? '' : 's'}`} to="/medications" icon={Flame} delay={0.15} />
        <Stat label="Vitals logged" value={String(vitals.data?.length ?? 0)} to="/vitals" icon={HeartPulse} delay={0.2} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c, i) => (
          <motion.div
            key={c.to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Link
              to={c.to}
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <span className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${c.grad} p-2.5 text-white shadow-sm transition group-hover:scale-105`}>
                <c.icon className="h-5 w-5" />
              </span>
              <div className="text-base font-semibold text-slate-800">{c.title}</div>
              <div className="mt-1 text-sm text-slate-500">{c.desc}</div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
