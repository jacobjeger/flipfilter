import { en, TranslationKeys } from './en';
import { he } from './he';
import { yi } from './yi';

export type Language = 'en' | 'he' | 'yi';

export const languages: Record<Language, { name: string; nativeName: string; dir: 'ltr' | 'rtl' }> = {
  en: { name: 'English', nativeName: 'English', dir: 'ltr' },
  he: { name: 'Hebrew', nativeName: 'עברית', dir: 'rtl' },
  yi: { name: 'Yiddish', nativeName: 'ייִדיש', dir: 'rtl' },
};

const translations: Record<Language, TranslationKeys> = { en, he, yi };

export function getTranslation(lang: Language): TranslationKeys {
  return translations[lang] || en;
}

export type { TranslationKeys };
