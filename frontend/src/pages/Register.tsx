import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Link changes pages without refreshing the browser.
import { Mail, Lock, Phone, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../lib/api';
import AuthShell from '../components/AuthShell';
import { Button } from '../components/ui';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const iconInputCls =
  'w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export default function Register() {
  const { register } = useAuth(); // gets the register function from the context
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
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
      await register({ ...form, phone: form.phone.trim() || undefined });
      navigate('/');
    } catch (err) {
      setError(apiError(err, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start using Health Companion">
      <form onSubmit={onSubmit}>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">First name</span>
            <input required value={form.firstName} onChange={set('firstName')} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Last name</span>
            <input required value={form.lastName} onChange={set('lastName')} className={inputCls} />
          </label>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-600">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="email" required value={form.email} onChange={set('email')} className={iconInputCls} />
          </div>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Phone <span className="text-slate-400">(optional)</span>
          </span>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+91 98765 43210"
              className={iconInputCls}
            />
          </div>
        </label>

        <label className="mb-5 block">
          <span className="mb-1 block text-sm font-medium text-slate-600">Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={set('password')}
              className={iconInputCls}
            />
          </div>
        </label>

        <Button type="submit" disabled={busy} className="w-full">
          <UserPlus className="h-4 w-4" />
          {busy ? 'Creating…' : 'Create account'}
        </Button>

        <p className="mt-5 text-center text-sm text-slate-500">
          Have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          Are you a doctor?{' '}
          <Link to="/doctor/register" className="font-medium text-indigo-600 hover:underline">
            Register here
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
