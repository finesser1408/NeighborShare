/**
 * Shared category metadata + keyword matching used by the home page,
 * browse page and item cards.
 */
import {
  Wrench, Sprout, Utensils, Laptop, Dumbbell, Music, Camera, Baby, BookOpen,
  Shirt, Sofa, Car, PartyPopper, Sparkles, Stethoscope, Briefcase, Tent, Package,
} from 'lucide-react';

export const CATEGORIES = [
  { value: 'tools', label: 'Tools', icon: Wrench, keywords: ['tool', 'drill', 'hammer', 'screwdriver', 'wrench', 'saw', 'ladder', 'equipment'] },
  { value: 'garden_equipment', label: 'Garden Equipment', icon: Sprout, keywords: ['garden', 'lawn', 'mower', 'hedge', 'shovel', 'rake', 'soil', 'sieve'] },
  { value: 'kitchen_appliances', label: 'Kitchen Appliances', icon: Utensils, keywords: ['kitchen', 'cook', 'blender', 'mixer', 'oven', 'fridge', 'appliance'] },
  { value: 'electronics', label: 'Electronics', icon: Laptop, keywords: ['electronics', 'laptop', 'computer', 'phone', 'tv', 'speaker', 'console', 'charger', 'camera', 'drone', 'gadget'] },
  { value: 'sports_equipment', label: 'Sports Equipment', icon: Dumbbell, keywords: ['sport', 'gym', 'bike', 'bicycle', 'ball', 'tennis', 'football', 'exercise', 'fishing'] },
  { value: 'musical_instruments', label: 'Musical Instruments', icon: Music, keywords: ['music', 'guitar', 'piano', 'keyboard', 'drum', 'violin', 'dj', 'amplifier', 'mic'] },
  { value: 'cameras_photography', label: 'Cameras & Photography', icon: Camera, keywords: ['camera', 'photo', 'photography', 'lens', 'tripod', 'video', 'lighting'] },
  { value: 'baby_children', label: 'Baby & Children', icon: Baby, keywords: ['baby', 'child', 'stroller', 'cot', 'toy', 'kids'] },
  { value: 'books_stationery', label: 'Books & Stationery', icon: BookOpen, keywords: ['book', 'books', 'stationery', 'textbook'] },
  { value: 'clothing_accessories', label: 'Clothing & Accessories', icon: Shirt, keywords: ['clothes', 'clothing', 'shirt', 'dress', 'jacket', 'costume', 'wear'] },
  { value: 'furniture', label: 'Furniture', icon: Sofa, keywords: ['furniture', 'table', 'chair', 'sofa', 'couch', 'bed', 'desk'] },
  { value: 'vehicles_transport', label: 'Vehicles & Transport', icon: Car, keywords: ['vehicle', 'car', 'truck', 'bike', 'trailer', 'scooter', 'transport'] },
  { value: 'party_events', label: 'Party & Events', icon: PartyPopper, keywords: ['party', 'event', 'gazebo', 'tent', 'chairs', 'bouncy', 'decor', 'disco', 'sound'] },
  { value: 'cleaning_equipment', label: 'Cleaning Equipment', icon: Sparkles, keywords: ['clean', 'cleaner', 'vacuum', 'pressure washer', 'carpet', 'steam'] },
  { value: 'medical_health', label: 'Medical & Health', icon: Stethoscope, keywords: ['medical', 'health', 'wheelchair', 'crutch', 'first aid'] },
  { value: 'office_equipment', label: 'Office Equipment', icon: Briefcase, keywords: ['office', 'printer', 'projector', 'laminator', 'whiteboard'] },
  { value: 'outdoor_camping', label: 'Outdoor & Camping', icon: Tent, keywords: ['camp', 'camping', 'tent', 'sleeping', 'hiking', 'backpack', 'bbq'] },
  { value: 'other', label: 'Other', icon: Package, keywords: [] },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export function getCategoryMeta(value) {
  return CATEGORY_MAP[value] || CATEGORY_MAP.other;
}

/**
 * Offline category artwork served from the app's own bundle (frontend/public),
 * so every item renders an image even with no network or uploaded photo.
 */
export function getCategoryPlaceholder(value) {
  const cat = getCategoryMeta(value);
  return `${import.meta.env.BASE_URL}images/categories/${cat.value}.svg`;
}

/**
 * Best-effort match a free-text query to a category using keywords.
 * Returns null when no confident match exists.
 */
export function matchCategory(query) {
  if (!query) return null;
  const q = query.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => q.includes(kw))) return cat.value;
  }
  return null;
}
