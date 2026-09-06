import ResultCard from './ResultCard';
import LoadingShimmer from '../ui/LoadingShimmer';

export default function SearchResults({ results, loading, hasSearched }) {
  if (loading) {
    return <LoadingShimmer lines={3} className="mt-6" />;
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="text-6xl mb-4 animate-float">🧠</div>
        <h3 className="text-xl font-semibold text-[#d4d4d8] mb-2">Search Your Mind</h3>
        <p className="text-[#71717a] max-w-md text-sm leading-relaxed">
          Type a concept, idea, or question — MindMesh finds notes by <span className="text-purple-400 font-medium">meaning</span>, not just keywords.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {['brightness', 'auth security', 'vector search', 'react hooks'].map((q) => (
            <span key={q} className="px-3 py-1.5 glass-light rounded-lg text-xs text-slate-400 cursor-default">
              try "{q}"
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="text-5xl mb-4 opacity-40">🔍</div>
        <h3 className="text-lg font-semibold text-slate-400 mb-1">No matches found</h3>
        <p className="text-[#71717a] text-sm">Try a different query or broader concept.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-400">
          <span className="text-white font-medium">{results.length}</span> results found
        </p>
        <p className="text-xs text-[#52525b]">Ranked by semantic relevance</p>
      </div>
      {results.map((result, i) => (
        <ResultCard key={result.id} result={result} index={i} />
      ))}
    </div>
  );
}
