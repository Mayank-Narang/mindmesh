import Badge from '../ui/Badge';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  markdown: { icon: 'M↓', variant: 'violet', label: 'Markdown' },
  text: { icon: 'Aa', variant: 'slate', label: 'Text' },
  url: { icon: '🔗', variant: 'cyan', label: 'URL' },
};

export default function ResultCard({ result, index }) {
  const navigate = useNavigate();
  const typeConf = TYPE_CONFIG[result.type] || TYPE_CONFIG.text;
  const scorePercent = Math.round(result.score * 100);

  const scoreColor =
    result.score >= 0.9 ? 'text-emerald-400' :
    result.score >= 0.7 ? 'text-purple-400' :
    'text-amber-400';

  return (
    <div
      onClick={() => navigate(`/editor/${result.id}`)}
      className={`group glass glass-hover rounded-2xl p-5 cursor-pointer animate-fade-in-up`}
      style={{ animationDelay: `${index * 0.06}s`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={typeConf.variant}>
              {typeConf.icon} {typeConf.label}
            </Badge>
            {result.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="slate">#{tag}</Badge>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-white group-hover:text-gradient transition-colors truncate">
            {result.title}
          </h3>

          <p className="text-sm text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
            {result.snippet}
          </p>

          {result.type === 'url' && result.url && (
            <p className="text-xs text-[#52525b] mt-2 truncate">{result.url}</p>
          )}
        </div>

        {/* Score badge */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
            {scorePercent}
          </div>
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider font-medium">
            match
          </div>
          {/* Mini bar */}
          <div className="w-10 h-1 bg-[#27272a] rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full rounded-full bg-gradient-accent transition-all duration-700"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Open action */}
      <div className="flex justify-end mt-3 pt-3 border-t border-[#27272a]/40">
        <span className="text-xs text-[#71717a] group-hover:text-purple-400 transition-colors flex items-center gap-1">
          Open in Editor
          <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </div>
    </div>
  );
}
