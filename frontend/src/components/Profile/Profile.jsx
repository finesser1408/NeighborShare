import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi, itemsApi, transactionsApi } from '../../api';
import {
  User, Package, Receipt, Camera, BadgeCheck, Pencil, Save, X, ShieldCheck,
} from 'lucide-react';
import { formatTrustScore } from '../../utils/formatters';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    try {
      const [profileRes, listingsRes, transactionsRes] = await Promise.all([
        usersApi.profile(user.id),
        itemsApi.list({ owner: user.id }),
        transactionsApi.list({ user_id: user.id }),
      ]);
      setProfile(profileRes.data);
      setListings(listingsRes.data.results || listingsRes.data);
      setTransactions(transactionsRes.data.results || transactionsRes.data);
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: profileRes.data.phone_number || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await usersApi.updateProfile(user.id, formData);
      updateUser(response.data);
      setProfile(response.data);
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('profile_photo', file);
      const response = await usersApi.uploadPhoto(user.id, formData);
      updateUser(response.data);
      setProfile((prev) => ({ ...prev, profile_photo: response.data.profile_photo }));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'listings', label: `My Listings (${listings.length})`, icon: Package },
    { id: 'transactions', label: `Transactions (${transactions.length})`, icon: Receipt },
  ];

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">My Profile</h1>
          <p className="mt-1 text-gray-500">Manage your account and view your activity</p>
        </div>

        <div className="card overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4 sm:px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition ${
                  activeTab === tab.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            {activeTab === 'profile' && profile && (
              <div className="max-w-2xl">
                <div className="mb-8 flex flex-wrap items-center gap-6">
                  <div className="relative">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700">
                      {profile.profile_photo ? (
                        <img src={profile.profile_photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold uppercase">{(profile.full_name || 'U').slice(0, 2)}</span>
                      )}
                    </div>
                    {editing && (
                      <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow transition hover:bg-brand-700">
                        <Camera className="h-4 w-4" />
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handlePhotoUpload(e.target.files[0])} />
                      </label>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">{profile.full_name}</h2>
                    <p className="text-gray-500">{profile.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`badge ${profile.trust_score > 0 ? 'bg-brand-50 text-brand-800' : 'bg-gray-100 text-gray-600'}`}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Trust: {formatTrustScore(profile.trust_score)}
                      </span>
                      {profile.national_id_verified && (
                        <span className="badge bg-emerald-50 text-emerald-700">
                          <BadgeCheck className="h-3.5 w-3.5" /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-gray-700">First Name</label>
                        <input
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Last Name</label>
                        <input
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-gray-700">Phone Number</label>
                      <input
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleSave} className="btn-primary">
                        <Save className="h-4 w-4" /> Save
                      </button>
                      <button onClick={() => setEditing(false)} className="btn-secondary">
                        <X className="h-4 w-4" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-500">First Name</p>
                      <p className="font-semibold text-gray-900">{profile.first_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Name</p>
                      <p className="font-semibold text-gray-900">{profile.last_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone Number</p>
                      <p className="font-semibold text-gray-900">{profile.phone_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Member Since</p>
                      <p className="font-semibold text-gray-900">{new Date(profile.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <button onClick={() => setEditing(true)} className="btn-secondary">
                        <Pencil className="h-4 w-4" /> Edit Profile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'listings' && <MyListingsView listings={listings} onRefresh={fetchProfile} />}
            {activeTab === 'transactions' && <MyTransactionsView transactions={transactions} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function MyListingsView({ listings, onRefresh }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    setDeleting(id);
    try {
      await itemsApi.delete(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  if (listings.length === 0) {
    return (
      <div className="py-8 text-center">
        <Package className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-3 text-lg font-bold text-gray-900">No listings yet</h3>
        <p className="mt-1 text-sm text-gray-500">Create your first listing to start sharing with neighbors.</p>
        <button onClick={() => navigate('/create-listing')} className="btn-primary mt-5">Create Listing</button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((item) => (
          <div key={item.id} className="card overflow-hidden transition hover:shadow-card-hover">
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
                {item.category?.replace('_', ' ')}
              </span>
              {!item.is_available && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white">Unavailable</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="truncate font-bold text-gray-900">{item.title}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-lg font-extrabold text-gray-900">{item.time_credits_per_day}</span>
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
                    disabled={deleting === item.id}
                    className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MyTransactionsView({ transactions }) {
  const navigate = useNavigate();
  const stateLabels = {
    PENDING: 'Pending',
    AGREED: 'Agreed',
    ACTIVE: 'Active',
    ITEM_OUT: 'Item Out',
    ITEM_RETURNED: 'Returned',
    CLOSED: 'Completed',
    DISPUTED: 'Disputed',
  };

  const stateColors = {
    PENDING: 'bg-amber-50 text-amber-700',
    AGREED: 'bg-brand-50 text-brand-700',
    ACTIVE: 'bg-violet-50 text-violet-700',
    ITEM_OUT: 'bg-orange-50 text-orange-700',
    ITEM_RETURNED: 'bg-emerald-50 text-emerald-700',
    CLOSED: 'bg-gray-100 text-gray-600',
    DISPUTED: 'bg-red-50 text-red-700',
  };

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center">
        <Receipt className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-3 text-lg font-bold text-gray-900">No transactions yet</h3>
        <p className="mt-1 text-sm text-gray-500">Your borrowing and lending history will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((txn) => (
        <div key={txn.id} className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-card-hover">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-gray-900">{txn.item?.title || 'Item'}</h3>
                <span className={`badge ${stateColors[txn.state]}`}>{stateLabels[txn.state] || txn.state}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{txn.requested_from} to {txn.requested_to}</p>
              <p className="mt-0.5 text-sm text-gray-500">
                {txn.time_credits_per_day} credits/day • Total: {txn.total_time_credits} credits
              </p>
            </div>
            <button onClick={() => navigate(`/transactions/${txn.id}`)} className="btn-secondary shrink-0 px-4 py-2 text-xs">
              View Details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
