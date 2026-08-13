import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search, ArrowRight, ShieldCheck, BadgeCheck, Wallet, MapPin, Clock, Leaf,
  PlusCircle, Sparkles, Star, Repeat, HeartHandshake,
} from 'lucide-react';
import { itemsApi } from '../../api';
import ItemCard from '../ItemSearch/ItemCard';
import { CATEGORIES, matchCategory } from '../../utils/categories';

const CENTER = { lat: -17.7833, lng: 31.05 };

const HOW_IT_WORKS = [
  {
    icon: PlusCircle,
    title: 'Create a listing',
    text: 'Snap a photo of your item, set your Time Credit price and choose when neighbours can borrow it.',
  },
  {
    icon: Search,
    title: 'Find what you need',
    text: 'Search nearby listings and request to borrow an item for the days you need it.',
  },
  {
    icon: HeartHandshake,
    title: 'Meet, swap & earn',
    text: 'Hand over the item with a verified QR handshake, and earn Community Time Credits when it returns.',
  },
];

const WHY = [
  { icon: ShieldCheck, title: 'Everything is guaranteed', text: 'Escrow-held deposits protect both the borrower and the lender on every single rental.' },
  { icon: BadgeCheck, title: 'Everyone is verified', text: 'National ID and address checks mean every member of the community is who they say they are.' },
  { icon: Wallet, title: 'Cheaper than buying', text: 'Renting through NeighbourShare is far cheaper than buying or renting from a traditional company.' },
  { icon: MapPin, title: 'Rent in your area', text: 'You can usually find what you need closer to home than the nearest store.' },
  { icon: Clock, title: 'Hours that suit you', text: 'Before and after work and weekends work best — just as it should be.' },
  { icon: Leaf, title: 'Good for the environment', text: 'The more things get used, the better. Share more, buy less.' },
];

const TESTIMONIALS = [
  {
    quote: 'Borrowing a pressure washer from my neighbour saved me the cost of buying one — and it was 5 minutes from my house.',
    author: 'Community member · Belvedere',
    initials: 'TA',
  },
  {
    quote: 'The QR handshake made lending my camera gear feel completely safe. Deposit held in escrow, returned in perfect condition.',
    author: 'Community member · Belvedere',
    initials: 'TM',
  },
  {
    quote: 'Time Credits are a genius idea. I lend my lawnmower and borrow a drill — everyone wins without money changing hands.',
    author: 'Community member · Belvedere',
    initials: 'RK',
  },
];

function HeroSearch({ onSearch }) {
  const [query, setQuery] = useState('');
  const submit = (e) => {
    e.preventDefault();
    onSearch(query);
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-8 w-full max-w-2xl">
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-card-hover ring-1 ring-gray-100 sm:flex-row sm:items-center sm:rounded-full">
        <div className="flex flex-1 items-center gap-3 px-3">
          <Search className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="What do you need to borrow?"
            className="w-full border-0 bg-transparent py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <button type="submit" className="btn-primary shrink-0 rounded-xl px-6 sm:rounded-full">
          Search
        </button>
      </div>
    </form>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const response = await itemsApi.search({
          lat: CENTER.lat,
          lng: CENTER.lng,
          radius_km: 10,
          sort: 'newest',
        });
        setItems((response.data.features || []).map((f) => f.properties || f).filter((i) => i.id));
      } catch (err) {
        console.error('Failed to load home feed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, []);

  const handleSearch = (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      navigate('/browse');
      return;
    }
    // Always pass the free-text query so results match real titles/descriptions;
    // also pre-select a matching category when the query maps to one.
    const params = new URLSearchParams({ q: trimmed });
    const cat = matchCategory(trimmed);
    if (cat) params.set('category', cat);
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <div className="bg-white">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-accent-50/40 to-white">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-24 h-80 w-80 rounded-full bg-accent-200/40 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-energy-100/50 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Belvedere's community sharing platform
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Borrow instead of{' '}
            <span className="bg-gradient-to-r from-brand-600 via-accent-600 to-brand-600 bg-clip-text text-transparent">
              buying
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            Nearby and at times that suit you.
          </p>

          <HeroSearch onSearch={handleSearch} />

          <p className="mt-6 text-sm font-medium text-gray-500">Or browse our most popular categories…</p>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {CATEGORIES.slice(0, 8).map((cat) => (
              <button
                key={cat.value}
                onClick={() => navigate(`/browse?category=${cat.value}`)}
                className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <cat.icon className="h-4 w-4 text-brand-600" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ================= RECENTLY ACTIVE ITEMS ================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Recently active items</h2>
            <p className="mt-1 text-gray-500">Things your neighbours are lending right now</p>
          </div>
          <Link to="/browse" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition">
            View all items <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
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
          ) : items.length === 0 ? (
            <div className="card p-10 text-center">
              <Search className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 font-medium text-gray-900">No items nearby yet</p>
              <p className="mt-1 text-sm text-gray-500">Be the first to list something for your neighbours to borrow.</p>
              <Link to="/create-listing" className="btn-primary mt-5">Create a listing</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.slice(0, 8).map((item) => (
                <ItemCard key={item.id} item={item} distance={item.distance_km} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="border-y border-gray-100 bg-[#FAFAF8] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">How NeighbourShare works</h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-500">Three simple steps to borrow anything from a neighbour</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="relative text-center">
                <div className="bg-brand-gradient mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg shadow-brand-600/30">
                  <step.icon className="h-7 w-7" />
                </div>
                <span className="absolute right-1/2 top-14 -z-10 translate-x-1/2 text-[80px] font-extrabold leading-none text-brand-100 select-none">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-bold text-gray-900">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-500">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= WHY NEIGHBOURSHARE ================= */}
      <section id="why" className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Why choose NeighbourShare?</h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-500">Trusted sharing for the Belvedere community</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-card-hover">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <w.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold text-gray-900">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section className="border-y border-gray-100 bg-[#FAFAF8] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Some love from our neighbours</h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-500">Stories from the Belvedere community</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.initials} className="card flex flex-col p-6">
                <div className="flex gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-gray-700">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {t.initials}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{t.author}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            * Illustrative community stories — real reviews will appear here once enabled.
          </p>
        </div>
      </section>

      {/* ================= CTA BAND ================= */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 via-brand-600 to-accent-700 px-8 py-14 text-center shadow-xl shadow-brand-700/30">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <Repeat className="mx-auto h-10 w-10 text-brand-100" />
            <h2 className="mx-auto mt-4 max-w-xl text-3xl font-extrabold tracking-tight text-white">
              Have something sitting unused at home?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-brand-100">
              List it in minutes and start earning Community Time Credits for the things you barely use.
            </p>
            <Link to="/create-listing" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-bold text-brand-700 shadow-lg transition hover:bg-brand-50">
              <PlusCircle className="h-4 w-4" />
              Create a free listing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
