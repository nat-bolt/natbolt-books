import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { Smartphone, KeyRound } from 'lucide-react';
import { auth, isTestPhoneNumber, setTestMode } from '../firebase';
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
          size: 'invisible',  // Invisible reCAPTCHA - no checkbox needed
          callback: (response) => {
            // reCAPTCHA solved successfully
            if (import.meta.env.DEV) {
              console.log('[DEBUG] reCAPTCHA v2 verification successful');
            }
          },
          'expired-callback': () => {
            if (import.meta.env.DEV) {
              console.log('[DEBUG] reCAPTCHA expired, resetting');
            }
            resetVerifier();
          },
          'error-callback': (error) => {
            if (import.meta.env.DEV) {
              console.error('[DEBUG] reCAPTCHA error:', error);
            }
            resetVerifier();
          }
        }
      );
      if (import.meta.env.DEV) {
        console.log('[DEBUG] RecaptchaVerifier initialized (invisible mode)');
      }
    } catch (error) {
      console.error('Failed to create RecaptchaVerifier:', error);
      throw error;
    }
  }
  return recaptchaVerifierSingleton;
}

function resetVerifier() {
  try {
    if (recaptchaVerifierSingleton) {
      recaptchaVerifierSingleton.clear();
    }
  } catch (e) {
    // Ignore cleanup errors
    if (import.meta.env.DEV) {
      console.log('[DEBUG] Verifier cleanup error (safe to ignore):', e.message);
    }
  }
  recaptchaVerifierSingleton = null;

  // Also clear the DOM container to ensure clean state
  const container = document.getElementById('recaptcha-container');
  if (container) {
    container.innerHTML = '';
  }

  if (import.meta.env.DEV) {
    console.log('[DEBUG] RecaptchaVerifier reset complete');
  }
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

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    // Cleanup verifier when component unmounts
    return () => resetVerifier();
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

      // ── Smart Test Mode Detection ─────────────────────────────────────────────
      // Check if this is a test number → enable test mode (no reCAPTCHA, Firebase test OTP)
      // Otherwise → production mode (reCAPTCHA + real SMS)
      const isTestNum = isTestPhoneNumber(fullPhone);
      setTestMode(isTestNum);

      if (import.meta.env.DEV) {
        console.log(`[DEBUG] ${isTestNum ? '🧪 Test number detected' : '📱 Real number detected'} - Initiating OTP send`);
      }

      // For production mode, ensure we have a fresh verifier
      let verifier = null;
      if (!isTestNum) {
        // Reset and recreate verifier for production mode to ensure clean state
        resetVerifier();
        verifier = getVerifier();

        if (import.meta.env.DEV) {
          console.log('[DEBUG] Using fresh RecaptchaVerifier for production mode');
        }

        // Wait for verifier to fully render before proceeding
        await new Promise(resolve => setTimeout(resolve, 100));
      }

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
        errorMsg = 'Too many login attempts. Please wait 15-30 minutes and try again, or use a different phone number.';
      } else if (err.code === 'auth/quota-exceeded') {
        errorMsg = 'Daily SMS limit reached. Please try again tomorrow or contact support.';
      } else if (err.code === 'auth/captcha-check-failed') {
        errorMsg = 'Security verification failed. Please refresh the page and try again.';
      } else if (err.code === 'auth/argument-error') {
        errorMsg = 'Configuration error. Please refresh the page or contact support.';
      } else if (err.message && err.message.includes('INVALID_RECAPTCHA_TOKEN')) {
        errorMsg = 'reCAPTCHA verification failed. Please complete the verification and try again.';
        // Don't reset verifier immediately - user might need to interact with visible CAPTCHA
      }
      setError(errorMsg);

      // Always reset verifier on error for production mode to allow fresh retry
      // Exception: INVALID_RECAPTCHA_TOKEN might need the existing verifier to show visible CAPTCHA
      if (!auth.settings.appVerificationDisabledForTesting &&
          !(err.message && err.message.includes('INVALID_RECAPTCHA_TOKEN'))) {
        resetVerifier();
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

      {/* reCAPTCHA container - invisible, no UI shown */}
      <div id="recaptcha-container" />
    </div>
  );
}
