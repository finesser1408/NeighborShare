import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { transactionsApi } from '../../api';
import QRCode from 'qrcode.react';
import {
  ArrowLeft, Check, X, Info, QrCode, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrToken, setQrToken] = useState(null);
  const [qrType, setQrType] = useState(null);
  const [offlineQueue, setOfflineQueue] = useState([]);

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const response = await transactionsApi.get(id);
      setTransaction(response.data);
    } catch (err) {
      setError('Transaction not found');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async (type) => {
    try {
      const response = await transactionsApi.generateQr(id);
      setQrToken(response.data.token);
      setQrType(type);
      setShowQR(true);
    } catch (err) {
      setError('Failed to generate QR code');
    }
  };

  const handleScanQR = async (token) => {
    try {
      await transactionsApi.scanQr(id, token);
      fetchTransaction();
      setShowQR(false);
    } catch (err) {
      setError('Failed to scan QR code');
    }
  };

  const queueScanOffline = (token) => {
    setOfflineQueue((prev) => [...prev, token]);
    setShowQR(false);
  };

  useEffect(() => {
    if (navigator.onLine && offlineQueue.length > 0) {
      offlineQueue.forEach((token) => handleScanQR(token));
      setOfflineQueue([]);
    }
  }, [offlineQueue]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF8] px-4 text-center">
        <Info className="h-12 w-12 text-gray-300" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Transaction Not Found</h1>
        <button onClick={() => navigate('/my-transactions')} className="btn-primary mt-6">Back to Transactions</button>
      </div>
    );
  }

  const isLender = transaction.item?.owner?.id === user?.id;
  const isBorrower = transaction.borrower?.id === user?.id;

  const stateSteps = [
    { state: 'PENDING', label: 'Requested' },
    { state: 'ACCEPTED', label: 'Accepted' },
    { state: 'DEPOSIT_HELD', label: 'Deposit Held' },
    { state: 'ITEM_OUT', label: 'Handed Over' },
    { state: 'ITEM_RETURNED', label: 'Returned' },
    { state: 'CLOSED', label: 'Completed' },
  ];

  const currentStepIndex = stateSteps.findIndex((s) => s.state === transaction.state);

  const stateBadge = (() => {
    const map = {
      CLOSED: 'bg-gray-100 text-gray-600',
      DISPUTED: 'bg-red-50 text-red-700',
      DEPOSIT_HELD: 'bg-violet-50 text-violet-700',
      ITEM_OUT: 'bg-orange-50 text-orange-700',
      ITEM_RETURNED: 'bg-emerald-50 text-emerald-700',
      ACCEPTED: 'bg-brand-50 text-brand-700',
    };
    return `badge ${map[transaction.state] || 'bg-amber-50 text-amber-700'}`;
  })();

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Transaction Details</h1>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {offlineQueue.length > 0 && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            {offlineQueue.length} scan(s) queued offline. Will retry when connection returns.
          </div>
        )}

        {/* Summary + stepper */}
        <div className="card p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-900">{transaction.item?.title}</h2>
            <span className={stateBadge}>{transaction.state.replace('_', ' ')}</span>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div><p className="text-xs text-gray-500">Borrower</p><p className="font-semibold text-gray-900">{transaction.borrower?.full_name}</p></div>
            <div><p className="text-xs text-gray-500">Lender</p><p className="font-semibold text-gray-900">{transaction.item?.owner?.full_name}</p></div>
            <div><p className="text-xs text-gray-500">Daily Rate</p><p className="font-semibold text-gray-900">{transaction.daily_rate ? `$${transaction.daily_rate}` : `${transaction.time_credits_per_day ?? '—'} credits`}</p></div>
            <div><p className="text-xs text-gray-500">Deposit</p><p className="font-semibold text-gray-900">{transaction.deposit_amount ? `$${transaction.deposit_amount}` : '—'}</p></div>
            <div><p className="text-xs text-gray-500">Start Date</p><p className="font-semibold text-gray-900">{transaction.requested_from}</p></div>
            <div><p className="text-xs text-gray-500">End Date</p><p className="font-semibold text-gray-900">{transaction.requested_to}</p></div>
            <div><p className="text-xs text-gray-500">Escrow Ref</p><p className="font-semibold text-gray-900">{transaction.escrow_reference || 'N/A'}</p></div>
            <div><p className="text-xs text-gray-500">Total Days</p><p className="font-semibold text-gray-900">{transaction.total_days}</p></div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="mb-4 text-sm font-bold text-gray-700">Progress</h3>
            <div className="flex items-center overflow-x-auto">
              {stateSteps.map((step, index) => (
                <React.Fragment key={step.state}>
                  <div className="flex shrink-0 flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      index <= currentStepIndex ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className={`mt-1 whitespace-nowrap text-xs font-medium ${index <= currentStepIndex ? 'text-brand-700' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < stateSteps.length - 1 && (
                    <div className={`mx-2 h-1 flex-1 shrink-0 rounded ${index < currentStepIndex ? 'bg-brand-600' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-bold text-gray-900">Actions</h3>

          {transaction.state === 'PENDING' && isLender && (
            <div className="space-y-3">
              <button
                onClick={async () => {
                  try { await transactionsApi.accept(id); fetchTransaction(); } catch (e) { console.error(e); }
                }}
                className="btn-primary w-full bg-emerald-600 py-3 hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" /> Accept Borrow Request
              </button>
            </div>
          )}

          {transaction.state === 'ACCEPTED' && (
            <div className="rounded-xl bg-brand-50 p-4">
              <p className="mb-3 text-sm text-brand-800">Deposit payment required to proceed.</p>
              <button
                onClick={async () => {
                  try {
                    const { MockEcoCashProvider } = await import('../../api');
                    const provider = new MockEcoCashProvider();
                    const result = await provider.hold_deposit(
                      transaction.deposit_amount,
                      transaction.borrower?.phone_number,
                      transaction.escrow_reference
                    );
                    await transactionsApi.holdDeposit(id, result.transaction_id);
                    fetchTransaction();
                  } catch (e) { console.error(e); }
                }}
                className="btn-primary w-full py-3"
              >
                Process Deposit (Mock EcoCash)
              </button>
            </div>
          )}

          {(transaction.state === 'DEPOSIT_HELD' || transaction.state === 'ITEM_OUT') && (
            <div className="rounded-xl bg-violet-50 p-4">
              <p className="mb-3 text-sm text-violet-800">
                {transaction.state === 'DEPOSIT_HELD'
                  ? 'Both parties must scan the QR code to confirm hand-off.'
                  : 'Both parties must scan the QR code to confirm return.'}
              </p>
              <button
                onClick={() => handleGenerateQR(transaction.state === 'DEPOSIT_HELD' ? 'handoff' : 'return')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                <QrCode className="h-4 w-4" /> Generate QR Code
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className={`rounded-lg p-2 ${transaction.lender_scanned_handoff || transaction.lender_scanned_return ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  Lender: {transaction.lender_scanned_handoff || transaction.lender_scanned_return ? '✓ Scanned' : '✗ Pending'}
                </div>
                <div className={`rounded-lg p-2 ${transaction.borrower_scanned_handoff || transaction.borrower_scanned_return ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  Borrower: {transaction.borrower_scanned_handoff || transaction.borrower_scanned_return ? '✓ Scanned' : '✗ Pending'}
                </div>
              </div>
            </div>
          )}

          {transaction.state === 'ITEM_RETURNED' && isLender && (
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="mb-3 text-sm text-emerald-800">Item returned. Release deposit to complete transaction.</p>
              <button
                onClick={async () => {
                  try {
                    const { MockEcoCashProvider } = await import('../../api');
                    const provider = new MockEcoCashProvider();
                    await provider.release_deposit(transaction.escrow_reference);
                    await transactionsApi.close(id);
                    fetchTransaction();
                  } catch (e) { console.error(e); }
                }}
                className="btn-primary w-full bg-emerald-600 py-3 hover:bg-emerald-700"
              >
                Release Deposit & Close
              </button>
            </div>
          )}

          {(transaction.state === 'ITEM_OUT' || transaction.state === 'DEPOSIT_HELD' || transaction.state === 'ITEM_RETURNED') && (
            <div className="mt-4">
              <button
                onClick={async () => {
                  try { await transactionsApi.dispute(id, 'Issue with transaction'); fetchTransaction(); } catch (e) { console.error(e); }
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <AlertTriangle className="h-4 w-4" /> Raise Dispute
              </button>
            </div>
          )}

          {transaction.state === 'CLOSED' && (
            <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-600">
              Transaction completed successfully. Time Credits have been released.
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-bold text-gray-900">Event Timeline</h3>
          {transaction.events?.length ? (
            <div className="space-y-4">
              {transaction.events.slice().reverse().map((event, idx) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600 ring-4 ring-brand-100" />
                  <div>
                    <p className="font-semibold text-gray-900">{event.event_type}</p>
                    <p className="text-gray-500">{new Date(event.created_at).toLocaleString()}</p>
                    {event.detail && Object.keys(event.detail).length > 0 && (
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-400">
                        {JSON.stringify(event.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500">No events yet</p>
          )}
        </div>
      </div>

      {/* QR modal */}
      {showQR && qrToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowQR(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">QR Handshake Code</h3>
              <button onClick={() => setShowQR(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 flex justify-center rounded-2xl border border-gray-100 bg-gray-50 p-6">
              <QRCode value={qrToken} size={200} level="M" includeMargin />
            </div>
            <p className="mb-4 text-center text-sm text-gray-600">
              Both parties must scan this code to confirm {qrType === 'handoff' ? 'hand-off' : 'return'}.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleScanQR(qrToken)}
                disabled={!navigator.onLine}
                className="btn-primary w-full py-3 disabled:cursor-not-allowed"
              >
                {navigator.onLine ? "I've Scanned — Confirm" : 'Offline — Scan Disabled'}
              </button>
              {!navigator.onLine && (
                <button onClick={() => queueScanOffline(qrToken)} className="btn-secondary w-full">
                  Queue Scan for Later
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
