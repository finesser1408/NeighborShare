import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { itemsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const itemSchema = yup.object().shape({
  title: yup.string().required('Title is required').min(3).max(120),
  description: yup.string().required('Description is required').min(10),
  category: yup.string().required('Category is required'),
  listing_type: yup.string().required('Listing type is required'),
  tier: yup.string().required('Tier is required'),
  trade_type: yup.string().required('Trade type is required'),
  trade_request_details: yup.string().when('trade_type', {
    is: 'specific_trade',
    then: yup.string().required('Trade request details are required for specific trades'),
    otherwise: yup.string(),
  }),
  time_credits_per_day: yup.number().required('Time credits per day is required').min(1).max(100),
});

const CATEGORIES = [
  { value: 'tools', label: 'Tools' },
  { value: 'garden_equipment', label: 'Garden Equipment' },
  { value: 'kitchen_appliances', label: 'Kitchen Appliances' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'sports_equipment', label: 'Sports Equipment' },
  { value: 'musical_instruments', label: 'Musical Instruments' },
  { value: 'cameras_photography', label: 'Cameras & Photography' },
  { value: 'baby_children', label: 'Baby & Children' },
  { value: 'books_stationery', label: 'Books & Stationery' },
  { value: 'clothing_accessories', label: 'Clothing & Accessories' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'vehicles_transport', label: 'Vehicles & Transport' },
  { value: 'party_events', label: 'Party & Events' },
  { value: 'cleaning_equipment', label: 'Cleaning Equipment' },
  { value: 'medical_health', label: 'Medical & Health' },
  { value: 'office_equipment', label: 'Office Equipment' },
  { value: 'outdoor_camping', label: 'Outdoor & Camping' },
  { value: 'other', label: 'Other' },
];

const TIERS = [
  { value: 'tier_1', label: 'Tier 1 - Small Exchanges (under 30 min)' },
  { value: 'tier_2', label: 'Tier 2 - Medium Exchanges (1-2 hours)' },
  { value: 'tier_3', label: 'Tier 3 - Large Exchanges (specialized/heavy)' },
];

const TRADE_TYPES = [
  { value: 'specific_trade', label: 'Specific Trade Request' },
  { value: 'open_offer', label: 'Open to Offers' },
  { value: 'community_credit', label: 'Community Credit Only' },
];

const LISTING_TYPES = [
  { value: 'item', label: 'Physical Item' },
  { value: 'service', label: 'Skill/Service' },
];

export default function CreateItem() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(itemSchema),
    defaultValues: {
      category: 'tools',
      listing_type: 'item',
      tier: 'tier_1',
      trade_type: 'open_offer',
      time_credits_per_day: 1,
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/create-listing' } });
      return;
    }
    if (id) {
      setIsEditing(true);
      loadItem();
    }
  }, [isAuthenticated, navigate, id]);

  const loadItem = async () => {
    try {
      const response = await itemsApi.get(id);
      const item = response.data;
      reset({
        title: item.title,
        description: item.description,
        category: item.category,
        listing_type: item.listing_type,
        tier: item.tier,
        trade_type: item.trade_type,
        trade_request_details: item.trade_request_details,
        time_credits_per_day: item.time_credits_per_day,
      });
      if (item.images) {
        setImagePreviews(item.images.map(img => img.image));
      }
    } catch (err) {
      setError('Failed to load item');
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 6) {
      setError('Maximum 6 images allowed');
      return;
    }
    const validFiles = files.filter(f => f.size <= 5 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      setError('Some images exceed 5MB limit');
    }
    setImages(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      // Pass data with images to API layer which handles FormData conversion
      const payload = { ...data, images };
      console.log('Creating item with payload:', payload);
      
      if (isEditing) {
        const response = await itemsApi.update(id, payload);
        console.log('Update response:', response.data);
      } else {
        const response = await itemsApi.create(payload);
        console.log('Create response:', response.data);
      }
      navigate('/my-listings');
    } catch (err) {
      console.error('Error saving item:', err);
      setError(err.response?.data?.error?.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{isEditing ? 'Edit Item' : 'Create New Listing'}</h1>
          <p className="text-gray-600 mt-1">Fill in the details below to {isEditing ? 'update' : 'list'} your item</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              {...register('title')}
              type="text"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="e.g., Cordless Power Drill"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              {...register('description')}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Describe the item's condition, features, and any important details..."
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              {...register('category')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.category ? 'border-red-500' : 'border-gray-300'}`}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type *</label>
            <select
              {...register('listing_type')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.listing_type ? 'border-red-500' : 'border-gray-300'}`}
            >
              {LISTING_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {errors.listing_type && <p className="mt-1 text-sm text-red-600">{errors.listing_type.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier *</label>
            <select
              {...register('tier')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.tier ? 'border-red-500' : 'border-gray-300'}`}
            >
              {TIERS.map(tier => (
                <option key={tier.value} value={tier.value}>{tier.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Tier 1: Small items/favours (under 30min) | Tier 2: Medium items/work (1-2hrs) | Tier 3: Large/specialized items</p>
            {errors.tier && <p className="mt-1 text-sm text-red-600">{errors.tier.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trade Type *</label>
            <select
              {...register('trade_type')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.trade_type ? 'border-red-500' : 'border-gray-300'}`}
            >
              {TRADE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {errors.trade_type && <p className="mt-1 text-sm text-red-600">{errors.trade_type.message}</p>}
          </div>

          {watch('trade_type') === 'specific_trade' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trade Request Details *</label>
              <textarea
                {...register('trade_request_details')}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.trade_request_details ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Describe exactly what you want in return (e.g., 'Looking for lawn mowing in exchange for these clothes')"
              />
              {errors.trade_request_details && <p className="mt-1 text-sm text-red-600">{errors.trade_request_details.message}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Credits Per Day *</label>
            <input
              {...register('time_credits_per_day', { valueAsNumber: true })}
              type="number"
              step="1"
              min="1"
              max="100"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.time_credits_per_day ? 'border-red-500' : 'border-gray-300'}`}
            />
            <p className="mt-1 text-xs text-gray-500">Community Time Credits earned per day of lending (1-100)</p>
            {errors.time_credits_per_day && <p className="mt-1 text-sm text-red-600">{errors.time_credits_per_day.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Images (Max 6, 5MB each)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden">
                  <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs text-gray-500 mt-1">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-500">Drag & drop or click to upload. Max 6 images, 5MB each.</p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Listing' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}