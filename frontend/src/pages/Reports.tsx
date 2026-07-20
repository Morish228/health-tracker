import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText, UploadCloud, Trash2, Quote, ChevronDown, ChevronUp,
  Bot, Send, FileSearch,
} from 'lucide-react';
import { ragApi, agentApi, apiError, getToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Markdown from '../components/Markdown';
import PipelineIndicator from '../components/PipelineIndicator';
import { Card, Badge, statusTone, SkeletonRows, EmptyState, SectionTitle, PageTitle, Button } from '../components/ui';

interface Report {
  reportId: string;
  fileName?: string;
  fileType?: string;
  reportType?: string;
  status?: string;
  uploadedAt?: string | null;
}
interface ChatTurn {
  question: string;
  answer: string;
  citations: string[];
}

function Citations({ quotes }: { quotes: string[] }) {
  const [open, setOpen] = useState(false);
  if (!quotes.length) return null;
  return (
    <div className="mt-2 border-t border-slate-200/70 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-700"
      >
        <Quote className="h-3 w-3" />
        Sources ({quotes.length})
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {quotes.map((q, i) => (
            <div
              key={i}
              className="rounded-lg border-l-2 border-indigo-300 bg-white/70 px-2.5 py-1.5 text-xs italic text-slate-500"
            >
              “{q}”
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const patientId = user?.id ?? '';

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [reportType, setReportType] = useState('');
  const [scope, setScope] = useState(''); // '' = all reports, else a reportId
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [msg, setMsg] = useState('');

  const reports = useQuery({
    queryKey: ['reports', patientId],
    enabled: !!patientId,
    queryFn: async () =>
      (await ragApi.get('/reports', { params: { patientId } })).data.reports as Report[],
  });

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a PDF or image first');
      const form = new FormData();
      form.append('patientId', patientId);
      if (reportType) form.append('reportType', reportType);
      form.append('file', file);
      await ragApi.post('/upload', form);
    },
    onSuccess: () => {
      setMsg('Uploaded ✓ — processing in the background (embedding may take a moment).');
      setReportType('');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['reports', patientId] });
      setTimeout(() => setMsg(''), 4000);
    },
    onError: (err) => setMsg(apiError(err, 'Upload failed')),
  });

  const del = useMutation({
    mutationFn: async (reportId: string) => {
      await ragApi.delete(`/report/${reportId}`, { params: { patientId } });
    },
    onSuccess: (_d, reportId) => {
      if (scope === reportId) setScope('');
      qc.invalidateQueries({ queryKey: ['reports', patientId] });
    },
  });

  const ask = useMutation({
    mutationFn: async (q: string) => {
      // Report Q&A goes through the agent's CRAG+Self-RAG pipeline (rag-service is retrieval-only).
      const res = await agentApi.post('/chat', {
        question: q,
        patientId,
        reportId: scope || undefined,
        sessionId: chatSessionId || undefined,
        authToken: getToken() || undefined,
      });
      return res.data as { answer: string; citations?: string[]; sessionId?: string };
    },
    onSuccess: (data, q) => {
      if (data.sessionId) setChatSessionId(data.sessionId);
      setTurns((t) => [...t, { question: q, answer: data.answer, citations: data.citations ?? [] }]);
      setQuestion('');
    },
    onError: (err, q) => {
      setTurns((t) => [...t, { question: q, answer: `⚠️ ${apiError(err, 'Query failed')}`, citations: [] }]);
      setQuestion('');
    },
  });

  const onDropFile = (file: File | undefined) => {
    if (!file || !fileRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileRef.current.files = dt.files;
    setFileName(file.name);
  };

  return (
    <div>
      <PageTitle icon={FileSearch} sub="Upload medical reports; ask questions answered by a self-verifying RAG pipeline">
        Reports (AI)
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload + reports list */}
        <div>
          <Card className="mb-6 p-4">
            <SectionTitle icon={UploadCloud}>Upload a report</SectionTitle>

            {/* drag & drop zone */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onDropFile(e.dataTransfer.files?.[0]);
              }}
              className={`mb-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40'
              }`}
            >
              <UploadCloud className={`mb-2 h-7 w-7 ${dragOver ? 'text-indigo-500' : 'text-slate-400'}`} />
              <span className="text-sm font-medium text-slate-600">
                {fileName || 'Drop a file here or click to browse'}
              </span>
              <span className="mt-1 text-xs text-slate-400">PDF · JPG · PNG</span>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
            </label>

            <input
              placeholder="Report type (optional, e.g. Blood Test)"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex items-center gap-3">
              <Button onClick={() => upload.mutate()} disabled={upload.isPending}>
                <UploadCloud className="h-4 w-4" />
                {upload.isPending ? 'Uploading…' : 'Upload'}
              </Button>
              {msg && <span className="text-sm text-slate-500">{msg}</span>}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Text is extracted, chunked & embedded for patient-scoped vector search.
            </p>
          </Card>

          <SectionTitle icon={FileText}>Your reports</SectionTitle>
          <div className="space-y-2">
            {reports.isLoading && <SkeletonRows rows={3} />}
            {reports.data?.length === 0 && (
              <EmptyState
                icon={FileText}
                title="No reports uploaded yet"
                hint="Upload a lab report or prescription to start asking questions about it."
              />
            )}
            {reports.data?.map((r) => (
              <motion.div
                key={r.reportId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-lg bg-indigo-50 p-2 text-indigo-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {r.fileName ?? 'Report'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      {r.reportType && <Badge tone="indigo">{r.reportType}</Badge>}
                      {r.status && <Badge tone={statusTone(r.status)}>{r.status}</Badge>}
                      <span className="uppercase">{r.fileType}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => del.mutate(r.reportId)}
                  disabled={del.isPending}
                  title="Delete report"
                  className="ml-3 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Q&A chat */}
        <Card className="flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle icon={Bot} className="mb-0">
              Ask about your reports
            </SectionTitle>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-500"
            >
              <option value="">All reports</option>
              {reports.data?.map((r) => (
                <option key={r.reportId} value={r.reportId}>
                  {r.fileName ?? r.reportId}
                </option>
              ))}
            </select>
          </div>

          <div className="nice-scroll mb-3 flex-1 space-y-3 overflow-y-auto" style={{ minHeight: 260 }}>
            {turns.length === 0 && !ask.isPending && (
              <EmptyState
                icon={Quote}
                title="Ask a question grounded in your reports"
                hint='e.g. "What was my hemoglobin?" — answers include verified source quotes.'
              />
            )}
            {turns.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-1 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm text-white">
                  {t.question}
                </div>
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <Markdown>{t.answer}</Markdown>
                  <Citations quotes={t.citations} />
                </div>
              </motion.div>
            ))}
            {ask.isPending && <PipelineIndicator mode="report" />}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = question.trim();
              if (q) ask.mutate(q);
            }}
            className="flex gap-2 border-t border-slate-100 pt-3"
          >
            <input
              placeholder="Ask a question…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <Button type="submit" disabled={ask.isPending}>
              <Send className="h-4 w-4" />
              Ask
            </Button>
          </form>
          <p className="mt-2 text-xs text-slate-400">
            CRAG + Self-RAG pipeline: retrieval graded, answer verified against sources before you see it.
          </p>
        </Card>
      </div>
    </div>
  );
}
