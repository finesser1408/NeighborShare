/**
 * Shared formatting utilities used across the app.
 */

export const CATEGORY_LABELS = {
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

export const TRANSACTION_STATE_LABELS = {
  PENDING: 'Pending Approval',
  AGREED: 'Agreed - Ready for Hand-off',
  ACTIVE: 'Active - Hand-off Complete',
  ITEM_OUT: 'Item Out with Borrower',
  ITEM_RETURNED: 'Item Returned - Completed',
  CLOSED: 'Completed',
  DISPUTED: 'Disputed',
};

export const TRANSACTION_STATE_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  AGREED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-purple-100 text-purple-800',
  ITEM_OUT: 'bg-orange-100 text-orange-800',
  ITEM_RETURNED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  DISPUTED: 'bg-red-100 text-red-800',
};

/**
 * Format a trust score value for display.
 */
export function formatTrustScore(score) {
  if (!score || score === 0) return 'New Member';
  return `${Math.round(score)}/100`;
}

/**
 * Calculate the number of days between two date strings.
 */
export function daysBetween(from, to) {
  if (!from || !to) return 0;
  const ms = new Date(to) - new Date(from);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Format a date string to a readable local date.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a datetime string to a readable local datetime.
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
