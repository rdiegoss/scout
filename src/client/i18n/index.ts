import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';

export const defaultNS = 'translation';

export const resources = {
  'pt-BR': { translation: ptBR },
  en: { translation: en },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt-BR',
    defaultNS,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      convertDetectedLanguage: (lng: string) => {
        // Map pt/pt-* variants to pt-BR since that's our only PT locale
        if (lng === 'pt' || lng.startsWith('pt-')) return 'pt-BR';
        // Map en-US, en-GB etc. to en
        if (lng.startsWith('en')) return 'en';
        return lng;
      },
    },
  });

export default i18n;
