import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NoteEditor from '../components/Editor/NoteEditor';
import { getNoteById, getBrains } from '../services';

export default function EditorPage() {
  const { noteId } = useParams();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brains, setBrains] = useState([]);

  useEffect(() => {
    getBrains().then(setBrains);
  }, []);

  useEffect(() => {
    if (noteId) {
      setLoading(true);
      getNoteById(noteId)
        .then((n) => setNote(n))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setNote(null);
    }
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

  return (
    <div className="max-w-6xl mx-auto h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {note ? `Editing: ${note.title}` : 'New Note'}
        </h2>
      </div>

      <NoteEditor note={note} brains={brains} />
    </div>
  );
}
