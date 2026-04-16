import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebase';
import useStore from '../store/useStore';
import { Clock, CheckCircle2, ArrowUpRight } from 'lucide-react';
import WhatsAppIcon from '../components/WhatsAppIcon';
import AuthShell from '../components/AuthShell';

const ADMIN_WHATSAPP = '919738007523';

// ── Shown when the user's phone number has no shop registered by the admin yet
export default function Pending() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, setShop } = useStore();

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setShop(null);
    navigate('/login', { replace: true });
  };

  // Format phone nicely: +919876543210 → +91 98765 43210
  const phone = user?.phoneNumber || '';
  const formatted = phone.startsWith('+91')
    ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`
    : phone;

  return (
    <AuthShell
      hero={(
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl">
            <Clock className="h-10 w-10 text-brand-mid" />
          </div>
          <h1 className="text-[2rem] font-bold tracking-wide text-white" style={{ fontFamily: 'Dagger Square, sans-serif' }}>
            {t('pending.title')}
          </h1>
          <p className="mt-2 text-sm text-brand-light/90">{t('pending.subtitle')}</p>
        </div>
      )}
    >
      <div className="rounded-2xl bg-brand-light/50 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-mid">{t('settings.signedInAs')}</p>
        <p className="mt-1 text-lg font-bold text-brand-dark">{formatted}</p>
      </div>

      <a
        href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(t('pending.whatsappMessage', { phone: formatted }))}`}
        className="mt-4 inline-flex items-center gap-3 self-start rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#f4fff8_72%,#fff2ea_100%)] px-4 py-3 text-brand-dark shadow-[0_12px_28px_rgba(16,185,129,0.12)] transition-transform duration-150 hover:-translate-y-0.5"
        target="_blank"
        rel="noopener noreferrer"
      >
        <WhatsAppIcon className="h-6 w-6" badge badgeClassName="bg-white/95 p-1.5 shadow-[0_6px_14px_rgba(37,211,102,0.18)]" />
        <span className="text-sm font-semibold">{t('pending.contactAdmin')}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-mid/10 text-brand-mid">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </a>

      <div className="mt-4 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-mid">{t('pending.nextSteps')}</p>
        <div className="mt-3 space-y-2">
          {['stepOneTitle', 'stepThreeTitle'].map((key) => (
            <div key={key} className="flex items-start gap-2 text-sm text-brand-dark">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <span>{t(`pending.${key}`)}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSignOut}
        className="mt-4 w-full py-2 text-sm font-medium text-brand-mid underline-offset-4 hover:underline"
      >
        {t('settings.logout')}
      </button>
    </AuthShell>
  );
}
