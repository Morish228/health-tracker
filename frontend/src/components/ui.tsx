/**
 * ui.tsx — tiny shared design-system primitives (Tailwind only).
 * Keeps every page visually consistent: cards, buttons, badges,
 * skeleton loaders, empty states and section titles.
 */
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

/* ---------- Card ---------- */
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:from-indigo-700 hover:to-violet-700',
  secondary:
    'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
const TONES = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
} as const;

export function Badge({
  tone = 'slate',
  children,
  className = '',
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Map common backend statuses to badge tones. */
export function statusTone(status?: string): keyof typeof TONES {
  switch ((status || '').toUpperCase()) {
    case 'SCHEDULED':
    case 'READY':
    case 'AVAILABLE':
    case 'ACCEPTED':
    case 'RESOLVED':
      return 'green';
    case 'CANCELLED':
    case 'ACTIVE': // emergency alert active
      return 'red';
    case 'PENDING':
    case 'PROCESSING':
    case 'ACKNOWLEDGED':
      return 'amber';
    case 'COMPLETED':
    case 'TAKEN':
      return 'indigo';
    default:
      return 'slate';
  }
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

/** A stack of skeleton rows — drop-in replacement for "Loading…" text. */
export function SkeletonRows({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
      {Icon && (
        <div className="mb-2 rounded-full bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-400" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {hint && <p className="mt-0.5 max-w-xs text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* ---------- SectionTitle ---------- */
export function SectionTitle({
  icon: Icon,
  children,
  className = '',
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600 ${className}`}>
      {Icon && <Icon className="h-4 w-4 text-indigo-500" />}
      {children}
    </h2>
  );
}

/* ---------- PageTitle ---------- */
export function PageTitle({
  icon: Icon,
  children,
  sub,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800">
        {Icon && (
          <span className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2 text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
        )}
        {children}
      </h1>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
  );
}
