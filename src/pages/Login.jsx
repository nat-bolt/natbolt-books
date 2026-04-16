import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { Smartphone, KeyRound, Pencil } from 'lucide-react';
import { auth, isTestPhoneNumber, setTestMode } from '../firebase';
// No Supabase session setup needed — accessToken factory in supabase.js handles it.
import useStore from '../store/useStore';
import AuthShell from '../components/AuthShell';

const OTP_RESEND_COOLDOWN = 60;

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

function formatCountdown(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
  const [resendCountdown, setResendCountdown] = useState(0);

  // ── Pre-warm reCAPTCHA verifier on mount ──────────────────────────────────
  // Initialize the verifier BEFORE user clicks button, so the Google round-trip
  // completes while they're typing their phone number = instant OTP send
  useEffect(() => {
    // Pre-warm the verifier (background initialization)
    getVerifier();

    // Cleanup verifier when component unmounts
    return () => resetVerifier();
  }, []);

  useEffect(() => {
    if (step !== 'otp' || resendCountdown <= 0) return undefined;

    const timerId = window.setTimeout(() => {
      setResendCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [step, resendCountdown]);

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

      // For production mode, use the pre-warmed verifier (already initialized in useEffect)
      let verifier = null;
      if (!isTestNum) {
        verifier = getVerifier(); // Use existing pre-warmed verifier (instant!)

        if (import.meta.env.DEV) {
          console.log('[DEBUG] Using pre-warmed RecaptchaVerifier (no delay)');
        }
      }

      const result = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmResult(result);
      setStep('otp');
      setOtp('');
      setResendCountdown(OTP_RESEND_COOLDOWN);
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

      // Only reset verifier on specific errors that indicate verifier corruption
      // For most errors (wrong phone, rate limit, etc.), keep the pre-warmed verifier
      const verifierCorrupted = err.code === 'auth/captcha-check-failed' ||
                                 err.code === 'auth/internal-error' ||
                                 (err.message && err.message.includes('internal-error'));

      if (verifierCorrupted && !auth.settings.appVerificationDisabledForTesting) {
        if (import.meta.env.DEV) {
          console.log('[DEBUG] Resetting verifier due to corruption');
        }
        resetVerifier();
        // Pre-warm again for next attempt
        setTimeout(() => getVerifier(), 100);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (loading || resendCountdown > 0) return;
    setError('');
    await handleSendOtp();
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
    <AuthShell
      hero={(
        <div className="text-center">
          <img
            src="/icons/logo.png"
            alt="NatBolt"
            className="mx-auto mb-5 h-24 w-24 rounded-3xl shadow-xl"
          />
          <h1
            className="text-[2rem] font-bold tracking-wide text-white"
            style={{ fontFamily: 'Dagger Square, sans-serif' }}
          >
            {t('appName')}
          </h1>
          <p className="mt-2 text-sm text-brand-light/90">{t('appTagline')}</p>
        </div>
      )}
      footer={(
        <>
          Protected by reCAPTCHA. Google{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Privacy Policy
          </a>
          {' '}and{' '}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Terms of Service
          </a>
          {' '}apply.
        </>
      )}
    >
      {step === 'phone' ? (
        <>
          <div className="mb-5 flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-light text-brand-mid">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-dark">{t('login.title')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('login.phoneHint')}</p>
            </div>
          </div>

          <label className="section-label">{t('login.phoneLabel')}</label>
          <div className="mb-4 flex gap-2">
            <span className="input-field flex w-14 flex-shrink-0 items-center justify-center text-center font-bold text-gray-600">
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

          <p className="mb-4 text-xs text-gray-400">{t('login.phoneSupport')}</p>

          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

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
          <div className="mb-5 flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-light text-brand-mid">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-dark">{t('login.otpLabel')}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                <span>{t('login.otpSent')} +91 {phone}</span>
                <button
                  type="button"
                  className="rounded-md p-1 text-brand-mid"
                  onClick={() => {
                    setStep('phone');
                    setOtp('');
                    setError('');
                    setResendCountdown(0);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t('edit')}</span>
                </button>
              </div>
            </div>
          </div>

          <label className="section-label">{t('login.otpLabel')}</label>
          <input
            type="tel"
            className="input-field mb-4 text-center text-2xl font-bold tracking-[0.28em]"
            placeholder={t('login.otpPlaceholder')}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
            maxLength={6}
            inputMode="numeric"
            autoFocus
          />

          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

          <button
            className="btn-primary mb-3 w-full"
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? t('login.verifying') : t('login.verifyOtp')}
          </button>
          <div className="flex items-center justify-start gap-3 text-sm">
            <button
              className="py-2 font-medium text-brand-mid disabled:text-gray-400"
              onClick={handleResendOtp}
              disabled={loading || resendCountdown > 0}
            >
              {resendCountdown > 0
                ? t('login.resendOtpIn', { time: formatCountdown(resendCountdown) })
                : t('login.resendOtp')}
            </button>
          </div>
        </>
      )}

      <div id="recaptcha-container" />
    </AuthShell>
  );
}
