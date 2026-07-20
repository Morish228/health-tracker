import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../lib/api';
import AuthShell from '../components/AuthShell';
import { Button } from '../components/ui';

export default function DoctorRegister() {
  const { registerDoctor } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    specialization: '',
    qualifications: '',
    contact: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await registerDoctor(form);
      navigate('/doctor');
    } catch (err) {
      setError(apiError(err, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

  return (
    <AuthShell title="Doctor sign-up" subtitle="Create a Health Companion doctor account" wide>
      <form onSubmit={onSubmit}>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="space-y-3">
          <input required placeholder="Full name (Dr. …)" value={form.name} onChange={set('name')} className={field} />
          <input required placeholder="Specialization (e.g. Cardiology)" value={form.specialization} onChange={set('specialization')} className={field} />
          <input placeholder="Qualifications (e.g. MD, DM)" value={form.qualifications} onChange={set('qualifications')} className={field} />
          <input placeholder="Contact (phone or email)" value={form.contact} onChange={set('contact')} className={field} />
          <input required type="email" placeholder="Login email" value={form.email} onChange={set('email')} className={field} />
          <input required type="password" minLength={6} placeholder="Password" value={form.password} onChange={set('password')} className={field} />
        </div>

        <Button type="submit" disabled={busy} className="mt-5 w-full">
          <Stethoscope className="h-4 w-4" />
          {busy ? 'Creating…' : 'Create doctor account'}
        </Button>

        <p className="mt-5 text-center text-sm text-slate-500">
          Not a doctor?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            Patient sign-up
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
