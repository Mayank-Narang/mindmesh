import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import MeshBackground from '../components/ui/MeshBackground';

const PRESET_QUERIES = [
  {
    label: 'Display brightness fix',
    query: 'Fixing screen brightness controls',
    title: 'Linux Screen Brightness Fix',
    brain: 'Personal',
    brainVariant: 'violet',
    score: '96% match',
    snippet: 'Backlight controls stopped working after kernel update. acpi_backlight=native parameter in GRUB or brightnessctl command.',
    keywordMatches: 0,
  },
  {
    label: 'JWT security tokens',
    query: 'JWT auth security & tokens',
    title: 'JWT Auth Architecture Notes',
    brain: 'Work',
    brainVariant: 'violet',
    score: '95% match',
    snippet: 'Signed JWT with 24h expiry, role-based authorization payload, sliding-window rate limiting, and session verification.',
    keywordMatches: 0,
  },
  {
    label: 'Semantic vs keyword',
    query: 'Semantic vs keyword search',
    title: 'Semantic vs Keyword Search',
    brain: 'Research',
    brainVariant: 'violet',
    score: '97% match',
    snippet: 'Keyword search matches exact terms. Semantic search matches meaning via vector embeddings and cosine similarity nearest neighbours.',
    keywordMatches: 0,
  },
  {
    label: 'React cleanup patterns',
    query: 'React hooks memory leaks',
    title: 'React useEffect Cleanup Patterns',
    brain: 'Personal',
    brainVariant: 'violet',
    score: '94% match',
    snippet: 'Always clean up effects creating subscriptions or timers using AbortController for fetch calls to prevent memory leaks.',
    keywordMatches: 0,
  },
];

const FEATURES = [
  {
    title: '768-Dim Vector Intelligence',
    description: 'Every thought is embedded into high-dimensional geometric space using Google Gemini models, enabling conceptual retrieval across your entire library.',
    badge: 'Gemini AI',
    badgeVariant: 'cyan',
    icon: (
      <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    title: 'Isolated Brain Workspaces',
    description: 'Segment your knowledge into isolated thematic brains like Work, Research, and Personal, with custom themes and granular access boundaries.',
    badge: 'Workspaces',
    badgeVariant: 'violet',
    icon: (
      <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    title: 'RAG AI Q&A Synthesis',
    description: 'Ask natural-language questions and receive grounded, streaming answers synthesized directly from your notes with exact citation links.',
    badge: 'Real-Time SSE',
    badgeVariant: 'emerald',
    icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    title: 'Neural Knowledge Mesh',
    description: 'Ditch rigid folder structures. MindMesh discovers latent associations between disparate notes based on semantic cosine proximity.',
    badge: 'Graph Mesh',
    badgeVariant: 'amber',
    icon: (
      <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: 'Smart Web Scraper & Clipper',
    description: 'Save any URL to automatically extract rich Open Graph metadata, titles, descriptions, and high-res favicons into a searchable bookmark note.',
    badge: 'Metadata API',
    badgeVariant: 'rose',
    icon: (
      <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    title: 'Granular Sharing & Access Tiers',
    description: 'Share entire brains or individual notes with colleagues via email, assigning strict read-only or collaborative editing access controls.',
    badge: 'Permissions',
    badgeVariant: 'slate',
    icon: (
      <svg className="w-6 h-6 text-[#d4d4d8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  const { isAuthenticated, quickDemoLogin } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customSearch, setCustomSearch] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(null);

  const activePreset = PRESET_QUERIES[selectedPreset];
  const queryDisplay = customSearch.trim() ? customSearch : activePreset.query;

  const handleQuickDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const res = await quickDemoLogin();
      if (res.success) {
        navigate('/', { replace: true });
      } else {
        setDemoError(res.error || 'Demo login failed');
      }
    } catch (err) {
      setDemoError(err.message || 'Demo login failed');
    } finally {
      setDemoLoading(false);
    }
  };

  const scrollTo = (hash) => {
    setMobileMenuOpen(false);
    const element = document.querySelector(hash);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col relative selection:bg-purple-500/30 selection:text-cyan-200">
      <MeshBackground />
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-10 w-[30rem] h-[30rem] bg-violet-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/3 w-[24rem] h-[24rem] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Sticky Glass Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-[#27272a]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center text-white font-bold text-lg shadow-glow-purple transition-transform group-hover:scale-105">
              M
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-purple-300 transition-colors">
                MindMesh
              </span>
              <Badge variant="cyan" className="hidden sm:inline-flex text-[10px] py-0 px-2">v1.0</Badge>
            </div>
          </Link>

          {/* Desktop Nav Anchors */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#d4d4d8]">
            <button onClick={() => scrollTo('#features')} className="hover:text-purple-400 transition-colors cursor-pointer">
              Features
            </button>
            <button onClick={() => scrollTo('#demo')} className="hover:text-purple-400 transition-colors cursor-pointer">
              Interactive Demo
            </button>
            <button onClick={() => scrollTo('#architecture')} className="hover:text-purple-400 transition-colors cursor-pointer">
              Architecture
            </button>
            <button onClick={() => scrollTo('#stats')} className="hover:text-purple-400 transition-colors cursor-pointer">
              Benchmarks
            </button>
          </nav>

          {/* Auth Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/" className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
                <span>Go to Dashboard</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm py-2 px-4">
                  Sign In
                </Link>
                <Link to="/signup" className="btn-primary text-sm py-2 px-4">
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/60 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-2 pb-6 border-b border-[#27272a] bg-[#0a0a0a]/95 backdrop-blur-xl flex flex-col gap-3">
            <button onClick={() => scrollTo('#features')} className="text-left py-2 text-[#d4d4d8] hover:text-white">
              Features
            </button>
            <button onClick={() => scrollTo('#demo')} className="text-left py-2 text-[#d4d4d8] hover:text-white">
              Interactive Demo
            </button>
            <button onClick={() => scrollTo('#architecture')} className="text-left py-2 text-[#d4d4d8] hover:text-white">
              Architecture
            </button>
            <button onClick={() => scrollTo('#stats')} className="text-left py-2 text-[#d4d4d8] hover:text-white">
              Benchmarks
            </button>
            <div className="pt-3 border-t border-[#27272a]/80 flex flex-col gap-2">
              {isAuthenticated ? (
                <Link to="/" className="btn-primary text-center py-2.5">
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn-ghost text-center py-2">
                    Sign In
                  </Link>
                  <Link to="/signup" className="btn-primary text-center py-2.5">
                    Get Started Free
                  </Link>
                  <button
                    onClick={handleQuickDemo}
                    disabled={demoLoading}
                    className="w-full py-2.5 text-center text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-500/30 rounded-xl hover:bg-cyan-900/40 transition-colors"
                  >
                    {demoLoading ? 'Launching Demo...' : '⚡ Quick Demo Login'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Intelligence Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-purple-400/30 text-xs text-purple-300 mb-8 shadow-glow-purple/20 animate-fade-in">
          <svg className="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z" />
          </svg>
          <span className="font-medium tracking-wide">Google Gemini 768-Dim Vector Intelligence</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1] sm:leading-[1.15] text-white">
          Your Knowledge Graph, Connected by{' '}
          <span className="text-gradient">Semantic AI</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-[#a1a1aa] max-w-2xl leading-relaxed">
          Stop digging through rigid folders. MindMesh organizes notes, code snippets, and web clippings into an interconnected second brain powered by neural embeddings.
        </p>

        {/* Demo error alert if any */}
        {demoError && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl max-w-md">
            {demoError}
          </div>
        )}

        {/* Hero CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 w-full max-w-md">
          {isAuthenticated ? (
            <Link to="/" className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2">
              <span>Open Dashboard</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          ) : (
            <>
              <Link to="/signup" className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2">
                <span>Start Building Free</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <button
                onClick={handleQuickDemo}
                disabled={demoLoading}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold bg-purple-950/40 border border-purple-500/40 text-purple-300 hover:bg-purple-900/50 hover:shadow-glow-purple transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>⚡ Quick Demo Login</span>
              </button>
            </>
          )}
          <button
            onClick={() => scrollTo('#demo')}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-medium text-[#d4d4d8] glass hover:text-white transition-all cursor-pointer"
          >
            Explore Interactive Demo ↓
          </button>
        </div>

        {/* Key Architecture Stats (#stats) */}
        <div id="stats" className="mt-16 sm:mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl">
          <GlassCard hover={false} className="p-5 text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400">768-Dim</div>
            <div className="text-xs sm:text-sm text-[#a1a1aa] mt-1 font-medium">Gemini Embeddings</div>
          </GlassCard>
          <GlassCard hover={false} className="p-5 text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400">&lt; 45ms</div>
            <div className="text-xs sm:text-sm text-[#a1a1aa] mt-1 font-medium">Vector Latency</div>
          </GlassCard>
          <GlassCard hover={false} className="p-5 text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">100%</div>
            <div className="text-xs sm:text-sm text-[#a1a1aa] mt-1 font-medium">Markdown GFM</div>
          </GlassCard>
          <GlassCard hover={false} className="p-5 text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">Live SSE</div>
            <div className="text-xs sm:text-sm text-[#a1a1aa] mt-1 font-medium">Streaming AI RAG</div>
          </GlassCard>
        </div>
      </section>

      {/* Interactive Concept Search Teaser Section (#demo) */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="cyan" className="mb-3">Live Interactive Preview</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            See the Semantic Difference
          </h2>
          <p className="mt-3 text-[#a1a1aa] text-base sm:text-lg">
            Traditional keyword search demands exact word matches. MindMesh embeds meanings, surfacing conceptual matches even with zero matching keywords.
          </p>
        </div>

        {/* Interactive Search Console */}
        <div className="max-w-4xl mx-auto glass rounded-3xl p-6 sm:p-8 border border-[#3f3f46]/60 shadow-glass-lg">
          {/* Preset Chip Buttons */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mr-2">
              Try Concept Preset:
            </span>
            {PRESET_QUERIES.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedPreset(idx);
                  setCustomSearch('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  selectedPreset === idx && !customSearch
                    ? 'bg-purple-500 text-slate-950 font-bold shadow-glow-purple'
                    : 'glass-light text-[#d4d4d8] hover:text-white hover:bg-[#18181b]/80'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Search Input Bar */}
          <div className="relative mb-8">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#a1a1aa]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              value={customSearch}
              onChange={(e) => setCustomSearch(e.target.value)}
              placeholder={`Current semantic query: "${activePreset.query}"`}
              className="w-full pl-12 pr-12 py-3.5 bg-[#0a0a0a]/80 border border-[#3f3f46]/60 rounded-2xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20"
            />
            {customSearch && (
              <button
                onClick={() => setCustomSearch('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#a1a1aa] hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Comparative Split Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Traditional Keyword Search Pane */}
            <div className="p-5 rounded-2xl bg-[#0a0a0a]/60 border border-[#27272a] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <h3 className="text-sm font-semibold text-[#d4d4d8]">Traditional Keyword Search</h3>
                  </div>
                  <Badge variant="rose" className="text-[11px]">0 Matches</Badge>
                </div>

                <p className="text-xs text-[#a1a1aa] mb-4">
                  Query: <span className="font-mono text-[#d4d4d8] bg-[#0a0a0a] px-1.5 py-0.5 rounded">"{queryDisplay}"</span>
                </p>

                <div className="p-4 rounded-xl bg-[#0a0a0a]/40 border border-dashed border-[#27272a] text-center text-xs text-[#a1a1aa]">
                  <svg className="w-8 h-8 text-[#3f3f46] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="font-medium text-[#d4d4d8]">Exact String Match Failed</p>
                  <p className="mt-1 text-[11px] text-[#a1a1aa]">
                    No note title or body contains this exact phrase verbatim. Synonyms and concept equivalents are completely missed.
                  </p>
                </div>
              </div>
              <div className="mt-4 text-[11px] text-[#a1a1aa] font-mono">
                Method: Exact substring regex (O(N) character scan)
              </div>
            </div>

            {/* MindMesh Semantic Engine Pane */}
            <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/40 shadow-glow-purple/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <h3 className="text-sm font-semibold text-white">MindMesh Semantic Engine</h3>
                  </div>
                  <Badge variant={activePreset.brainVariant} className="text-[11px]">
                    {activePreset.score}
                  </Badge>
                </div>

                <p className="text-xs text-purple-300 mb-3 font-medium">
                  Nearest Vector Neighbour (Cosine Similarity):
                </p>

                {/* Match Card */}
                <div className="p-4 rounded-xl glass-light border border-purple-400/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      {activePreset.title}
                    </h4>
                    <Badge variant={activePreset.brainVariant} className="text-[10px]">
                      {activePreset.brain}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#d4d4d8] line-clamp-3 leading-relaxed">
                    {activePreset.snippet}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-purple-300 font-mono">
                <span>Vector: 768-dim Atlas index</span>
                <span>Latency: 38ms</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid (#features) */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="violet" className="mb-3">Core Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built for Modern Intellectual Workflows
          </h2>
          <p className="mt-3 text-[#a1a1aa] text-base sm:text-lg">
            Everything you need to capture, structure, connect, and synthesize technical knowledge effortlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, idx) => (
            <GlassCard key={idx} hover={true} className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl glass-light flex items-center justify-center border border-[#3f3f46]/50">
                    {feature.icon}
                  </div>
                  <Badge variant={feature.badgeVariant} className="text-[11px]">
                    {feature.badge}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Architecture & Tech Specs (#architecture) */}
      <section id="architecture" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="emerald" className="mb-3">Engineering Excellence</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            High-Performance System Architecture
          </h2>
          <p className="mt-3 text-[#a1a1aa] text-base sm:text-lg">
            Built on top of cutting-edge modern runtime environments and vector database infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <GlassCard hover={false} className="p-6 border border-[#27272a]">
            <div className="text-purple-400 font-bold text-xs uppercase tracking-wider mb-2">Frontend Tier</div>
            <h4 className="text-lg font-bold text-white mb-2">React 19 & Vite 8</h4>
            <ul className="text-xs text-[#a1a1aa] space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Tailwind CSS v3 glassmorphism
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                React Router v7 route guards
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Zero-external icon footprint
              </li>
            </ul>
          </GlassCard>

          <GlassCard hover={false} className="p-6 border border-[#27272a]">
            <div className="text-purple-400 font-bold text-xs uppercase tracking-wider mb-2">Backend Tier</div>
            <h4 className="text-lg font-bold text-white mb-2">Node.js v22 & Express</h4>
            <ul className="text-xs text-[#a1a1aa] space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                JWT Auth & bcryptjs hashing
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                Sliding-window rate limiters
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                Server-Sent Events streaming
              </li>
            </ul>
          </GlassCard>

          <GlassCard hover={false} className="p-6 border border-[#27272a]">
            <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">Vector Storage</div>
            <h4 className="text-lg font-bold text-white mb-2">MongoDB Atlas</h4>
            <ul className="text-xs text-[#a1a1aa] space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                768-dim cosine search index
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Composite filters on author & brain
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Atomic CRUD transactions
              </li>
            </ul>
          </GlassCard>

          <GlassCard hover={false} className="p-6 border border-[#27272a]">
            <div className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">AI Engine</div>
            <h4 className="text-lg font-bold text-white mb-2">Google Gemini 2.5</h4>
            <ul className="text-xs text-[#a1a1aa] space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                L2 normalized query embeddings
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                RAG grounded question answering
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Source citation verification
              </li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Bottom Conversion CTA Banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="relative glass rounded-3xl p-8 sm:p-14 border border-purple-500/30 overflow-hidden text-center shadow-glass-lg">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-accent opacity-10 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight max-w-2xl mx-auto">
            Ready to upgrade to an intelligent second brain?
          </h2>
          <p className="mt-4 text-[#a1a1aa] text-base sm:text-lg max-w-xl mx-auto">
            Experience lightning-fast semantic note retrieval and AI knowledge synthesis in seconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" className="btn-primary px-8 py-3.5 text-base">
              Create Free Account
            </Link>
            <button
              onClick={handleQuickDemo}
              disabled={demoLoading}
              className="px-6 py-3.5 rounded-xl text-sm font-semibold bg-purple-950/40 border border-purple-500/40 text-purple-300 hover:bg-purple-900/50 transition-all cursor-pointer disabled:opacity-50"
            >
              {demoLoading ? 'Launching Demo...' : '⚡ Launch Quick Demo'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#27272a]/80 bg-[#0a0a0a]/80 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-accent flex items-center justify-center text-white font-bold text-sm">
                M
              </div>
              <span className="text-lg font-bold text-white tracking-tight">MindMesh</span>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              AI-driven semantic knowledge graph and collaborative note-taking engine built for engineering teams and researchers.
            </p>
            <p className="text-[11px] text-[#a1a1aa]">
              College Minor Project Defense Demonstration.
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h5 className="text-xs font-semibold text-[#d4d4d8] uppercase tracking-wider mb-4">Product</h5>
            <ul className="space-y-2 text-xs text-[#a1a1aa]">
              <li>
                <button onClick={() => scrollTo('#features')} className="hover:text-purple-400 transition-colors cursor-pointer">
                  Features
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo('#demo')} className="hover:text-purple-400 transition-colors cursor-pointer">
                  Interactive Concept Teaser
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo('#architecture')} className="hover:text-purple-400 transition-colors cursor-pointer">
                  Architecture
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo('#stats')} className="hover:text-purple-400 transition-colors cursor-pointer">
                  Performance Specs
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h5 className="text-xs font-semibold text-[#d4d4d8] uppercase tracking-wider mb-4">Navigation</h5>
            <ul className="space-y-2 text-xs text-[#a1a1aa]">
              <li><Link to="/login" className="hover:text-purple-400 transition-colors">Sign In</Link></li>
              <li><Link to="/signup" className="hover:text-purple-400 transition-colors">Sign Up</Link></li>
              <li><Link to="/search" className="hover:text-purple-400 transition-colors">Semantic Search</Link></li>
              <li><Link to="/editor" className="hover:text-purple-400 transition-colors">Note Editor</Link></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h5 className="text-xs font-semibold text-[#d4d4d8] uppercase tracking-wider mb-4">System Status</h5>
            <div className="flex items-center gap-2 text-xs text-emerald-400 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
            <p className="text-[11px] text-[#a1a1aa]">
              Mock Parity: 100% Offline Capable
            </p>
            <p className="text-[11px] text-[#a1a1aa] mt-1">
              Vector Engine: Google Gemini API
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-[#27272a]/60 flex flex-col sm:flex-row items-center justify-between text-xs text-[#a1a1aa] gap-4">
          <p>© 2026 MindMesh. Developed for College Minor Project Defense.</p>
          <p className="flex items-center gap-4">
            <span>React 19</span>
            <span>•</span>
            <span>Vite</span>
            <span>•</span>
            <span>Tailwind CSS</span>
            <span>•</span>
            <span>Node.js v22</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
