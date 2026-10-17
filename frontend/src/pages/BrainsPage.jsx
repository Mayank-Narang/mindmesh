/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getBrains,
  createBrain,
  updateBrain,
  deleteBrain,
  getBrainById,
} from '../services';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import ShareModal from '../components/ui/ShareModal';

const BRAIN_COLORS = ['#22d3ee', '#8b5cf6', '#34d399', '#f59e0b', '#f472b6', '#60a5fa'];
const BRAIN_ICONS = ['🧠', '💼', '🔬', '📚', '🎯', '💡', '🌍', '🎨'];

function getBrainSummary(brain) {
  if (!brain) return '';
  if (brain.memoryState?.summary) return brain.memoryState.summary;
  if (typeof brain.description === 'string' && brain.description.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(brain.description);
      if (parsed.summary) return parsed.summary;
    } catch {
      // not JSON, fallback to plain text
    }
  }
  return brain.description || 'No description';
}

export default function BrainsPage() {
  const [brains, setBrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingBrain, setEditingBrain] = useState(null);
  const [selectedBrain, setSelectedBrain] = useState(null);
  const [brainNotes, setBrainNotes] = useState([]);
  const [newBrain, setNewBrain] = useState({
    name: '',
    description: '',
    color: BRAIN_COLORS[0],
    icon: BRAIN_ICONS[0],
  });
  const [creating, setCreating] = useState(false);
  const [shareNoteId, setShareNoteId] = useState(null);
  const [shareBrainId, setShareBrainId] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSelectBrain = useCallback(async (brain) => {
    setSelectedBrain(brain);
    try {
      const data = await getBrainById(brain.id);
      setBrainNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to load brain notes:', err);
    }
  }, []);

  const loadBrains = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBrains();
      setBrains(data);

      const targetId = searchParams.get('id');
      if (targetId) {
        const found = data.find((b) => b.id === targetId);
        if (found) {
          handleSelectBrain(found);
        }
      } else {
        setSelectedBrain(null);
      }
    } catch (err) {
      console.error('Failed to load brains:', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, handleSelectBrain]);

  useEffect(() => {
    loadBrains();
  }, [loadBrains]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newBrain.name.trim()) return;
    setCreating(true);
    try {
      await createBrain(newBrain);
      setNewBrain({ name: '', description: '', color: BRAIN_COLORS[0], icon: BRAIN_ICONS[0] });
      setShowCreate(false);
      loadBrains();
      window.dispatchEvent(new Event('brainsUpdated'));
    } catch (err) {
      console.error('Failed to create brain:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingBrain || !editingBrain.name.trim()) return;
    setCreating(true);
    try {
      await updateBrain(editingBrain.id, {
        name: editingBrain.name.trim(),
        description: editingBrain.description,
        color: editingBrain.color,
        icon: editingBrain.icon,
      });
      setEditingBrain(null);
      loadBrains();
      window.dispatchEvent(new Event('brainsUpdated'));
    } catch (err) {
      console.error('Failed to update brain:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this brain? All notes within it will become unassigned.')) return;
    try {
      await deleteBrain(id);
      if (selectedBrain?.id === id) setSelectedBrain(null);
      loadBrains();
      window.dispatchEvent(new Event('brainsUpdated'));
    } catch (err) {
      console.error('Failed to delete brain:', err);
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
          Loading brains...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Brains</h1>
          <p className="text-[#a1a1aa] mt-1">Organize your knowledge into thematic workspaces</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Brain
        </button>
      </div>

      {showCreate && (
        <CreateBrainModal
          newBrain={newBrain}
          setNewBrain={setNewBrain}
          onCreate={handleCreate}
          creating={creating}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingBrain && (
        <EditBrainModal
          brain={editingBrain}
          setBrain={setEditingBrain}
          onUpdate={handleUpdate}
          saving={creating}
          onClose={() => setEditingBrain(null)}
        />
      )}

      {selectedBrain && (
        <BrainDetail
          brain={selectedBrain}
          notes={brainNotes}
          onBack={() => {
            setSelectedBrain(null);
            navigate('/brains');
          }}
          onOpenNote={(id) => navigate(`/editor/${id}`)}
          onShareNote={setShareNoteId}
          onShareBrain={(id) => setShareBrainId(id)}
          onEditBrain={(b) => setEditingBrain(b)}
        />
      )}

      {!selectedBrain && (
        <BrainsGrid
          brains={brains}
          onSelect={handleSelectBrain}
          onDelete={handleDelete}
          onShare={(id) => setShareBrainId(id)}
          onEdit={(b) => setEditingBrain(b)}
        />
      )}

      {shareNoteId && <ShareModal noteId={shareNoteId} onClose={() => setShareNoteId(null)} />}
      {shareBrainId && <ShareModal brainId={shareBrainId} onClose={() => setShareBrainId(null)} />}
    </div>
  );
}

function CreateBrainModal({ newBrain, setNewBrain, onCreate, creating, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md border border-[#27272a]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Create New Brain</h2>
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-1">Name</label>
            <input
              type="text"
              value={newBrain.name}
              onChange={(e) => setNewBrain({ ...newBrain, name: e.target.value })}
              placeholder="e.g., Research"
              className="input-base w-full"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-1">Description</label>
            <textarea
              value={newBrain.description}
              onChange={(e) => setNewBrain({ ...newBrain, description: e.target.value })}
              placeholder="What is this brain about?"
              className="input-base w-full resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-2">Color</label>
            <div className="flex gap-2">
              {BRAIN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewBrain({ ...newBrain, color: c })}
                  className={`w-8 h-8 rounded-full transition-all ${newBrain.color === c ? 'ring-2 ring-white scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-2">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {BRAIN_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setNewBrain({ ...newBrain, icon })}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                    newBrain.icon === icon ? 'bg-purple-500/20 ring-2 ring-purple-400' : 'bg-[#18181b] hover:bg-[#27272a]'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={creating || !newBrain.name.trim()} className="btn-primary flex-1">
              {creating ? 'Creating...' : 'Create Brain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditBrainModal({ brain, setBrain, onUpdate, saving, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md border border-[#27272a]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Edit Brain</h2>
        <form onSubmit={onUpdate} className="space-y-4">
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-1">Name</label>
            <input
              type="text"
              value={brain.name}
              onChange={(e) => setBrain({ ...brain, name: e.target.value })}
              className="input-base w-full"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-1">Description</label>
            <textarea
              value={brain.description}
              onChange={(e) => setBrain({ ...brain, description: e.target.value })}
              className="input-base w-full resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-2">Color</label>
            <div className="flex gap-2">
              {BRAIN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBrain({ ...brain, color: c })}
                  className={`w-8 h-8 rounded-full transition-all ${brain.color === c ? 'ring-2 ring-white scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-2">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {BRAIN_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setBrain({ ...brain, icon })}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                    brain.icon === icon ? 'bg-purple-500/20 ring-2 ring-purple-400' : 'bg-[#18181b] hover:bg-[#27272a]'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving || !brain.name.trim()} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BrainDetail({ brain, notes, onBack, onOpenNote, onShareNote, onShareBrain, onEditBrain }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-[#a1a1aa] hover:text-purple-400 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to all brains
      </button>

      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: (brain.color || '#22d3ee') + '20' }}
          >
            {brain.icon || brain.emoji || '🧠'}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{brain.name}</h2>
            <p className="text-[#a1a1aa] text-sm">{getBrainSummary(brain)}</p>
          </div>
          <div className="flex items-center gap-2">
            {brain.id !== 'unassigned' && (
              <>
                <button
                  onClick={() => onEditBrain(brain)}
                  className="btn-ghost text-xs px-3 py-1.5 glass-light"
                >
                  Edit Brain
                </button>
                <button
                  onClick={() => onShareBrain(brain.id)}
                  className="btn-ghost text-xs px-3 py-1.5 glass-light flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                  Share
                </button>
              </>
            )}
            <button
              onClick={() => navigate(`/editor?brain=${brain.id}`)}
              className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Note
            </button>
          </div>
        </div>
      </GlassCard>

      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Notes in this brain ({notes.length})</h3>
        {notes.length === 0 ? (
          <GlassCard className="p-8 text-center text-sm text-[#71717a]">
            No notes in this brain yet. Click "Add Note" to create one.
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notes.map((note) => (
              <GlassCard key={note.id} className="p-4 group cursor-pointer" onClick={() => onOpenNote(note.id)}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={note.type === 'url' ? 'cyan' : note.type === 'markdown' ? 'violet' : 'neutral'}>
                    {note.type}
                  </Badge>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareNote(note.id);
                    }}
                    title="Share note"
                    className="opacity-0 group-hover:opacity-100 ml-auto text-[#a1a1aa] hover:text-purple-400 p-1 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                  </button>
                </div>
                <h4 className="font-medium text-white truncate">{note.title}</h4>
                <p className="text-sm text-[#a1a1aa] mt-1 line-clamp-2">{note.content?.substring(0, 100)}...</p>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BrainsGrid({ brains, onSelect, onDelete, onShare, onEdit }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {brains.map((brain) => (
        <GlassCard key={brain.id} className="p-5 group cursor-pointer" onClick={() => onSelect(brain)}>
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: (brain.color || '#22d3ee') + '20' }}
            >
              {brain.icon || brain.emoji || '🧠'}
            </div>
            {brain.id !== 'unassigned' && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(brain);
                  }}
                  title="Edit brain"
                  className="text-[#a1a1aa] hover:text-white p-1 rounded"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(brain.id);
                  }}
                  title="Share brain"
                  className="text-[#a1a1aa] hover:text-purple-400 p-1 rounded"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(brain.id);
                  }}
                  title="Delete brain"
                  className="text-[#52525b] hover:text-rose-400 p-1 rounded"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <h3 className="font-semibold text-white text-lg">{brain.name}</h3>
          <p className="text-sm text-[#a1a1aa] mt-1 line-clamp-2">{getBrainSummary(brain)}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-[#52525b]">{brain.noteCount || 0} notes</span>
            <div className="h-1.5 flex-1 mx-3 bg-[#18181b] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, ((brain.noteCount || 0) / 30) * 100)}%`,
                  backgroundColor: brain.color || '#22d3ee',
                }}
              />
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
