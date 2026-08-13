import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, MapPin, SlidersHorizontal, Package, Coins, LayoutGrid } from 'lucide-react';
import { itemsApi } from '../../api';
import ItemCard from './ItemCard';
import { CATEGORIES, getCategoryMeta, matchCategory } from '../../utils/categories';

const SORTS = [
  { value: 'distance', label: 'Distance' },
  { value: 'newest', label: 'Newest' },
  { value: 'credits_asc', label: 'Credits: Low to High' },
  { value: 'credits_desc', label: 'Credits: High to Low' },
];

function ItemList({ items, loading, widenSuggestion, onWidenSearch }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading items">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card overflow-hidden animate-pulse">
            <div className="aspect-[4/3] bg-gray-200" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <div className="card flex flex-col items-center p-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
            <Search className="h-8 w-8 text-gray-300" />
          </span>
          <h3 className="mt-4 text-lg font-bold text-gray-900">No items found</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {widenSuggestion
              ? 'No items within 5km. Try widening your search radius.'
              : 'No items available in this area. Try another category or radius.'}
          </p>
          {widenSuggestion && (
            <button onClick={onWidenSearch} className="btn-primary mt-5">
              Search within 10km instead
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Available items">
      {items.map((item) => (
        <ItemCard
          key={item.properties?.id || item.id}
          item={item.properties || item}
          distance={item.properties?.distance_km || item.distance_km}
        />
      ))}
    </div>
  );
}

/**
 * Live results snapshot — replaces the old map. Shows aggregate stats
 * computed from the fetched items (closest item, average credits/day,
 * category breakdown) with clickable category chips that filter.
 */
function BrowseSnapshot({ items, radius, category, onSelectCategory }) {
  const list = items.map((f) => f.properties || f).filter((i) => i && i.id);
  if (list.length === 0) return null;

  const distances = list.map((i) => i.distance_km).filter((d) => typeof d === 'number');
  const closest = distances.length ? Math.min(...distances) : null;
  const avgCredits = list.reduce((s, i) => s + (Number(i.time_credits_per_day) || 0), 0) / list.length;

  const counts = list.reduce((acc, i) => {
    const c = i.category || 'other';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const stats = [
    { icon: Package, label: 'Items found', value: list.length },
    { icon: MapPin, label: 'Closest item', value: closest !== null ? `${closest.toFixed(1)} km` : '—' },
    { icon: Coins, label: 'Avg. credits/day', value: Math.round(avgCredits) },
    { icon: LayoutGrid, label: 'Categories', value: entries.length },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6" aria-label="Browse summary">
      <div className="bg-brand-gradient relative overflow-hidden rounded-2xl p-5 shadow-lg shadow-brand-600/20 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-accent-400/20 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">What's nearby</h2>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              Within {radius} km of you
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <s.icon className="h-4 w-4 text-white/70" />
                <p className="mt-1.5 text-2xl font-extrabold text-white">{s.value}</p>
                <p className="text-xs font-medium text-white/70">{s.label}</p>
              </div>
            ))}
          </div>

          {entries.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Top categories</span>
              {entries.slice(0, 6).map(([value, count]) => {
                const meta = getCategoryMeta(value);
                const active = category === value;
                return (
                  <button
                    key={value}
                    onClick={() => onSelectCategory(value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active ? 'bg-white text-brand-700' : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    <meta.icon className="h-3.5 w-3.5" />
                    {meta.label} · {count}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ItemSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(5);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('distance');
  const [widenSuggestion, setWidenSuggestion] = useState(false);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await itemsApi.search({
        lat: -17.7833,
        lng: 31.05,
        radius_km: radius,
        category: category || undefined,
        q: query || undefined,
        sort,
      });
      setItems(response.data.features || []);
      setWidenSuggestion(response.data.widen_suggestion || false);
    } catch (err) {
      setError('Failed to load items. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [radius, category, sort, query]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Sync category + query from URL (e.g. deep links from the home page hero search)
  useEffect(() => {
    const urlCategory = searchParams.get('category') || '';
    const urlQuery = searchParams.get('q') || '';
    if (urlCategory !== category) setCategory(urlCategory);
    if (urlQuery !== query) setQuery(urlQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const effectiveCategory = category || (query ? matchCategory(query) : '');

  const handleWidenSearch = () => setRadius(10);

  const selectCategory = (value) => {
    setCategory(value === category ? '' : value);
    setQuery('');
    navigate(value ? `/browse?category=${value}` : '/browse', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Filter bar */}
      <div className="z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => selectCategory('')}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                !category ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => selectCategory(cat.value)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  category === cat.value
                    ? 'bg-brand-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5">
              <SlidersHorizontal className="h-4 w-4 text-gray-400" />
              <select
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
                aria-label="Search radius"
              >
                <option value={1}>1 km</option>
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
                aria-label="Sort by"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="h-4 w-4 text-brand-600" />
              <span className="font-medium">{items.length} item{items.length === 1 ? '' : 's'} nearby</span>
            </div>
          </div>

          {query && (
            <div className="mt-2 flex items-center gap-2">
              <span className="badge bg-brand-50 text-brand-800">
                {effectiveCategory
                  ? `Results for “${query}” in ${getCategoryMeta(effectiveCategory).label}`
                  : `Results for “${query}”`}
              </span>
              <button
                onClick={() => { setQuery(''); navigate('/browse', { replace: true }); }}
                className="text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 px-4 py-2.5 text-sm text-red-700 border-b border-red-100">
          <span>{error}</span>
          <button onClick={fetchItems} className="font-semibold text-red-800 hover:underline">Retry</button>
        </div>
      )}

      {/* Live snapshot — replaces the map */}
      <BrowseSnapshot
        items={items}
        radius={radius}
        category={category}
        onSelectCategory={selectCategory}
      />

      {/* Item grid */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <ItemList
          items={items}
          loading={loading}
          widenSuggestion={widenSuggestion}
          onWidenSearch={handleWidenSearch}
        />
      </div>
    </div>
  );
}
