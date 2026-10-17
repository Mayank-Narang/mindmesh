/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';

export default function SearchBar({ initialQuery = '', onSearch, loading }) {
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef(null);
  const isFirstMount = useRef(true);

  // Sync internal state when initialQuery changes from outside (e.g. URL change)
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(query);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, onSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="relative group">
      {/* Glow background */}
      <div className="absolute -inset-0.5 bg-gradient-accent rounded-2xl opacity-0 group-focus-within:opacity-20 blur-lg transition-opacity duration-500" />

      <div className="relative flex items-center gap-3 glass rounded-2xl px-5 py-4 transition-all duration-300 group-focus-within:border-cyan-400/40 group-focus-within:shadow-glow-cyan">
        {/* Brain icon */}
        <div className="flex-shrink-0">
          {loading ? (
            <svg className="w-6 h-6 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-slate-400 group-focus-within:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          )}
        </div>

        <input
          id="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your mind... (try 'brightness', 'vector', 'auth')"
          className="flex-1 bg-transparent text-lg text-white placeholder-slate-500 outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onSearch('');
            }}
            className="flex-shrink-0 p-1 rounded-lg text-[#71717a] hover:text-white hover:bg-[#27272a]/60 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
