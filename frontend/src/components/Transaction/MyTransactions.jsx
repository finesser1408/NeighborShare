import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { transactionsApi } from '../../api';
import { Receipt, ArrowRight, Info, QrCode } from 'lucide-react';
import { TRANSACTION_STATE_LABELS, TRANSACTION_STATE_COLORS } from '../../utils/formatters';

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

  const filteredTransactions = transactions.filter((txn) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return ['PENDING', 'AGREED', 'ACTIVE', 'ITEM_OUT'].includes(txn.state);
    if (activeFilter === 'completed') return txn.state === 'CLOSED';
    if (activeFilter === 'disputed') return txn.state === 'DISPUTED';
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'disputed', label: 'Disputed' },
  ];

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-7xl px-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">My Transactions</h1>
        <p className="mt-1 text-gray-500">Track your borrows and lends, hand-offs and returns</p>

        {error && (
          <div className="mb-6 mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Filter pills */}
        <div className="mb-6 mt-6 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeFilter === filter.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="card flex flex-col items-center p-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <Receipt className="h-8 w-8 text-gray-300" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-gray-900">No transactions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your {activeFilter !== 'all' ? activeFilter : ''} transactions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((txn) => (
              <div key={txn.id} className="card p-6 transition hover:shadow-card-hover">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900">{txn.item?.title || 'Item'}</h3>
                      <span className={`badge ${TRANSACTION_STATE_COLORS[txn.state] || 'bg-gray-100 text-gray-600'}`}>
                        {TRANSACTION_STATE_LABELS[txn.state] || txn.state}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {txn.requested_from} to {txn.requested_to} • {txn.time_credits_per_day} Credits/day
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {txn.lender?.id === user.id ? 'You are the lender' : 'You are the borrower'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-gray-900">{txn.total_time_credits}</p>
                      <p className="text-xs text-gray-500">Total Credits</p>
                    </div>
                    <button
                      onClick={() => navigate(`/transactions/${txn.id}`)}
                      className="btn-primary shrink-0 px-4 py-2.5 text-sm"
                    >
                      View Details <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Inline actions */}
                {txn.state === 'PENDING' && txn.lender?.id === user.id && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                    Waiting for your response to this borrow request.
                  </div>
                )}

                {txn.state === 'AGREED' && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4">
                    {txn.borrower?.id === user.id ? (
                      <>
                        <p className="text-sm text-brand-800">Terms agreed. Activate to unlock the QR handshake.</p>
                        <button
                          onClick={async () => {
                            try {
                              await transactionsApi.activate(txn.id);
                              navigate(`/transactions/${txn.id}/scan`);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                        >
                          <QrCode className="h-4 w-4" /> Activate & Generate QR
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-brand-800">Terms agreed. Waiting for the borrower to activate.</p>
                    )}
                  </div>
                )}

                {(txn.state === 'ACTIVE' || txn.state === 'ITEM_OUT') && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-orange-50 p-4">
                    <p className="text-sm text-orange-800">Item is with the borrower. Scan QR code to confirm return.</p>
                    <button
                      onClick={() => navigate(`/transactions/${txn.id}/scan`)}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
                    >
                      <QrCode className="h-4 w-4" /> Generate Return QR
                    </button>
                  </div>
                )}

                {txn.state === 'ITEM_RETURNED' && txn.lender?.id === user.id && (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                    Item returned. Close transaction to finalize Time Credits.
                  </div>
                )}

                {txn.state === 'DISPUTED' && (
                  <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                    This transaction is under dispute. An admin will review and resolve.
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
