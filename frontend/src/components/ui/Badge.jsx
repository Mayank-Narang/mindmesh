const VARIANTS = {
  cyan: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
  violet: 'bg-violet-400/15 text-violet-300 border-violet-400/30',
  emerald: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  amber: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  rose: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
  slate: 'bg-slate-700/40 text-slate-300 border-slate-600/30',
};

export default function Badge({ children, variant = 'cyan', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${VARIANTS[variant] || VARIANTS.cyan} ${className}`}>
      {children}
    </span>
  );
}
