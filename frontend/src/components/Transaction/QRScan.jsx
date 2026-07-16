import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { transactionsApi } from '../../api';
import QRCode from 'qrcode.react';

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
    setOfflineQueue(prev => [...prev, token]);
    setShowQR(false);
  };

  useEffect(() => {
    if (navigator.onLine && offlineQueue.length > 0) {
      offlineQueue.forEach(token => handleScanQR(token));
      setOfflineQueue([]);
    }
  }, [offlineQueue]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Transaction Not Found</h1>
          <button onClick={() => navigate('/my-transactions')} className="mt-4 text-blue-600 hover:underline">
            Back to Transactions
          </button>
        </div>
      </div>
    );
  }

  const isLender = transaction.item?.owner?.id === user?.id;
  const isBorrower = transaction.borrower?.id === user?.id;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">QR Digital Handshake</h1>
          <p className="text-gray-600 mt-1">Scan to confirm hand-off or return of {transaction.item?.title}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700" role="alert">
            {error}
          </div>
        )}

        {offlineQueue.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            {offlineQueue.length} scan(s) queued offline. Will retry when connection returns.
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Transaction Status</h2>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              transaction.state === 'CLOSED' ? 'bg-gray-100 text-gray-800' :
              transaction.state === 'DISPUTED' ? 'bg-red-100 text-red-800' :
              transaction.state === 'DEPOSIT_HELD' ? 'bg-purple-100 text-purple-800' :
              transaction.state === 'ITEM_OUT' ? 'bg-orange-100 text-orange-800' :
              transaction.state === 'ITEM_RETURNED' ? 'bg-green-100 text-green-800' :
              transaction.state === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {transaction.state.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-gray-500">Borrower</p>
              <p className="font-medium text-gray-900">{transaction.borrower?.full_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Lender</p>
              <p className="font-medium text-gray-900">{transaction.item?.owner?.full_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Dates</p>
              <p className="font-medium text-gray-900">{transaction.requested_from} to {transaction.requested_to}</p>
            </div>
            <div>
              <p className="text-gray-500">Deposit</p>
              <p className="font-medium text-gray-900">${transaction.deposit_amount}</p>
            </div>
          </div>

          {(transaction.state === 'DEPOSIT_HELD' || transaction.state === 'ITEM_OUT') && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-800 mb-3">
                  {transaction.state === 'DEPOSIT_HELD'
                    ? 'Both parties must scan the QR code to confirm hand-off.'
                    : 'Both parties must scan the QR code to confirm return.'}
                </p>
                <button
                  onClick={() => handleGenerateQR(transaction.state === 'DEPOSIT_HELD' ? 'handoff' : 'return')}
                  className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Generate QR Code
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border ${scanStatus.lender ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">Lender</span>
                    {scanStatus.lender ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </div>
                  {isLender && !scanStatus.lender && (
                    <button
                      onClick={() => handleScanQR(qrToken)}
                      disabled={!qrToken}
                      className="mt-2 w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      Scan
                    </button>
                  )}
                </div>

                <div className={`p-4 rounded-lg border ${scanStatus.borrower ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">Borrower</span>
                    {scanStatus.borrower ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </div>
                  {isBorrower && !scanStatus.borrower && (
                    <button
                      onClick={() => handleScanQR(qrToken)}
                      disabled={!qrToken}
                      className="mt-2 w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      Scan
                    </button>
                  )}
                </div>
              </div>

              {!navigator.onLine && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    You are offline. Scans will be queued and sent automatically when connection returns.
                  </p>
                </div>
              )}
            </div>
          )}

          {transaction.state === 'PENDING' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">Waiting for lender to accept the request.</p>
            </div>
          )}

          {transaction.state === 'ACCEPTED' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">Deposit payment required before hand-off can proceed.</p>
            </div>
          )}

          {transaction.state === 'ITEM_RETURNED' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">Item returned. Waiting for lender to release deposit.</p>
            </div>
          )}

          {transaction.state === 'CLOSED' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-gray-700">Transaction completed successfully.</p>
            </div>
          )}

          {transaction.state === 'DISPUTED' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">This transaction is under dispute. An admin will review.</p>
            </div>
          )}
        </div>
      </div>

      {showQR && qrToken && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">QR Handshake Code</h3>
              <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-center mb-4">
              <QRCode value={qrToken} size={200} level="M" includeMargin={true} />
            </div>
            <p className="text-sm text-gray-600 text-center mb-4">
              Both parties must scan this code to confirm {qrType === 'handoff' ? 'hand-off' : 'return'}.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleScanQR(qrToken)}
                disabled={!navigator.onLine}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {navigator.onLine ? 'I\'ve Scanned - Confirm' : 'Offline - Scan Disabled'}
              </button>
              {!navigator.onLine && (
                <button
                  onClick={() => queueScanOffline(qrToken)}
                  className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
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