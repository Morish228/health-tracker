/**
 * AuthShell.tsx — shared wrapper for Login / Register / DoctorRegister:
 * soft gradient background, brand mark, animated card entrance.
 */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HeartPulse } from 'lucide-react';

export default function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`w-full ${wide ? 'max-w-md' : 'max-w-sm'}`}
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <span className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2 text-white shadow-md">
            <HeartPulse className="h-6 w-6" />
          </span>
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-xl font-bold text-transparent">
            Health Companion
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-indigo-100/40">
          <h1 className="mb-1 text-2xl font-semibold text-slate-800">{title}</h1>
          <p className="mb-6 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          AI-powered care · reports Q&A · appointments · vitals
        </p>
      </motion.div>
    </div>
  );
}
