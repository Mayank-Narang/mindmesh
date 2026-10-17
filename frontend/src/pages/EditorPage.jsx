import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NoteEditor from '../components/Editor/NoteEditor';
import { getNoteById, getBrains } from '../services';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from '../components/ui/GlassCard';

export default function EditorPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(Boolean(noteId));
  const [error, setError] = useState(null);
  const [brains, setBrains] = useState([]);

  useEffect(() => {
    let active = true;
    getBrains()
      .then((b) => {
        if (active) setBrains(b);
      })
      .catch((err) => console.error('Failed to load brains:', err));
    return () => {
      active = false;
    };
  }, []);

  const loadNote = () => {
    if (!noteId) {
      setNote(null);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    getNoteById(noteId)
      .then((n) => {
        setNote(n);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

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

  if (error) {
    const is403 = error.status === 403 || error.isForbidden;
    const is404 = error.status === 404;
    const is503 = error.status === 503 || error.isServiceUnavailable;

    return (
      <div className="max-w-2xl mx-auto py-12">
        <GlassCard className="p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl font-bold">
            {is403 ? '🔒' : is503 ? '⚡' : '⚠️'}
          </div>
          <h2 className="text-xl font-bold text-white">
            {is403
              ? 'Access Denied (403)'
              : is404
              ? 'Note Not Found (404)'
              : is503
              ? 'Service Unavailable (503)'
              : 'Error Loading Note'}
          </h2>
          <p className="text-sm text-[#a1a1aa] max-w-md mx-auto">
            {is403
              ? 'You do not have permission to view or edit this note. Request access from the owner.'
              : is503
              ? 'The knowledge base service is temporarily offline or undergoing maintenance. Please retry in a moment.'
              : error.message || 'An unexpected error occurred while retrieving this note.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => navigate('/editor')} className="btn-ghost text-sm">
              Create New Note
            </button>
            <button onClick={loadNote} className="btn-primary text-sm">
              Retry
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {note ? `Editing: ${note.title}` : 'New Note'}
        </h2>
      </div>

      <NoteEditor
        key={note?.id || 'new'}
        note={note}
        brains={brains}
        currentUser={user}
        onSave={(saved) => {
          if (saved?.note) {
            setNote(saved.note);
            if (!noteId) {
              navigate(`/editor/${saved.note.id}`, { replace: true });
            }
          }
        }}
      />
    </div>
  );
}
