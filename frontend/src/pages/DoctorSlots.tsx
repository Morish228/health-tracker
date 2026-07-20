import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { PageTitle } from '../components/ui';

interface Slot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'TAKEN' | 'BLOCKED';
}

const todayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function DoctorSlots() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [msg, setMsg] = useState('');

  const slots = useQuery({
    queryKey: ['doctor', 'slots'],
    queryFn: async () => (await backend.get('/api/doctor-portal/slots')).data.data as Slot[],
  });

  const create = useMutation({
    mutationFn: async () => {
      await backend.post('/api/doctor-portal/slots', { date, startTime, endTime });
    },
    onSuccess: () => {
      setMsg('Slot added ✓');
      qc.invalidateQueries({ queryKey: ['doctor', 'slots'] });
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to add slot')),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await backend.delete(`/api/doctor-portal/slots/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor', 'slots'] }),
    onError: (err) => setMsg(apiError(err, 'Could not delete')),
  });

  // Group slots by date for readability.
  const byDate = (slots.data ?? []).reduce<Record<string, Slot[]>>((acc, s) => {
    const d = s.date.slice(0, 10);
    (acc[d] ??= []).push(s);
    return acc;
  }, {});

  const statusStyle: Record<Slot['status'], string> = {
    AVAILABLE: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    TAKEN: 'border-slate-200 bg-slate-100 text-slate-500',
    BLOCKED: 'border-amber-200 bg-amber-50 text-amber-700',
  };

  return (
    <div>
      <PageTitle icon={CalendarClock} sub="Publish the time slots patients can book">
        Availability
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add a slot */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Add a slot</h2>
          <div className="mb-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Start</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">End</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={create.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {create.isPending ? 'Adding…' : 'Add slot'}
            </button>
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
          </div>
        </form>

        {/* Existing slots */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Your slots</h2>
          {slots.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
          {slots.data?.length === 0 && <p className="text-sm text-slate-400">No slots yet.</p>}
          <div className="space-y-4">
            {Object.entries(byDate).map(([d, list]) => (
              <div key={d}>
                <div className="mb-1 text-xs font-medium text-slate-400">
                  {new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {list.map((s) => (
                    <div key={s._id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${statusStyle[s.status]}`}>
                      <span>{s.startTime}–{s.endTime}</span>
                      {s.status === 'AVAILABLE' ? (
                        <button onClick={() => remove.mutate(s._id)} disabled={remove.isPending} className="text-slate-400 hover:text-red-500" title="Delete">
                          ✕
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase">{s.status}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
