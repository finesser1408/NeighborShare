import React from 'react';

const CATEGORY_LABELS = {
  tools: 'Tools',
  garden_equipment: 'Garden Equipment',
  kitchen_appliances: 'Kitchen Appliances',
  electronics: 'Electronics',
  sports_equipment: 'Sports Equipment',
  musical_instruments: 'Musical Instruments',
  cameras_photography: 'Cameras & Photography',
  baby_children: 'Baby & Children',
  books_stationery: 'Books & Stationery',
  clothing_accessories: 'Clothing & Accessories',
  furniture: 'Furniture',
  vehicles_transport: 'Vehicles & Transport',
  party_events: 'Party & Events',
  cleaning_equipment: 'Cleaning Equipment',
  medical_health: 'Medical & Health',
  office_equipment: 'Office Equipment',
  outdoor_camping: 'Outdoor & Camping',
  other: 'Other',
};

export default function ItemCard({ item, distance, selected, onClick, onClose }) {
  const trustScoreDisplay = (score) => {
    if (!score || score === 0) return 'New Member';
    if (score > 0 && score < 50) return 'New Member';
    return `${Math.round(score)}/100`;
  };

  return (
    <article
      className={`relative group flex flex-col p-4 rounded-xl border transition-all cursor-pointer ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500/20'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
      onClick={onClick}
      role="listitem"
    >
      {onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="flex gap-3">
        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          {item.images?.[0] ? (
            <img
              src={item.images[0].image}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded-full bg-white/90 backdrop-blur text-gray-700">
            {CATEGORY_LABELS[item.category] || item.category}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 truncate pr-2">{item.title}</h3>
            {distance !== undefined && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {distance.toFixed(1)} km
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {item.owner_name || 'Unknown'}
            </span>
            <span className="flex items-center gap-1 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {trustScoreDisplay(item.owner_trust_score)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900">${item.daily_rate_usd}</span>
          <span className="text-sm text-gray-500">/ day</span>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Deposit: <span className="font-medium text-gray-900">${item.deposit_amount_usd}</span></p>
          <p className="text-xs">~${(item.daily_rate_usd * 7).toFixed(2)}/week</p>
        </div>
      </div>
    </article>
  );
}