const ACTIONS = [
  { label: 'B', title: 'Bold', before: '**', after: '**' },
  { label: 'I', title: 'Italic', before: '_', after: '_' },
  { label: 'S', title: 'Strikethrough', before: '~~', after: '~~' },
  { label: 'H1', title: 'Heading 1', before: '# ', after: '' },
  { label: 'H2', title: 'Heading 2', before: '## ', after: '' },
  { label: 'H3', title: 'Heading 3', before: '### ', after: '' },
  { label: '< >', title: 'Inline Code', before: '`', after: '`' },
  { label: '```', title: 'Code Block', before: '```\n', after: '\n```' },
  { label: '🔗', title: 'Link', before: '[', after: '](url)' },
  { label: '—', title: 'Divider', before: '\n---\n', after: '' },
  { label: '•', title: 'Bullet List', before: '- ', after: '' },
  { label: '☐', title: 'Task', before: '- [ ] ', after: '' },
  { label: '❝', title: 'Blockquote', before: '> ', after: '' },
];

export default function EditorToolbar({ textareaRef, onInsert }) {
  const handleAction = (action) => {
    const el = textareaRef?.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.substring(start, end);
    const replacement = action.before + (selected || 'text') + action.after;
    const newValue = el.value.substring(0, start) + replacement + el.value.substring(end);
    onInsert(newValue);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      const cursorPos = start + action.before.length + (selected || 'text').length;
      el.setSelectionRange(cursorPos, cursorPos);
      el.focus();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 glass-light rounded-xl">
      {ACTIONS.map((a, i) => (
        <button
          key={i}
          title={a.title}
          onClick={() => handleAction(a)}
          className="px-2.5 py-1.5 text-xs font-mono text-slate-400 rounded-lg
                     hover:bg-slate-700/60 hover:text-white transition-all duration-150
                     active:scale-95"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
