export default function LoadingShimmer({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="space-y-3 p-5 glass rounded-2xl">
          <div className="h-5 w-2/5 rounded-lg bg-gradient-to-r from-[#27272a] via-[#3f3f46] to-[#27272a] bg-[length:200%_100%] animate-shimmer" />
          <div className="h-3 w-full rounded-lg bg-gradient-to-r from-[#27272a] via-[#3f3f46] to-[#27272a] bg-[length:200%_100%] animate-shimmer" />
          <div className="h-3 w-3/4 rounded-lg bg-gradient-to-r from-[#27272a] via-[#3f3f46] to-[#27272a] bg-[length:200%_100%] animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
