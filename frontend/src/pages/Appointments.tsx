import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CalendarDays, Search, Stethoscope, MapPin, Phone, GraduationCap,
  CheckCircle2, XCircle, Repeat,
} from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { Card, Badge, statusTone, SkeletonRows, EmptyState, SectionTitle, PageTitle } from '../components/ui';

interface Doctor {
  _id: string;
  name: string;
  specialization: string;
  qualifications?: string;
  contact?: string;
  hospitalId?: { name?: string; address?: string };
}
interface Slot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
}
interface Appointment {
  _id: string;
  dateTime: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  symptoms?: string;
  doctorId?: { _id?: string; name?: string; specialization?: string; hospitalId?: { name?: string } };
  slotId?: { date?: string; startTime?: string; endTime?: string };
}

// Default the date picker to today (YYYY-MM-DD in local time).
const todayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const inputCls =
  'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export default function Appointments() {
  const qc = useQueryClient();
  const [spec, setSpec] = useState('');
  const [selected, setSelected] = useState<Doctor | null>(null);
  const [date, setDate] = useState(todayStr());
  const [symptoms, setSymptoms] = useState('');
  const [msg, setMsg] = useState('');
  // When set, the slot picker books a follow-up linked to this appointment (goal 14).
  const [followUpFor, setFollowUpFor] = useState<Appointment | null>(null);

  const doctors = useQuery({
    queryKey: ['doctors', spec], // in cache the doctors object is labelled with this
    // if page refresh, and user did not change the spec, we don't have to recall — it's stored in cache
    queryFn: async () =>
      (await backend.get('/api/doctors', { params: spec ? { specialization: spec } : {} }))
        .data.data as Doctor[],
  });

  // Doctor detail (wires GET /api/doctors/:id) — richer info than the list row.
  const doctorDetail = useQuery({
    queryKey: ['doctor', selected?._id],
    enabled: !!selected,
    queryFn: async () =>
      (await backend.get(`/api/doctors/${selected!._id}`)).data.data as Doctor,
  });

  const slots = useQuery({
    queryKey: ['slots', selected?._id, date],
    enabled: !!selected && !!date, // only fire once a doctor and date are picked
    queryFn: async () =>
      (await backend.get(`/api/doctors/${selected!._id}/slots`, { params: { date } }))
        .data.data as Slot[],
  });

  const appointments = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => (await backend.get('/api/appointments')).data.data as Appointment[],
  });

  const book = useMutation({
    mutationFn: async (slotId: string) => {
      await backend.post('/api/appointments', { slotId, symptoms: symptoms || undefined });
    },
    onSuccess: () => {
      setSymptoms('');
      setMsg('Appointment booked ✓');
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['slots'] });
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to book')),
  });

  const followUp = useMutation({
    mutationFn: async (slotId: string) => {
      await backend.post('/api/appointments/follow-up', {
        originalAppointmentId: followUpFor!._id,
        slotId,
        symptoms: symptoms || undefined,
      });
    },
    onSuccess: () => {
      setSymptoms('');
      setMsg('Follow-up booked ✓');
      setFollowUpFor(null);
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['slots'] });
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to book follow-up')),
  });

  // Enter follow-up mode: preselect the same doctor so their slots load.
  const startFollowUp = (a: Appointment) => {
    if (!a.doctorId?._id) {
      setMsg('Cannot book a follow-up for this appointment.');
      return;
    }
    setFollowUpFor(a);
    setSelected({
      _id: a.doctorId._id,
      name: a.doctorId.name ?? 'Doctor',
      specialization: a.doctorId.specialization ?? '',
      hospitalId: a.doctorId.hospitalId,
    });
    setDate(todayStr());
    setMsg('');
  };

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      await backend.patch(`/api/appointments/${id}/cancel`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });

  // Mark a past appointment done (wires PATCH /api/appointments/:id/complete).
  const complete = useMutation({
    mutationFn: async (id: string) => {
      await backend.patch(`/api/appointments/${id}/complete`, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const isPast = (a: Appointment) => new Date(a.dateTime).getTime() < Date.now();

  return (
    <div>
      <PageTitle icon={CalendarDays} sub="Find a doctor, pick a slot, manage your visits">
        Appointments
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Find a doctor + book */}
        <Card className="p-4">
          <SectionTitle icon={Search}>Find a doctor</SectionTitle>

          <input
            placeholder="Filter by specialization (e.g. Cardiology)"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            className={`mb-3 ${inputCls}`}
          />

          <div className="nice-scroll mb-4 max-h-56 space-y-2 overflow-y-auto">
            {doctors.isLoading && <SkeletonRows rows={3} />}
            {doctors.data?.length === 0 && (
              <EmptyState icon={Stethoscope} title="No doctors found" />
            )}
            {doctors.data?.map((d) => (
              <button
                key={d._id}
                onClick={() => setSelected(d)}
                className={`block w-full rounded-xl border p-3 text-left transition ${
                  selected?._id === d._id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-medium text-slate-800">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {d.specialization}
                  {d.hospitalId?.name && <span> · {d.hospitalId.name}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Doctor detail card (GET /api/doctors/:id) */}
          {selected && doctorDetail.data && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-3.5 ring-1 ring-indigo-100"
            >
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 p-2 text-white">
                  <Stethoscope className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{doctorDetail.data.name}</div>
                  <div className="text-xs text-indigo-600">{doctorDetail.data.specialization}</div>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {doctorDetail.data.qualifications && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                    {doctorDetail.data.qualifications}
                  </div>
                )}
                {doctorDetail.data.hospitalId?.name && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {doctorDetail.data.hospitalId.name}
                    {doctorDetail.data.hospitalId.address && ` — ${doctorDetail.data.hospitalId.address}`}
                  </div>
                )}
                {doctorDetail.data.contact && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {doctorDetail.data.contact}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Slots for the selected doctor */}
          {selected && (
            <div className="border-t border-slate-100 pt-3">
              {followUpFor && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <span>
                    Booking a follow-up with {followUpFor.doctorId?.name ?? 'this doctor'}
                  </span>
                  <button
                    onClick={() => setFollowUpFor(null)}
                    className="font-medium text-amber-800 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600">
                  Slots · {selected.name}
                </h3>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <input
                placeholder="Symptoms / reason (optional)"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className={`mb-3 ${inputCls}`}
              />

              {slots.isLoading && <SkeletonRows rows={1} />}
              {slots.data?.length === 0 && (
                <p className="text-sm text-slate-400">No available slots on this date.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {slots.data?.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => (followUpFor ? followUp.mutate(s._id) : book.mutate(s._id))}
                    disabled={book.isPending || followUp.isPending}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                  >
                    {s.startTime}–{s.endTime}
                  </button>
                ))}
              </div>
              {msg && <p className="mt-3 text-sm text-slate-500">{msg}</p>}
            </div>
          )}
        </Card>

        {/* My appointments */}
        <div>
          <SectionTitle icon={CalendarDays}>Your appointments</SectionTitle>
          <div className="space-y-3">
            {appointments.isLoading && <SkeletonRows rows={3} />}
            {appointments.data?.length === 0 && (
              <EmptyState
                icon={CalendarDays}
                title="No appointments yet"
                hint="Pick a doctor on the left to book your first visit."
              />
            )}
            {appointments.data?.map((a, i) => (
              <motion.div
                key={a._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {a.doctorId?.name ?? 'Doctor'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {a.doctorId?.specialization}
                      {a.doctorId?.hospitalId?.name && <span> · {a.doctorId.hospitalId.name}</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {new Date(a.dateTime).toLocaleString()}
                    </div>
                    {a.symptoms && (
                      <div className="mt-1 text-xs text-slate-400">Reason: {a.symptoms}</div>
                    )}
                  </div>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
                {a.status !== 'CANCELLED' && (
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => startFollowUp(a)}
                      className="flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
                    >
                      <Repeat className="h-3 w-3" />
                      Book follow-up
                    </button>
                    {a.status === 'SCHEDULED' && isPast(a) && (
                      <button
                        onClick={() => complete.mutate(a._id)}
                        disabled={complete.isPending}
                        title="Mark this past visit as completed"
                        className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Mark completed
                      </button>
                    )}
                    {a.status === 'SCHEDULED' && (
                      <button
                        onClick={() => cancel.mutate(a._id)}
                        disabled={cancel.isPending}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        <XCircle className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
