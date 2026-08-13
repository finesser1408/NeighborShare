import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { itemsApi } from '../../api';
import { Package, PlusCircle, ArrowLeft, Info } from 'lucide-react';

export default function MyListings() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchListings();
  }, [isAuthenticated, navigate]);

  const fetchListings = async () => {
    try {
      const response = await itemsApi.list({ owner: user.id });
      setListings(response.data.results || response.data);
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to load your listings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
      await itemsApi.delete(id);
      setListings((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError('Failed to delete listing');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/profile" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-brand-700">
              <ArrowLeft className="h-4 w-4" /> Back to profile
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">My Listings</h1>
            <p className="mt-1 text-gray-500">Manage the items you're lending to your neighbours</p>
          </div>
          <Link to="/create-listing" className="btn-primary">
            <PlusCircle className="h-4 w-4" /> Create New Listing
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {listings.length === 0 ? (
          <div className="card flex flex-col items-center p-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <Package className="h-8 w-8 text-gray-300" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-gray-900">No listings yet</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Create your first listing to start sharing with neighbors and earning Time Credits.
            </p>
            <Link to="/create-listing" className="btn-primary mt-6">
              <PlusCircle className="h-4 w-4" /> Create Listing
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((item) => (
              <div key={item.id} className="card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card-hover">
                <div className="relative aspect-video bg-gray-100">
                  {item.images?.[0] ? (
                    <img src={item.images[0].image} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur">
                    {item.category?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                  {!item.is_available && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white">Unavailable</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="truncate font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.description}</p>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-gray-900">{item.time_credits_per_day}</span>
                    <span className="text-sm text-gray-500">Credits/day</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className={`badge ${item.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/edit-item/${item.id}`)} className="btn-secondary px-3 py-1.5 text-xs">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
