import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, BookOpen, Settings, ChevronLeft, Globe
} from 'lucide-react';
import useStore from '../store/useStore';
import i18n from '../i18n/index';

export default function Layout({ children, title, showBack = false }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useStore();

  const tabs = [
    { path: '/',          icon: LayoutDashboard, labelKey: 'dashboard.today'   },
    { path: '/customers', icon: Users,            labelKey: 'customer.title'   },
    { path: '/parts',     icon: BookOpen,         labelKey: 'catalogue.title'  },
    { path: '/settings',  icon: Settings,         labelKey: 'settings.title'   },
  ];

  const cycleLang = () => {
    const langs = ['en', 'hi', 'te'];
    const next = langs[(langs.indexOf(language) + 1) % langs.length];
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  const langLabel = { en: 'EN', hi: 'हि', te: 'తె' };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 max-w-lg mx-auto">
      {/* Top bar */}
      <header className="bg-brand-dark text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-md">
        {showBack ? (
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg active:bg-brand-mid">
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-7" />
        )}
        <h1 className="flex-1 text-lg font-bold truncate">
          {title || t('appName')}
        </h1>
        <button
          onClick={cycleLang}
          className="flex items-center gap-1 bg-brand-mid px-2 py-1 rounded-lg text-xs font-bold"
        >
          <Globe className="w-3.5 h-3.5" />
          {langLabel[language]}
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 flex z-20">
        {tabs.map(({ path, icon: Icon, labelKey }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors
                ${active
                  ? 'text-brand-mid border-t-2 border-brand-mid -mt-px'
                  : 'text-gray-500 hover:text-brand-mid'}`}
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
