export default function GlassCard({ children, className = '', hover = true, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`glass rounded-2xl ${hover ? 'glass-hover cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
