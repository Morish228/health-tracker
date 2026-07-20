import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Wrench, Database, CalendarClock, ShieldAlert } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, Button, SectionTitle, PageTitle } from '../components/ui';

/**
 * Admin console — wires POST /api/admin/seed and /api/admin/seed/slots.
 * Backend gates these with requireRole('admin'); we mirror that here.
 */
export default function Admin() {
  const { user } = useAuth();
  const [msg, setMsg] = useState('');

  const seed = useMutation({
    mutationFn: async () => (await backend.post('/api/admin/seed')).data,
    onSuccess: (d) => setMsg(`Seed complete ✓ — ${JSON.stringify(d.data ?? d.message ?? 'done')}`),
    onError: (e) => setMsg(apiError(e, 'Seed failed')),
  });

  const seedSlots = useMutation({
    mutationFn: async () => (await backend.post('/api/admin/seed/slots')).data,
    onSuccess: (d) =>
      setMsg(`Slots reseeded ✓ — ${d.data?.created ?? '?'} slots over ${d.data?.days ?? '?'} days`),
    onError: (e) => setMsg(apiError(e, 'Slot seeding failed')),
  });

  if (user && user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div>
      <PageTitle icon={Wrench} sub="Demo-data management (admin only)">
        Admin
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={Database}>Seed demo data</SectionTitle>
          <p className="mb-4 text-sm text-slate-500">
            Creates demo doctors, hospitals, a week of slots and the demo admin account.
            Idempotent — safe to run again.
          </p>
          <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Database className="h-4 w-4" />
            {seed.isPending ? 'Seeding…' : 'Run full seed'}
          </Button>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={CalendarClock}>Reseed appointment slots</SectionTitle>
          <p className="mb-4 text-sm text-slate-500">
            Slots expire as days pass — run this to top up the next 7 days of availability
            for every demo doctor.
          </p>
          <Button variant="secondary" onClick={() => seedSlots.mutate()} disabled={seedSlots.isPending}>
            <CalendarClock className="h-4 w-4" />
            {seedSlots.isPending ? 'Reseeding…' : 'Reseed slots'}
          </Button>
        </Card>
      </div>

      {msg && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {msg}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        These endpoints are gated by role=admin on the backend — other accounts get 403.
      </div>
    </div>
  );
}
