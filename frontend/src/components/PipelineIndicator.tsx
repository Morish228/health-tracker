/**
 * PipelineIndicator.tsx — animated step tracker shown while the agent thinks.
 * It VISUALIZES the stages of the agentic pipeline (supervisor → CRAG → Self-RAG);
 * timings are client-side estimates, not live telemetry from the graph.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

const REPORT_STEPS = [
  'Routing your question',
  'Retrieving report chunks',
  'Grading relevance (CRAG)',
  'Generating answer',
  'Verifying grounding (Self-RAG)',
];

const CHAT_STEPS = [
  'Checking for emergencies',
  'Routing your question',
  'Consulting tools & memory',
  'Composing answer',
];

// rough time each step stays "active" before advancing (ms)
const STEP_MS = 1600;

export default function PipelineIndicator({ mode = 'chat' }: { mode?: 'chat' | 'report' }) {
  const steps = mode === 'report' ? REPORT_STEPS : CHAT_STEPS;
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    const id = setInterval(
      () => setActive((a) => Math.min(a + 1, steps.length - 1)),
      STEP_MS,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="rounded-2xl rounded-bl-sm border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <AnimatePresence>
        <div className="space-y-1.5">
          {steps.map((label, i) => {
            const done = i < active;
            const current = i === active;
            if (i > active) return null; // reveal steps as they start
            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-xs"
              >
                {done ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="h-3 w-3 text-emerald-600" />
                  </span>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                )}
                <span className={done ? 'text-slate-400 line-through' : current ? 'font-medium text-indigo-700' : 'text-slate-500'}>
                  {label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
}
