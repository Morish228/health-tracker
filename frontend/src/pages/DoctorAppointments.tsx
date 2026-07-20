import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { PageTitle } from '../components/ui';

interface DocAppointment {
  _id: string;
  dateTime: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  symptoms?: string;
  doctorNotes?: string;
  patientId?: { email?: string };
  slotId?: { date?: string; startTime?: string; endTime?: string };
}

const statusStyle: Record<DocAppointment['status'], string> = {
  SCHEDULED: 'bg-indigo-50 text-indigo-600',
  COMPLETED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function DoctorAppointments() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');

  const appointments = useQuery({
    queryKey: ['doctor', 'appointments'],
    queryFn: async () => (await backend.get('/api/doctor-portal/appointments')).data.data as DocAppointment[],
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      await backend.patch(`/api/doctor-portal/appointments/${id}/complete`, {
        diagnosis: diagnosis || undefined,
        doctorNotes: notes || undefined,
      });
    },
    onSuccess: () => {
      setOpenId(null);
      setDiagnosis('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['doctor', 'appointments'] });
    },
    onError: () => {},
  });

  return (
    <div>
      <PageTitle icon={CalendarDays} sub="Your booked patients — complete visits with notes">
        My Appointments
      </PageTitle>

      <div className="space-y-3">
        {appointments.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {appointments.data?.length === 0 && (
          <p className="text-sm text-slate-400">No appointments booked with you yet.</p>
        )}
        {appointments.data?.map((a) => (
          <div key={a._id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-slate-800">{a.patientId?.email ?? 'Patient'}</div>
                <div className="mt-1 text-xs text-slate-500">{new Date(a.dateTime).toLocaleString()}</div>
                {a.symptoms && <div className="mt-1 text-xs text-slate-500">Symptoms: {a.symptoms}</div>}
                {a.doctorNotes && (
                  <div className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                    {a.doctorNotes}
                  </div>
                )}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[a.status]}`}>
                {a.status}
              </span>
            </div>

            {a.status === 'SCHEDULED' && (
              <div className="mt-3">
                {openId === a._id ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <input
                      placeholder="Diagnosis"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                    />
                    <textarea
                      placeholder="Notes"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setOpenId(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => complete.mutate(a._id)}
                        disabled={complete.isPending}
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {complete.isPending ? 'Saving…' : 'Complete'}
                      </button>
                    </div>
                    {complete.isError && (
                      <p className="text-xs text-red-500">{apiError(complete.error)}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setOpenId(a._id);
                        setDiagnosis('');
                        setNotes('');
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Complete with notes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
