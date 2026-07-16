import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [disputesRes, statsRes] = await Promise.all([
        adminApi.disputes(),
        adminApi.stats(),
      ]);
      setDisputes(disputesRes.data.results || disputesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (resolution) => {
    if (!selectedDispute) return;
    setResolving(true);
    try {
      await adminApi.resolveDispute(selectedDispute.id, resolution);
      fetchData();
      setSelectedDispute(null);
    } catch (err) {
      console.error(err);
    } finally {
      setResolving(false);
    }
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage disputes and monitor platform activity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Users', value: stats.total_users || 0, color: 'blue' },
            { label: 'Verified Users', value: stats.verified_users || 0, color: 'green' },
            { label: 'Active Items', value: stats.available_items || 0, color: 'purple' },
            { label: 'Open Disputes', value: stats.disputed_transactions || 0, color: 'red' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Disputed Transactions ({disputes.length})</h2>
          </div>

          {disputes.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No disputes</h3>
              <p className="mt-1 text-gray-500">All transactions are running smoothly.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parties</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {disputes.map((dispute) => (
                    <tr key={dispute.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">#{dispute.id.slice(0, 8)}</div>
                        <div className="text-sm text-gray-500">{new Date(dispute.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{dispute.borrower?.full_name || 'Borrower'}</div>
                        <div className="text-sm text-gray-500">from {dispute.item?.owner?.full_name || 'Lender'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{dispute.item?.title || 'Item'}</div>
                        <div className="text-sm text-gray-500">{dispute.item?.category}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">${dispute.deposit_amount}</div>
                        <div className="text-sm text-gray-500">${dispute.daily_rate}/day</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${stateColors[dispute.state]}`}>
                          {dispute.state}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedDispute(dispute)}
                          className="text-sm text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Review & Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedDispute && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDispute(null)}>
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Resolve Dispute</h2>
                <button onClick={() => setSelectedDispute(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Transaction Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Transaction ID</p><p className="font-medium">{selectedDispute.id}</p></div>
                    <div><p className="text-gray-500">Item</p><p className="font-medium">{selectedDispute.item?.title}</p></div>
                    <div><p className="text-gray-500">Borrower</p><p className="font-medium">{selectedDispute.borrower?.full_name}</p></div>
                    <div><p className="text-gray-500">Lender</p><p className="font-medium">{selectedDispute.item?.owner?.full_name}</p></div>
                    <div><p className="text-gray-500">Deposit</p><p className="font-medium">${selectedDispute.deposit_amount}</p></div>
                    <div><p className="text-gray-500">Daily Rate</p><p className="font-medium">${selectedDispute.daily_rate}</p></div>
                    <div><p className="text-gray-500">Dates</p><p className="font-medium">{selectedDispute.requested_from} to {selectedDispute.requested_to}</p></div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-medium text-red-800 mb-2">Dispute Reason</h3>
                  <p className="text-red-700">{selectedDispute.events?.find(e => e.event_type === 'DISPUTE')?.detail?.reason || 'No reason provided'}</p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Resolution Options</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'lender', label: 'Release to Lender', desc: 'Full deposit to item owner', color: 'green' },
                      { value: 'borrower', label: 'Refund to Borrower', desc: 'Full deposit back to borrower', color: 'blue' },
                      { value: 'split', label: 'Split 50/50', desc: 'Half to each party', color: 'yellow' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleResolve(opt.value)}
                        disabled={resolving}
                        className={`p-4 rounded-lg border-2 text-left transition ${opt.color === 'green' ? 'border-green-300 hover:border-green-500' : opt.color === 'blue' ? 'border-blue-300 hover:border-blue-500' : 'border-yellow-300 hover:border-yellow-500'}`}
                      >
                        <p className="font-medium text-gray-900">{opt.label}</p>
                        <p className="text-sm text-gray-500 mt-1">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}