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
    recaptchaVerifierSingleton = new RecaptchaVerifier(
      auth,
      'recaptcha-container',
      { size: 'invisible', callback: () => {} }
    );
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
  // Invisible reCAPTCHA still makes a background round-trip to Google to register.
  // Doing it here (while the user is typing their phone number) means that
  // network call is already done by the time they tap "Send OTP" — eliminating
  // the visible delay between tap and OTP arriving.
  // Cleanup on unmount prevents a stale verifier if the user navigates away and back.
  useEffect(() => {
    getVerifier();
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
    // Do NOT reset verifier here — use the pre-warmed singleton.
    // resetVerifier() is only called on error (below) so the user can retry.
    try {
      const fullPhone = `+91${cleaned}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, getVerifier());
      setConfirmResult(result);
      setStep('otp');
    } catch (err) {
      console.error('sendOtp error:', err);
      setError(err.message || t('common.error'));
      resetVerifier(); // Reset only on failure so user can retry with a fresh verifier
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

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container" />
    </div>
  );
}
