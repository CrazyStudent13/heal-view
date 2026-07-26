import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  DEFAULT_LOCALE,
  getElementPlusLocale,
  i18n,
  localeOptions,
  normalizeLocale
} from '../i18n';

export const useLocaleStore = defineStore('locale', () => {
  const currentLocale = ref(normalizeLocale(localStorage.getItem('locale') || navigator.language || DEFAULT_LOCALE));
  const availableLocales = localeOptions;
  const elementPlusLocale = computed(() => getElementPlusLocale(currentLocale.value));

  function setLocale(locale) {
    const normalized = normalizeLocale(locale);
    currentLocale.value = normalized;
    i18n.global.locale.value = normalized;
    localStorage.setItem('locale', normalized);
    document.documentElement.lang = normalized;
    document.title = i18n.global.t('app.title');
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
