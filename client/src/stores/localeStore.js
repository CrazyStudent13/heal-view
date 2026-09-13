import { defineStore } from 'pinia';
import {
  DEFAULT_LOCALE,
  getElementPlusLocale,
  i18n,
  localeOptions,
  normalizeLocale
} from '@/i18n';

export const useLocaleStore = defineStore('locale', () => {
  const storedLocale = typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : '';
  const browserLocale = typeof navigator !== 'undefined' ? navigator.language : '';
  const currentLocale = ref(normalizeLocale(storedLocale || browserLocale || DEFAULT_LOCALE));
  const availableLocales = localeOptions;
  const elementPlusLocale = computed(() => getElementPlusLocale(currentLocale.value));

  function setLocale(locale) {
    const normalized = normalizeLocale(locale);
    currentLocale.value = normalized;
    i18n.global.locale.value = normalized;
    if (typeof localStorage !== 'undefined') localStorage.setItem('locale', normalized);
    if (typeof document !== 'undefined') document.documentElement.lang = normalized;
    if (typeof document !== 'undefined') document.title = i18n.global.t('app.title');
  }

  function t(key, params) {
    return i18n.global.t(key, params);
  }

  setLocale(currentLocale.value);

  return {
    availableLocales,
    currentLocale,
    elementPlusLocale,
    setLocale,
    t
  };
});
