import { useState, useRef, useEffect } from 'react';
import NoteTypeSelector from './NoteTypeSelector';
import EditorToolbar from './EditorToolbar';
import MarkdownPreview from './MarkdownPreview';
import Badge from '../ui/Badge';
import {
  saveDraft,
  getUrlMetadata,
  acquireNoteLock,
  renewNoteLock,
  releaseNoteLock,
  getNoteById,
} from '../../services';

export default function NoteEditor({ note = null, onSave, brains = [], currentUser = null }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [history, setHistory] = useState({ past: [], present: note?.content || '', future: [] });
  const [noteType, setNoteType] = useState(note?.type || 'markdown');
  const [urlInput, setUrlInput] = useState(note?.url || '');
  const [urlMeta, setUrlMeta] = useState(note?.urlMeta || note?.metadata || null);
  const [urlFetchLoading, setUrlFetchLoading] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(note?.updatedAt || null);
  const [showPreview, setShowPreview] = useState(true);
  const [selectedBrain, setSelectedBrain] = useState(
    note?.brainId || (brains.length > 0 ? brains[0].id : '')
  );

  // Collaboration & locking state
  const [lockStatus, setLockStatus] = useState(null);
  const [lockExpiresIn, setLockExpiresIn] = useState(null);
  const [lockingActive, setLockingActive] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictServerNote, setConflictServerNote] = useState(null);
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const textareaRef = useRef(null);

  // Compute access role
  const isOwner = !note?.id || note?.author?.id === currentUser?.id || note?.author === currentUser?.id;
  const sharedEntry = (note?.sharedWith || []).find((s) => {
    const sUserId = s.user?.id || s.user;
    const currentId = currentUser?.id;
    const sEmail = (s.email || '').toLowerCase();
    const currentEmail = (currentUser?.email || '').toLowerCase();
    return (sUserId && currentId && sUserId === currentId) || (sEmail && currentEmail && sEmail === currentEmail);
  });
  const userRole = isOwner ? 'owner' : (sharedEntry?.permission || 'read');
  const isReadOnly = userRole === 'read';

  // Acquire note lock on mount when editing an existing note
  useEffect(() => {
    if (!note?.id || isReadOnly) return;

    let timer = null;
    let isCancelled = false;

    const lock = async () => {
      try {
        setLockingActive(true);
        const res = await acquireNoteLock(note.id);
        if (!isCancelled) {
          setLockStatus(res);
          if (res?.expiresAt) {
            const diff = Math.max(0, Math.floor((new Date(res.expiresAt).getTime() - Date.now()) / 1000));
            setLockExpiresIn(diff);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('Note lock acquisition note:', err.message);
        }
      } finally {
        if (!isCancelled) setLockingActive(false);
      }
    };

    lock();

    // Lock countdown timer
    timer = setInterval(() => {
      setLockExpiresIn((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      isCancelled = true;
      clearInterval(timer);
      if (note?.id) {
        releaseNoteLock(note.id).catch(() => {});
      }
    };
  }, [note?.id, isReadOnly]);

  // Lock renewal
  const handleRenewLock = async () => {
    if (!note?.id) return;
    try {
      setLockingActive(true);
      const res = await renewNoteLock(note.id);
      setLockStatus(res);
      if (res?.expiresAt) {
        const diff = Math.max(0, Math.floor((new Date(res.expiresAt).getTime() - Date.now()) / 1000));
        setLockExpiresIn(diff);
      }
    } catch (err) {
      console.warn('Failed to renew lock:', err.message);
    } finally {
      setLockingActive(false);
    }
  };

  const handleReleaseLock = async () => {
    if (!note?.id) return;
    try {
      await releaseNoteLock(note.id);
      setLockStatus(null);
      setLockExpiresIn(null);
    } catch (err) {
      console.warn('Failed to release lock:', err.message);
    }
  };

  // URL metadata fetch with clear retry and error state
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlFetchLoading(true);
    setUrlFetchError(null);
    try {
      const meta = await getUrlMetadata(urlInput.trim());
      setUrlMeta(meta);
      if (!title && meta.title) setTitle(meta.title);
      if (!content && meta.description) setContent(meta.description);
    } catch (e) {
      setUrlFetchError(e.message || 'Failed to fetch URL metadata. Please verify the URL.');
    } finally {
      setUrlFetchLoading(false);
    }
  };

  // Manual save
  const handleSave = async () => {
    if (isReadOnly) return;
    if (!title && !content && !(noteType === 'url' && urlInput)) return;

    setSaving(true);
    setSaveError(null);

    try {
      let finalTitle = title;
      if (!finalTitle && noteType === 'url') {
        finalTitle = urlMeta?.title || urlInput;
      }

      // Existing notes send real note.id -> PUT request
      const payload = {
        id: note?.id,
        title: finalTitle,
        content,
        type: noteType,
        url: noteType === 'url' ? urlInput : null,
        urlMeta: noteType === 'url' ? urlMeta : null,
        brainId: selectedBrain,
      };

      const result = await saveDraft(payload);
      setLastSaved(result.savedAt);
      if (onSave) onSave(result);
    } catch (err) {
      if (err.status === 409 || err.isConflict) {
        setConflictServerNote(err.serverNote || null);
        setConflictModalOpen(true);
      } else {
        setSaveError(err.message || 'Failed to save note.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Conflict resolution actions
  const handleReloadLatest = async () => {
    if (!note?.id) return;
    try {
      const freshest = await getNoteById(note.id);
      setTitle(freshest.title || '');
      setContent(freshest.content || '');
      setHistory({ past: [], present: freshest.content || '', future: [] });
      setNoteType(freshest.type || 'markdown');
      setUrlInput(freshest.url || '');
      setUrlMeta(freshest.urlMeta || null);
      setLastSaved(freshest.updatedAt || null);
      setConflictModalOpen(false);
    } catch (err) {
      alert('Failed to reload latest note: ' + err.message);
    }
  };

  const handleRestoreServerDraft = () => {
    if (conflictServerNote) {
      setTitle(conflictServerNote.title || '');
      setContent(conflictServerNote.content || '');
      setConflictModalOpen(false);
    } else {
      handleReloadLatest();
    }
  };

  const handleCopyLocalWork = () => {
    const textToCopy = `Title: ${title}\n\nContent:\n${content}\n\nURL: ${urlInput}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 3000);
    }
  };

  const updateContent = (newContent) => {
    if (isReadOnly) return;
    setHistory((prev) => ({
      past: [...prev.past, prev.present],
      present: newContent,
      future: [],
    }));
    setContent(newContent);
  };

  const handleKeyDown = (e) => {
    if (isReadOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      updateContent(newContent);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (history.past.length > 0) {
        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);
        setHistory({ past: newPast, present: previous, future: [history.present, ...history.future] });
        setContent(previous);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      if (history.future.length > 0) {
        const next = history.future[0];
        const newFuture = history.future.slice(1);
        setHistory({ past: [...history.past, history.present], present: next, future: newFuture });
        setContent(next);
      }
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in relative">
      {/* Read-Only Notice Banner */}
      {isReadOnly && (
        <div className="glass-light border border-amber-500/30 bg-amber-500/10 rounded-xl px-4 py-3 flex items-center justify-between text-amber-300 text-sm">
          <div className="flex items-center gap-2">
            <span>🔒</span>
            <span>You have <strong>read-only access</strong> to this note. Editing and deletion are disabled.</span>
          </div>
          <Badge variant="neutral">Read Only</Badge>
        </div>
      )}

      {/* Lock Status Banner */}
      {note?.id && !isReadOnly && lockStatus && (
        <div className="glass-light border border-cyan-500/20 bg-cyan-950/20 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Active editor: <strong>You</strong></span>
            {lockExpiresIn !== null && (
              <span className="text-[#a1a1aa]">
                (Lock expires in {Math.floor(lockExpiresIn / 60)}m {lockExpiresIn % 60}s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRenewLock}
              disabled={lockingActive}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors"
            >
              {lockingActive ? 'Renewing...' : 'Renew Lock'}
            </button>
            <button
              onClick={handleReleaseLock}
              className="px-2.5 py-1 rounded-lg text-[#a1a1aa] hover:text-white transition-colors"
            >
              Release Lock
            </button>
          </div>
        </div>
      )}

      {/* Save Error Alert */}
      {saveError && (
        <div className="glass border border-rose-500/30 bg-rose-500/10 rounded-xl px-4 py-3 flex items-center justify-between text-rose-300 text-sm">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-rose-400 hover:text-rose-200 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <NoteTypeSelector selected={noteType} onChange={setNoteType} disabled={isReadOnly} />
        <div className="flex items-center gap-3">
          {lastSaved && !saving && (
            <span className="text-[10px] text-[#71717a] hidden sm:block">
              Saved {new Date(lastSaved).toLocaleTimeString()}
            </span>
          )}
          {!isReadOnly ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm px-4 py-1.5 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Note'
              )}
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-medium cursor-not-allowed border border-slate-700">
              Read Only
            </span>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`btn-ghost text-sm hidden md:flex items-center gap-1.5 ${showPreview ? 'text-purple-400' : ''}`}
          >
            {showPreview ? '◧' : '□'} {showPreview ? 'Split' : 'Editor Only'}
          </button>
        </div>
      </div>

      {/* Title & Brain selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="note-title"
          type="text"
          value={title}
          disabled={isReadOnly}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Note"
          className="text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none text-white placeholder-slate-600 w-full disabled:opacity-75"
        />
        {brains.length > 0 && (
          <select
            value={selectedBrain}
            disabled={isReadOnly}
            onChange={(e) => setSelectedBrain(e.target.value)}
            className="input-base sm:w-48 disabled:opacity-75"
          >
            {brains.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* URL input (only when type = url) */}
      {noteType === 'url' && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex gap-2">
            <input
              id="url-input"
              type="url"
              value={urlInput}
              disabled={isReadOnly}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/article"
              className="input-base flex-1 disabled:opacity-75"
            />
            {!isReadOnly && (
              <button
                onClick={handleFetchUrl}
                disabled={urlFetchLoading || !urlInput.trim()}
                className="btn-primary whitespace-nowrap text-sm"
              >
                {urlFetchLoading ? 'Fetching...' : 'Fetch Metadata'}
              </button>
            )}
          </div>

          {urlFetchError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
              <span>{urlFetchError}</span>
              <button onClick={handleFetchUrl} className="underline hover:text-white font-medium ml-2">
                Retry Fetch
              </button>
            </div>
          )}
        </div>
      )}

      {/* URL metadata preview */}
      {noteType === 'url' && urlMeta && (
        <div className="glass-light rounded-xl p-4 flex items-start gap-3 animate-fade-in-up">
          {urlMeta.favicon && (
            <img src={urlMeta.favicon} alt="" className="w-8 h-8 rounded-lg mt-0.5 object-contain" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{urlMeta.title || 'No Title Extracted'}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{urlMeta.siteName}</p>
            <p className="text-xs text-[#71717a] mt-1 line-clamp-2">{urlMeta.description}</p>
          </div>
        </div>
      )}

      {/* Toolbar (markdown/text modes) */}
      {noteType !== 'url' && !isReadOnly && (
        <EditorToolbar textareaRef={textareaRef} onInsert={updateContent} />
      )}

      {/* Editor body */}
      <div className={`flex-1 flex ${showPreview ? 'flex-col lg:flex-row' : 'flex-col'} gap-4 min-h-0`}>
        {/* Textarea */}
        <div className={`flex-1 flex flex-col min-h-0 ${showPreview ? 'lg:w-1/2' : 'w-full'}`}>
          <textarea
            ref={textareaRef}
            id="note-content"
            value={content}
            readOnly={isReadOnly}
            onChange={(e) => updateContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isReadOnly
                ? 'This note is read-only.'
                : noteType === 'url'
                ? 'Add your notes about this link...'
                : 'Start writing...'
            }
            className="flex-1 w-full p-4 bg-slate-900/40 border border-slate-700/30 rounded-xl
                       text-slate-200 placeholder-slate-600 outline-none resize-none font-mono text-sm
                       leading-relaxed transition-all duration-300
                       focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20
                       min-h-[300px] lg:min-h-0 disabled:opacity-75"
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="flex-1 lg:w-1/2 glass rounded-xl p-5 overflow-y-auto min-h-[300px] lg:min-h-0 animate-fade-in">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Preview</span>
            </div>
            {noteType === 'markdown' ? (
              <MarkdownPreview content={content} />
            ) : (
              <div className="text-[#d4d4d8] whitespace-pre-wrap text-sm leading-relaxed">
                {content || <span className="text-[#52525b] italic">Nothing to preview</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 409 Conflict Resolution Modal */}
      {conflictModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-lg border border-rose-500/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Save Conflict (409)</h3>
                <p className="text-xs text-[#a1a1aa]">
                  A newer version of this note was saved by another user or session.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              To prevent overwriting changes, choose how you would like to proceed:
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleReloadLatest}
                className="w-full btn-ghost border border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-300 justify-start px-4 py-2.5 text-sm"
              >
                🔄 <strong>Reload latest note</strong> — Discard local edits and view server version
              </button>

              <button
                onClick={handleRestoreServerDraft}
                className="w-full btn-ghost border border-purple-500/40 hover:bg-purple-500/10 text-purple-300 justify-start px-4 py-2.5 text-sm"
              >
                💾 <strong>Restore server draft</strong> — Recover server-saved version
              </button>

              <button
                onClick={handleCopyLocalWork}
                className="w-full btn-ghost border border-slate-600 hover:bg-slate-800 text-white justify-start px-4 py-2.5 text-sm"
              >
                📋 {copiedLocal ? 'Copied to clipboard! ✓' : 'Copy local work to clipboard — Keep your draft for manual merge'}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setConflictModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
