import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { Activity, PlusCircle, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { backend, apiError } from '../lib/api';
import type { VitalLog, VitalType } from '../types';
import { Card, Button, Badge, SkeletonRows, EmptyState, SectionTitle, PageTitle } from '../components/ui';

// Friendly labels + default units for each backend enum value.
const VITAL_TYPES: { value: VitalType; label: string; unit: string }[] = [
  { value: 'HEART_RATE', label: 'Heart Rate', unit: 'bpm' },
  { value: 'BLOOD_SUGAR', label: 'Blood Sugar', unit: 'mg/dL' },
  { value: 'BLOOD_PRESSURE_SYSTOLIC', label: 'BP Systolic', unit: 'mmHg' },
  { value: 'BLOOD_PRESSURE_DIASTOLIC', label: 'BP Diastolic', unit: 'mmHg' },
  { value: 'SPO2', label: 'SpO2', unit: '%' },
  { value: 'WEIGHT', label: 'Weight', unit: 'kg' },
  { value: 'TEMPERATURE', label: 'Temperature', unit: '°C' },
  { value: 'RESPIRATORY_RATE', label: 'Respiratory Rate', unit: '/min' },
];

const labelFor = (t: string) => VITAL_TYPES.find((v) => v.value === t)?.label ?? t;

interface Threshold {
  _id: string;
  vitalType: string;
  minSafe: number;
  maxSafe: number;
}

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export default function Vitals() {
  const qc = useQueryClient();
  const [type, setType] = useState<VitalType>('HEART_RATE');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');

  // safe-range editor state
  const [thType, setThType] = useState<VitalType>('HEART_RATE');
  const [minSafe, setMinSafe] = useState('');
  const [maxSafe, setMaxSafe] = useState('');
  const [thMsg, setThMsg] = useState('');

  const unit = VITAL_TYPES.find((v) => v.value === type)!.unit;

  const latest = useQuery({
    queryKey: ['vitals', 'latest'],
    queryFn: async () => {
      const res = await backend.get('/api/vitals/latest');
      return res.data.data as VitalLog[];
    },
  });

  const history = useQuery({
    queryKey: ['vitals', 'history', type],
    queryFn: async () => {
      const res = await backend.get('/api/vitals/history', { params: { type } });
      return res.data.data as VitalLog[];
    },
  });

  // Safe ranges (vitals thresholds) — powers the backend breach alerts.
  const thresholds = useQuery({
    queryKey: ['vitals', 'thresholds'],
    queryFn: async () => {
      const res = await backend.get('/api/vitals/thresholds');
      return res.data.data as Threshold[];
    },
  });

  const thresholdFor = (t: string) => thresholds.data?.find((x) => x.vitalType === t);

  const logVital = useMutation({
    mutationFn: async () => {
      await backend.post('/api/vitals/', { type, value: Number(value), unit });
    },
    onSuccess: () => {
      setValue('');
      setMsg('Saved ✓');
      qc.invalidateQueries({ queryKey: ['vitals'] });
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (err) => setMsg(apiError(err, 'Failed to save')),
  });

  const saveThreshold = useMutation({
    mutationFn: async () => {
      await backend.post('/api/vitals/thresholds', {
        vitalType: thType,
        minSafe: Number(minSafe),
        maxSafe: Number(maxSafe),
      });
    },
    onSuccess: () => {
      setThMsg('Range saved ✓ — breaches will trigger alerts');
      setMinSafe('');
      setMaxSafe('');
      qc.invalidateQueries({ queryKey: ['vitals', 'thresholds'] });
      setTimeout(() => setThMsg(''), 3000);
    },
    onError: (err) => setThMsg(apiError(err, 'Failed to save range')),
  });

  const chartData =
    history.data?.map((d) => ({
      time: new Date(d.recordedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      value: d.value,
    })) ?? [];

  const chartTh = thresholdFor(type);

  return (
    <div>
      <PageTitle icon={Activity} sub="Log readings, watch trends, set safe ranges">
        Vitals
      </PageTitle>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Log form */}
        <Card className="p-4">
          <SectionTitle icon={PlusCircle}>Log a reading</SectionTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (value) logVital.mutate();
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as VitalType)}
                className={inputCls}
              >
                {VITAL_TYPES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Value ({unit})
              </span>
              <input
                type="number"
                step="any"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`w-32 ${inputCls}`}
              />
            </label>

            <Button type="submit" disabled={logVital.isPending}>
              {logVital.isPending ? 'Saving…' : 'Log vital'}
            </Button>
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
          </form>
        </Card>

        {/* Safe ranges editor (wires GET/POST /api/vitals/thresholds) */}
        <Card className="p-4">
          <SectionTitle icon={ShieldCheck}>Safe ranges (alerts)</SectionTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (minSafe && maxSafe) saveThreshold.mutate();
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Type</span>
              <select
                value={thType}
                onChange={(e) => {
                  const t = e.target.value as VitalType;
                  setThType(t);
                  const ex = thresholdFor(t);
                  setMinSafe(ex ? String(ex.minSafe) : '');
                  setMaxSafe(ex ? String(ex.maxSafe) : '');
                }}
                className={inputCls}
              >
                {VITAL_TYPES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Min safe</span>
              <input
                type="number"
                step="any"
                required
                value={minSafe}
                onChange={(e) => setMinSafe(e.target.value)}
                className={`w-24 ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Max safe</span>
              <input
                type="number"
                step="any"
                required
                value={maxSafe}
                onChange={(e) => setMaxSafe(e.target.value)}
                className={`w-24 ${inputCls}`}
              />
            </label>
            <Button type="submit" variant="secondary" disabled={saveThreshold.isPending}>
              {saveThreshold.isPending ? 'Saving…' : 'Save range'}
            </Button>
          </form>
          {thMsg && <p className="mt-2 text-sm text-slate-500">{thMsg}</p>}
          {/* configured ranges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {thresholds.data?.map((t) => (
              <Badge key={t._id} tone="indigo">
                {labelFor(t.vitalType)}: {t.minSafe}–{t.maxSafe}
              </Badge>
            ))}
            {thresholds.data?.length === 0 && (
              <span className="text-xs text-slate-400">
                No ranges yet — out-of-range readings will alert you & your caregivers.
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Latest per type */}
      <SectionTitle icon={Activity}>Latest readings</SectionTitle>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {latest.isLoading && <SkeletonRows rows={2} className="col-span-full" />}
        {latest.data?.length === 0 && (
          <div className="col-span-full">
            <EmptyState icon={Activity} title="No readings yet" hint="Log your first vital above." />
          </div>
        )}
        {latest.data?.map((v, i) => {
          const th = thresholdFor(v.type);
          const outOfRange = th && (v.value < th.minSafe || v.value > th.maxSafe);
          return (
            <motion.div
              key={v._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-xl border p-4 transition hover:shadow-sm ${
                outOfRange ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">{labelFor(v.type)}</div>
                {outOfRange && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              </div>
              <div className={`text-xl font-semibold ${outOfRange ? 'text-red-600' : 'text-slate-800'}`}>
                {v.value}
                <span className="ml-1 text-sm font-normal text-slate-400">{v.unit}</span>
              </div>
              {th && (
                <div className="mt-0.5 text-[10px] text-slate-400">
                  safe {th.minSafe}–{th.maxSafe}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Trend chart */}
      <SectionTitle icon={TrendingUp}>{labelFor(type)} trend</SectionTitle>
      <Card className="h-72 p-4">
        {chartData.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={`No history for ${labelFor(type)} yet`}
            className="h-full"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip />
              {/* safe-range guides when configured */}
              {chartTh && (
                <ReferenceLine y={chartTh.minSafe} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              {chartTh && (
                <ReferenceLine y={chartTh.maxSafe} stroke="#f59e0b" strokeDasharray="4 4" />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
