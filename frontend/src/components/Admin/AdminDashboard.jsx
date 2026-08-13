import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../api';
import {
  Users, BadgeCheck, Package, AlertTriangle, X, ShieldCheck, Info,
} from 'lucide-react';

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
    PENDING: 'bg-amber-50 text-amber-700',
    ACCEPTED: 'bg-brand-50 text-brand-700',
    DEPOSIT_HELD: 'bg-violet-50 text-violet-700',
    ITEM_OUT: 'bg-orange-50 text-orange-700',
    ITEM_RETURNED: 'bg-emerald-50 text-emerald-700',
    CLOSED: 'bg-gray-100 text-gray-600',
    DISPUTED: 'bg-red-50 text-red-700',
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.total_users || 0, icon: Users, tint: 'bg-brand-50 text-brand-700' },
    { label: 'Verified Users', value: stats.verified_users || 0, icon: BadgeCheck, tint: 'bg-emerald-50 text-emerald-700' },
    { label: 'Active Items', value: stats.available_items || 0, icon: Package, tint: 'bg-violet-50 text-violet-700' },
    { label: 'Open Disputes', value: stats.disputed_transactions || 0, icon: AlertTriangle, tint: 'bg-red-50 text-red-700' },
  ];

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Admin Dashboard</h1>
            <p className="mt-1 text-gray-500">Manage disputes and monitor platform activity</p>
          </div>
          <span className="badge bg-gray-900 text-white">
            <ShieldCheck className="h-3.5 w-3.5" /> Signed in as {user?.first_name || 'Admin'}
          </span>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tint}`}>
                  <stat.icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-3xl font-extrabold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Disputes table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-900">Disputed Transactions ({disputes.length})</h2>
          </div>

          {disputes.length === 0 ? (
            <div className="flex flex-col items-center p-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-gray-900">No disputes</h3>
              <p className="mt-1 text-sm text-gray-500">All transactions are running smoothly.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Parties</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {disputes.map((dispute) => (
                    <tr key={dispute.id} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">#{dispute.id.slice(0, 8)}</div>
                        <div className="text-sm text-gray-500">{new Date(dispute.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{dispute.borrower?.full_name || 'Borrower'}</div>
                        <div className="text-sm text-gray-500">from {dispute.item?.owner?.full_name || 'Lender'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{dispute.item?.title || 'Item'}</div>
                        <div className="text-sm text-gray-500">{dispute.item?.category}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {dispute.deposit_amount ? `$${dispute.deposit_amount}` : `${dispute.total_time_credits ?? '—'} credits`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {dispute.daily_rate ? `$${dispute.daily_rate}/day` : `${dispute.time_credits_per_day ?? '—'} credits/day`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${stateColors[dispute.state] || 'bg-gray-100 text-gray-600'}`}>
                          {dispute.state.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedDispute(dispute)}
                          className="text-sm font-semibold text-brand-700 transition hover:text-brand-800 hover:underline"
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

        {/* Resolve modal */}
        {selectedDispute && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedDispute(null)}>
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900">Resolve Dispute</h2>
                <button onClick={() => setSelectedDispute(null)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-6 p-6">
                <div className="rounded-xl bg-gray-50 p-5">
                  <h3 className="mb-3 font-bold text-gray-900">Transaction Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Transaction ID</p><p className="font-semibold">{selectedDispute.id}</p></div>
                    <div><p className="text-gray-500">Item</p><p className="font-semibold">{selectedDispute.item?.title}</p></div>
                    <div><p className="text-gray-500">Borrower</p><p className="font-semibold">{selectedDispute.borrower?.full_name}</p></div>
                    <div><p className="text-gray-500">Lender</p><p className="font-semibold">{selectedDispute.item?.owner?.full_name}</p></div>
                    <div><p className="text-gray-500">Deposit</p><p className="font-semibold">{selectedDispute.deposit_amount ? `$${selectedDispute.deposit_amount}` : '—'}</p></div>
                    <div><p className="text-gray-500">Daily Rate</p><p className="font-semibold">{selectedDispute.daily_rate ? `$${selectedDispute.daily_rate}` : `${selectedDispute.time_credits_per_day ?? '—'} credits`}</p></div>
                    <div><p className="text-gray-500">Dates</p><p className="font-semibold">{selectedDispute.requested_from} to {selectedDispute.requested_to}</p></div>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <h3 className="font-bold text-red-800">Dispute Reason</h3>
                    <p className="mt-1 text-sm text-red-700">
                      {selectedDispute.events?.find((e) => e.event_type === 'DISPUTE')?.detail?.reason || 'No reason provided'}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 font-bold text-gray-900">Resolution Options</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { value: 'lender', label: 'Release to Lender', desc: 'Full deposit to item owner', classes: 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50' },
                      { value: 'borrower', label: 'Refund to Borrower', desc: 'Full deposit back to borrower', classes: 'border-brand-300 hover:border-brand-500 hover:bg-brand-50' },
                      { value: 'split', label: 'Split 50/50', desc: 'Half to each party', classes: 'border-amber-300 hover:border-amber-500 hover:bg-amber-50' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleResolve(opt.value)}
                        disabled={resolving}
                        className={`rounded-2xl border-2 p-4 text-left transition disabled:opacity-50 ${opt.classes}`}
                      >
                        <p className="font-bold text-gray-900">{opt.label}</p>
                        <p className="mt-1 text-sm text-gray-500">{opt.desc}</p>
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
