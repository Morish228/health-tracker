/**
 * Markdown.tsx — styled markdown renderer for chat bubbles / AI answers.
 * Styling lives in index.css under .md-body.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
