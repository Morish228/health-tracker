import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bot, Send, Mic, Square, Volume2, VolumeX, MessageSquarePlus,
  FileText, Siren, Sparkles, Quote, ChevronDown, ChevronUp,
} from 'lucide-react';
import { agentApi, apiError, getToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Markdown from '../components/Markdown';
import PipelineIndicator from '../components/PipelineIndicator';

interface Session {
  sessionId: string;
  title?: string;
  updatedAt?: string;
}
interface Message {
  role: 'user' | 'assistant' | string;
  content: string;
  createdAt?: string;
  route?: string; // client-side annotation on assistant replies
  citations?: string[]; // Self-RAG evidence quotes
}

/* route → badge look (icon, label, colors) */
const ROUTE_BADGE: Record<string, { label: string; cls: string; Icon: typeof Bot }> = {
  report_rag: { label: 'Report RAG', cls: 'bg-indigo-50 text-indigo-600 ring-indigo-200', Icon: FileText },
  assistant: { label: 'Assistant', cls: 'bg-emerald-50 text-emerald-600 ring-emerald-200', Icon: Bot },
  emergency: { label: 'Emergency', cls: 'bg-red-50 text-red-600 ring-red-200', Icon: Siren },
};

const SUGGESTIONS = [
  'What was my hemoglobin in my last report?',
  'Which doctor has available slots tomorrow?',
  'Show my medication adherence this week',
  'I have a mild headache since morning',
];

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* expandable "Sources" section under report answers */
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

export default function Assistant() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const patientId = user?.id ?? '';
  const initial = (user?.firstName?.[0] || 'U').toUpperCase();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [pendingRoute, setPendingRoute] = useState<'chat' | 'report'>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);

  // smooth autoscroll whenever messages / pending state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  // ---- Voice I/O (goal 22): mic capture -> /voice-chat, browser TTS speaks the answer ----
  const [recording, setRecording] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const speakText = (text: string) => {
    if (!speakOn || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  // Stop any speech/recording if we leave the page.
  useEffect(
    () => () => {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      mediaRef.current?.stop();
    },
    [],
  );

  const sessions = useQuery({
    queryKey: ['sessions', patientId],
    enabled: !!patientId,
    queryFn: async () =>
      (await agentApi.get('/sessions', { params: { patientId } })).data.sessions as Session[],
  });

  const loadSession = useMutation({
    mutationFn: async (id: string) =>
      (await agentApi.get(`/sessions/${id}`)).data.messages as Message[],
    onSuccess: (msgs, id) => {
      setSessionId(id);
      setMessages(msgs);
      setErr('');
    },
  });

  const send = useMutation({
    mutationFn: async (question: string) => {
      const res = await agentApi.post('/chat', {
        question,
        patientId,
        sessionId: sessionId || undefined,
        authToken: getToken() || undefined, // lets the agent call backend tools on your behalf
      });
      return res.data as { answer: string; route?: string; sessionId?: string; citations?: string[] };
    },
    onSuccess: (data) => {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.answer, route: data.route, citations: data.citations },
      ]);
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        qc.invalidateQueries({ queryKey: ['sessions', patientId] });
      }
      speakText(data.answer);
    },
    onError: (e) => {
      setErr(apiError(e, 'The assistant is unavailable (LLM quota may be exhausted).'));
    },
  });

  // Send a recorded clip: agent transcribes (Groq Whisper) then runs the chat pipeline.
  const sendVoice = useMutation({
    mutationFn: async (blob: Blob) => {
      const fd = new FormData();
      fd.append('file', blob, 'clip.webm');
      fd.append('patientId', patientId);
      if (sessionId) fd.append('sessionId', sessionId);
      const token = getToken();
      if (token) fd.append('authToken', token);
      const res = await agentApi.post('/voice-chat', fd);
      return res.data as {
        answer: string;
        route?: string;
        sessionId?: string;
        citations?: string[];
        transcript: string;
      };
    },
    onSuccess: (data) => {
      setMessages((m) => [
        ...m,
        { role: 'user', content: data.transcript },
        { role: 'assistant', content: data.answer, route: data.route, citations: data.citations },
      ]);
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        qc.invalidateQueries({ queryKey: ['sessions', patientId] });
      }
      speakText(data.answer);
    },
    onError: (e) => setErr(apiError(e, 'Voice chat failed (mic or LLM unavailable).')),
  });

  const startRecording = async () => {
    setErr('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErr('Your browser does not support audio recording.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size) sendVoice.mutate(blob);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setErr('Microphone access was denied.');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  };

  const toggleMic = () => (recording ? stopRecording() : startRecording());

  const submit = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || send.isPending) return;
    setErr('');
    setInput('');
    // guess which pipeline animation to show
    setPendingRoute(/report|hemoglobin|glucose|lab|test result|blood|cholesterol/i.test(q) ? 'report' : 'chat');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    send.mutate(q);
  };

  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setErr('');
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Session history */}
      <aside className="flex w-56 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-3">
        <button
          onClick={newChat}
          className="mb-3 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </button>
        <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          History
        </div>
        <div className="nice-scroll flex-1 space-y-1 overflow-y-auto">
          {sessions.isLoading && (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}
          {sessions.data?.length === 0 && (
            <p className="px-1 text-xs text-slate-400">No past conversations.</p>
          )}
          {sessions.data?.map((s) => (
            <button
              key={s.sessionId}
              onClick={() => loadSession.mutate(s.sessionId)}
              className={`block w-full rounded-lg px-2 py-1.5 text-left transition ${
                sessionId === s.sessionId
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title={s.title}
            >
              <span className="block truncate text-sm">{s.title || 'Conversation'}</span>
              <span className="block text-[10px] text-slate-400">{timeAgo(s.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">AI Health Assistant</h1>
              <p className="text-xs text-slate-400">
                Agentic RAG · Self-verifying answers grounded in your reports
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (speakOn && typeof window !== 'undefined') window.speechSynthesis?.cancel();
              setSpeakOn((v) => !v);
            }}
            title={speakOn ? 'Voice replies on' : 'Voice replies off'}
            className={`shrink-0 rounded-lg p-2 transition ${
              speakOn ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'
            }`}
          >
            {speakOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        <div className="nice-scroll flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && !send.isPending && (
            <div className="mx-auto max-w-lg pt-8 text-center">
              <div className="mb-3 inline-flex rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 p-4">
                <Sparkles className="h-6 w-6 text-indigo-500" />
              </div>
              <p className="mb-4 text-sm text-slate-400">
                Ask about your reports, book appointments, log vitals — or describe symptoms.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-full border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs text-indigo-600 transition hover:bg-indigo-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === 'user';
            const badge = !isUser && m.route ? ROUTE_BADGE[m.route] : undefined;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={isUser ? 'flex justify-end gap-2' : 'flex justify-start gap-2'}
              >
                {!isUser && (
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                    isUser
                      ? 'rounded-br-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                      : 'rounded-bl-sm border border-slate-100 bg-slate-50 text-slate-700'
                  }`}
                >
                  {badge && (
                    <span
                      className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${badge.cls}`}
                    >
                      <badge.Icon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  )}
                  {isUser ? (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  ) : (
                    <Markdown>{m.content}</Markdown>
                  )}
                  {!isUser && m.citations && m.citations.length > 0 && (
                    <Citations quotes={m.citations} />
                  )}
                </div>
                {isUser && (
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                    {initial}
                  </span>
                )}
              </motion.div>
            );
          })}
          {(send.isPending || sendVoice.isPending) && (
            <div className="flex justify-start gap-2">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Bot className="h-4 w-4" />
              </span>
              {sendVoice.isPending ? (
                <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm text-slate-400">
                  Transcribing your voice…
                </div>
              ) : (
                <PipelineIndicator mode={pendingRoute} />
              )}
            </div>
          )}
          {err && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{err}</div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex gap-2 border-t border-slate-100 p-3"
        >
          <button
            type="button"
            onClick={toggleMic}
            disabled={send.isPending || sendVoice.isPending}
            title={recording ? 'Stop and send' : 'Speak your message'}
            className={`shrink-0 rounded-lg px-3 py-2 transition disabled:opacity-60 ${
              recording
                ? 'animate-pulse bg-red-600 text-white hover:bg-red-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={recording ? 'Listening…' : 'Message the assistant…'}
            disabled={recording}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={send.isPending || sendVoice.isPending || recording || !input.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
