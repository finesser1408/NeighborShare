import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { transactionsApi } from '../../api';

export default function MyTransactions() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchTransactions();
  }, [isAuthenticated, navigate]);

  const fetchTransactions = async () => {
    try {
      const response = await transactionsApi.list({ user_id: user.id });
      setTransactions(response.data.results || response.data);
    } catch (err) {
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(txn => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return ['PENDING', 'ACCEPTED', 'DEPOSIT_HELD', 'ITEM_OUT'].includes(txn.state);
    if (activeFilter === 'completed') return txn.state === 'CLOSED';
    if (activeFilter === 'disputed') return txn.state === 'DISPUTED';
    return true;
  });

  const stateLabels = {
    PENDING: 'Pending Approval',
    ACCEPTED: 'Accepted - Awaiting Deposit',
    DEPOSIT_HELD: 'Deposit Held - Ready for Hand-off',
    ITEM_OUT: 'Item Out with Borrower',
    ITEM_RETURNED: 'Item Returned - Awaiting Deposit Release',
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Transactions</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700" role="alert">
            {error}
          </div>
        )}

        <div className="mb-6 flex gap-2 flex-wrap">
          {['all', 'active', 'completed', 'disputed'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No transactions found</h3>
            <p className="mt-2 text-gray-500">Your {activeFilter !== 'all' ? activeFilter : ''} transactions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((txn) => (
              <div key={txn.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{txn.item?.title || 'Item'}</h3>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${stateColors[txn.state]}`}>
                        {stateLabels[txn.state] || txn.state}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {txn.requested_from} to {txn.requested_to} • ${txn.daily_rate}/day
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {txn.item?.owner?.id === user.id ? 'You are the lender' : 'You are the borrower'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">${txn.deposit_amount}</p>
                      <p className="text-sm text-gray-500">Deposit</p>
                    </div>
                    <button
                      onClick={() => navigate(`/transactions/${txn.id}`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      View Details
                    </button>
                  </div>
                </div>

                {txn.state === 'PENDING' && txn.item?.owner?.id === user.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 mb-2">Waiting for your response to this borrow request.</p>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                        Accept
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {txn.state === 'DEPOSIT_HELD' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-800 mb-2">Both parties must scan the QR code to confirm hand-off.</p>
                    <button
                      onClick={() => navigate(`/transactions/${txn.id}/scan`)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                    >
                      Generate QR Code
                    </button>
                  </div>
                )}

                {txn.state === 'ITEM_OUT' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-800 mb-2">Item is with the borrower. Scan QR code to confirm return.</p>
                    <button
                      onClick={() => navigate(`/transactions/${txn.id}/scan`)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
                    >
                      Generate Return QR
                    </button>
                  </div>
                )}

                {txn.state === 'ITEM_RETURNED' && txn.item?.owner?.id === user.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-800 mb-2">Item returned. Release deposit to complete transaction.</p>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                      Release Deposit & Close
                    </button>
                  </div>
                )}

                {txn.state === 'DISPUTED' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-red-800">This transaction is under dispute. An admin will review and resolve.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}