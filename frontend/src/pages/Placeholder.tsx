export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">{title}</h1>
      <p className="text-sm text-slate-500">Coming soon — this page is being built.</p>
    </div>
  );
}
