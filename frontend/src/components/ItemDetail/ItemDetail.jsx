import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { itemsApi, transactionsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'qrcode.react';
import L from 'leaflet';

const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [borrowDates, setBorrowDates] = useState({ from: '', to: '' });
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [borrowError, setBorrowError] = useState(null);
  const [borrowSuccess, setBorrowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrToken, setQrToken] = useState(null);
  const [transaction, setTransaction] = useState(null);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await itemsApi.get(id);
        setItem(response.data);
      } catch (err) {
        setError('Item not found');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  const handleBorrowRequest = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/items/${id}` } });
      return;
    }

    if (!borrowDates.from || !borrowDates.to) {
      setBorrowError('Please select both start and end dates');
      return;
    }

    setBorrowLoading(true);
    setBorrowError(null);
    try {
      const response = await transactionsApi.borrowRequest({
        item_id: id,
        requested_from: borrowDates.from,
        requested_to: borrowDates.to,
      });
      setTransaction(response.data);
      setBorrowSuccess(true);
      setActiveTab('transaction');
    } catch (err) {
      setBorrowError(err.response?.data?.error?.message || 'Failed to create borrow request');
    } finally {
      setBorrowLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!transaction) return;
    try {
      const response = await transactionsApi.generateQr(transaction.id);
      setQrToken(response.data.token);
      setShowQR(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanQR = async () => {
    if (!transaction) return;
    try {
      await transactionsApi.scanQr(transaction.id, qrToken);
      const updated = await transactionsApi.get(transaction.id);
      setTransaction(updated.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Item Not Found</h1>
          <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user && item.owner === user.id;
  const canBorrow = user && !isOwner && item.is_available;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8 py-4" role="tablist">
            {[
              { id: 'details', label: 'Details' },
              { id: 'availability', label: 'Availability' },
              { id: 'transaction', label: 'Transaction' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {isOwner && (
              <button
                onClick={() => navigate(`/edit-item/${id}`)}
                className="ml-auto py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Edit Listing
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="relative aspect-video bg-gray-100">
                {item.images?.length > 0 ? (
                  <img
                    src={item.images[0].image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-50 text-blue-700">
                    {item.category?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  {item.is_available ? (
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-50 text-green-700">
                      Available
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-50 text-red-700">
                      Unavailable
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h1>
                <p className="text-gray-600 mb-6">{item.description}</p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-500">Tier</p>
                    <p className="text-xl font-bold text-gray-900 capitalize">{item.tier?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Trade Type</p>
                    <p className="text-xl font-bold text-gray-900 capitalize">{item.trade_type?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Credits / Day</p>
                    <p className="text-xl font-bold text-gray-900">{item.time_credits_per_day}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    {item.owner_profile_photo ? (
                      <img src={item.owner_profile_photo} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.owner_name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {item.owner_trust_score ? `${item.owner_trust_score}/100` : 'New Member'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {activeTab === 'details' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Item Details</h2>
                <dl className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-gray-500">Category</dt>
                      <dd className="text-gray-900 capitalize">{item.category?.replace('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Condition</dt>
                      <dd className="text-gray-900">Good</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Description</dt>
                    <dd className="text-gray-900 mt-1 whitespace-pre-wrap">{item.description}</dd>
                  </div>
                  {item.availability_calendar?.length > 0 && (
                    <div>
                      <dt className="text-sm text-gray-500">Unavailable Dates</dt>
                      <dd className="text-gray-900 mt-1">
                        <ul className="list-disc list-inside space-y-1">
                          {item.availability_calendar.map((range, i) => (
                            <li key={i}>{range.start} to {range.end}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {activeTab === 'availability' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability Calendar</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-center py-8">Calendar view coming soon</p>
                </div>
              </div>
            )}

            {activeTab === 'transaction' && transaction && (
              <TransactionPanel
                transaction={transaction}
                item={item}
                isOwner={isOwner}
                qrToken={qrToken}
                showQR={showQR}
                onGenerateQR={handleGenerateQR}
                onScanQR={handleScanQR}
                onCloseQR={() => setShowQR(false)}
              />
            )}
          </div>

          <aside className="space-y-6">
            {canBorrow && !transaction && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Request to Borrow</h3>
                <form onSubmit={handleBorrowRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={borrowDates.from}
                      onChange={(e) => setBorrowDates({ ...borrowDates, from: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      min={borrowDates.from || new Date().toISOString().split('T')[0]}
                      value={borrowDates.to}
                      onChange={(e) => setBorrowDates({ ...borrowDates, to: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Credits / Day</span>
                      <span className="font-medium">{item.time_credits_per_day}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 border-t border-gray-200 pt-2">
                      <span className="font-medium text-gray-900">Total Credits</span>
                      <span className="font-bold text-blue-600">
                        {borrowDates.from && borrowDates.to
                          ? item.time_credits_per_day * (Math.max(1, (new Date(borrowDates.to) - new Date(borrowDates.from)) / (1000 * 60 * 60 * 24) + 1))
                          : 'Select dates'}
                      </span>
                    </div>
                  </div>
                  {borrowError && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{borrowError}</p>
                  )}
                  {borrowSuccess && (
                    <p className="text-sm text-green-600 bg-green-50 p-2 rounded">Request sent! Waiting for lender approval.</p>
                  )}
                  <button
                    type="submit"
                    disabled={borrowLoading || borrowSuccess}
                    className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {borrowLoading ? 'Submitting...' : borrowSuccess ? 'Request Sent' : 'Submit Borrow Request'}
                  </button>
                </form>
              </div>
            )}

            {isOwner && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Owner Actions</h3>
                <div className="space-y-2">
                  <button className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Edit Listing
                  </button>
                  <button className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Manage Availability
                  </button>
                  <button className="w-full py-2 px-4 border border-red-300 rounded-lg text-red-700 hover:bg-red-50">
                    Delete Listing
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>
              <div className="h-48 rounded-lg overflow-hidden">
                <MapContainer center={[item.location.coordinates[1], item.location.coordinates[0]]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <Marker position={[item.location.coordinates[1], item.location.coordinates[0]]} />
                </MapContainer>
              </div>
              <p className="mt-2 text-sm text-gray-500 text-center">Approximate location in Belvedere</p>
            </div>
          </aside>
        </div>
      </main>

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
              Both parties must scan this code to confirm {transaction?.state === 'AGREED' ? 'hand-off' : 'return'}.
            </p>
            <button
              onClick={handleScanQR}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              I've Scanned - Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionPanel({ transaction, item, isOwner, qrToken, showQR, onGenerateQR, onScanQR, onCloseQR }) {
  const stateLabels = {
    PENDING: 'Pending Approval',
    AGREED: 'Agreed - Ready for Hand-off',
    ACTIVE: 'Active - Hand-off Complete',
    ITEM_OUT: 'Item Out with Borrower',
    ITEM_RETURNED: 'Item Returned - Completed',
    CLOSED: 'Completed',
    DISPUTED: 'Disputed',
  };

  const stateColors = {
    PENDING: 'bg-yellow-50 text-yellow-700',
    AGREED: 'bg-blue-50 text-blue-700',
    ACTIVE: 'bg-purple-50 text-purple-700',
    ITEM_OUT: 'bg-orange-50 text-orange-700',
    ITEM_RETURNED: 'bg-green-50 text-green-700',
    CLOSED: 'bg-gray-50 text-gray-700',
    DISPUTED: 'bg-red-50 text-red-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Transaction Status</h2>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${stateColors[transaction.state]}`}>
            {stateLabels[transaction.state] || transaction.state}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Borrower</p>
            <p className="font-medium">{transaction.borrower?.full_name || 'Loading...'}</p>
          </div>
          <div>
            <p className="text-gray-500">Dates</p>
            <p className="font-medium">{transaction.requested_from} to {transaction.requested_to}</p>
          </div>
          <div>
            <p className="text-gray-500">Credits / Day</p>
            <p className="font-medium">{transaction.time_credits_per_day}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Credits</p>
            <p className="font-medium">{transaction.total_time_credits}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {transaction.state === 'PENDING' && isOwner && (
          <button
            onClick={async () => {
              try {
                await transactionsApi.accept(transaction.id);
                window.location.reload();
              } catch (e) { console.error(e); }
            }}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            Accept Request
          </button>
        )}

        {transaction.state === 'AGREED' && !isOwner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 mb-2">Terms agreed. Please activate the transaction to proceed to hand-off.</p>
            <button
              onClick={async () => {
                try {
                  await transactionsApi.activate(transaction.id);
                  window.location.reload();
                } catch (e) { console.error(e); }
              }}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Activate Transaction
            </button>
          </div>
        )}

        {transaction.state === 'AGREED' && isOwner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 mb-2">Waiting for the borrower to confirm terms and activate the transaction.</p>
          </div>
        )}

        {(transaction.state === 'ACTIVE' || transaction.state === 'ITEM_OUT') && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-purple-800 mb-3">
              {transaction.state === 'ACTIVE'
                ? 'Both parties must scan the QR code to confirm hand-off.'
                : 'Both parties must scan the QR code to confirm return.'}
            </p>
            <div className="flex gap-2">
              <button onClick={onGenerateQR} className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">
                Generate QR Code
              </button>
              {showQR && (
                <button onClick={onCloseQR} className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50">
                  Close QR
                </button>
              )}
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

        {transaction.state === 'ITEM_RETURNED' && isOwner && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 mb-2">Item returned. Close transaction to finalize Time Credits.</p>
            <button
              onClick={async () => {
                try {
                  await transactionsApi.close(transaction.id);
                  window.location.reload();
                } catch (e) { console.error(e); }
              }}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Confirm & Close
            </button>
          </div>
        )}

        {transaction.state === 'DISPUTED' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">This transaction is under dispute. An admin will review and resolve.</p>
          </div>
        )}

        {transaction.state === 'CLOSED' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-gray-700">Transaction completed successfully.</p>
            <button className="mt-2 text-blue-600 hover:underline text-sm">Leave a Rating</button>
          </div>
        )}
      </div>
    </div>
  );
}