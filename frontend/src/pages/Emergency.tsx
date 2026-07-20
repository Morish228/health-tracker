import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Siren, History, CheckCircle2 } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { Badge, statusTone, SkeletonRows, EmptyState, SectionTitle, PageTitle } from '../components/ui';

interface Alert {
  _id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  source: 'MANUAL' | 'AGENT';
  triggeredAt: string;
}

export default function Emergency() {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Alert['severity']>('CRITICAL');
  const [msg, setMsg] = useState('');

  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => (await backend.get('/api/emergency/alerts')).data.data as Alert[],
  });

  const sos = useMutation({
    mutationFn: async () => {
      const res = await backend.post('/api/emergency/sos', {
        message: message || undefined,
        severity,
      });
      return res.data as { caregiversNotified: number; emergencyContactNotified: boolean };
    },
    onSuccess: (d) => {
      setMessage('');
      setMsg(
        `SOS sent ✓ — ${d.caregiversNotified} caregiver(s) notified${
          d.emergencyContactNotified ? ', emergency contact alerted' : ''
        }.`,
      );
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setTimeout(() => setMsg(''), 4000);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to trigger SOS')),
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACKNOWLEDGED' | 'RESOLVED' }) => {
      await backend.patch(`/api/emergency/alerts/${id}/status`, { status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div>
      <PageTitle icon={Siren} sub="One tap alerts your caregivers & emergency contact">
        Emergency
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trigger SOS */}
        <div className="rounded-2xl border border-red-200 bg-gradient-to-b from-red-50/50 to-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Trigger an SOS</h2>
          <p className="mb-4 text-xs text-slate-400">
            Alerts your caregivers and emergency contact immediately.
          </p>

          <textarea
            placeholder="What's happening? (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mb-3 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          <label className="mb-1 block text-xs font-medium text-slate-500">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Alert['severity'])}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500"
          >
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => sos.mutate()}
            disabled={sos.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:from-red-700 hover:to-rose-700 disabled:opacity-60"
          >
            <Siren className={`h-5 w-5 ${sos.isPending ? 'animate-pulse' : ''}`} />
            {sos.isPending ? 'Sending…' : 'Send SOS'}
          </motion.button>
          {msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
        </div>

        {/* Alert history */}
        <div>
          <SectionTitle icon={History}>Alert history</SectionTitle>
          <div className="space-y-3">
            {alerts.isLoading && <SkeletonRows rows={3} />}
            {alerts.data?.length === 0 && (
              <EmptyState icon={Siren} title="No alerts raised" hint="Hopefully it stays that way." />
            )}
            {alerts.data?.map((a) => (
              <div key={a._id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{a.message}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {a.severity} · {a.source} · {new Date(a.triggeredAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
                {a.status !== 'RESOLVED' && (
                  <div className="mt-3 flex justify-end gap-2">
                    {a.status === 'ACTIVE' && (
                      <button
                        onClick={() => update.mutate({ id: a._id, status: 'ACKNOWLEDGED' })}
                        disabled={update.isPending}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => update.mutate({ id: a._id, status: 'RESOLVED' })}
                      disabled={update.isPending}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
