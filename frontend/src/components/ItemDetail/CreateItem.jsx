import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ArrowLeft, ImagePlus, X, Info, UploadCloud } from 'lucide-react';
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
        setImagePreviews(item.images.map((img) => img.image));
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
    const validFiles = files.filter((f) => f.size <= 5 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      setError('Some images exceed 5MB limit');
    }
    setImages((prev) => [...prev, ...validFiles]);
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews((prev) => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const payload = { ...data, images };
      if (isEditing) {
        await itemsApi.update(id, payload);
      } else {
        await itemsApi.create(payload);
      }
      navigate('/my-listings');
    } catch (err) {
      console.error('Error saving item:', err);
      setError(err.response?.data?.error?.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (hasError) =>
    `input-field ${hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`;

  return (
    <div className="bg-[#FAFAF8] py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-8">
          <Link to="/my-listings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> Back to my listings
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {isEditing ? 'Edit your listing' : 'Create a new listing'}
          </h1>
          <p className="mt-1.5 text-gray-500">
            {isEditing ? 'Update the details of your item below.' : 'Fill in the details below to start lending to your neighbours.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-8 p-6 sm:p-8" noValidate>
          {/* Basic info */}
          <section className="space-y-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">1</span>
              About your item
            </h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Title *</label>
              <input
                {...register('title')}
                type="text"
                className={fieldClass(errors.title)}
                placeholder="e.g., Cordless Power Drill"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Description *</label>
              <textarea
                {...register('description')}
                rows={4}
                className={fieldClass(errors.description)}
                placeholder="Describe the item's condition, features, and any important details..."
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Category *</label>
                <select {...register('category')} className={fieldClass(errors.category)}>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Listing type *</label>
                <select {...register('listing_type')} className={fieldClass(errors.listing_type)}>
                  {LISTING_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {errors.listing_type && <p className="mt-1 text-sm text-red-600">{errors.listing_type.message}</p>}
              </div>
            </div>
          </section>

          {/* Exchange details */}
          <section className="space-y-5 border-t border-gray-100 pt-8">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">2</span>
              Exchange details
            </h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tier *</label>
              <select {...register('tier')} className={fieldClass(errors.tier)}>
                {TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>{tier.label}</option>
                ))}
              </select>
              <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Tier 1: Small items/favours (under 30min) · Tier 2: Medium items/work (1–2hrs) · Tier 3: Large/specialized items
              </p>
              {errors.tier && <p className="mt-1 text-sm text-red-600">{errors.tier.message}</p>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Trade type *</label>
                <select {...register('trade_type')} className={fieldClass(errors.trade_type)}>
                  {TRADE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {errors.trade_type && <p className="mt-1 text-sm text-red-600">{errors.trade_type.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Time credits per day *</label>
                <input
                  {...register('time_credits_per_day', { valueAsNumber: true })}
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  className={fieldClass(errors.time_credits_per_day)}
                />
                <p className="mt-1.5 text-xs text-gray-500">Community Time Credits earned per day of lending (1–100)</p>
                {errors.time_credits_per_day && <p className="mt-1 text-sm text-red-600">{errors.time_credits_per_day.message}</p>}
              </div>
            </div>

            {watch('trade_type') === 'specific_trade' && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Trade request details *</label>
                <textarea
                  {...register('trade_request_details')}
                  rows={3}
                  className={fieldClass(errors.trade_request_details)}
                  placeholder="Describe exactly what you want in return (e.g., 'Looking for lawn mowing in exchange for these clothes')"
                />
                {errors.trade_request_details && <p className="mt-1 text-sm text-red-600">{errors.trade_request_details.message}</p>}
              </div>
            )}
          </section>

          {/* Photos */}
          <section className="space-y-4 border-t border-gray-100 pt-8">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">3</span>
              Photos
            </h2>

            <div className="flex flex-wrap gap-3">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-gray-200">
                  <img src={preview} alt={`Preview ${index}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={`Remove image ${index + 1}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {images.length < 6 && (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600">
                  <UploadCloud className="h-6 w-6" />
                  <span className="text-xs font-medium">Add photo</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="sr-only" />
                </label>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <ImagePlus className="h-3.5 w-3.5" />
              Up to 6 photos, 5MB each. Good photos get more borrow requests.
            </p>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
            <Link to="/my-listings" className="btn-secondary justify-center">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary justify-center py-3">
              {loading ? 'Saving...' : isEditing ? 'Update Listing' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
