const VARIANTS = {
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  neutral: 'bg-[#27272a]/60 text-[#a1a1aa] border-[#3f3f46]/50',
  cyan: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

export default function Badge({ children, variant = 'purple', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${VARIANTS[variant] || VARIANTS.purple} ${className}`}>
      {children}
    </span>
  );
}
