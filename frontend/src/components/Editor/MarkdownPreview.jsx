import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownPreview({ content }) {
  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
        <span className="text-5xl opacity-40">✨</span>
        <p className="text-sm">Start typing to see the preview...</p>
      </div>
    );
  }

  return (
    <div className="markdown-body p-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
