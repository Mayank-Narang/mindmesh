/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSharedWithMe } from '../services';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

export default function SharedPage() {
  const [brains, setBrains] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadShared = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSharedWithMe();
      setBrains(data.brains || []);
      setNotes(data.notes || []);
    } catch (err) {
      setError(err.message || 'Failed to load shared items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShared();
  }, [loadShared]);

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

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <GlassCard className="p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-white">Error Loading Shared Items</h2>
          <p className="text-sm text-[#a1a1aa]">{error}</p>
          <button onClick={loadShared} className="btn-primary text-sm px-4 py-2">
            Retry
          </button>
        </GlassCard>
      </div>
    );
  }

  const totalItems = brains.length + notes.length;

  const getUserPermission = (item) => {
    const entry = (item.sharedWith || []).find((s) => {
      const sUserId = s.user?.id || s.user;
      const currentId = user?.id;
      const sEmail = (s.email || '').toLowerCase();
      const currentEmail = (user?.email || '').toLowerCase();
      return (sUserId && currentId && sUserId === currentId) || (sEmail && currentEmail && sEmail === currentEmail);
    });
    return entry?.permission || 'read';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Shared with Me</h1>
        <p className="text-[#a1a1aa] mt-1">Brains and notes others have shared with you</p>
      </div>

      {totalItems === 0 ? (
        <GlassCard className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#18181b] flex items-center justify-center mx-auto mb-4 text-2xl">
            🤝
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Nothing shared yet</h3>
          <p className="text-[#a1a1aa] text-sm max-w-sm mx-auto">
            When teammates share notes or brains with you, they will immediately appear here with your assigned permissions.
          </p>
        </GlassCard>
      ) : (
        <>
          {brains.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Shared Brains ({brains.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brains.map((brain) => {
                  const perm = getUserPermission(brain);
                  return (
                    <GlassCard
                      key={brain.id}
                      className="p-4 cursor-pointer group"
                      onClick={() => navigate(`/brains?id=${brain.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                          style={{ backgroundColor: (brain.color || '#22d3ee') + '20' }}
                        >
                          {brain.icon || brain.emoji || '🧠'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium text-white truncate group-hover:text-purple-400 transition-colors">
                              {brain.name}
                            </h3>
                            <Badge variant={perm === 'collaborator' ? 'violet' : 'neutral'}>
                              {perm === 'collaborator' ? 'Can Edit' : 'Read Only'}
                            </Badge>
                          </div>
                          <p className="text-xs text-[#52525b] mt-1">
                            {brain.noteCount !== undefined ? `${brain.noteCount} notes` : 'Shared brain'}
                          </p>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Shared Notes ({notes.length})</h2>
              <div className="space-y-2">
                {notes.map((note) => {
                  const perm = getUserPermission(note);
                  return (
                    <GlassCard
                      key={note.id}
                      className="p-4 cursor-pointer group"
                      onClick={() => navigate(`/editor/${note.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={note.type === 'url' ? 'cyan' : note.type === 'markdown' ? 'violet' : 'neutral'}>
                            {note.type}
                          </Badge>
                          {note.tags?.slice(0, 2).map((t) => (
                            <Badge key={t} variant="slate">#{t}</Badge>
                          ))}
                        </div>

                        <Badge variant={perm === 'collaborator' ? 'violet' : 'neutral'}>
                          {perm === 'collaborator' ? 'Can Edit' : 'Read Only'}
                        </Badge>
                      </div>

                      <h3 className="font-medium text-white group-hover:text-cyan-300 transition-colors truncate">
                        {note.title}
                      </h3>
                      <p className="text-sm text-[#a1a1aa] mt-1 line-clamp-2">
                        {note.content?.substring(0, 160)}
                      </p>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
