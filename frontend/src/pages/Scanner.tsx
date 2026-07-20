import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { scannerApi, apiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageTitle } from '../components/ui';

interface Alternative {
  name: string;
  composition?: string;
  estimatedPrice?: number;
  currency?: string;
  note?: string;
}
interface Identified {
  brandName?: string;
  genericName?: string;
  composition?: string;
  estimatedBrandPrice?: number;
  currency?: string;
}
interface ScanResult {
  identified: Identified;
  alternatives: Alternative[];
  cached: boolean;
  disclaimer: string;
}

const price = (v?: number, cur = 'INR') =>
  v == null ? '—' : `${cur === 'INR' ? '₹' : cur + ' '}${v.toFixed(2)}`;

function Alternatives({ items }: { items: Alternative[] }) {
  if (!items.length)
    return <p className="text-sm text-slate-400">No cheaper generic alternatives found.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a, i) => (
        <li key={i} className="flex items-start justify-between py-2">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800">{a.name}</div>
            {a.composition && <div className="text-xs text-slate-500">{a.composition}</div>}
            {a.note && <div className="text-xs text-slate-400">{a.note}</div>}
          </div>
          <div className="ml-3 shrink-0 text-sm font-semibold text-green-600">
            {price(a.estimatedPrice, a.currency)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Scanner() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [scanMsg, setScanMsg] = useState('');
  const [genMsg, setGenMsg] = useState('');

  const scan = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a photo first');
      const form = new FormData();
      form.append('file', file);
      if (user?.id) form.append('patientId', user.id);
      return (await scannerApi.post('/scan', form)).data as ScanResult;
    },
    onError: (err) => setScanMsg(apiError(err, 'Scan failed (needs Gemini Vision quota)')),
    onSuccess: () => setScanMsg(''),
  });

  const generics = useMutation({
    mutationFn: async () =>
      (await scannerApi.post('/generics', { brandName: brand.trim() })).data as ScanResult & {
        brandName: string;
      },
    onError: (err) => setGenMsg(apiError(err, 'Lookup failed (needs Gemini quota)')),
    onSuccess: () => setGenMsg(''),
  });

  const onPick = () => {
    const file = fileRef.current?.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
    setScanMsg('');
  };

  const identified = scan.data?.identified;

  return (
    <div>
      <PageTitle icon={ScanLine} sub="Identify a medicine from a photo & find cheaper generics">
        Medicine Scanner
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scan a photo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Scan a medicine photo</h2>

          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={onPick}
            className="mb-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />

          {preview && (
            <img
              src={preview}
              alt="preview"
              className="mb-3 max-h-48 rounded-xl border border-slate-200 object-contain"
            />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => scan.mutate()}
              disabled={scan.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {scan.isPending ? 'Identifying…' : 'Identify & find generics'}
            </button>
            {scanMsg && <span className="text-sm text-slate-500">{scanMsg}</span>}
          </div>

          {identified && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Identified
                </span>
                {scan.data?.cached && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    cached
                  </span>
                )}
              </div>
              {identified.brandName || identified.genericName ? (
                <>
                  <div className="text-sm font-medium text-slate-800">
                    {identified.brandName ?? identified.genericName}
                    {identified.brandName && identified.genericName && (
                      <span className="text-slate-400"> · {identified.genericName}</span>
                    )}
                  </div>
                  {identified.composition && (
                    <div className="text-xs text-slate-500">{identified.composition}</div>
                  )}
                  <div className="mt-1 text-xs text-slate-600">
                    Brand price: {price(identified.estimatedBrandPrice, identified.currency)}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Couldn’t read the box clearly — try a sharper, well-lit photo.
                </p>
              )}
            </div>
          )}

          {scan.data && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Cheaper alternatives</h3>
              <Alternatives items={scan.data.alternatives} />
            </div>
          )}
        </div>

        {/* Look up by name */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Know the brand name?</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (brand.trim()) generics.mutate();
            }}
            className="mb-4 flex gap-2"
          >
            <input
              placeholder="e.g. Crocin, Dolo 650"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={generics.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {generics.isPending ? 'Searching…' : 'Find generics'}
            </button>
          </form>
          {genMsg && <p className="mb-3 text-sm text-slate-500">{genMsg}</p>}

          {generics.data && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600">
                  Alternatives to {generics.data.brandName}
                </h3>
                {generics.data.cached && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    cached
                  </span>
                )}
              </div>
              <Alternatives items={generics.data.alternatives} />
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {scan.data?.disclaimer ??
          generics.data?.disclaimer ??
          'Prices are AI estimates, not real pricing. Always confirm generics with a pharmacist. Identification needs Gemini Vision quota (:8002).'}
      </p>
    </div>
  );
}
