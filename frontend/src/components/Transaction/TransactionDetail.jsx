import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { transactionsApi } from '../../api';
import QRCode from 'qrcode.react';

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

  const stateSteps = [
    { state: 'PENDING', label: 'Requested' },
    { state: 'ACCEPTED', label: 'Accepted' },
    { state: 'DEPOSIT_HELD', label: 'Deposit Held' },
    { state: 'ITEM_OUT', label: 'Handed Over' },
    { state: 'ITEM_RETURNED', label: 'Returned' },
    { state: 'CLOSED', label: 'Completed' },
  ];

  const currentStepIndex = stateSteps.findIndex(s => s.state === transaction.state);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Details</h1>
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{transaction.item?.title}</h2>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">Borrower</p>
                <p className="font-medium text-gray-900">{transaction.borrower?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lender</p>
                <p className="font-medium text-gray-900">{transaction.item?.owner?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Daily Rate</p>
                <p className="font-medium text-gray-900">${transaction.daily_rate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Deposit</p>
                <p className="font-medium text-gray-900">${transaction.deposit_amount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Date</p>
                <p className="font-medium text-gray-900">{transaction.requested_from}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">End Date</p>
                <p className="font-medium text-gray-900">{transaction.requested_to}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Escrow Ref</p>
                <p className="font-medium text-gray-900">{transaction.escrow_reference || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Days</p>
                <p className="font-medium text-gray-900">{transaction.total_days}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Progress</h3>
              <div className="flex items-center">
                {stateSteps.map((step, index) => (
                  <React.Fragment key={step.state}>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        index <= currentStepIndex ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {index < currentStepIndex ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (index + 1)}
                      </div>
                      <span className={`mt-1 text-xs font-medium ${index <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < stateSteps.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 ${index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

          {transaction.state === 'PENDING' && isLender && (
            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    await transactionsApi.accept(id);
                    fetchTransaction();
                  } catch (e) { console.error(e); }
                }}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Accept Borrow Request
              </button>
            </div>
          )}

          {transaction.state === 'ACCEPTED' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 mb-3">Deposit payment required to proceed.</p>
              <button
                onClick={async () => {
                  try {
                    const provider = new (await import('../../api')).MockEcoCashProvider();
                    const result = await provider.hold_deposit(
                      transaction.deposit_amount,
                      transaction.borrower?.phone_number,
                      transaction.escrow_reference
                    );
                    await transactionsApi.holdDeposit(id, result.transaction_id);
                    fetchTransaction();
                  } catch (e) { console.error(e); }
                }}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Process Deposit (Mock EcoCash)
              </button>
            </div>
          )}

          {(transaction.state === 'DEPOSIT_HELD' || transaction.state === 'ITEM_OUT') && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-purple-800 mb-3">
                {transaction.state === 'DEPOSIT_HELD'
                  ? 'Both parties must scan the QR code to confirm hand-off.'
                  : 'Both parties must scan the QR code to confirm return.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerateQR(transaction.state === 'DEPOSIT_HELD' ? 'handoff' : 'return')}
                  className="flex-1 py-3 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Generate QR Code
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className={`p-2 rounded ${transaction.lender_scanned_handoff || transaction.lender_scanned_return ? 'bg-green-100' : 'bg-gray-100'}`}>
                  Lender: {transaction.lender_scanned_handoff || transaction.lender_scanned_return ? '✓ Scanned' : '✗ Pending'}
                </div>
                <div className={`p-2 rounded ${transaction.borrower_scanned_handoff || transaction.borrower_scanned_return ? 'bg-green-100' : 'bg-gray-100'}`}>
                  Borrower: {transaction.borrower_scanned_handoff || transaction.borrower_scanned_return ? '✓ Scanned' : '✗ Pending'}
                </div>
              </div>
            </div>
          )}

          {transaction.state === 'ITEM_RETURNED' && isLender && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 mb-3">Item returned. Release deposit to complete transaction.</p>
              <button
                onClick={async () => {
                  try {
                    const provider = new (await import('../../api')).MockEcoCashProvider();
                    await provider.release_deposit(transaction.escrow_reference);
                    await transactionsApi.close(id);
                    fetchTransaction();
                  } catch (e) { console.error(e); }
                }}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Release Deposit & Close
              </button>
            </div>
          )}

          {(transaction.state === 'ITEM_OUT' || transaction.state === 'DEPOSIT_HELD' || transaction.state === 'ITEM_RETURNED') && (
            <div className="mt-4">
              <button
                onClick={async () => {
                  try {
                    await transactionsApi.dispute(id, 'Issue with transaction');
                    fetchTransaction();
                  } catch (e) { console.error(e); }
                }}
                className="w-full py-2 px-4 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50"
              >
                Raise Dispute
              </button>
            </div>
          )}

          {transaction.state === 'CLOSED' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-gray-700">Transaction completed successfully.</p>
              <button className="mt-2 text-blue-600 hover:underline text-sm">Leave a Rating</button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Timeline</h3>
          <div className="space-y-3">
            {transaction.events?.slice().reverse().map((event, idx) => (
              <div key={idx} className="flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900">{event.event_type}</p>
                  <p className="text-gray-500">{new Date(event.created_at).toLocaleString()}</p>
                  {event.detail && Object.keys(event.detail).length > 0 && (
                    <pre className="mt-1 text-xs text-gray-400 bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(event.detail, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
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