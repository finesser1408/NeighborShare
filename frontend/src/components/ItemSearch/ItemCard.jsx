import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, BadgeCheck, X } from 'lucide-react';
import { getCategoryMeta } from '../../utils/categories';
import { formatTrustScore } from '../../utils/formatters';
import ItemImage from '../ItemImage';

function OwnerAvatar({ name, photo }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700">
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-bold uppercase">{(name || 'U').slice(0, 2)}</span>
      )}
    </span>
  );
}

function ImageBlock({ item }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
      <ItemImage
        item={item}
        alt={item.title}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur">
        {getCategoryMeta(item.category).label}
      </span>
      {!item.is_available && (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          Unavailable
        </span>
      )}
      <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition group-hover:opacity-100">
        <span className="mb-3 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold text-gray-900 shadow">
          View item →
        </span>
      </div>
    </div>
  );
}

export default function ItemCard({ item, distance, selected, onClose, compact }) {
  const navigate = useNavigate();
  const meta = getCategoryMeta(item.category);
  const open = (e) => {
    if (e) e.stopPropagation();
    navigate(`/items/${item.id}`);
  };

  if (compact) {
    return (
      <article
        className={`group flex cursor-pointer gap-3 rounded-2xl border p-3 transition hover:shadow-card-hover ${
          selected ? 'border-brand-300 bg-brand-50/50' : 'border-gray-100 bg-white shadow-card hover:border-gray-200'
        }`}
        onClick={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
        role="button"
        tabIndex={0}
        aria-label={`View ${item.title}`}
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          <ItemImage item={item} alt={item.title} className="h-full w-full object-cover" />
          {onClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-gray-500 shadow-sm hover:text-gray-800"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">{item.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.description}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-base font-bold text-gray-900">{item.time_credits_per_day}</span>
            <span className="text-xs text-gray-500">Credits/day</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
            {distance !== undefined && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {Number(distance).toFixed(1)} km
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <OwnerAvatar name={item.owner_name} photo={item.owner_profile_photo} />
              <span className="truncate">{item.owner_name || 'Member'}</span>
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group card cursor-pointer overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-card-hover ${
        selected ? 'border-brand-300 ring-2 ring-brand-500/20' : ''
      }`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      role="button"
      tabIndex={0}
      aria-label={item.title}
    >
      <ImageBlock item={item} />
      <div className="p-4">
        <h3 className="line-clamp-1 text-[15px] font-bold text-gray-900 group-hover:text-brand-700 transition">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">{item.description}</p>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold tracking-tight text-gray-900">{item.time_credits_per_day}</span>
            <span className="text-xs font-medium text-gray-500">Credits/day</span>
          </div>
          {distance !== undefined && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              <MapPin className="h-3.5 w-3.5 text-brand-600" />
              {Number(distance).toFixed(1)} km away
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <OwnerAvatar name={item.owner_name} photo={item.owner_profile_photo} />
          <span className="truncate text-sm font-medium text-gray-700">{item.owner_name || 'Community member'}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
            <BadgeCheck className="h-3.5 w-3.5" />
            {formatTrustScore(item.owner_trust_score)}
          </span>
        </div>
      </div>
    </article>
  );
}
