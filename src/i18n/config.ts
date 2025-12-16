import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import uzTranslations from './locales/uz.json'
import enTranslations from './locales/en.json'
import ruTranslations from './locales/ru.json'

// NOTE: We intentionally avoid direct `localStorage` usage here.
// The app persists language via Capacitor Preferences (`src/lib/storage.ts`)
// and loads it in `useLanguageStore.loadLanguage()`.
const getNavigatorLanguage = (): 'uz' | 'en' | 'ru' => {
  if (typeof navigator === 'undefined') return 'uz'
  const lang = (navigator.language || '').toLowerCase()
  if (lang.startsWith('ru')) return 'ru'
  if (lang.startsWith('en')) return 'en'
  return 'uz'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      uz: { translation: uzTranslations },
      en: { translation: enTranslations },
      ru: { translation: ruTranslations },
    },
    lng: getNavigatorLanguage(),
    fallbackLng: 'uz', // Default: O'zbek tili
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n

