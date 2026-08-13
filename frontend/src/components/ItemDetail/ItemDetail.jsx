import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { itemsApi, transactionsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'qrcode.react';
import L from 'leaflet';
import {
  ArrowLeft, BadgeCheck, CalendarDays, Clock, MapPin, Pencil, ShieldCheck,
  X, CheckCircle2, Info,
} from 'lucide-react';
import { getCategoryMeta } from '../../utils/categories';
import { formatTrustScore } from '../../utils/formatters';

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
  const [activeImage, setActiveImage] = useState(0);
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

  const totalCredits = useMemo(() => {
    if (!borrowDates.from || !borrowDates.to || !item) return null;
    const days = Math.max(1, Math.round((new Date(borrowDates.to) - new Date(borrowDates.from)) / (1000 * 60 * 60 * 24)) + 1);
    return item.time_credits_per_day * days;
  }, [borrowDates, item]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF8] px-4 text-center">
        <Info className="h-12 w-12 text-gray-300" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Item Not Found</h1>
        <button onClick={() => navigate('/browse')} className="btn-primary mt-6">
          Back to Browse
        </button>
      </div>
    );
  }

  const isOwner = user && item.owner === user.id;
  const canBorrow = user && !isOwner && item.is_available;
  const meta = getCategoryMeta(item.category);
  const images = item.images || [];

  return (
    <div className="bg-[#FAFAF8]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link to="/browse" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" />
            Back to browse
          </Link>
          {isOwner && (
            <button
              onClick={() => navigate(`/edit-item/${id}`)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" /> Edit Listing
            </button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ============ LEFT: gallery + info ============ */}
          <div className="space-y-6 lg:col-span-2">
            <div className="card overflow-hidden">
              <div className="relative aspect-video bg-gray-100">
                {images[activeImage] ? (
                  <img src={images[activeImage].image} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur">
                  {meta.label}
                </span>
                {item.is_available ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Available
                  </span>
                ) : (
                  <span className="absolute right-3 top-3 rounded-full bg-gray-900/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                    Unavailable
                  </span>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 border-t border-gray-100 p-3">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`h-16 w-20 overflow-hidden rounded-lg border-2 transition ${
                        activeImage === i ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.image} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="p-6">
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{item.title}</h1>
                <p className="mt-3 whitespace-pre-wrap text-gray-600">{item.description}</p>

                <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <dt className="text-xs font-medium text-gray-500">Tier</dt>
                    <dd className="mt-1 font-bold text-gray-900 capitalize">{item.tier?.replace('_', ' ')}</dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <dt className="text-xs font-medium text-gray-500">Trade Type</dt>
                    <dd className="mt-1 font-bold text-gray-900 capitalize">{item.trade_type?.replace('_', ' ')}</dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <dt className="text-xs font-medium text-gray-500">Credits / Day</dt>
                    <dd className="mt-1 font-bold text-gray-900">{item.time_credits_per_day}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Owner card */}
            <div className="card flex flex-wrap items-center gap-4 p-5">
              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700">
                {item.owner_profile_photo ? (
                  <img src={item.owner_profile_photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold uppercase">{(item.owner_name || 'U').slice(0, 2)}</span>
                )}
              </span>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{item.owner_name}</p>
                <p className="flex items-center gap-1 text-sm text-gray-500">
                  <BadgeCheck className="h-4 w-4 text-brand-600" />
                  Trust score: {formatTrustScore(item.owner_trust_score)}
                </p>
              </div>
              <Link to={`/users/${item.owner}/profile`} className="btn-secondary">
                View profile
              </Link>
            </div>

            {/* Tabs */}
            <div className="card overflow-hidden">
              <div className="flex gap-6 border-b border-gray-100 px-6" role="tablist">
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
                    className={`-mb-px border-b-2 py-4 text-sm font-semibold transition ${
                      activeTab === tab.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'details' && (
                  <dl className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-gray-500">Category</dt>
                        <dd className="mt-0.5 font-medium text-gray-900 capitalize">{item.category?.replace('_', ' ')}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Condition</dt>
                        <dd className="mt-0.5 font-medium text-gray-900">Good</dd>
                      </div>
                    </div>
                    {item.availability_calendar?.length > 0 && (
                      <div>
                        <dt className="text-gray-500">Unavailable dates</dt>
                        <dd className="mt-1">
                          <ul className="list-inside list-disc space-y-1 text-gray-900">
                            {item.availability_calendar.map((range, i) => (
                              <li key={i}>{range.start} to {range.end}</li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {activeTab === 'availability' && (
                  <div className="rounded-xl bg-gray-50 p-8 text-center">
                    <CalendarDays className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">Calendar view coming soon</p>
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
            </div>
          </div>

          {/* ============ RIGHT: sticky action card ============ */}
          <div className="space-y-6">
            <div className="card sticky top-36 p-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-gray-900">{item.time_credits_per_day}</span>
                <span className="text-sm font-medium text-gray-500">Credits / day</span>
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-xs font-semibold text-brand-800">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Escrow-protected — both parties are covered
              </div>

              {canBorrow && !transaction && (
                <form onSubmit={handleBorrowRequest} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">Start date</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={borrowDates.from}
                      onChange={(e) => setBorrowDates({ ...borrowDates, from: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">End date</label>
                    <input
                      type="date"
                      min={borrowDates.from || new Date().toISOString().split('T')[0]}
                      value={borrowDates.to}
                      onChange={(e) => setBorrowDates({ ...borrowDates, to: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Credits / day</span>
                      <span className="font-semibold">{item.time_credits_per_day}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
                      <span className="font-semibold text-gray-900">Total credits</span>
                      <span className="font-bold text-brand-700">{totalCredits ?? 'Select dates'}</span>
                    </div>
                  </div>

                  {borrowError && (
                    <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700" role="alert">{borrowError}</p>
                  )}
                  {borrowSuccess && (
                    <p className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">
                      Request sent! Waiting for lender approval.
                    </p>
                  )}

                  <button type="submit" disabled={borrowLoading || borrowSuccess} className="btn-primary w-full py-3">
                    {borrowLoading ? 'Submitting...' : borrowSuccess ? 'Request Sent ✓' : 'Request to borrow'}
                  </button>
                </form>
              )}

              {canBorrow && transaction && (
                <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  Your request has been sent to {item.owner_name}. You can track it in
                  <Link to="/my-transactions" className="font-semibold underline"> My Transactions</Link>.
                </div>
              )}

              {!isAuthenticated && item.is_available && (
                <button onClick={() => navigate('/login', { state: { from: `/items/${id}` } })} className="btn-primary mt-5 w-full py-3">
                  Sign in to request
                </button>
              )}

              {isOwner && (
                <div className="mt-5 space-y-2">
                  <button onClick={() => navigate(`/edit-item/${id}`)} className="btn-secondary w-full">
                    <Pencil className="h-4 w-4" /> Edit Listing
                  </button>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand-600" /> Belvedere area</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Flexible hours</span>
              </div>
            </div>

            {/* Location */}
            <div className="card overflow-hidden">
              <div className="h-48 bg-gray-100">
                {item.location?.coordinates && (
                  <MapContainer
                    center={[item.location.coordinates[1], item.location.coordinates[0]]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <Marker position={[item.location.coordinates[1], item.location.coordinates[0]]} />
                  </MapContainer>
                )}
              </div>
              <p className="px-4 py-3 text-center text-xs text-gray-500">
                Approximate location in Belvedere — exact address shared after approval
              </p>
            </div>
          </div>
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
              Both parties must scan this code to confirm {transaction?.state === 'AGREED' ? 'hand-off' : 'return'}.
            </p>
            <button onClick={handleScanQR} className="btn-primary w-full py-3">
              I've Scanned — Confirm
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
    PENDING: 'bg-amber-50 text-amber-700',
    AGREED: 'bg-brand-50 text-brand-700',
    ACTIVE: 'bg-violet-50 text-violet-700',
    ITEM_OUT: 'bg-orange-50 text-orange-700',
    ITEM_RETURNED: 'bg-emerald-50 text-emerald-700',
    CLOSED: 'bg-gray-100 text-gray-600',
    DISPUTED: 'bg-red-50 text-red-700',
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">Transaction Status</h2>
        <span className={`badge ${stateColors[transaction.state] || 'bg-gray-100 text-gray-600'}`}>
          {stateLabels[transaction.state] || transaction.state}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-gray-500">Borrower</p><p className="font-semibold text-gray-900">{transaction.borrower?.full_name || 'Loading...'}</p></div>
        <div><p className="text-gray-500">Dates</p><p className="font-semibold text-gray-900">{transaction.requested_from} to {transaction.requested_to}</p></div>
        <div><p className="text-gray-500">Credits / Day</p><p className="font-semibold text-gray-900">{transaction.time_credits_per_day}</p></div>
        <div><p className="text-gray-500">Total Credits</p><p className="font-semibold text-gray-900">{transaction.total_time_credits}</p></div>
      </div>

      <div className="mt-5 space-y-3">
        {transaction.state === 'PENDING' && isOwner && (
          <button
            onClick={async () => {
              try { await transactionsApi.accept(transaction.id); window.location.reload(); } catch (e) { console.error(e); }
            }}
            className="btn-primary w-full py-3 bg-emerald-600 hover:bg-emerald-700"
          >
            Accept Request
          </button>
        )}

        {transaction.state === 'AGREED' && !isOwner && (
          <div className="rounded-xl bg-brand-50 p-4">
            <p className="mb-2 text-sm text-brand-800">Terms agreed. Please activate the transaction to proceed to hand-off.</p>
            <button
              onClick={async () => {
                try { await transactionsApi.activate(transaction.id); window.location.reload(); } catch (e) { console.error(e); }
              }}
              className="btn-primary w-full py-2.5"
            >
              Activate Transaction
            </button>
          </div>
        )}

        {transaction.state === 'AGREED' && isOwner && (
          <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
            Waiting for the borrower to confirm terms and activate the transaction.
          </div>
        )}

        {(transaction.state === 'ACTIVE' || transaction.state === 'ITEM_OUT') && (
          <div className="rounded-xl bg-violet-50 p-4">
            <p className="mb-3 text-sm text-violet-800">
              {transaction.state === 'ACTIVE'
                ? 'Both parties must scan the QR code to confirm hand-off.'
                : 'Both parties must scan the QR code to confirm return.'}
            </p>
            <div className="flex gap-2">
              <button onClick={onGenerateQR} className="btn-primary flex-1 py-2.5 bg-violet-600 hover:bg-violet-700">Generate QR Code</button>
              {showQR && (
                <button onClick={onCloseQR} className="btn-secondary px-4 py-2.5 border-violet-300 text-violet-700">Close QR</button>
              )}
            </div>
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

        {transaction.state === 'ITEM_RETURNED' && isOwner && (
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="mb-2 text-sm text-emerald-800">Item returned. Close transaction to finalize Time Credits.</p>
            <button
              onClick={async () => {
                try { await transactionsApi.close(transaction.id); window.location.reload(); } catch (e) { console.error(e); }
              }}
              className="btn-primary w-full py-2.5 bg-emerald-600 hover:bg-emerald-700"
            >
              Confirm & Close
            </button>
          </div>
        )}

        {transaction.state === 'DISPUTED' && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
            This transaction is under dispute. An admin will review and resolve.
          </div>
        )}

        {transaction.state === 'CLOSED' && (
          <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-600">
            Transaction completed successfully.
          </div>
        )}
      </div>
    </div>
  );
}
