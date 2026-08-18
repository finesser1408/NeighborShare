import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, ArrowRight, ShieldCheck, MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const step1Schema = yup.object().shape({
  full_name: yup.string().required('Full name is required').min(2, 'Name too short'),
  email: yup.string().required('Email is required').email('Invalid email format'),
  password: yup.string().required('Password is required').min(8, 'Password must be at least 8 characters'),
  confirm_password: yup.string().required('Please confirm your password').oneOf([yup.ref('password')], 'Passwords do not match'),
});

const step2Schema = yup.object().shape({
  code: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d{6}$/, 'Code must be 6 digits'),
});

const step3Schema = yup.object().shape({
  national_id: yup.string().required('National ID is required').matches(/^\d{2}-\d{6,7}[A-Z]\d{2}$/, 'Invalid format. Use: XX-XXXXXXXA00'),
  selfie: yup.mixed().notRequired(),
});

const step4Schema = yup.object().shape({
  street_address: yup.string().required('Street address is required').min(10, 'Please provide a complete address'),
});

const STEPS = [
  { id: 1, title: 'Account', description: 'Create your account' },
  { id: 2, title: 'Email Verification', description: 'Enter the code we emailed you' },
  { id: 3, title: 'ID Verification', description: 'Verify your National ID' },
  { id: 4, title: 'Address', description: 'Confirm your Belvedere address' },
];

export default function RegistrationWizard() {
  const { register, verifyEmail, resendVerification, verifyId, verifyAddress } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [resending, setResending] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState(null);
  const [showMapPreview, setShowMapPreview] = useState(false);

  const step1Methods = useForm({ resolver: yupResolver(step1Schema), mode: 'onBlur' });
  const step2Methods = useForm({ resolver: yupResolver(step2Schema), mode: 'onBlur' });
  const step3Methods = useForm({ resolver: yupResolver(step3Schema), mode: 'onBlur' });
  const step4Methods = useForm({ resolver: yupResolver(step4Schema), mode: 'onBlur' });

  const handleStep1Submit = async (data) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await register(data);
      setStep1Data({ user_id: response.user_id, email: data.email });
      setNotice(`We sent a 6-digit verification code to ${data.email}.`);
      setStep(2);
    } catch (err) {
      console.error('Registration error:', err.response?.data);
      const errors = err.response?.data;
      if (errors) {
        if (errors.email) setError(errors.email[0] || 'Email error');
        else if (errors.password) setError(errors.password[0] || 'Password error');
        else if (errors.confirm_password) setError(errors.confirm_password[0] || 'Password confirmation error');
        else if (errors.full_name) setError(errors.full_name[0] || 'Name error');
        else if (errors.non_field_errors) setError(errors.non_field_errors[0]);
        else setError('Registration failed. Please check your input.');
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
    setNotice(null);
    try {
      await verifyEmail({ user_id: step1Data.user_id, code: data.code });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await resendVerification(step1Data.user_id);
      setNotice(`A new code has been sent to ${step1Data.email}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleStep3Submit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('user_id', step1Data.user_id);
      formData.append('national_id', data.national_id);
      if (data.selfie) formData.append('selfie', data.selfie[0]);

      await verifyId(formData);
      setStep(4);
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

  const handleStep4Submit = async (data) => {
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

  const fieldClass = (hasError) =>
    `input-field ${hasError ? 'border-red-400 focus:ring-red-500/20' : ''}`;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <form onSubmit={step1Methods.handleSubmit(handleStep1Submit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Full Name</label>
              <input {...step1Methods.register('full_name')} type="text" className={fieldClass(step1Methods.formState.errors.full_name)} placeholder="Tinaye Gogwe" />
              {step1Methods.formState.errors.full_name && <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.full_name.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email</label>
              <input {...step1Methods.register('email')} type="email" className={fieldClass(step1Methods.formState.errors.email)} placeholder="tinaye@example.com" />
              {step1Methods.formState.errors.email && <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Password</label>
              <input {...step1Methods.register('password')} type="password" className={fieldClass(step1Methods.formState.errors.password)} placeholder="••••••••" />
              {step1Methods.formState.errors.password && <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.password.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Confirm Password</label>
              <input {...step1Methods.register('confirm_password')} type="password" className={fieldClass(step1Methods.formState.errors.confirm_password)} placeholder="••••••••" />
              {step1Methods.formState.errors.confirm_password && <p className="mt-1 text-sm text-red-600">{step1Methods.formState.errors.confirm_password.message}</p>}
            </div>
          </form>
        );
      case 2:
        return (
          <form onSubmit={step2Methods.handleSubmit(handleStep2Submit)} className="space-y-5">
            <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Check your inbox{step1Data.email ? ` for ${step1Data.email}` : ''} — we sent a 6-digit verification code. It expires in 30 minutes.
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Verification Code</label>
              <input
                {...step2Methods.register('code')}
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                className={fieldClass(step2Methods.formState.errors.code) + ' text-center text-2xl font-bold tracking-[0.5em]'}
                placeholder="••••••"
              />
              {step2Methods.formState.errors.code && <p className="mt-1 text-sm text-red-600">{step2Methods.formState.errors.code.message}</p>}
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition hover:text-brand-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
              {resending ? 'Sending...' : "Didn't get it? Resend code"}
            </button>
          </form>
        );
      case 3:
        return (
          <form onSubmit={step3Methods.handleSubmit(handleStep3Submit)} className="space-y-5">
            <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              We verify your National ID to keep the community safe. Your data stays private.
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">National ID</label>
              <input {...step3Methods.register('national_id')} type="text" className={fieldClass(step3Methods.formState.errors.national_id)} placeholder="12-345678A90" />
              {step3Methods.formState.errors.national_id && <p className="mt-1 text-sm text-red-600">{step3Methods.formState.errors.national_id.message}</p>}
              <p className="mt-1.5 text-xs text-gray-500">Format: XX-XXXXXXXA00 (e.g., 12-345678A90)</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Selfie (Optional)</label>
              <input {...step3Methods.register('selfie')} type="file" accept="image/*" className={fieldClass(step3Methods.formState.errors.selfie)} />
            </div>
          </form>
        );
      case 4:
        return (
          <form onSubmit={step4Methods.handleSubmit(handleStep4Submit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Street Address</label>
              <input {...step4Methods.register('street_address')} type="text" className={fieldClass(step4Methods.formState.errors.street_address)} placeholder="123 Main Street, Belvedere" />
              {step4Methods.formState.errors.street_address && <p className="mt-1 text-sm text-red-600">{step4Methods.formState.errors.street_address.message}</p>}
            </div>

            {showMapPreview && geocodeResult && (
              <div className="animate-fade-up rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h4 className="font-bold text-gray-900">Confirm your location</h4>
                <p className="mb-3 mt-1 text-sm text-gray-600">{geocodeResult.display_name}</p>
                <div className="h-48 overflow-hidden rounded-lg">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0 }}
                    title="Address preview"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${geocodeResult.lng - 0.01}%2C${geocodeResult.lat - 0.01}%2C${geocodeResult.lng + 0.01}%2C${geocodeResult.lat + 0.01}&layer=mapnik&marker=${geocodeResult.lat}%2C${geocodeResult.lng}`}
                    allowFullScreen
                  />
                </div>
                <p className="mt-2 text-center text-xs text-gray-500">Is this your correct location?</p>
              </div>
            )}
          </form>
        );
      default:
        return null;
    }
  };

  const advance = () => {
    if (step === 1) step1Methods.handleSubmit(handleStep1Submit)();
    else if (step === 2) step2Methods.handleSubmit(handleStep2Submit)();
    else if (step === 3) step3Methods.handleSubmit(handleStep3Submit)();
    else if (step === 4) step4Methods.handleSubmit(handleStep4Submit)();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Stepper */}
        <div className="mb-6 flex items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                  i + 1 < step ? 'bg-brand-600 text-white' : i + 1 === step ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i + 1 < step ? <Check className="h-5 w-5" /> : i + 1}
                </div>
                <span className={`mt-1.5 text-xs font-semibold ${i + 1 <= step ? 'text-brand-700' : 'text-gray-400'}`}>{s.title}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-2 mb-5 h-1 flex-1 rounded ${i + 1 < step ? 'bg-brand-600' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{STEPS[step - 1].title}</h1>
          <p className="mt-1 text-sm text-gray-500">{STEPS[step - 1].description}</p>

          {notice && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800" role="status">
              {notice}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="mt-6">{renderStep()}</div>

          <div className="mt-7 flex items-center justify-between">
            <button
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              disabled={step === 1 || loading}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={advance} disabled={loading} className="btn-primary px-6 py-2.5">
              {loading ? 'Processing...' : step === 4 ? 'Complete Registration' : 'Continue'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
