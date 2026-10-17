import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { askAI, getBrains } from '../services';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

export default function AIPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [brains, setBrains] = useState([]);
  const [selectedBrain, setSelectedBrain] = useState('all');

  const answerRef = useRef(null);
  const navigate = useNavigate();

  // Load brains for brain-targeted AI retrieval
  useEffect(() => {
    getBrains().then(setBrains).catch(() => {});
  }, []);

  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [answer]);

  const handleAsk = async (e) => {
    e?.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer('');
    setSources([]);
    setError(null);

    try {
      const brainId = selectedBrain === 'all' ? null : selectedBrain;
      await askAI(question.trim(), brainId, {
        onSources: (data) => setSources(data || []),
        onMessage: (text) => setAnswer((prev) => prev + text),
        onError: (errMsg) => setError(errMsg),
        onDone: () => setLoading(false),
      });
    } catch (err) {
      setError(err.message || 'Failed to generate answer. Please try again.');
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'What are the key concepts in my notes?',
    'Summarize my research on AI and semantic search',
    'Find connections between my ideas',
    'What did I learn about productivity and systems?',
  ];

  const renderAnswerContent = () => {
    if (!answer) return null;
    const tokens = answer.split(/(\[\d+\])/g);
    return tokens.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const citationNum = parseInt(match[1], 10);
        const sourceIndex = citationNum - 1;
        const source = sources[sourceIndex];
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (source?.id) {
                const el = document.getElementById(`source-card-${source.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-cyan-400');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 2500);
                } else {
                  navigate(`/editor/${source.id}`);
                }
              }
            }}
            title={source ? `${source.title || 'Note'} (${Math.round((source.score || 0) * 100)}% match)` : `Source [${citationNum}]`}
            className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold bg-purple-500/25 text-purple-300 hover:bg-cyan-500/20 hover:text-cyan-300 border border-purple-500/40 hover:border-cyan-400/50 transition-all cursor-pointer align-baseline"
          >
            [{citationNum}]
          </button>
        );
      }
      return part;
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">AI Assistant</h1>
        <p className="text-[#a1a1aa] mt-1">
          Ask questions across your entire knowledge base or a specific brain workspace
        </p>
      </div>

      {/* Query Form with Brain Scope Filter */}
      <form onSubmit={handleAsk} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about your notes..."
            className="input-base flex-1 text-base"
            disabled={loading}
          />

          <div className="flex gap-2">
            <select
              value={selectedBrain}
              onChange={(e) => setSelectedBrain(e.target.value)}
              disabled={loading}
              className="input-base text-sm py-2 px-3 sm:w-44 bg-slate-900/80"
              title="Filter AI retrieval to a specific brain"
            >
              <option value="all">🧠 All Brains</option>
              {brains.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.icon || '🧠'} {b.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="btn-primary px-6 text-sm flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Thinking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Ask AI
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Suggested Questions */}
      {!answer && !loading && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-[#52525b] font-medium">Suggested queries:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuestion(q);
                }}
                className="px-3.5 py-1.5 rounded-full bg-[#18181b]/70 border border-[#3f3f46] text-xs text-[#d4d4d8] hover:border-purple-500/50 hover:text-purple-300 transition-all text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={handleAsk}
            className="btn-primary text-xs px-3 py-1 whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* Streamed Answer Card */}
      {answer && (
        <GlassCard className="p-6 space-y-4 shadow-glow-accent">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center text-white">
                ✨
              </div>
              <div>
                <span className="font-semibold text-white text-sm">MindMesh Intelligence</span>
                <p className="text-[10px] text-[#71717a]">Grounding response on your vector-indexed notes</p>
              </div>
            </div>
            {loading && (
              <span className="flex items-center gap-1.5 text-xs text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                Streaming...
              </span>
            )}
          </div>

          <div
            ref={answerRef}
            className="text-[#d4d4d8] leading-relaxed whitespace-pre-wrap text-sm sm:text-base selection:bg-purple-500/30 font-sans"
          >
            {renderAnswerContent()}
          </div>
        </GlassCard>
      )}

      {/* Citations / Source Cards */}
      {sources.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#a1a1aa] flex items-center gap-2">
              <span>Grounding Sources</span>
              <Badge variant="violet">{sources.length} cited</Badge>
            </h3>
            <span className="text-xs text-[#52525b]">Click source to open real note</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sources.map((source, idx) => (
              <GlassCard
                key={source.id || idx}
                id={`source-card-${source.id || idx}`}
                className="p-4 hover:border-cyan-400/50 cursor-pointer transition-all group duration-300"
                onClick={() => navigate(`/editor/${source.id}`)}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-bold flex-shrink-0">
                      [{idx + 1}]
                    </span>
                    <span className="font-medium text-white text-sm truncate group-hover:text-cyan-300 transition-colors">
                      {source.title || 'Untitled Note'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {typeof source.chunkIndex === 'number' && (
                      <Badge variant="slate">
                        Chunk #{source.chunkIndex + 1}
                      </Badge>
                    )}
                    {source.score && (
                      <Badge variant="cyan">
                        {Math.round(source.score * 100)}% match
                      </Badge>
                    )}
                  </div>
                </div>

                {source.snippet && (
                  <p className="text-xs text-[#a1a1aa] line-clamp-3 leading-relaxed mt-1">
                    {source.snippet}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#27272a]/40 text-[10px] text-[#71717a]">
                  <span>ID: {source.id}</span>
                  <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-medium">
                    View note &rarr;
                  </span>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
