import { useState, useEffect } from 'react';
import { shareNote, unshareNote, getNoteById } from '../../services';

export default function ShareModal({ noteId, onClose }) {
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [sharedWith, setSharedWith] = useState([]);
  const [savingShare, setSavingShare] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNoteById(noteId).then(n => {
      setSharedWith(n.sharedWith || []);
      setLoading(false);
    }).catch(console.error);
  }, [noteId]);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;
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
    try {
      const result = await unshareNote(noteId, email);
      setSharedWith(result.sharedWith || []);
    } catch (err) {
      console.error('Failed to unshare:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Share Note</h2>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white text-2xl leading-none">&times;</button>
        </div>
        {loading ? <p className="text-[#a1a1aa] text-sm">Loading...</p> : (
          <div className="space-y-4">
            <form onSubmit={handleShare} className="flex gap-2">
              <input type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="colleague@example.com" className="input-base flex-1" />
              <select value={sharePermission} onChange={(e) => setSharePermission(e.target.value)} className="input-base">
                <option value="read">Read</option>
                <option value="collaborator">Collaborator</option>
              </select>
              <button type="submit" disabled={savingShare || !shareEmail.trim()} className="btn-primary px-4">
                {savingShare ? '...' : 'Add'}
              </button>
            </form>
            {sharedWith.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs text-[#52525b]">Shared with:</p>
                {sharedWith.map((s) => (
                  <div key={s.email} className="flex items-center justify-between bg-[#18181b]/50 rounded-lg px-3 py-2">
                    <span className="text-sm text-[#d4d4d8]">{s.email}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-[#a1a1aa] bg-[#27272a] px-2 py-0.5 rounded">{s.permission}</span>
                      <button onClick={() => handleUnshare(s.email)} className="text-rose-400 hover:text-rose-300 text-lg leading-none">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
