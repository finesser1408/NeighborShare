import React, { useState } from 'react';
import { getCategoryPlaceholder } from '../utils/categories';

/**
 * Item photo that always renders something:
 *  - shows the first uploaded image when present,
 *  - falls back to an offline, category-themed SVG bundled with the app
 *    when the item has no photo, or when the photo fails to load
 *    (e.g. the media file was deleted or the network is unavailable).
 *
 * Pass `src` to override the primary image (e.g. gallery thumbnails).
 */
export default function ItemImage({ item, src, className = '', alt = '', loading = 'lazy', style }) {
  const primary = src || item.images?.[0]?.image;
  const [useFallback, setUseFallback] = useState(!primary);
  const imageSrc = useFallback || !primary ? getCategoryPlaceholder(item.category) : primary;

  return (
    <img
      src={imageSrc}
      alt={alt || item.title || ''}
      loading={loading}
      className={className}
      style={style}
      onError={() => {
        if (primary && !useFallback) setUseFallback(true);
      }}
    />
  );
}
