import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotes, getBrains } from '../services';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import MeshBackground from '../components/ui/MeshBackground';

const TYPE_ICONS = { markdown: 'M↓', text: 'Aa', url: '🔗' };
const TYPE_VARIANTS = { markdown: 'violet', text: 'slate', url: 'purple' };

export default function DashboardPage() {
  const [notes, setNotes] = useState([]);
  const [brains, setBrains] = useState([]);
  const navigate = useNavigate();
  const { user } = useAuth();

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
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative">
      <MeshBackground />
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">
          Welcome back, <span className="text-gradient">{user?.name || 'User'}</span>
        </h1>
        <p className="text-[#a1a1aa] mt-2">Your knowledge, semantically connected.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Notes', value: notes.length, icon: '📝', color: 'from-purple-500/20 to-purple-500/5' },
          { label: 'Brains', value: brains.length, icon: '🧠', color: 'from-violet-500/20 to-violet-500/5' },
          { label: 'URL Notes', value: notes.filter(n => n.type === 'url').length, icon: '🔗', color: 'from-emerald-500/20 to-emerald-500/5' },
        ].map((stat) => (
          <GlassCard key={stat.label} hover={false} className={`p-4 bg-gradient-to-br ${stat.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#a1a1aa] uppercase tracking-wider">{stat.label}</p>
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
        <button onClick={() => navigate('/brains')} className="btn-ghost flex items-center gap-2 glass-light">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
          Manage Brains
        </button>
        <button onClick={() => navigate('/search')} className="btn-ghost flex items-center gap-2 glass-light">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          Semantic Search
        </button>
        <button onClick={() => navigate('/ai')} className="btn-ghost flex items-center gap-2 glass-light">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          AI Chat
        </button>
      </div>

      {/* Brains grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Your Brains</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {brains.map((brain, i) => (
            <GlassCard
              key={brain.id}
              className={`p-5 animate-fade-in-up animate-fade-in-up stagger-${i + 1}`}
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
                  <p className="text-xs text-[#52525b]">{brain.noteCount} notes</p>
                </div>
              </div>
              <div className="h-1 bg-[#18181b] rounded-full overflow-hidden">
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
              className={`p-5 animate-fade-in-up animate-fade-in-up stagger-${i + 1}`}
              onClick={() => navigate(`/editor/${note.id}`)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={TYPE_VARIANTS[note.type]}>
                  {TYPE_ICONS[note.type]} {note.type}
                </Badge>
                <span className="text-[10px] text-[#52525b] ml-auto">{formatDate(note.updatedAt)}</span>
              </div>
              <h3 className="font-semibold text-white truncate">{note.title}</h3>
              <p className="text-sm text-[#a1a1aa] mt-1 line-clamp-2 leading-relaxed">
                {note.content.substring(0, 100)}...
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {note.tags.map((tag) => (
                  <span key={tag} className="text-[10px] text-[#52525b]">#{tag}</span>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
