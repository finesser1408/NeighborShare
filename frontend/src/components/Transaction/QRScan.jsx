import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { transactionsApi } from '../../api';
import QRCode from 'qrcode.react';
import {
  ArrowLeft, Check, Clock, Info, QrCode, X, AlertTriangle, ShieldCheck,
} from 'lucide-react';

export default function QRScan() {
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
  const [scanStatus, setScanStatus] = useState({ lender: false, borrower: false });

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const response = await transactionsApi.get(id);
      setTransaction(response.data);
      setScanStatus({
        lender: response.data.lender_scanned_handoff || response.data.lender_scanned_return,
        borrower: response.data.borrower_scanned_handoff || response.data.borrower_scanned_return,
      });
    } catch (err) {
      setError('Transaction not found');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async (type) => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ video: false });
      }
    } catch (err) {
      console.warn('Camera permission check failed:', err);
    }

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

  const stateBadge = (() => {
    const map = {
      CLOSED: 'bg-gray-100 text-gray-600',
      DISPUTED: 'bg-red-50 text-red-700',
      ACTIVE: 'bg-violet-50 text-violet-700',
      ITEM_OUT: 'bg-orange-50 text-orange-700',
      ITEM_RETURNED: 'bg-emerald-50 text-emerald-700',
      AGREED: 'bg-brand-50 text-brand-700',
    };
    return `badge ${map[transaction.state] || 'bg-amber-50 text-amber-700'}`;
  })();

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">QR Digital Handshake</h1>
          <p className="mt-1 text-gray-500">Scan to confirm hand-off or return of {transaction.item?.title}</p>
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

        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900">Transaction Status</h2>
            <span className={stateBadge}>{transaction.state.replace('_', ' ')}</span>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Borrower</p><p className="font-semibold text-gray-900">{transaction.borrower?.full_name}</p></div>
            <div><p className="text-gray-500">Lender</p><p className="font-semibold text-gray-900">{transaction.item?.owner?.full_name}</p></div>
            <div><p className="text-gray-500">Dates</p><p className="font-semibold text-gray-900">{transaction.requested_from} to {transaction.requested_to}</p></div>
            <div><p className="text-gray-500">Total Credits</p><p className="font-semibold text-gray-900">{transaction.total_time_credits} credits</p></div>
          </div>

          <div className="mb-5 flex items-start gap-2 rounded-xl bg-brand-50 p-4 text-xs font-semibold text-brand-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Both parties must scan the same QR code to verify the exchange — safe, simple and secure.
          </div>

          {(transaction.state === 'ACTIVE' || transaction.state === 'ITEM_OUT') && (
            <div className="space-y-4">
              <button
                onClick={() => handleGenerateQR(transaction.state === 'ACTIVE' ? 'handoff' : 'return')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                <QrCode className="h-4 w-4" />
                {transaction.state === 'ACTIVE' ? 'Generate Hand-off QR Code' : 'Generate Return QR Code'}
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-2xl border p-4 ${scanStatus.lender ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">Lender</span>
                    {scanStatus.lender ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <span className="text-xs font-medium text-gray-400">Pending</span>
                    )}
                  </div>
                  {isLender && !scanStatus.lender && (
                    <button
                      onClick={() => handleScanQR(qrToken)}
                      disabled={!qrToken}
                      className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Scan
                    </button>
                  )}
                </div>

                <div className={`rounded-2xl border p-4 ${scanStatus.borrower ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">Borrower</span>
                    {scanStatus.borrower ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <span className="text-xs font-medium text-gray-400">Pending</span>
                    )}
                  </div>
                  {isBorrower && !scanStatus.borrower && (
                    <button
                      onClick={() => handleScanQR(qrToken)}
                      disabled={!qrToken}
                      className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Scan
                    </button>
                  )}
                </div>
              </div>

              {!navigator.onLine && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  You are offline. Scans will be queued and sent automatically when connection returns.
                </div>
              )}
            </div>
          )}

          {transaction.state === 'PENDING' && (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Waiting for lender to accept the request.</div>
          )}

          {transaction.state === 'AGREED' && (
            <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">Transaction accepted. Ready for hand-off.</div>
          )}

          {transaction.state === 'ITEM_RETURNED' && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Item returned. Waiting for lender to close transaction.</div>
          )}

          {transaction.state === 'CLOSED' && (
            <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-600">Transaction completed successfully.</div>
          )}

          {transaction.state === 'DISPUTED' && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">This transaction is under dispute. An admin will review.</div>
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
