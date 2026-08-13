import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { CheckCircle2 } from 'lucide-react';
import { transactionsApi } from '../../api';

const ratingSchema = yup.object().shape({
  item_condition: yup.number().required('Required').min(1).max(5),
  communication: yup.number().required('Required').min(1).max(5),
  punctuality: yup.number().required('Required').min(1).max(5),
});

export default function RatingForm({ transaction, onSubmitted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: yupResolver(ratingSchema),
    defaultValues: { item_condition: 0, communication: 0, punctuality: 0 },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      await transactionsApi.rating(transaction.id, data);
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ name, label, value }) => (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setValue(name, star, { shouldValidate: true })}
            className={`text-3xl transition ${
              star <= value ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'
            }`}
            aria-label={`${label} ${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      {errors[name] && <p className="mt-1 text-sm text-red-600">{errors[name].message}</p>}
    </div>
  );

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h3 className="mt-2 text-lg font-bold text-emerald-800">Rating Submitted!</h3>
        <p className="text-sm text-emerald-700">Thank you for your feedback — it helps the community.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <StarRating name="item_condition" label="Item Condition" value={watch('item_condition')} />
      <StarRating name="communication" label="Communication" value={watch('communication')} />
      <StarRating name="punctuality" label="Punctuality" value={watch('punctuality')} />

      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? 'Submitting...' : 'Submit Rating'}
      </button>
    </form>
  );
}
