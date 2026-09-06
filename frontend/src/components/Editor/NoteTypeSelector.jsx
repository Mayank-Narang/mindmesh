const TYPES = [
  { key: 'markdown', label: 'Markdown', icon: 'M↓' },
  { key: 'text', label: 'Plain Text', icon: 'Aa' },
  { key: 'url', label: 'URL', icon: '🔗' },
];

export default function NoteTypeSelector({ selected, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 glass rounded-xl">
      {TYPES.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            selected === t.key
              ? 'bg-gradient-accent text-white shadow-glow-cyan'
              : 'text-slate-400 hover:text-white hover:bg-[#27272a]/60'
          }`}
        >
          <span className="text-xs">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
