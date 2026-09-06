import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden text-center">
      {/* Ambient background glows */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main glass card */}
      <div className="w-full max-w-lg glass rounded-3xl p-8 sm:p-12 border border-[#3f3f46]/50 shadow-glass-lg flex flex-col items-center">
        {/* Brand Badge */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center text-white font-bold text-2xl shadow-glow-purple mb-6">
          M
        </div>

        {/* 404 Headline */}
        <div className="text-7xl sm:text-8xl font-black tracking-tight text-gradient mb-2">
          404
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
          Lost in the MindMesh?
        </h1>

        <p className="text-[#a1a1aa] text-sm sm:text-base leading-relaxed max-w-md mb-8">
          The neural node or page you requested could not be located in your knowledge graph. It may have been disconnected, renamed, or never existed.
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
          <Link
            to="/"
            className="btn-primary w-full sm:w-auto px-6 py-3 text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span>Return to Dashboard</span>
          </Link>

          <Link
            to="/search"
            className="btn-ghost w-full sm:w-auto px-6 py-3 text-sm flex items-center justify-center gap-2 glass-light"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span>Search Knowledge</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
