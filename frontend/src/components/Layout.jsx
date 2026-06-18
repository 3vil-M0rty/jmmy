import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransition } from './TransitionContext';
import { useNavigate } from "react-router-dom";

import BrandIcon from './Brandicon';
import './Layout.css';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
];

const NAV = [
  { path: '/', key: 'nav.home' },
  { path: '/work', key: 'nav.discover' },
  { path: '/', key: 'nav.users' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { navigateTo } = useTransition();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  };

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <div className="app">
      <nav className="nav" aria-label={t('nav.primary')}>
        {/* Left: logo */}
        <BrandIcon onClick={() => navigateTo("/")} className='ghitz' size={80} color="#000" />

        {/* Right: order + burger */}
        <div className="nav-right">
          <button className="order">{t('order')}</button>

          <button
            className={`burger${menuOpen ? ' burger--open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className="burger__bar" />
            <span className="burger__bar" />
            <span className="burger__bar" />
          </button>
        </div>
      </nav>

      {/* Overlay */}
      <div className={`menu-overlay${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="menu-content">

          <ul className="menu-list">
            {NAV.map(({ path, key }) => (
              <li key={key}>
                <button
                  className="menu-link"
                  onClick={() => {
                    navigateTo(path);
                    setMenuOpen(false);
                  }}
                >
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>

          <div className="menu-footer">
            {/* Language switcher */}
            <div className="menu-lang">
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  className={`menu-lang__btn${i18n.language === code ? ' menu-lang__btn--active' : ''}`}
                  onClick={() => changeLanguage(code)}
                  aria-pressed={i18n.language === code}
                >
                  {label}
                </button>
              ))}
            </div>
            <span>ghitzcare © 2025</span>
          </div>

        </div>
      </div>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}