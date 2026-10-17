/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect } from 'react';
import {
  shareNote,
  unshareNote,
  getNoteById,
  shareBrain,
  unshareBrain,
  getBrainById,
} from '../../services';

export default function ShareModal({
  noteId = null,
  brainId = null,
  title = '',
  onClose,
}) {
  const isBrain = Boolean(brainId);
  const targetId = isBrain ? brainId : noteId;
  const targetLabel = isBrain ? 'Brain' : 'Note';

  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [sharedWith, setSharedWith] = useState([]);
  const [savingShare, setSavingShare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    setError(null);

    const loadTarget = isBrain ? getBrainById(targetId) : getNoteById(targetId);
    loadTarget
      .then((res) => {
        const item = isBrain ? res.brain : res;
        setSharedWith(item?.sharedWith || []);
      })
      .catch((err) => {
        setError(err.message || `Failed to load ${targetLabel} sharing info`);
      })
      .finally(() => setLoading(false));
  }, [targetId, isBrain, targetLabel]);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;
    setSavingShare(true);
    setError(null);

    try {
      const email = shareEmail.trim().toLowerCase();
      let res;
      if (isBrain) {
        res = await shareBrain(targetId, email, sharePermission);
      } else {
        res = await shareNote(targetId, email, sharePermission);
      }
      setSharedWith(res.sharedWith || []);
      setShareEmail('');
    } catch (err) {
      setError(err.message || `Failed to share ${targetLabel}`);
    } finally {
      setSavingShare(false);
    }
  };

  const handleUnshare = async (email) => {
    setError(null);
    try {
      let res;
      if (isBrain) {
        res = await unshareBrain(targetId, email);
      } else {
        res = await unshareNote(targetId, email);
      }
      setSharedWith(res.sharedWith || []);
    } catch (err) {
      setError(err.message || `Failed to remove collaborator`);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-6 w-full max-w-md border border-[#27272a] shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Share {targetLabel}</h2>
            {title && <p className="text-xs text-[#a1a1aa] mt-0.5 truncate max-w-[280px]">{title}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-white text-2xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 flex items-center justify-center text-sm text-[#a1a1aa] gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading sharing details...
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={handleShare} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="input-base flex-1 text-sm"
                required
              />
              <div className="flex gap-2">
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="input-base text-sm py-1.5"
                >
                  <option value="read">Read Only</option>
                  <option value="collaborator">Collaborator</option>
                </select>
                <button
                  type="submit"
                  disabled={savingShare || !shareEmail.trim()}
                  className="btn-primary text-sm px-4 whitespace-nowrap"
                >
                  {savingShare ? 'Adding...' : 'Share'}
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs uppercase tracking-wider text-[#71717a] font-medium">
                People with access ({sharedWith.length})
              </h4>

              {sharedWith.length === 0 ? (
                <p className="text-xs text-[#52525b] italic py-2">
                  Not shared with anyone yet. Enter an email above to grant access.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {sharedWith.map((s) => (
                    <div
                      key={s.email}
                      className="flex items-center justify-between bg-[#18181b]/60 border border-[#27272a] rounded-xl px-3.5 py-2.5"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-[#d4d4d8] truncate">{s.email}</p>
                        <p className="text-[10px] text-[#71717a] capitalize">
                          {s.permission === 'collaborator' ? 'Can edit' : 'Can view'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                            s.permission === 'collaborator'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-slate-700/50 text-slate-300 border border-slate-600/30'
                          }`}
                        >
                          {s.permission}
                        </span>

                        <button
                          onClick={() => handleUnshare(s.email)}
                          title="Remove access"
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg p-1 text-base leading-none transition-colors"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
