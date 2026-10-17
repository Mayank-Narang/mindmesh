/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/Search/SearchBar';
import SearchResults from '../components/Search/SearchResults';
import { searchNotes, getBrains } from '../services';

const MODES = [
  { id: 'semantic', label: 'Semantic', icon: '🧠', desc: 'Finds notes by conceptual meaning' },
  { id: 'keyword', label: 'Keyword', icon: '🔤', desc: 'Exact keyword & phrase matching' },
  { id: 'recency', label: 'Recency', icon: '🕒', desc: 'Sorted chronologically by latest edit' },
  { id: 'hybrid', label: 'Hybrid', icon: '⚡', desc: 'Combines vector semantics & keyword rank' },
];

const DATE_OPTIONS = [
  { id: 'all', label: 'Any time' },
  { id: 'today', label: 'Past 24h' },
  { id: 'week', label: 'Past week' },
  { id: 'month', label: 'Past month' },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = searchParams.get('q') || '';
  const modeParam = searchParams.get('mode') || 'semantic';
  const brainParam = searchParams.get('brain') || 'all';
  const typeParam = searchParams.get('type') || 'all';
  const tagParam = searchParams.get('tag') || '';
  const dateParam = searchParams.get('date') || 'all';

  const [query, setQuery] = useState(queryParam);
  const [mode, setMode] = useState(modeParam);
  const [selectedBrain, setSelectedBrain] = useState(brainParam);
  const [selectedType, setSelectedType] = useState(typeParam);
  const [selectedTag, setSelectedTag] = useState(tagParam);
  const [selectedDate, setSelectedDate] = useState(dateParam);

  const [brains, setBrains] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(queryParam));
  const [error, setError] = useState(null);

  // Load brains for filter dropdown
  useEffect(() => {
    getBrains().then(setBrains).catch(() => {});
  }, []);

  // Sync state to URL search parameters
  const updateUrlParams = useCallback((newQuery, newMode, newBrain, newType, newTag, newDate) => {
    const params = new URLSearchParams();
    if (newQuery) params.set('q', newQuery);
    if (newMode && newMode !== 'semantic') params.set('mode', newMode);
    if (newBrain && newBrain !== 'all') params.set('brain', newBrain);
    if (newType && newType !== 'all') params.set('type', newType);
    if (newTag) params.set('tag', newTag);
    if (newDate && newDate !== 'all') params.set('date', newDate);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Execute search
  const executeSearch = useCallback(async (q, m, b, t, tg, d) => {
    if (!q || !q.trim()) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setError(null);

    let dateFrom = null;
    const now = Date.now();
    if (d === 'today') dateFrom = new Date(now - 24 * 3600 * 1000).toISOString();
    else if (d === 'week') dateFrom = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    else if (d === 'month') dateFrom = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

    try {
      const data = await searchNotes(q.trim(), {
        mode: m,
        brain: b,
        type: t,
        tags: tg ? [tg] : [],
        dateFrom,
        limit: 25,
      });
      setResults(data);
    } catch (err) {
      setError(
        err.isServiceUnavailable || err.status === 503
          ? 'Embedding and vector search service is currently unavailable (503). Try keyword mode or retry in a moment.'
          : err.message || 'Search failed. Please try again.'
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger search on parameter changes
  useEffect(() => {
    if (queryParam) {
      executeSearch(queryParam, modeParam, brainParam, typeParam, tagParam, dateParam);
    }
  }, [queryParam, modeParam, brainParam, typeParam, tagParam, dateParam, executeSearch]);

  const handleQuerySubmit = (newQ) => {
    setQuery(newQ);
    updateUrlParams(newQ, mode, selectedBrain, selectedType, selectedTag, selectedDate);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    updateUrlParams(query, newMode, selectedBrain, selectedType, selectedTag, selectedDate);
  };

  const handleBrainChange = (newBrain) => {
    setSelectedBrain(newBrain);
    updateUrlParams(query, mode, newBrain, selectedType, selectedTag, selectedDate);
  };

  const handleTypeChange = (newType) => {
    setSelectedType(newType);
    updateUrlParams(query, mode, selectedBrain, newType, selectedTag, selectedDate);
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    updateUrlParams(query, mode, selectedBrain, selectedType, selectedTag, newDate);
  };

  const handleClearFilters = () => {
    setMode('semantic');
    setSelectedBrain('all');
    setSelectedType('all');
    setSelectedTag('');
    setSelectedDate('all');
    updateUrlParams(query, 'semantic', 'all', 'all', '', 'all');
  };

  const hasActiveFilters = mode !== 'semantic' || selectedBrain !== 'all' || selectedType !== 'all' || selectedTag || selectedDate !== 'all';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          Knowledge <span className="text-gradient">Search</span>
        </h1>
        <p className="text-[#a1a1aa] text-sm">
          Search across notes, URLs, and markdown using 4 distinct retrieval engines
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 glass p-1.5 rounded-2xl">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => handleModeChange(m.id)}
            className={`flex flex-col items-center py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200 ${
              mode === m.id
                ? 'bg-gradient-accent text-white shadow-glow-cyan'
                : 'text-slate-400 hover:text-white hover:bg-[#27272a]/60'
            }`}
          >
            <span className="text-base mb-0.5">{m.icon}</span>
            <span className="font-semibold">{m.label}</span>
            <span className="text-[10px] opacity-75 hidden md:block mt-0.5">{m.desc.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Main Search Bar */}
      <SearchBar initialQuery={query} onSearch={handleQuerySubmit} loading={loading} />

      {/* Filter Suite */}
      <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
        {/* Brain Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#71717a]">Brain:</span>
          <select
            value={selectedBrain}
            onChange={(e) => handleBrainChange(e.target.value)}
            className="input-base text-xs py-1 px-2.5 bg-slate-900"
          >
            <option value="all">All Brains</option>
            {brains.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Note Type Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#71717a]">Type:</span>
          {['all', 'markdown', 'text', 'url'].map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                selectedType === t
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white bg-[#18181b]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#71717a]">Date:</span>
          <select
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="input-base text-xs py-1 px-2.5 bg-slate-900"
          >
            {DATE_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-cyan-400 hover:text-cyan-300 ml-auto underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Error / 503 Banner */}
      {error && (
        <div className="glass-light border border-rose-500/30 bg-rose-500/10 rounded-xl p-4 flex items-start justify-between gap-3 text-rose-300 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => executeSearch(query, mode, selectedBrain, selectedType, selectedTag, selectedDate)}
            className="btn-primary text-xs px-3 py-1 whitespace-nowrap"
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Search Results */}
      <SearchResults
        results={results}
        loading={loading}
        hasSearched={hasSearched}
        mode={mode}
        brains={brains}
      />
    </div>
  );
}
