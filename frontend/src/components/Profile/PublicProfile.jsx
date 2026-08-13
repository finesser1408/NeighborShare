import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usersApi, itemsApi } from '../../api';
import { ArrowLeft, BadgeCheck, ShieldCheck, Package, Info } from 'lucide-react';
import { formatTrustScore } from '../../utils/formatters';

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      const [profileRes, listingsRes] = await Promise.all([
        usersApi.profile(id),
        itemsApi.list({ owner: id }),
      ]);
      setProfile(profileRes.data);
      setListings(listingsRes.data.results || listingsRes.data);
    } catch (err) {
      setError('Profile not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF8] px-4 text-center">
        <Info className="h-12 w-12 text-gray-300" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Profile Not Found</h1>
        <button onClick={() => navigate('/browse')} className="btn-primary mt-6">Back to Browse</button>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        {/* Header card */}
        <div className="card overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-brand-600 to-brand-400" />
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="-mt-14 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-100 text-brand-700 shadow">
                {profile.profile_photo ? (
                  <img src={profile.profile_photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold uppercase">{(profile.full_name || 'U').slice(0, 2)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{profile.full_name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`badge ${profile.trust_score > 0 ? 'bg-brand-50 text-brand-800' : 'bg-gray-100 text-gray-600'}`}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Trust: {formatTrustScore(profile.trust_score)}
                  </span>
                  {profile.national_id_verified && (
                    <span className="badge bg-emerald-50 text-emerald-700">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified member
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-500">Member since {new Date(profile.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Listings */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900">Listings by {profile.full_name}</h2>
          {listings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No active listings</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((item) => (
                <Link key={item.id} to={`/items/${item.id}`} className="card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card-hover">
                  <div className="aspect-video bg-gray-100">
                    {item.images?.[0] ? (
                      <img src={item.images[0].image} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-bold text-gray-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{item.time_credits_per_day} Credits/day</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No reviews yet</p>
          ) : (
            <div className="mt-4 space-y-4">
              {reviews.map((review, idx) => (
                <div key={idx} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{review.reviewer_name}</span>
                    <span className="text-sm text-gray-500">{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>Item: {'★'.repeat(review.item_condition) || '-'}/5</span>
                    <span>Communication: {'★'.repeat(review.communication)}/5</span>
                    <span>Punctuality: {'★'.repeat(review.punctuality)}/5</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
