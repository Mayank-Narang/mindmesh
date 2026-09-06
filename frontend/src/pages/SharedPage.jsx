import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSharedWithMe } from '../services';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

export default function SharedPage() {
  const [brains, setBrains] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadShared();
  }, []);

  const loadShared = async () => {
    setLoading(true);
    try {
      const data = await getSharedWithMe();
      setBrains(data.brains || []);
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to load shared items:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-[#a1a1aa]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading shared items...
        </div>
      </div>
    );
  }

  const totalItems = brains.length + notes.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Shared with Me</h1>
        <p className="text-[#a1a1aa] mt-1">Brains and notes others have shared with you</p>
      </div>

      {totalItems === 0 ? (
        <GlassCard className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#18181b] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#52525b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Nothing shared yet</h3>
          <p className="text-[#a1a1aa] text-sm">When someone shares a brain or note with you, it will appear here.</p>
        </GlassCard>
      ) : (
        <>
          {brains.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Shared Brains ({brains.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brains.map((brain) => (
                  <GlassCard key={brain.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: (brain.color || '#22d3ee') + '20' }}>
                        {brain.icon || brain.emoji || '🧠'}
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{brain.name}</h3>
                        <p className="text-xs text-[#52525b]">{brain.noteCount || 0} notes</p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Shared Notes ({notes.length})</h2>
              <div className="space-y-2">
                {notes.map((note) => (
                  <GlassCard key={note.id} className="p-4" onClick={() => navigate(`/editor/${note.id}`)}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={note.type === 'url' ? 'cyan' : note.type === 'markdown' ? 'violet' : 'neutral'}>
                        {note.type}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-white">{note.title}</h3>
                    <p className="text-sm text-[#a1a1aa] mt-1 line-clamp-2">{note.content?.substring(0, 150)}...</p>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
