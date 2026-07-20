import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill, PlusCircle, Bell, BellPlus, CheckCircle2, Flame,
  ClipboardList, X, Trash2,
} from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { Card, Button, Badge, SkeletonRows, EmptyState, SectionTitle, PageTitle } from '../components/ui';

interface Medication {
  medicationName: string;
  dosage?: string;
  frequency?: string;
}
interface Prescription {
  _id: string;
  doctorName?: string;
  medications: Medication[];
  notes?: string;
  uploadedAt?: string;
  createdAt?: string;
}
interface DueDose {
  prescriptionId: string;
  medicationName: string;
  scheduledTime: string;
  date: string;
  taken: boolean;
}
interface Interaction {
  hasInteraction: boolean;
  severity: 'none' | 'minor' | 'moderate' | 'severe' | 'unknown';
  summary: string;
  details?: string;
  disclaimer: string;
}
interface Reminder {
  _id: string;
  prescriptionId: string;
  medicationName: string;
  times: string[];
  active: boolean;
}

const emptyMed = (): Medication => ({ medicationName: '', dosage: '', frequency: '' });

const inputCls =
  'rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export default function Medications() {
  const qc = useQueryClient();
  const [meds, setMeds] = useState<Medication[]>([emptyMed()]);
  const [doctorName, setDoctorName] = useState('');
  const [msg, setMsg] = useState('');
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const prescriptions = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => (await backend.get('/api/prescriptions')).data.data as Prescription[],
  });

  // Full single-prescription detail (wires GET /api/prescriptions/:id).
  const detail = useQuery({
    queryKey: ['prescription', detailId],
    enabled: !!detailId,
    queryFn: async () =>
      (await backend.get(`/api/prescriptions/${detailId}`)).data.data as Prescription,
  });

  const streak = useQuery({
    queryKey: ['adherence', 'streak'],
    queryFn: async () => (await backend.get('/api/adherence/streak')).data.streak as number,
  });

  const today = useQuery({
    queryKey: ['adherence', 'today'],
    queryFn: async () => (await backend.get('/api/adherence/today')).data.data as DueDose[],
  });

  const create = useMutation({
    mutationFn: async () => {
      const medications = meds.filter((m) => m.medicationName.trim());
      const res = await backend.post('/api/prescriptions', {
        medications,
        doctorName: doctorName || undefined,
      });
      return res.data.interaction as Interaction | undefined;
    },
    onSuccess: (interactionResult) => {
      setMeds([emptyMed()]);
      setDoctorName('');
      setMsg('Prescription added ✓');
      setInteraction(interactionResult ?? null);
      qc.invalidateQueries({ queryKey: ['prescriptions'] });
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to add')),
  });

  const logDose = useMutation({
    mutationFn: async (d: DueDose) => {
      await backend.post('/api/adherence/log', {
        prescriptionId: d.prescriptionId,
        medicationName: d.medicationName,
        scheduledTime: d.scheduledTime,
        date: d.date,
        taken: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adherence'] }),
  });

  // --- Reminders (goal 5) ---
  const [rxId, setRxId] = useState('');
  const [remMed, setRemMed] = useState('');
  const [remTimes, setRemTimes] = useState('08:00, 20:00');

  const reminders = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => (await backend.get('/api/reminders')).data.data as Reminder[],
  });

  const addReminder = useMutation({
    mutationFn: async () => {
      const times = remTimes.split(',').map((t) => t.trim()).filter(Boolean);
      await backend.post('/api/reminders', {
        prescriptionId: rxId,
        medicationName: remMed,
        times,
      });
    },
    onSuccess: () => {
      setRxId('');
      setRemMed('');
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['adherence'] });
    },
  });

  // One-click reminders for EVERY med in a prescription
  // (wires POST /api/reminders/for-prescription).
  const remindAll = useMutation({
    mutationFn: async (prescriptionId: string) => {
      await backend.post('/api/reminders/for-prescription', {
        prescriptionId,
        times: ['08:00', '20:00'],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
    onSuccess: () => {
      setMsg('Reminders created for all medicines ✓ (08:00 & 20:00 — edit below)');
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['adherence'] });
      setTimeout(() => setMsg(''), 3500);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to create reminders')),
  });

  const toggleReminder = useMutation({
    mutationFn: async (r: Reminder) => {
      await backend.put(`/api/reminders/${r._id}`, { active: !r.active });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      await backend.delete(`/api/reminders/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['adherence'] });
    },
  });

  // Medication name options for the currently-selected prescription.
  const rxMeds = prescriptions.data?.find((p) => p._id === rxId)?.medications ?? [];

  const setMed = (i: number, k: keyof Medication, v: string) =>
    setMeds(meds.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <PageTitle icon={Pill} sub="Prescriptions, reminders and adherence">
          Medications
        </PageTitle>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-slate-500">Streak:</span>
          <span className="font-semibold text-indigo-600">
            {streak.data ?? 0} day{streak.data === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Today's doses */}
      <SectionTitle icon={CheckCircle2}>Due today</SectionTitle>
      <Card className="mb-6 p-4">
        {today.isLoading && <SkeletonRows rows={2} />}
        {today.data?.length === 0 && (
          <p className="text-sm text-slate-400">
            No doses scheduled today. (Set reminders on a prescription to see them here.)
          </p>
        )}
        <ul className="space-y-2">
          {today.data?.map((d, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-sm text-slate-700">
                <span className="font-medium">{d.medicationName}</span>{' '}
                <span className="text-slate-400">· {d.scheduledTime}</span>
              </span>
              {d.taken ? (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Taken
                </span>
              ) : (
                <Button
                  onClick={() => logDose.mutate(d)}
                  disabled={logDose.isPending}
                  className="!px-3 !py-1 text-xs"
                >
                  Mark taken
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add prescription */}
        <Card className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (meds.some((m) => m.medicationName.trim())) create.mutate();
            }}
          >
            <SectionTitle icon={PlusCircle}>Add prescription</SectionTitle>

            {meds.map((m, i) => (
              <div key={i} className="mb-2 grid grid-cols-3 gap-2">
                <input
                  placeholder="Medicine"
                  required
                  value={m.medicationName}
                  onChange={(e) => setMed(i, 'medicationName', e.target.value)}
                  className={inputCls}
                />
                <input
                  placeholder="Dosage"
                  value={m.dosage}
                  onChange={(e) => setMed(i, 'dosage', e.target.value)}
                  className={inputCls}
                />
                <input
                  placeholder="Frequency"
                  value={m.frequency}
                  onChange={(e) => setMed(i, 'frequency', e.target.value)}
                  className={inputCls}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setMeds([...meds, emptyMed()])}
              className="mb-3 text-xs font-medium text-indigo-600 hover:underline"
            >
              + Add another medicine
            </button>

            <input
              placeholder="Doctor name (optional)"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className={`mb-3 w-full ${inputCls}`}
            />

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Saving…' : 'Add prescription'}
              </Button>
              {msg && <span className="text-sm text-slate-500">{msg}</span>}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              On save, the backend runs an AI drug-interaction check (needs Gemini/Groq quota).
            </p>

            {interaction && (
              <div
                className={`mt-3 rounded-xl border p-3 text-sm ${
                  interaction.severity === 'severe'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : interaction.severity === 'moderate'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : interaction.severity === 'minor'
                        ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">
                    Interaction check: {interaction.hasInteraction ? interaction.severity : 'no interaction'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInteraction(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <p>{interaction.summary}</p>
                {interaction.details && <p className="mt-1 text-xs opacity-80">{interaction.details}</p>}
                <p className="mt-2 text-xs italic opacity-70">{interaction.disclaimer}</p>
              </div>
            )}
          </form>
        </Card>

        {/* Prescription list */}
        <div>
          <SectionTitle icon={ClipboardList}>Your prescriptions</SectionTitle>
          <div className="space-y-3">
            {prescriptions.isLoading && <SkeletonRows rows={3} />}
            {prescriptions.data?.length === 0 && (
              <EmptyState
                icon={Pill}
                title="No prescriptions yet"
                hint="Add one on the left — we'll check for drug interactions automatically."
              />
            )}
            {prescriptions.data?.map((p) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setDetailId(detailId === p._id ? null : p._id)}
                className={`cursor-pointer rounded-xl border p-4 transition hover:shadow-sm ${
                  detailId === p._id ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    {p.doctorName && (
                      <div className="mb-1 text-xs text-slate-400">Dr. {p.doctorName}</div>
                    )}
                    <ul className="space-y-1">
                      {p.medications.map((m, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          <span className="font-medium">{m.medicationName}</span>
                          {m.dosage && <span className="text-slate-500"> · {m.dosage}</span>}
                          {m.frequency && <span className="text-slate-500"> · {m.frequency}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remindAll.mutate(p._id);
                    }}
                    disabled={remindAll.isPending}
                    title="Create reminders for every medicine in this prescription"
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60"
                  >
                    <BellPlus className="h-3.5 w-3.5" />
                    Remind all
                  </button>
                </div>

                {/* Detail drawer (GET /api/prescriptions/:id) */}
                <AnimatePresence>
                  {detailId === p._id && detail.data && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">Prescription details</span>
                          <button onClick={() => setDetailId(null)} className="text-slate-400 hover:text-slate-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="text-slate-400">ID:</span> {detail.data._id}
                          </div>
                          {detail.data.doctorName && (
                            <div>
                              <span className="text-slate-400">Doctor:</span> {detail.data.doctorName}
                            </div>
                          )}
                          {(detail.data.uploadedAt || detail.data.createdAt) && (
                            <div>
                              <span className="text-slate-400">Added:</span>{' '}
                              {new Date(detail.data.uploadedAt || detail.data.createdAt!).toLocaleString()}
                            </div>
                          )}
                          {detail.data.notes && (
                            <div>
                              <span className="text-slate-400">Notes:</span> {detail.data.notes}
                            </div>
                          )}
                          <div className="pt-1">
                            <span className="text-slate-400">Medicines:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {detail.data.medications.map((m, i) => (
                                <Badge key={i} tone="indigo">
                                  {m.medicationName}
                                  {m.dosage ? ` · ${m.dosage}` : ''}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Reminders (goal 5) */}
      <Card className="mt-6 p-4">
        <SectionTitle icon={Bell}>Medication reminders</SectionTitle>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (rxId && remMed && remTimes.trim()) addReminder.mutate();
          }}
          className="mb-4 flex flex-wrap items-end gap-2"
        >
          <select
            value={rxId}
            onChange={(e) => {
              setRxId(e.target.value);
              setRemMed('');
            }}
            className={inputCls}
          >
            <option value="">Prescription…</option>
            {prescriptions.data?.map((p) => (
              <option key={p._id} value={p._id}>
                {p.medications.map((m) => m.medicationName).join(', ').slice(0, 30) || 'Prescription'}
              </option>
            ))}
          </select>
          <select
            value={remMed}
            onChange={(e) => setRemMed(e.target.value)}
            disabled={!rxId}
            className={`${inputCls} disabled:opacity-50`}
          >
            <option value="">Medicine…</option>
            {rxMeds.map((m, i) => (
              <option key={i} value={m.medicationName}>
                {m.medicationName}
              </option>
            ))}
          </select>
          <input
            placeholder="Times e.g. 08:00, 20:00"
            value={remTimes}
            onChange={(e) => setRemTimes(e.target.value)}
            className={inputCls}
          />
          <Button type="submit" disabled={addReminder.isPending || !rxId || !remMed} className="!px-3 !py-1.5">
            <BellPlus className="h-3.5 w-3.5" />
            Add reminder
          </Button>
        </form>

        <div className="space-y-2">
          {reminders.data?.length === 0 && (
            <p className="text-sm text-slate-400">No reminders set.</p>
          )}
          {reminders.data?.map((r) => (
            <div key={r._id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Bell className={`h-4 w-4 ${r.active ? 'text-indigo-500' : 'text-slate-300'}`} />
                <span className="text-sm font-medium text-slate-800">{r.medicationName}</span>
                <span className="text-xs text-slate-500">{r.times.join(', ')}</span>
                {!r.active && <Badge tone="slate">paused</Badge>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleReminder.mutate(r)}
                  disabled={toggleReminder.isPending}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {r.active ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => deleteReminder.mutate(r._id)}
                  disabled={deleteReminder.isPending}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                  title="Delete reminder"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
