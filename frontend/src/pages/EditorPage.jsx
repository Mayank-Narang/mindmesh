import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NoteEditor from '../components/Editor/NoteEditor';
import { getNoteById, getBrains, shareNote, unshareNote } from '../services';
import GlassCard from '../components/ui/GlassCard';

export default function EditorPage() {
  const { noteId } = useParams();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brains, setBrains] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [sharedWith, setSharedWith] = useState([]);
  const [savingShare, setSavingShare] = useState(false);

  useEffect(() => {
    getBrains().then(setBrains);
  }, []);

  useEffect(() => {
    if (noteId) {
      setLoading(true);
      getNoteById(noteId)
        .then((n) => {
          setNote(n);
          setSharedWith(n.sharedWith || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setNote(null);
    }
  }, [noteId]);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim() || !noteId) return;
    setSavingShare(true);
    try {
      const result = await shareNote(noteId, shareEmail.trim(), sharePermission);
      setSharedWith(result.sharedWith || []);
      setShareEmail('');
    } catch (err) {
      console.error('Failed to share:', err);
    } finally {
      setSavingShare(false);
    }
  };

  const handleUnshare = async (email) => {
    if (!noteId) return;
    try {
      const result = await unshareNote(noteId, email);
      setSharedWith(result.sharedWith || []);
    } catch (err) {
      console.error('Failed to unshare:', err);
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
          Loading note...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {note ? `Editing: ${note.title}` : 'New Note'}
        </h2>
        {noteId && (
          <button onClick={() => setShowShare(!showShare)} className="btn-ghost flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Share
          </button>
        )}
      </div>

      {showShare && (
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Share this note</h3>
          <form onSubmit={handleShare} className="flex gap-2">
            <input
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="input-base flex-1"
            />
            <select
              value={sharePermission}
              onChange={(e) => setSharePermission(e.target.value)}
              className="input-base"
            >
              <option value="read">Read</option>
              <option value="collaborator">Collaborator</option>
            </select>
            <button type="submit" disabled={savingShare || !shareEmail.trim()} className="btn-primary px-4">
              {savingShare ? '...' : 'Add'}
            </button>
          </form>
          {sharedWith.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[#52525b]">Shared with:</p>
              {sharedWith.map((s) => (
                <div key={s.email} className="flex items-center justify-between bg-[#18181b]/50 rounded-lg px-3 py-2">
                  <span className="text-sm text-[#d4d4d8]">{s.email}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#52525b] capitalize">{s.permission}</span>
                    <button onClick={() => handleUnshare(s.email)} className="text-[#52525b] hover:text-rose-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      <NoteEditor note={note} brains={brains} />
    </div>
  );
}
