import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBrains, createBrain, deleteBrain, getBrainById } from '../services';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

const BRAIN_COLORS = ['#22d3ee', '#8b5cf6', '#34d399', '#f59e0b', '#f472b6', '#60a5fa'];
const BRAIN_ICONS = ['🧠', '💼', '🔬', '📚', '🎯', '💡', '🌍', '🎨'];

export default function BrainsPage() {
  const [brains, setBrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBrain, setSelectedBrain] = useState(null);
  const [brainNotes, setBrainNotes] = useState([]);
  const [newBrain, setNewBrain] = useState({ name: '', description: '', color: BRAIN_COLORS[0], icon: BRAIN_ICONS[0] });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBrains();
  }, []);

  const loadBrains = async () => {
    setLoading(true);
    try {
      const data = await getBrains();
      setBrains(data);
    } catch (err) {
      console.error('Failed to load brains:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newBrain.name.trim()) return;
    setCreating(true);
    try {
      await createBrain(newBrain);
      setNewBrain({ name: '', description: '', color: BRAIN_COLORS[0], icon: BRAIN_ICONS[0] });
      setShowCreate(false);
      loadBrains();
    } catch (err) {
      console.error('Failed to create brain:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this brain? Notes will be unlinked.')) return;
    try {
      await deleteBrain(id);
      if (selectedBrain?.id === id) setSelectedBrain(null);
      loadBrains();
    } catch (err) {
      console.error('Failed to delete brain:', err);
    }
  };

  const handleSelectBrain = async (brain) => {
    setSelectedBrain(brain);
    try {
      const data = await getBrainById(brain.id);
      setBrainNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to load brain notes:', err);
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

      {showCreate && <CreateBrainModal newBrain={newBrain} setNewBrain={setNewBrain} onCreate={handleCreate} creating={creating} onClose={() => setShowCreate(false)} />}
      {selectedBrain && <BrainDetail brain={selectedBrain} notes={brainNotes} onBack={() => setSelectedBrain(null)} onOpenNote={(id) => navigate(`/editor/${id}`)} />}
      {!selectedBrain && <BrainsGrid brains={brains} onSelect={handleSelectBrain} onDelete={handleDelete} />}
    </div>
  );
}

function CreateBrainModal({ newBrain, setNewBrain, onCreate, creating, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Create New Brain</h2>
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-1">Name</label>
            <input type="text" value={newBrain.name} onChange={(e) => setNewBrain({ ...newBrain, name: e.target.value })} placeholder="e.g., Research" className="input-base w-full" autoFocus />
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-1">Description</label>
            <textarea value={newBrain.description} onChange={(e) => setNewBrain({ ...newBrain, description: e.target.value })} placeholder="What's this brain about?" className="input-base w-full resize-none" rows={2} />
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-2">Color</label>
            <div className="flex gap-2">
              {BRAIN_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setNewBrain({ ...newBrain, color: c })} className={`w-8 h-8 rounded-full transition-all ${newBrain.color === c ? 'ring-2 ring-white scale-110' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-[#a1a1aa] block mb-2">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {BRAIN_ICONS.map((icon) => (
                <button key={icon} type="button" onClick={() => setNewBrain({ ...newBrain, icon })} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${newBrain.icon === icon ? 'bg-purple-500/20 ring-2 ring-purple-400' : 'bg-[#18181b] hover:bg-[#27272a]'}`}>{icon}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={creating || !newBrain.name.trim()} className="btn-primary flex-1">{creating ? 'Creating...' : 'Create Brain'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BrainDetail({ brain, notes, onBack, onOpenNote }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-[#a1a1aa] hover:text-purple-400 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        Back to all brains
      </button>
      <GlassCard className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: (brain.color || '#22d3ee') + '20' }}>{brain.icon || '🧠'}</div>
          <div>
            <h2 className="text-2xl font-bold text-white">{brain.name}</h2>
            <p className="text-[#a1a1aa] text-sm">{brain.description || 'No description'}</p>
          </div>
        </div>
      </GlassCard>
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Notes in this brain ({notes.length})</h3>
        {notes.length === 0 ? (
          <p className="text-[#52525b] text-sm">No notes in this brain yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notes.map((note) => (
              <GlassCard key={note.id} className="p-4" onClick={() => onOpenNote(note.id)}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={note.type === 'url' ? 'cyan' : note.type === 'markdown' ? 'violet' : 'neutral'}>{note.type}</Badge>
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

function BrainsGrid({ brains, onSelect, onDelete }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {brains.map((brain) => (
        <GlassCard key={brain.id} className="p-5 group" onClick={() => onSelect(brain)}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: (brain.color || '#22d3ee') + '20' }}>{brain.icon || '🧠'}</div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(brain.id); }} className="opacity-0 group-hover:opacity-100 text-[#52525b] hover:text-rose-400 transition-all p-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
          <h3 className="font-semibold text-white text-lg">{brain.name}</h3>
          <p className="text-sm text-[#a1a1aa] mt-1 line-clamp-2">{brain.description || 'No description'}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-[#52525b]">{brain.noteCount || 0} notes</span>
            <div className="h-1.5 flex-1 mx-3 bg-[#18181b] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((brain.noteCount || 0) / 30) * 100)}%`, backgroundColor: brain.color || '#22d3ee' }} />
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
