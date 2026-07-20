import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Bot, Activity, Pill, CalendarDays, FileText,
  ScanLine, Users, Siren, Bell, User, HeartPulse, LogOut, Stethoscope,
  CalendarClock, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { backend } from '../lib/api';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const PATIENT_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/vitals', label: 'Vitals', icon: Activity },
  { to: '/medications', label: 'Medications', icon: Pill },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/reports', label: 'Reports (AI)', icon: FileText },
  { to: '/scanner', label: 'Medicine Scanner', icon: ScanLine },
  { to: '/caregivers', label: 'Caregivers', icon: Users },
  { to: '/emergency', label: 'Emergency', icon: Siren },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: User },
];

const DOCTOR_NAV: NavItem[] = [
  { to: '/doctor', label: 'Appointments', icon: CalendarDays, end: true },
  { to: '/doctor/slots', label: 'Availability', icon: CalendarClock },
  { to: '/doctor/profile', label: 'My Profile', icon: Stethoscope },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';
  const NAV = isDoctor ? DOCTOR_NAV : PATIENT_NAV;

  // Patient-only unread notification count, polled every 60s.
  const unread = useQuery({
    queryKey: ['notifications'],
    enabled: !isDoctor,
    refetchInterval: 60_000,
    queryFn: async () => (await backend.get('/api/notifications')).data.unreadCount as number,
  });

  const initial = (user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-1.5 text-white shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-lg font-bold text-transparent">
            Health Companion
          </span>
        </div>
        <nav className="nice-scroll flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Wrench className="h-4 w-4 shrink-0" />
              Admin
            </NavLink>
          )}
        </nav>
        <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          AI-powered elderly care
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
              {initial}
            </span>
            <div className="text-sm text-slate-600">
              {user?.firstName ? `Hi, ${user.firstName}` : user?.email}
              {isDoctor && <span className="ml-1.5 text-xs text-indigo-500">(Doctor)</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isDoctor && (
              <NavLink
                to="/notifications"
                className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {(unread.data ?? 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
                    {unread.data}
                  </span>
                )}
              </NavLink>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </header>
        <main className="nice-scroll flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
