import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { PageTitle } from '../components/ui';

interface Link {
  _id: string;
  inviteEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  permissions: string[];
  patientId?: { _id: string; email: string };
}

const PERMISSIONS = ['vitals', 'adherence', 'appointments'] as const;

const todayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

interface PatientData {
  vitals: { _id: string; type: string; value: number; unit: string; recordedAt: string }[];
  adherence: { _id: string; medicationName: string; taken: boolean; date: string }[];
  appointments: { _id: string; dateTime: string; status: string; doctorId?: { name?: string } }[];
}

export default function Caregiver() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState<string[]>([...PERMISSIONS]);
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState<{ id: string; email?: string; perms: string[] } | null>(
    null,
  );

  // Book-on-behalf state (goal 32) — scoped to the selected patient.
  const [cgSpec, setCgSpec] = useState('');
  const [cgDoctor, setCgDoctor] = useState<{ _id: string; name: string } | null>(null);
  const [cgDate, setCgDate] = useState(todayStr());
  const [cgSymptoms, setCgSymptoms] = useState('');
  const [bookMsg, setBookMsg] = useState('');

  const invites = useQuery({
    queryKey: ['caregiver', 'invites'],
    queryFn: async () => (await backend.get('/api/caregivers/invites')).data.data as Link[],
  });

  const patients = useQuery({
    queryKey: ['caregiver', 'patients'],
    queryFn: async () => (await backend.get('/api/caregivers/patients')).data.data as Link[],
  });

  const invite = useMutation({
    mutationFn: async () => {
      await backend.post('/api/caregivers/invite', { email: email.trim(), permissions: perms });
    },
    onSuccess: () => {
      setEmail('');
      setMsg('Invitation sent ✓');
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to invite')),
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      await backend.patch(`/api/caregivers/invites/${id}/accept`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caregiver'] });
    },
  });

  const togglePerm = (p: string) =>
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const canBook = !!selected?.perms.includes('appointments');

  const cgDoctors = useQuery({
    queryKey: ['caregiver', 'doctors', cgSpec, selected?.id],
    enabled: !!selected && canBook,
    queryFn: async () =>
      (await backend.get('/api/doctors', { params: cgSpec ? { specialization: cgSpec } : {} }))
        .data.data as { _id: string; name: string; specialization: string; hospitalId?: { name?: string } }[],
  });

  const cgSlots = useQuery({
    queryKey: ['caregiver', 'slots', cgDoctor?._id, cgDate],
    enabled: !!cgDoctor && !!cgDate,
    queryFn: async () =>
      (await backend.get(`/api/doctors/${cgDoctor!._id}/slots`, { params: { date: cgDate } }))
        .data.data as { _id: string; startTime: string; endTime: string }[],
  });

  const bookForPatient = useMutation({
    mutationFn: async (slotId: string) => {
      await backend.post('/api/caregivers/book', {
        patientId: selected!.id,
        slotId,
        symptoms: cgSymptoms || undefined,
      });
    },
    onSuccess: () => {
      setCgSymptoms('');
      setBookMsg('Appointment booked for patient ✓');
      qc.invalidateQueries({ queryKey: ['caregiver', 'patientData'] });
      qc.invalidateQueries({ queryKey: ['caregiver', 'slots'] });
      setTimeout(() => setBookMsg(''), 2500);
    },
    onError: (err) => setBookMsg(apiError(err, 'Failed to book for patient')),
  });

  // Read-only patient data (goal 30) — loaded when a patient is selected.
  const patientData = useQuery({
    queryKey: ['caregiver', 'patientData', selected?.id],
    enabled: !!selected,
    queryFn: async (): Promise<PatientData> => {
      const base = `/api/caregivers/patients/${selected!.id}`;
      const [v, a, ap] = await Promise.all([
        backend.get(`${base}/vitals`).then((r) => r.data.data).catch(() => []),
        backend.get(`${base}/adherence`).then((r) => r.data.data).catch(() => []),
        backend.get(`${base}/appointments`).then((r) => r.data.data).catch(() => []),
      ]);
      return { vitals: v, adherence: a, appointments: ap };
    },
  });

  return (
    <div>
      <PageTitle icon={Users} sub="Invite caregivers, view patients you care for">
        Caregivers
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invite a caregiver (patient side) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate();
          }}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="mb-1 text-sm font-semibold text-slate-600">Invite a caregiver</h2>
          <p className="mb-4 text-xs text-slate-400">
            Give a family member read-only access to your health data.
          </p>
          <input
            type="email"
            placeholder="caregiver@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <div className="mb-4 flex flex-wrap gap-3">
            {PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} />
                <span className="capitalize">{p}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={invite.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </button>
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
          </div>
        </form>

        <div className="space-y-6">
          {/* Invites for me (caregiver side) */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-600">Invitations for you</h2>
            <div className="space-y-2">
              {invites.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
              {invites.data?.length === 0 && (
                <p className="text-sm text-slate-400">No pending invitations.</p>
              )}
              {invites.data?.map((inv) => (
                <div
                  key={inv._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {inv.patientId?.email ?? 'A patient'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {inv.permissions.join(', ') || 'no permissions'} · {inv.status}
                    </div>
                  </div>
                  {inv.status === 'PENDING' && (
                    <button
                      onClick={() => accept.mutate(inv._id)}
                      disabled={accept.isPending}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Patients I care for */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-600">Patients you care for</h2>
            <div className="space-y-2">
              {patients.data?.length === 0 && (
                <p className="text-sm text-slate-400">Not caring for anyone yet.</p>
              )}
              {patients.data?.map((p) => (
                <button
                  key={p._id}
                  onClick={() => {
                    setCgDoctor(null);
                    setCgSpec('');
                    setBookMsg('');
                    setSelected(
                      p.patientId
                        ? { id: p.patientId._id, email: p.patientId.email, perms: p.permissions }
                        : null,
                    );
                  }}
                  className={`block w-full rounded-xl border p-3 text-left transition ${
                    selected?.id === p.patientId?._id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-800">
                    {p.patientId?.email ?? 'Patient'}
                  </div>
                  <div className="text-xs text-slate-400">Access: {p.permissions.join(', ')}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Read-only drill-in for the selected patient (goal 30) */}
      {selected && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">{selected.email}</h2>
            <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-600">
              ✕ close
            </button>
          </div>
          {patientData.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent vitals</h3>
                {patientData.data?.vitals.length === 0 && <p className="text-xs text-slate-400">None.</p>}
                <ul className="space-y-1">
                  {patientData.data?.vitals.slice(0, 6).map((v) => (
                    <li key={v._id} className="text-sm text-slate-600">
                      {v.type}: <span className="font-medium">{v.value}</span> {v.unit}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Adherence</h3>
                {patientData.data?.adherence.length === 0 && <p className="text-xs text-slate-400">None.</p>}
                <ul className="space-y-1">
                  {patientData.data?.adherence.slice(0, 6).map((a) => (
                    <li key={a._id} className="text-sm text-slate-600">
                      {a.medicationName} · {a.taken ? '✓ taken' : '✗ missed'}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Appointments</h3>
                {patientData.data?.appointments.length === 0 && <p className="text-xs text-slate-400">None.</p>}
                <ul className="space-y-1">
                  {patientData.data?.appointments.slice(0, 6).map((ap) => (
                    <li key={ap._id} className="text-sm text-slate-600">
                      {ap.doctorId?.name ?? 'Doctor'} · {new Date(ap.dateTime).toLocaleDateString()} · {ap.status}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Book-on-behalf (goal 32) — only if the patient granted appointment access. */}
          {canBook ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Book an appointment for {selected.email}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <input
                    placeholder="Filter by specialization"
                    value={cgSpec}
                    onChange={(e) => setCgSpec(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                  />
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {cgDoctors.isLoading && <p className="text-xs text-slate-400">Loading…</p>}
                    {cgDoctors.data?.length === 0 && (
                      <p className="text-xs text-slate-400">No doctors found.</p>
                    )}
                    {cgDoctors.data?.map((d) => (
                      <button
                        key={d._id}
                        onClick={() => setCgDoctor({ _id: d._id, name: d.name })}
                        className={`block w-full rounded-lg border px-2 py-1.5 text-left text-sm transition ${
                          cgDoctor?._id === d._id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-medium text-slate-700">{d.name}</span>
                        <span className="text-xs text-slate-400"> · {d.specialization}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  {cgDoctor ? (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-slate-600">Slots · {cgDoctor.name}</span>
                        <input
                          type="date"
                          value={cgDate}
                          onChange={(e) => setCgDate(e.target.value)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                      <input
                        placeholder="Symptoms / reason (optional)"
                        value={cgSymptoms}
                        onChange={(e) => setCgSymptoms(e.target.value)}
                        className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                      />
                      {cgSlots.isLoading && (
                        <p className="text-xs text-slate-400">Loading slots…</p>
                      )}
                      {cgSlots.data?.length === 0 && (
                        <p className="text-xs text-slate-400">No slots on this date.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {cgSlots.data?.map((s) => (
                          <button
                            key={s._id}
                            onClick={() => bookForPatient.mutate(s._id)}
                            disabled={bookForPatient.isPending}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                          >
                            {s.startTime}–{s.endTime}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Select a doctor to see slots.</p>
                  )}
                  {bookMsg && <p className="mt-2 text-sm text-slate-500">{bookMsg}</p>}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              This patient hasn’t granted appointment access, so you can’t book for them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
