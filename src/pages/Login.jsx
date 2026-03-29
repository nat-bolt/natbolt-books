import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { Smartphone, KeyRound } from 'lucide-react';
import { auth } from '../firebase';
// No Supabase session setup needed — accessToken factory in supabase.js handles it.
import useStore from '../store/useStore';

// ── Module-level singleton for RecaptchaVerifier ───────────────────────────────
// Kept outside the component so React StrictMode's double-effect firing
// does NOT create → clear → recreate the verifier, which causes internal-error.
let recaptchaVerifierSingleton = null;

function getVerifier() {
  if (!recaptchaVerifierSingleton) {
    try {
      recaptchaVerifierSingleton = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'invisible',
          callback: (response) => {
            // reCAPTCHA solved successfully (removed token logging for security)
            if (import.meta.env.DEV) {
              console.log('[DEBUG] reCAPTCHA verification successful');
            }
          },
          'expired-callback': () => {
            if (import.meta.env.DEV) {
              console.log('[DEBUG] reCAPTCHA expired, resetting');
            }
            resetVerifier();
          }
        }
      );
      if (import.meta.env.DEV) {
        console.log('[DEBUG] RecaptchaVerifier initialized');
      }
    } catch (error) {
      console.error('Failed to create RecaptchaVerifier:', error);
      throw error;
    }
  }
  return recaptchaVerifierSingleton;
}

function resetVerifier() {
  try { recaptchaVerifierSingleton?.clear(); } catch (_) {}
  recaptchaVerifierSingleton = null;
}

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser, setShop, setAuthLoading } = useStore();

  const [phone, setPhone]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [step, setStep]               = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [confirmResult, setConfirmResult] = useState(null);

  // ── Pre-warm RecaptchaVerifier on mount ───────────────────────────────────
  // Only pre-warm if NOT in test mode
  useEffect(() => {
    const isTestMode = import.meta.env.DEV && auth.settings.appVerificationDisabledForTesting;
    if (!isTestMode) {
      getVerifier();
      return () => resetVerifier();
    }
  }, []);

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setError(t('login.invalidPhone'));
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fullPhone = `+91${cleaned}`;
      // Only log in development (removed phone number from logs for privacy)
      if (import.meta.env.DEV) {
        console.log('[DEBUG] Initiating OTP send');
      }

      // Check if test mode is enabled
      const isTestMode = import.meta.env.DEV && auth.settings.appVerificationDisabledForTesting;

      // In test mode: pass null (no verifier)
      // In production: use RecaptchaVerifier
      const verifier = isTestMode ? null : getVerifier();

      const result = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmResult(result);
      setStep('otp');
      if (import.meta.env.DEV) {
        console.log('[DEBUG] OTP sent successfully');
      }
    } catch (err) {
      console.error('sendOtp error:', err);
      // Better error messages for common issues
      let errorMsg = err.message || t('common.error');
      if (err.code === 'auth/invalid-phone-number') {
        errorMsg = 'Invalid phone number. Please check and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Too many attempts. Please try again later.';
      } else if (err.code === 'auth/quota-exceeded') {
        errorMsg = 'SMS quota exceeded. Please try again later.';
      } else if (err.code === 'auth/captcha-check-failed') {
        errorMsg = 'reCAPTCHA verification failed. Please refresh and try again.';
      }
      setError(errorMsg);

      const isTestMode = import.meta.env.DEV && auth.settings.appVerificationDisabledForTesting;
      if (!isTestMode) {
        resetVerifier(); // Reset on failure so user can retry
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError(t('login.invalidOtp'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const credential = await confirmResult.confirm(otp);
      const firebaseUser = credential.user;
      setUser(firebaseUser);
      setAuthLoading(true); // Hold the spinner — onAuthStateChanged will resolve admin/shop then set false
      navigate('/', { replace: true });
    } catch (err) {
      console.error('verifyOtp error:', err);
      setError(
        err.code === 'auth/invalid-verification-code'
          ? 'Invalid OTP. Please try again.'
          : err.message || t('common.error')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    // Same layout as before — full screen, centered card, gradient background.
    // Only changes: gradient now uses brand black→orange, real icon replaces emoji,
    // accent colours updated to #f06022, brand-light tint updated.
    <div className="min-h-screen bg-gradient-to-b from-brand-dark to-brand-mid flex flex-col items-center justify-center p-6">

      {/* Logo — same position/size as original, emoji replaced by real brand icon */}
      <div className="text-center mb-8">
        <img
          src="/icons/icon-192.png"
          alt="NatBolt"
          className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-xl"
        />
        <h1 className="font-display text-4xl text-white tracking-widest uppercase">{t('appName')}</h1>
        <p className="text-brand-light text-sm mt-1 opacity-80">{t('appTagline')}</p>
      </div>

      {/* Card — same max-w-sm centered white card, no structural change */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
        {step === 'phone' ? (
          <>
            <div className="flex items-center gap-2 mb-5">
              <Smartphone className="w-5 h-5 text-brand-mid" />
              <h2 className="text-lg font-bold text-brand-dark">{t('login.title')}</h2>
            </div>

            <label className="section-label">{t('login.phoneLabel')}</label>
            <div className="flex gap-2 mb-4">
              <span className="input-field w-14 text-center font-bold text-gray-600 flex-shrink-0">
                +91
              </span>
              <input
                type="tel"
                className="input-field"
                placeholder={t('login.phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                maxLength={10}
                inputMode="numeric"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              className="btn-primary w-full"
              onClick={handleSendOtp}
              disabled={loading}
            >
              {loading ? t('login.sending') : t('login.sendOtp')}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5">
              <KeyRound className="w-5 h-5 text-brand-mid" />
              <h2 className="text-lg font-bold text-brand-dark">{t('login.otpLabel')}</h2>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {t('login.otpSent')} +91{phone}
            </p>

            <label className="section-label">{t('login.otpLabel')}</label>
            <input
              type="tel"
              className="input-field text-center text-2xl font-bold tracking-[0.4em] mb-4"
              placeholder="• • • • • •"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              maxLength={6}
              inputMode="numeric"
              autoFocus
            />

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              className="btn-primary w-full mb-3"
              onClick={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? t('login.verifying') : t('login.verifyOtp')}
            </button>

            <button
              className="w-full text-brand-mid text-sm font-medium py-2"
              onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
            >
              {t('login.resendOtp')}
            </button>
          </>
        )}
      </div>

      {/* reCAPTCHA container - invisible, works in background */}
      <div id="recaptcha-container" className="mt-4" />
    </div>
  );
}
