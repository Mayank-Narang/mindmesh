import { useState, useCallback } from 'react';
import SearchBar from '../components/Search/SearchBar';
import SearchResults from '../components/Search/SearchResults';
import { searchNotes } from '../services';

export default function SearchPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchNotes(query);
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          Semantic <span className="text-gradient">Search</span>
        </h1>
        <p className="text-[#a1a1aa] text-sm">
          Find notes by meaning — not just keywords
        </p>
      </div>

      <SearchBar onSearch={handleSearch} loading={loading} />
      <SearchResults results={results} loading={loading} hasSearched={hasSearched} />
    </div>
  );
}
