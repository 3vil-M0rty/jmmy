import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files directly (no HTTP backend needed for dev)
import en from './locales/en/translation.json';
import fr from './locales/fr/translation.json';
import ar from './locales/ar/translation.json';
import es from './locales/es/translation.json';

i18n
  .use(LanguageDetector)          // auto-detect browser language
  .use(initReactI18next)
  .init({
    // Supported locales
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
      es: { translation: es },
    },

    // Fallback when detected language isn't supported
    fallbackLng: 'en',

    // Detection order: query string ?lng=fr → localStorage → browser navigator
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React escapes by default
    },

    // Only load the detected language + fallback
    load: 'languageOnly', // strips region codes: "fr-FR" → "fr"
  });

export default i18n;
