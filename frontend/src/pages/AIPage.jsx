import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { askAI } from '../services';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

export default function AIPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const answerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [answer]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer('');
    setSources([]);
    setError(null);

    try {
      const data = await askAI(question.trim());
      setAnswer(data.answer || 'No answer generated.');
      setSources(data.sources || []);
    } catch (err) {
      setError(err.message || 'Failed to get answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'What are the key concepts in my notes?',
    'Summarize my research on AI',
    'Find connections between my ideas',
    'What did I learn about productivity?',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">AI Assistant</h1>
        <p className="text-[#a1a1aa] mt-1">Ask questions about your knowledge base</p>
      </div>

      {/* Question Input */}
      <form onSubmit={handleAsk} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your notes..."
          className="input-base flex-1"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !question.trim()} className="btn-primary px-6">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Thinking...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              Ask
            </span>
          )}
        </button>
      </form>

      {/* Suggested Questions */}
      {!answer && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-[#52525b]">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="px-3 py-1.5 rounded-full bg-[#18181b]/50 border border-[#3f3f46] text-sm text-[#d4d4d8] hover:border-purple-500/50 hover:text-purple-400 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Answer */}
      {answer && (
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <span className="font-medium text-white">AI Answer</span>
          </div>
          <div ref={answerRef} className="text-[#d4d4d8] leading-relaxed whitespace-pre-wrap">
            {answer}
          </div>
        </GlassCard>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[#a1a1aa]">Sources ({sources.length})</h3>
          <div className="space-y-2">
            {sources.map((source, idx) => (
              <GlassCard 
                key={source.id || idx} 
                className="p-4 hover:border-cyan-400/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/editor/${source.id}`)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-medium">
                    {idx + 1}
                  </span>
                  <span className="font-medium text-white text-sm">{source.title}</span>
                  {source.score && (
                    <Badge variant="cyan">{Math.round(source.score * 100)}% match</Badge>
                  )}
                </div>
                {source.snippet && (
                  <p className="text-xs text-[#a1a1aa] ml-7 line-clamp-2">{source.snippet}</p>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
