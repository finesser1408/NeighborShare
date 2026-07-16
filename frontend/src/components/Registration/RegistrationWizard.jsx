import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const step1Schema = yup.object().shape({
  full_name: yup.string().required('Full name is required').min(2, 'Name too short'),
  email: yup.string().required('Email is required').email('Invalid email format'),
  password: yup.string().required('Password is required').min(8, 'Password must be at least 8 characters'),
  confirm_password: yup.string().required('Please confirm your password').oneOf([yup.ref('password')], 'Passwords do not match'),
});

const step2Schema = yup.object().shape({
  national_id: yup.string().required('National ID is required').matches(/^\d{2}-\d{6,7}[A-Z]\d{2}$/, 'Invalid format. Use: XX-XXXXXXXA00'),
  selfie: yup.mixed().notRequired(),
});

const step3Schema = yup.object().shape({
  street_address: yup.string().required('Street address is required').min(10, 'Please provide a complete address'),
});

const STEPS = [
  { id: 1, title: 'Account Details', description: 'Create your account' },
  { id: 2, title: 'ID Verification', description: 'Verify your National ID' },
  { id: 3, title: 'Address', description: 'Confirm your Belvedere address' },
];

export default function RegistrationWizard() {
  const { register, verifyId, verifyAddress } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [geocodeResult, setGeocodeResult] = useState(null);
  const [showMapPreview, setShowMapPreview] = useState(false);

  const step1Methods = useForm({ resolver: yupResolver(step1Schema), mode: 'onBlur' });
  const step2Methods = useForm({ resolver: yupResolver(step2Schema), mode: 'onBlur' });
  const step3Methods = useForm({ resolver: yupResolver(step3Schema), mode: 'onBlur' });

  const handleStep1Submit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await register(data);
      setStep1Data({ user_id: response.user_id });
      setStep(2);
    } catch (err) {
      console.error('Registration error:', err.response?.data);
      const errors = err.response?.data;
      if (errors) {
        if (errors.email) {
          setError(errors.email[0] || 'Email error');
        } else if (errors.password) {
          setError(errors.password[0] || 'Password error');
        } else if (errors.confirm_password) {
          setError(errors.confirm_password[0] || 'Password confirmation error');
        } else if (errors.full_name) {
          setError(errors.full_name[0] || 'Name error');
        } else if (errors.non_field_errors) {
          setError(errors.non_field_errors[0]);
        } else {
          setError('Registration failed. Please check your input.');
        }
      } else {
        setError(err.response?.data?.error?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('user_id', step1Data.user_id);
      formData.append('national_id', data.national_id);
      if (data.selfie) formData.append('selfie', data.selfie[0]);

      await verifyId(formData);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.national_id?.[0] || 'ID verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeocode = async (address) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Belvedere, Harare, Zimbabwe')}&format=json&limit=1`,
        { headers: { 'User-Agent': 'NeighbourShare/1.0' } }
      );
      const data = await response.json();
      if (data.length > 0) {
        setGeocodeResult({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          display_name: data[0].display_name,
        });
        setShowMapPreview(true);
      } else {
        setError('Could not find this address. Please check and try again.');
      }
    } catch {
      setError('Geocoding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async (data) => {
    if (!geocodeResult) {
      await handleGeocode(data.street_address);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyAddress({
        user_id: step1Data.user_id,
        street_address: data.street_address,
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Address verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <form onSubmit={step1Methods.handleSubmit(handleStep1Submit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                {...step1Methods.register('full_name')}
                type="text"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${step1Methods.formState.errors.full_name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="John Doe"
              />
              {step1Methods.formState.errors.full_name && (
                <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.full_name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                {...step1Methods.register('email')}
                type="email"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${step1Methods.formState.errors.email ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="john@example.com"
              />
              {step1Methods.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                {...step1Methods.register('password')}
                type="password"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${step1Methods.formState.errors.password ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="••••••••"
              />
              {step1Methods.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                {...step1Methods.register('confirm_password')}
                type="password"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${step1Methods.formState.errors.confirm_password ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="••••••••"
              />
              {step1Methods.formState.errors.confirm_password && (
                <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.confirm_password.message}</p>
              )}
            </div>
          </form>
        );
      case 2:
        return (
          <form onSubmit={step2Methods.handleSubmit(handleStep2Submit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
              <input
                {...step2Methods.register('national_id')}
                type="text"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${step2Methods.formState.errors.national_id ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="12-345678A90"
              />
              {step2Methods.formState.errors.national_id && (
                <p className="mt-1 text-sm text-red-600">{step2Methods.formState.errors.national_id.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Format: XX-XXXXXXXA00 (e.g., 12-345678A90)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selfie (Optional)</label>
              <input
                {...step2Methods.register('selfie')}
                type="file"
                accept="image/*"
                className={`w-full px-3 py-2 border rounded-lg ${step2Methods.formState.errors.selfie ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
          </form>
        );
      case 3:
        return (
          <form onSubmit={step3Methods.handleSubmit(handleStep3Submit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                {...step3Methods.register('street_address')}
                type="text"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${step3Methods.formState.errors.street_address ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="123 Main Street, Belvedere"
              />
              {step3Methods.formState.errors.street_address && (
                <p className="mt-1 text-sm text-red-600">{step3Methods.formState.errors.street_address.message}</p>
              )}
            </div>

            {showMapPreview && geocodeResult && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Confirm Your Location</h4>
                <p className="text-sm text-gray-600 mb-3">{geocodeResult.display_name}</p>
                <div className="h-48 rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${geocodeResult.lng - 0.01}%2C${geocodeResult.lat - 0.01}%2C${geocodeResult.lng + 0.01}%2C${geocodeResult.lat + 0.01}&layer=mapnik&marker=${geocodeResult.lat}%2C${geocodeResult.lng}`}
                    allowFullScreen
                  ></iframe>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">Is this your correct location?</p>
              </div>
            )}
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition ${
                    i + 1 < step ? 'bg-blue-600 text-white' :
                    i + 1 === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {i + 1 < step ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (i + 1)}
                  </div>
                  <span className={`mt-1 text-xs font-medium ${i + 1 <= step ? 'text-blue-600' : 'text-gray-400'}`}>
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${i + 1 < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}

        <div className="mb-6">{renderStep()}</div>

        <div className="flex justify-between">
          <button
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1 || loading}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={() => {
              if (step === 1) step1Methods.handleSubmit(handleStep1Submit)();
              else if (step === 2) step2Methods.handleSubmit(handleStep2Submit)();
              else if (step === 3) step3Methods.handleSubmit(handleStep3Submit)();
            }}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : step === 3 ? 'Complete Registration' : 'Continue'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:underline font-medium">Sign in</a>
        </p>
      </div>
    </div>
  );
}