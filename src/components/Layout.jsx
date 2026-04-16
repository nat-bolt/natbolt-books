import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, BookOpen, Settings, ChevronLeft, Globe
} from 'lucide-react';
import useStore from '../store/useStore';
import i18n from '../i18n/index';

const LANG_NAMES = { en: 'English', hi: 'हिंदी', te: 'తెలుగు' };

// Detect iOS device
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export default function Layout({
  children,
  title,
  showBack = false,
  showNav = true,
  showLanguage = true,
  headerRight = null,
  onBack,
  titleNode = null,
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useStore();
  const chromeIsDark = false;
  const showHeaderTitle = !showNav;

  const [langToast, setLangToast] = useState('');
  const [toastTimer, setToastTimer] = useState(null);

  const tabs = [
    { path: '/',          icon: LayoutDashboard, labelKey: 'dashboard.today'   },
    { path: '/customers', icon: Users,            labelKey: 'customer.title'   },
    { path: '/parts',     icon: BookOpen,         labelKey: 'catalogue.title'  },
    { path: '/settings',  icon: Settings,         labelKey: 'settings.title'   },
  ];

  const cycleLang = useCallback(() => {
    const langs = ['en', 'hi', 'te'];
    const next = langs[(langs.indexOf(language) + 1) % langs.length];
    setLanguage(next);
    i18n.changeLanguage(next);
    setLangToast(LANG_NAMES[next]);
    if (toastTimer) clearTimeout(toastTimer);
    const timerId = setTimeout(() => setLangToast(''), 2000);
    setToastTimer(timerId);
  }, [language, setLanguage, toastTimer]);

  const langLabel = { en: 'EN', hi: 'हि', te: 'తె' };
  const shellBackground = chromeIsDark ? '#0b0b0b' : '#F5F0EB';

  useEffect(() => {
    const root = document.getElementById('root');
    const previousHtml = document.documentElement.style.backgroundColor;
    const previousBody = document.body.style.backgroundColor;
    const previousRoot = root?.style.backgroundColor || '';

    document.documentElement.style.backgroundColor = shellBackground;
    document.body.style.backgroundColor = shellBackground;
    if (root) {
      root.style.backgroundColor = shellBackground;
    }

    return () => {
      document.documentElement.style.backgroundColor = previousHtml;
      document.body.style.backgroundColor = previousBody;
      if (root) {
        root.style.backgroundColor = previousRoot;
      }
    };
  }, [shellBackground]);

  const handleBack = onBack || (() => navigate(-1));
  
  const resolvedHeaderRight = headerRight ?? (showLanguage ? (
    <button
      onClick={cycleLang}
      className="flex items-center gap-1 bg-brand-mid px-2.5 py-1 rounded-lg text-[11px] font-bold"
      aria-label={`Switch language — current: ${langLabel[language]}`}
    >
      <Globe className="w-3.5 h-3.5" />
      {langLabel[language]}
    </button>
  ) : (
    <div className="w-[52px]" />
  ));

  const resolvedTitleNode = titleNode || (
    <h1 className={`flex-1 text-lg font-display tracking-wider truncate uppercase ${chromeIsDark ? 'text-white' : 'text-brand-dark'}`}>
      {title || t('appName')}
    </h1>
  );

  return (
    <>
      {!showNav ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-[#F5F0EB] pointer-events-none"
        />
      ) : null}

      <div
        className="app-shell relative z-0 flex flex-col w-full max-w-lg mx-auto"
        style={{
          backgroundColor: '#F5F0EB',
        }}
      >
      {/* HEADER */}
      <header
        className={`px-3 flex items-center gap-3 sticky top-0 z-20 flex-shrink-0 ${
          chromeIsDark
            ? 'bg-brand-dark text-white shadow-md'
            : 'bg-[#F5F0EB] text-brand-dark'
        }`}
        style={{
          paddingTop: 'var(--safe-top)',
          minHeight: 'var(--header-total-height)',
        }}
      >
        {showBack ? (
          <button
            onClick={handleBack}
            className={`p-1 -ml-1 rounded-lg ${chromeIsDark ? 'active:bg-brand-mid' : 'active:bg-brand-light'}`}
            aria-label={t('common.back')}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className={showHeaderTitle ? 'w-7' : 'flex-1'} />
        )}
        {showHeaderTitle ? (
          <div className="flex-1 min-w-0">
            {resolvedTitleNode}
          </div>
        ) : null}
        {resolvedHeaderRight}
      </header>

      {/* LANGUAGE TOAST */}
      {langToast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50
                     text-sm font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none
                     animate-fade-in-out ${chromeIsDark ? 'bg-brand-dark text-white' : 'bg-white text-brand-dark border border-[#E8DED3]'}`}
          style={{ marginTop: 'var(--safe-top)' }}
        >
          {langToast}
        </div>
      )}

      {/* MAIN CONTENT */}
      <main
        className="flex-1 min-h-0 overflow-y-auto w-full"
        style={{
          paddingBottom: showNav ? 'var(--page-bottom-padding)' : 'var(--screen-page-bottom)',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="p-3">
          {children}
        </div>
      </main>

      {/* BOTTOM NAVIGATION */}
      {showNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-50"
          style={{
            backgroundColor: '#F5F0EB',
            height: 'var(--nav-total-height)',
            paddingBottom: 'var(--nav-safe-padding)',
          }}
        >
          {/* Icons Container */}
          <div 
            className="flex w-full" 
            style={{ 
              height: 'var(--nav-height)',
              alignItems: 'center',
            }}
          >
            {tabs.map(({ path, icon: Icon, labelKey }) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium transition-colors ${
                    active
                      ? 'text-brand-mid'
                      : 'text-brand-mid/55 hover:text-brand-mid'
                  }`}
                  style={{
                    // iOS: 44px minimum touch target (Apple HIG)
                    // Android: 40px is fine
                    minHeight: isIOS ? '44px' : '40px',
                    padding: '4px 0',
                  }}
                >
                  <Icon
                    className={`h-[24px] w-[24px] ${active ? 'stroke-[2.5px]' : ''}`}
                  />
                  <span>{t(labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      </div>
    </>
  );
}
