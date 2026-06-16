import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransition } from './TransitionContext';
import './Layout.css';
import JellyCursor from './JellyCursor';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },/* 
  { code: 'ar', label: 'AR' },
  { code: 'es', label: 'ES' }, */
];

const NAV = [
  { path: '/', key: 'nav.home' },
  { path: '/work', key: 'nav.work' },
  { path: '/users', key: 'nav.users' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { navigateTo } = useTransition();
  const { pathname } = useLocation();

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  };

  // Keep <html dir/lang> in sync with the active language on mount + change.
  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      {/* <span
        className="jimmy"
        onClick={() => navigateTo('/')}
        role="link"
        tabIndex={0}
        aria-label={t('nav.home')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigateTo('/')}
      >
        G
      </span> */}
      <JellyCursor />

      <nav className="nav" aria-label={t('nav.primary')}>
        <div className='ghitz'>ghitzcare</div>
        <div className='middle'>
          {NAV.map(({ path, key }) => (
            <button
              key={path}
              type="button"
              className={pathname === path ? 'nav-link active' : 'nav-link'}
              aria-current={pathname === path ? 'page' : undefined}
              onClick={() => navigateTo(path)}
            >
              {t(key)}
            </button>
          ))}

         {/*  <span className="lang-switcher" aria-label={t('language')}>
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                className={`lang-btn${i18n.language === code ? ' lang-btn--active' : ''}`}
                onClick={() => changeLanguage(code)}
                aria-pressed={i18n.language === code}
              >
                {label}
              </button>
            ))}
          </span> */}

        </div>

        <button className='order'>{t("order")}</button>
      </nav>
      <main className="main"><Outlet /></main>
    </div>
  );
}
