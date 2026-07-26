import { createI18n } from 'vue-i18n';
import zhCnElement from 'element-plus/es/locale/lang/zh-cn';
import enElement from 'element-plus/es/locale/lang/en';
import zhCN from './locales/zh-CN';
import en from './locales/en';

export const DEFAULT_LOCALE = 'zh-CN';

const localeRegistry = [
  { code: 'zh-CN', label: '简体中文', messages: zhCN, elementLocale: zhCnElement },
  { code: 'en', label: 'English', messages: en, elementLocale: enElement }
];

export const localeOptions = localeRegistry.map(({ code, label }) => ({ code, label }));
export const supportedLocales = localeRegistry.map(locale => locale.code);

export function normalizeLocale(locale) {
  if (supportedLocales.includes(locale)) return locale;
  const language = String(locale || '').toLowerCase();
  if (language.startsWith('zh')) return 'zh-CN';
  if (language.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export function getElementPlusLocale(locale) {
  const normalized = normalizeLocale(locale);
  return localeRegistry.find(item => item.code === normalized)?.elementLocale || zhCnElement;
}

const initialLocale = normalizeLocale(localStorage.getItem('locale') || navigator.language);

export const i18n = createI18n({
  legacy: false,
  globalInjection: false,
  locale: initialLocale,
  fallbackLocale: DEFAULT_LOCALE,
  messages: Object.fromEntries(localeRegistry.map(item => [item.code, item.messages])),
  missingWarn: import.meta.env.DEV,
  fallbackWarn: false
});

export function translate(key, params) {
  return i18n.global.t(key, params);
}
