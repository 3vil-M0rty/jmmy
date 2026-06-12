import { Outlet , useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransition } from './TransitionContext';
import "./Layout.css"

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'ar', label: 'AR' },
  { code: 'es', label: 'ES' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { navigateTo } = useTransition();

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  };

  const navClass = (path) => {
    const isActive = window.location.pathname === path ||
      (path === '/' && window.location.pathname === '/');
    return isActive ? 'nav-link active' : 'nav-link';
  };
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <span className='jimmy' onClick={() => navigateTo('/')}>JIMMY</span>
      <button className="jimmy2" onClick={() => navigateTo('/about')}>{t('nav.about')} </button>
      {/* <header className="header"> 
        <nav className="nav">
          
        </nav>
        <div className="lang-switcher">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              className={`lang-btn${i18n.language === code ? ' lang-btn--active' : ''}`}
              onClick={() => changeLanguage(code)}
            >{label}</button>
          ))}
        </div>
      </header> */}
      <main className="main"><Outlet /></main>
    </div>
  );
}