import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi, itemsApi, transactionsApi } from '../../api';

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
      console.log('Saving profile with data:', formData);
      const response = await usersApi.updateProfile(user.id, formData);
      console.log('Profile save response:', response.data);
      console.log('Phone number in response:', response.data.phone_number);
      updateUser(response.data);
      setProfile(response.data);
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      console.error('Error response:', err.response?.data);
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('profile_photo', file);
      const response = await usersApi.uploadPhoto(user.id, formData);
      updateUser(response.data);
      setProfile(prev => ({ ...prev, profile_photo: response.data.profile_photo }));
    } catch (err) {
      console.error(err);
    }
  };

  const trustScoreDisplay = (score) => {
    if (!score || score === 0) return 'New Member';
    return `${Math.round(score)}/100`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">Manage your account and view your activity</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px" aria-label="Tabs">
              {[
                { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                { id: 'listings', label: 'My Listings', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                { id: 'transactions', label: 'Transactions', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && profile && (
              <div className="max-w-2xl">
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {profile.profile_photo ? (
                        <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    {editing && (
                      <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handlePhotoUpload(e.target.files[0])} />
                      </label>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{profile.full_name}</h2>
                    <p className="text-gray-500">{profile.email}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        profile.trust_score > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        Trust Score: {trustScoreDisplay(profile.trust_score)}
                      </span>
                      {profile.national_id_verified && (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Save</button>
                      <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">First Name</p>
                        <p className="font-medium text-gray-900">{profile.first_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Last Name</p>
                        <p className="font-medium text-gray-900">{profile.last_name || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone Number</p>
                      <p className="font-medium text-gray-900">{profile.phone_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Member Since</p>
                      <p className="font-medium text-gray-900">{new Date(profile.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => setEditing(true)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Edit Profile</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'listings' && (
              <MyListingsView listings={listings} onRefresh={fetchProfile} />
            )}

            {activeTab === 'transactions' && (
              <MyTransactionsView transactions={transactions} />
            )}
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">My Listings ({listings.length})</h2>
        <button onClick={() => navigate('/create-listing')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Add Listing</button>
      </div>
      {listings.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No listings yet</h3>
          <p className="mt-1 text-gray-500">Create your first listing to start sharing with neighbors.</p>
          <button onClick={() => navigate('/create-listing')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Create Listing</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition">
              <div className="aspect-video bg-gray-100 relative">
                {item.images?.[0] ? (
                  <img src={item.images[0].image} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded-full bg-white/90 backdrop-blur text-gray-700">
                  {item.category?.replace('_', ' ')}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-1">${item.daily_rate_usd}/day</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className={`text-sm font-medium ${item.is_available ? 'text-green-600' : 'text-red-600'}`}>
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/edit-item/${item.id}`)} className="text-sm text-blue-600 hover:underline">Edit</button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      {deleting === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyTransactionsView({ transactions }) {
  const navigate = useNavigate();
  const stateLabels = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    DEPOSIT_HELD: 'Deposit Held',
    ITEM_OUT: 'Item Out',
    ITEM_RETURNED: 'Returned',
    CLOSED: 'Completed',
    DISPUTED: 'Disputed',
  };

  const stateColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    ACCEPTED: 'bg-blue-100 text-blue-800',
    DEPOSIT_HELD: 'bg-purple-100 text-purple-800',
    ITEM_OUT: 'bg-orange-100 text-orange-800',
    ITEM_RETURNED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
    DISPUTED: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">My Transactions ({transactions.length})</h2>
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No transactions yet</h3>
          <p className="mt-1 text-gray-500">Your borrowing and lending history will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((txn) => (
            <div key={txn.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{txn.item?.title || 'Item'}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${stateColors[txn.state]}`}>
                      {stateLabels[txn.state] || txn.state}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{txn.requested_from} to {txn.requested_to}</p>
                  <p className="text-sm text-gray-500 mt-1">${txn.daily_rate}/day • Deposit: ${txn.deposit_amount}</p>
                </div>
                <button onClick={() => navigate(`/transactions/${txn.id}`)} className="text-sm text-blue-600 hover:underline">View Details</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}