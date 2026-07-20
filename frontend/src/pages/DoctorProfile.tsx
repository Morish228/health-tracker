import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stethoscope } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { PageTitle } from '../components/ui';

interface DoctorProfileData {
  name?: string;
  specialization?: string;
  qualifications?: string;
  contact?: string;
}

const field =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500';
const label = 'mb-1 block text-xs font-medium text-slate-500';

export default function DoctorProfile() {
  const qc = useQueryClient();
  const [form, setForm] = useState<DoctorProfileData>({});
  const [msg, setMsg] = useState('');

  const profile = useQuery({
    queryKey: ['doctor', 'profile'],
    queryFn: async () => (await backend.get('/api/doctor-portal/me')).data.data as DoctorProfileData,
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        name: profile.data.name ?? '',
        specialization: profile.data.specialization ?? '',
        qualifications: profile.data.qualifications ?? '',
        contact: profile.data.contact ?? '',
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      await backend.put('/api/doctor-portal/me', form);
    },
    onSuccess: () => {
      setMsg('Profile saved ✓');
      qc.invalidateQueries({ queryKey: ['doctor', 'profile'] });
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to save')),
  });

  const set = (k: keyof DoctorProfileData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageTitle icon={Stethoscope} sub="Your public doctor profile">
        My Profile
      </PageTitle>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label className={label}>Name</label>
          <input className={field} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Specialization</label>
          <input className={field} value={form.specialization ?? ''} onChange={(e) => set('specialization', e.target.value)} />
        </div>
        <div>
          <label className={label}>Qualifications</label>
          <input className={field} value={form.qualifications ?? ''} onChange={(e) => set('qualifications', e.target.value)} />
        </div>
        <div>
          <label className={label}>Contact</label>
          <input className={field} value={form.contact ?? ''} onChange={(e) => set('contact', e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending || profile.isLoading}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
