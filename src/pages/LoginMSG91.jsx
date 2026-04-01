import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Smartphone, KeyRound } from 'lucide-react';
import { sendOTP, verifyOTP } from '../services/msg91Auth';
import useStore from '../store/useStore';

export default function LoginMSG91() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser, setShop, setIsAdmin } = useStore();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      await sendOTP(fullPhone);

      if (import.meta.env.DEV) {
        console.log('[MSG91] OTP sent successfully to', fullPhone);
      }

      setStep('otp');
    } catch (err) {
      console.error('[Login] Send OTP error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
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
      const fullPhone = `+91${phone.replace(/\D/g, '')}`;
      const result = await verifyOTP(fullPhone, otp);

      if (import.meta.env.DEV) {
        console.log('[MSG91] OTP verified:', result);
      }

      // Persist session in localStorage
      localStorage.setItem('nb_user_phone', result.phone);

      // Set user data in Zustand store
      setUser({ phone: result.phone });
      setIsAdmin(result.isAdmin);

      if (result.shop) {
        setShop(result.shop);
      }

      // Navigate to dashboard
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[Login] Verify OTP error:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    setStep('phone');
    setOtp('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-dark to-brand-mid flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-8">
        <img
          src="/icons/icon-192.png"
          alt="NatBolt"
          className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-xl"
        />
        <h1 className="font-display text-4xl text-white tracking-widest uppercase">{t('appName')}</h1>
        <p className="text-brand-light text-sm mt-1 opacity-80">{t('appTagline')}</p>
      </div>

      {/* Card */}
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

            {/* MSG91 Badge */}
            <p className="text-xs text-gray-400 text-center mt-4">
              🔒 Secured by MSG91
            </p>
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
              onClick={handleResendOtp}
            >
              {t('login.resendOtp')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
