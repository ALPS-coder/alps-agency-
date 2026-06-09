import de from '../../locales/de/common.json';
import en from '../../locales/en/common.json';

export const languages = { de: 'Deutsch', en: 'English' } as const;
export const defaultLang: Lang = 'de';
export type Lang = keyof typeof languages;

const dictionaries: Record<Lang, unknown> = { de, en };

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

/**
 * Übersetzungs-Helper. Fällt auf Deutsch zurück, wenn ein Key fehlt.
 * Nutzung: const t = useTranslations('de'); t('hero.title_pre')
 * Für Arrays/Objekte: t<string[]>('pricing.items.free.features')
 */
export function useTranslations(lang: Lang = defaultLang) {
  return function t<T = string>(key: string): T {
    const value = resolve(dictionaries[lang], key) ?? resolve(dictionaries[defaultLang], key);
    return value as T;
  };
}
