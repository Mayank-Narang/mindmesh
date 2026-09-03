import { useState, useRef, useEffect, useCallback } from 'react';
import NoteTypeSelector from './NoteTypeSelector';
import EditorToolbar from './EditorToolbar';
import MarkdownPreview from './MarkdownPreview';
import { saveDraft, getUrlMetadata } from '../../services/apiMock';

export default function NoteEditor({ note = null, onSave }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [noteType, setNoteType] = useState(note?.type || 'markdown');
  const [urlInput, setUrlInput] = useState(note?.url || '');
  const [urlMeta, setUrlMeta] = useState(note?.metadata || null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef(null);
  const saveTimerRef = useRef(null);

  // Auto-save with debounce
  const autoSave = useCallback(async () => {
    if (!title && !content) return;
    setSaving(true);
    const result = await saveDraft({ title, content, type: noteType, url: urlInput });
    setLastSaved(result.savedAt);
    setSaving(false);
    if (onSave) onSave(result);
  }, [title, content, noteType, urlInput, onSave]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(autoSave, 2000);
    return () => clearTimeout(saveTimerRef.current);
  }, [title, content, autoSave]);

  // Populate from existing note
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setNoteType(note.type || 'markdown');
      setUrlInput(note.url || '');
      setUrlMeta(note.metadata || null);
    }
  }, [note]);

  // URL metadata fetch
  const handleFetchUrl = async () => {
    if (!urlInput) return;
    try {
      const meta = await getUrlMetadata(urlInput);
      setUrlMeta(meta);
      if (!title) setTitle(meta.title);
      if (!content) setContent(meta.description);
    } catch (e) {
      console.error('URL fetch failed:', e);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <NoteTypeSelector selected={noteType} onChange={setNoteType} />
        <div className="flex items-center gap-3">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Saving...
            </span>
          )}
          {!saving && lastSaved && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Saved
            </span>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`btn-ghost text-sm hidden md:flex items-center gap-1.5 ${showPreview ? 'text-cyan-400' : ''}`}
          >
            {showPreview ? '◧' : '□'} {showPreview ? 'Split' : 'Editor Only'}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        id="note-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled Note"
        className="text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none text-white placeholder-slate-600 w-full"
      />

      {/* URL input (only when type = url) */}
      {noteType === 'url' && (
        <div className="flex gap-2 animate-fade-in">
          <input
            id="url-input"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/article"
            className="input-base flex-1"
          />
          <button onClick={handleFetchUrl} className="btn-primary whitespace-nowrap">
            Fetch Metadata
          </button>
        </div>
      )}

      {/* URL metadata preview */}
      {noteType === 'url' && urlMeta && (
        <div className="glass-light rounded-xl p-4 flex items-start gap-3 animate-fade-in-up">
          {urlMeta.favicon && (
            <img src={urlMeta.favicon} alt="" className="w-8 h-8 rounded-lg mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{urlMeta.title}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{urlMeta.siteName}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{urlMeta.description}</p>
          </div>
        </div>
      )}

      {/* Toolbar (markdown/text modes) */}
      {noteType !== 'url' && (
        <EditorToolbar textareaRef={textareaRef} onInsert={setContent} />
      )}

      {/* Editor body */}
      <div className={`flex-1 flex ${showPreview ? 'flex-col lg:flex-row' : 'flex-col'} gap-4 min-h-0`}>
        {/* Textarea */}
        <div className={`flex-1 flex flex-col min-h-0 ${showPreview ? 'lg:w-1/2' : 'w-full'}`}>
          <textarea
            ref={textareaRef}
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={noteType === 'url' ? 'Add your notes about this link...' : 'Start writing...'}
            className="flex-1 w-full p-4 bg-slate-900/40 border border-slate-700/30 rounded-xl
                       text-slate-200 placeholder-slate-600 outline-none resize-none font-mono text-sm
                       leading-relaxed transition-all duration-300
                       focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20
                       min-h-[300px] lg:min-h-0"
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
              <div className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                {content || <span className="text-slate-600 italic">Nothing to preview</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
