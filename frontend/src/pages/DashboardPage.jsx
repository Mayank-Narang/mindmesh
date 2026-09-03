import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotes, getBrains } from '../services/apiMock';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

const TYPE_ICONS = { markdown: 'M↓', text: 'Aa', url: '🔗' };
const TYPE_VARIANTS = { markdown: 'violet', text: 'slate', url: 'cyan' };

export default function DashboardPage() {
  const [notes, setNotes] = useState([]);
  const [brains, setBrains] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getNotes().then(setNotes);
    getBrains().then(setBrains);
  }, []);

  const recentNotes = [...notes].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  ).slice(0, 6);

  const formatDate = (d) => {
    const date = new Date(d);
    const now = new Date();
    const diffH = Math.floor((now - date) / 3600000);
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">
          Welcome back, <span className="text-gradient">Mayank</span>
        </h1>
        <p className="text-slate-400 mt-2">Your knowledge, semantically connected.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Notes', value: notes.length, icon: '📝', color: 'from-cyan-500/20 to-cyan-500/5' },
          { label: 'Brains', value: brains.length, icon: '🧠', color: 'from-violet-500/20 to-violet-500/5' },
          { label: 'URL Notes', value: notes.filter(n => n.type === 'url').length, icon: '🔗', color: 'from-emerald-500/20 to-emerald-500/5' },
          { label: 'Tags Used', value: [...new Set(notes.flatMap(n => n.tags))].length, icon: '🏷️', color: 'from-amber-500/20 to-amber-500/5' },
        ].map((stat) => (
          <GlassCard key={stat.label} hover={false} className={`p-4 bg-gradient-to-br ${stat.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => navigate('/editor')} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Note
        </button>
        <button onClick={() => navigate('/search')} className="btn-ghost flex items-center gap-2 glass-light">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Semantic Search
        </button>
      </div>

      {/* Brains grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Your Brains</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {brains.map((brain, i) => (
            <GlassCard
              key={brain.id}
              className={`p-5 animate-fade-in-up stagger-${i + 1}`}
              onClick={() => navigate(`/?brain=${brain.id}`)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ backgroundColor: brain.color + '20' }}
                >
                  {brain.emoji}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{brain.name}</h3>
                  <p className="text-xs text-slate-500">{brain.noteCount} notes</p>
                </div>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (brain.noteCount / 40) * 100)}%`,
                    backgroundColor: brain.color,
                  }}
                />
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Recent notes */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Notes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentNotes.map((note, i) => (
            <GlassCard
              key={note.id}
              className={`p-5 animate-fade-in-up stagger-${i + 1}`}
              onClick={() => navigate(`/editor/${note.id}`)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={TYPE_VARIANTS[note.type]}>
                  {TYPE_ICONS[note.type]} {note.type}
                </Badge>
                <span className="text-[10px] text-slate-500 ml-auto">{formatDate(note.updatedAt)}</span>
              </div>
              <h3 className="font-semibold text-white truncate">{note.title}</h3>
              <p className="text-sm text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {note.content.substring(0, 100)}...
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {note.tags.map((tag) => (
                  <span key={tag} className="text-[10px] text-slate-500">#{tag}</span>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
