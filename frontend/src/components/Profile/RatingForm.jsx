import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => setValue(name, star, { shouldValidate: true })}
            className={`text-2xl ${star <= value ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition`}
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
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <svg className="mx-auto h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-green-800">Rating Submitted!</h3>
        <p className="text-sm text-green-700">Thank you for your feedback.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}

      <StarRating name="item_condition" label="Item Condition" value={watch('item_condition')} />
      <StarRating name="communication" label="Communication" value={watch('communication')} />
      <StarRating name="punctuality" label="Punctuality" value={watch('punctuality')} />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Rating'}
      </button>
    </form>
  );
}