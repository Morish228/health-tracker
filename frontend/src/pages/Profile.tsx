import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import { PageTitle } from '../components/ui';

interface ProfileData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

const empty: ProfileData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: undefined,
  phone: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

const field =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500';
const label = 'mb-1 block text-xs font-medium text-slate-500';

export default function Profile() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProfileData>(empty);
  const [msg, setMsg] = useState('');

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await backend.get('/api/auth/me')).data.data.profile as ProfileData | null,
  });

  // Hydrate the form once the profile loads.
  useEffect(() => {
    if (profile.data) {
      setForm({
        ...empty,
        ...profile.data,
        dateOfBirth: profile.data.dateOfBirth ? profile.data.dateOfBirth.slice(0, 10) : '',
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: ProfileData = { ...form };
      if (!payload.dateOfBirth) delete payload.dateOfBirth;
      if (!payload.gender) delete payload.gender;
      await backend.put('/api/auth/profile', payload);
    },
    onSuccess: () => {
      setMsg('Profile saved ✓');
      qc.invalidateQueries({ queryKey: ['profile'] });
      setTimeout(() => setMsg(''), 2500);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to save')),
  });

  const set = (k: keyof ProfileData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageTitle icon={User} sub="Personal details & emergency contact">
        Profile
      </PageTitle>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="max-w-2xl space-y-6"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-600">Personal details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>First name</label>
              <input className={field} value={form.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div>
              <label className={label}>Last name</label>
              <input className={field} value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} />
            </div>
            <div>
              <label className={label}>Date of birth</label>
              <input type="date" className={field} value={form.dateOfBirth ?? ''} onChange={(e) => set('dateOfBirth', e.target.value)} />
            </div>
            <div>
              <label className={label}>Gender</label>
              <select className={field} value={form.gender ?? ''} onChange={(e) => set('gender', e.target.value)}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className={label}>Phone</label>
              <input className={field} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Address</label>
              <input className={field} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-600">Emergency contact</h2>
          <p className="mb-4 text-xs text-slate-400">Notified when you trigger an SOS.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Contact name</label>
              <input className={field} value={form.emergencyContactName ?? ''} onChange={(e) => set('emergencyContactName', e.target.value)} />
            </div>
            <div>
              <label className={label}>Contact phone</label>
              <input className={field} value={form.emergencyContactPhone ?? ''} onChange={(e) => set('emergencyContactPhone', e.target.value)} />
            </div>
          </div>
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
