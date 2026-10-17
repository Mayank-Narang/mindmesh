import Badge from '../ui/Badge';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  markdown: { icon: 'M↓', variant: 'violet', label: 'Markdown' },
  text: { icon: 'Aa', variant: 'slate', label: 'Text' },
  url: { icon: '🔗', variant: 'cyan', label: 'URL' },
};

export default function ResultCard({ result, index, mode = 'semantic', brains = [] }) {
  const navigate = useNavigate();
  const typeConf = TYPE_CONFIG[result.type] || TYPE_CONFIG.text;

  // Resolve source brain
  const brainId = result.brainId || result.brain;
  const brainObj = brains.find((b) => b.id === brainId);

  // Score computation
  const rawScore = typeof result.score === 'number' ? result.score : 0.85;
  const scorePercent = Math.min(100, Math.round(rawScore * 100));

  const scoreColor =
    scorePercent >= 88 ? 'text-emerald-400' :
    scorePercent >= 70 ? 'text-purple-400' :
    'text-amber-400';

  const isShared = Array.isArray(result.sharedWith) && result.sharedWith.length > 0;

  const formatDate = (d) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div
      onClick={() => navigate(`/editor/${result.id}`)}
      className="group glass glass-hover rounded-2xl p-5 cursor-pointer animate-fade-in-up"
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant={typeConf.variant}>
              {typeConf.icon} {typeConf.label}
            </Badge>

            {brainObj && (
              <Badge variant="neutral">
                {brainObj.icon || '🧠'} {brainObj.name}
              </Badge>
            )}

            {isShared && (
              <Badge variant="violet">
                👥 Shared ({result.sharedWith.length})
              </Badge>
            )}

            {result.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="slate">
                #{tag}
              </Badge>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-white group-hover:text-gradient transition-colors truncate">
            {result.title || 'Untitled Note'}
          </h3>

          <p className="text-sm text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
            {result.snippet || (result.content ? result.content.substring(0, 160) : 'No preview available')}
          </p>

          {result.type === 'url' && result.url && (
            <p className="text-xs text-[#52525b] mt-2 truncate flex items-center gap-1">
              <span>🔗</span>
              <span>{result.url}</span>
            </p>
          )}
        </div>

        {/* Right side: Mode-specific info */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 min-w-[70px]">
          {mode === 'recency' ? (
            <div className="text-center">
              <span className="text-xs font-semibold text-cyan-300">
                {formatDate(result.updatedAt || result.createdAt)}
              </span>
              <div className="text-[10px] text-[#71717a] uppercase tracking-wider font-medium mt-0.5">
                Updated
              </div>
            </div>
          ) : mode === 'keyword' ? (
            <div className="text-center">
              <span className="text-lg font-bold text-purple-400">
                #{index + 1}
              </span>
              <div className="text-[10px] text-[#71717a] uppercase tracking-wider font-medium">
                Keyword rank
              </div>
            </div>
          ) : (
            <>
              <div className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
                {scorePercent}%
              </div>
              <div className="text-[10px] text-[#71717a] uppercase tracking-wider font-medium">
                {mode === 'hybrid' ? 'Hybrid match' : 'Vector match'}
              </div>
              <div className="w-12 h-1 bg-[#27272a] rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full bg-gradient-accent transition-all duration-700"
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Open action footer */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#27272a]/40">
        <span className="text-[11px] text-[#52525b]">
          ID: {result.id}
        </span>
        <span className="text-xs text-[#71717a] group-hover:text-purple-400 transition-colors flex items-center gap-1 font-medium">
          Open in Editor
          <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </div>
    </div>
  );
}
