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
  daily_rate_usd: yup.number().required('Daily rate is required').min(0.01),
  deposit_amount_usd: yup.number().required('Deposit is required').min(0),
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
      daily_rate_usd: 1,
      deposit_amount_usd: 10,
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
        daily_rate_usd: item.daily_rate_usd,
        deposit_amount_usd: item.deposit_amount_usd,
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Rate (USD) *</label>
              <input
                {...register('daily_rate_usd', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.daily_rate_usd ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.daily_rate_usd && <p className="mt-1 text-sm text-red-600">{errors.daily_rate_usd.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (USD) *</label>
              <input
                {...register('deposit_amount_usd', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.deposit_amount_usd ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.deposit_amount_usd && <p className="mt-1 text-sm text-red-600">{errors.deposit_amount_usd.message}</p>}
            </div>
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