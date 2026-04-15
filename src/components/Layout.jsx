import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, BookOpen, Settings, ChevronLeft, Globe
} from 'lucide-react';
import useStore from '../store/useStore';
import i18n from '../i18n/index';

const LANG_NAMES = { en: 'English', hi: 'हिंदी', te: 'తెలుగు' };

export default function Layout({ children, title, showBack = false }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useStore();

  // Toast state for language-change confirmation
  const [langToast, setLangToast] = useState('');
  const [toastTimer, setToastTimer] = useState(null);
  const [bottomNavOffset, setBottomNavOffset] = useState('72px');
  const shellRef = useRef(null);
  const navRef = useRef(null);

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
    // Show a brief toast confirming the new language
    setLangToast(LANG_NAMES[next]);
    if (toastTimer) clearTimeout(toastTimer);
    const timerId = setTimeout(() => setLangToast(''), 2000);
    setToastTimer(timerId);
  }, [language, setLanguage, toastTimer]);

  const langLabel = { en: 'EN', hi: 'हि', te: 'తె' };

  useEffect(() => {
    const updateBottomNavOffset = () => {
      const navHeight = navRef.current?.getBoundingClientRect?.().height;
      if (!navHeight) return;
      setBottomNavOffset(`${Math.ceil(navHeight)}px`);
    };

    updateBottomNavOffset();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateBottomNavOffset)
      : null;

    if (resizeObserver && navRef.current) resizeObserver.observe(navRef.current);
    window.addEventListener('resize', updateBottomNavOffset);
    window.visualViewport?.addEventListener('resize', updateBottomNavOffset);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateBottomNavOffset);
      window.visualViewport?.removeEventListener('resize', updateBottomNavOffset);
    };
  }, []);

  return (
    <div
      ref={shellRef}
      className="app-shell flex flex-col max-w-lg mx-auto w-full"
      style={{
        backgroundColor: '#F5F0EB',
        '--bottom-nav-safe': 'max(env(safe-area-inset-bottom), 4px)',
        '--bottom-nav-offset': bottomNavOffset,
      }}
    >
      {/* Top bar
          — style paddingTop uses env(safe-area-inset-top) so the header
            sits below the Dynamic Island / notch on any iPhone model.
            The inner content always gets 12px (py-3) below the safe area. */}
      <header
        className="bg-brand-dark text-white px-4 flex items-center gap-3 sticky top-0 z-20 shadow-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: '12px' }}
      >
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 rounded-lg active:bg-brand-mid"
            aria-label={t('common.back')}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-7" />
        )}
        <h1 className="flex-1 text-xl font-display tracking-wider truncate uppercase">
          {title || t('appName')}
        </h1>
        <button
          onClick={cycleLang}
          className="flex items-center gap-1 bg-brand-mid px-2 py-1 rounded-lg text-xs font-bold"
          aria-label={`Switch language — current: ${langLabel[language]}`}
        >
          <Globe className="w-3.5 h-3.5" />
          {langLabel[language]}
        </button>
      </header>

      {/* Language-change toast — briefly confirms which language was selected */}
      {langToast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-brand-dark text-white
                     text-sm font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none
                     animate-fade-in-out"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          {langToast}
        </div>
      )}

      {/* Page content
          — pb uses safe-area-inset-bottom so content never hides behind
            the bottom nav + iOS home indicator.
          — overscrollBehaviorY: 'contain' prevents iOS rubber-band scroll
            from intercepting taps when the page is at its scroll boundary.
            Without this, tapping a button at the very top/bottom of a page
            sometimes triggers the bounce animation instead of the tap.
          — The max() fallback ensures at least 8px bottom gap on Android OEM
            skins (Samsung, OnePlus, Xiaomi) that return 0 for safe-area-inset-bottom
            even when gesture navigation is active. */}
      {/*
        min-h-0 is critical here. Flex items default to min-height: auto, which lets
        them grow to fit their content — so overflow-y: auto never triggers and the body
        ends up scrolling instead.
        min-h-0 overrides that default, giving <main> a constrained height so it
        becomes the real scroll container. overscroll-behavior-y: contain then works
        correctly on this actual scroll container.
      */}
      <main
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          paddingBottom: 'calc(var(--bottom-nav-offset) + 16px)',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch', // momentum scrolling on older iOS
        }}
      >
        {children}
      </main>

      {/* Bottom nav
          — max() fallback: guarantees ≥8px bottom padding on Android OEMs
            that report safe-area-inset-bottom = 0 in PWA mode, which would
            otherwise place the nav tabs inside the OS gesture zone. */}
      <nav
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto flex z-20"
        style={{ backgroundColor: '#0b0b0b', paddingBottom: 'var(--bottom-nav-safe)' }}
      >
        {tabs.map(({ path, icon: Icon, labelKey }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors
                ${active
                  ? 'text-brand-mid border-t-2 border-brand-mid -mt-px'
                  : 'text-gray-400 hover:text-brand-mid'}`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
