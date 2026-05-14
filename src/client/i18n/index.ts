import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all locales
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ko from './locales/ko.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import tr from './locales/tr.json';
import ar from './locales/ar.json';
import vi from './locales/vi.json';
import id from './locales/id.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'fr', name: 'Francais', dir: 'ltr' },
  { code: 'es', name: 'Espanol', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', dir: 'ltr' },
  { code: 'pt', name: 'Portugues', dir: 'ltr' },
  { code: 'ja', name: 'Nihongo', dir: 'ltr' },
  { code: 'zh', name: 'Zhongwen', dir: 'ltr' },
  { code: 'ko', name: 'Hangugeo', dir: 'ltr' },
  { code: 'it', name: 'Italiano', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', dir: 'ltr' },
  { code: 'pl', name: 'Polski', dir: 'ltr' },
  { code: 'tr', name: 'Turkce', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', dir: 'rtl' },
  { code: 'vi', name: 'Tieng Viet', dir: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', dir: 'ltr' },
];

const resources = {
  en, fr, es, de, pt,
  ja, zh, ko, it, nl,
  pl, tr, ar, vi, id,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: true },
    react: { useSuspense: false },
  });

export default i18n;
