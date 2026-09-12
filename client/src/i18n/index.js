import { createI18n } from 'vue-i18n';
import zhCnElement from 'element-plus/es/locale/lang/zh-cn';
import enElement from 'element-plus/es/locale/lang/en';
import zhCN from '@/i18n/locales/zh-CN.js';
import en from '@/i18n/locales/en.js';

export const DEFAULT_LOCALE = 'zh-CN';

const localeRegistry = [
  { code: 'zh-CN', labelKey: 'settings.localeZh', messages: zhCN, elementLocale: zhCnElement },
  { code: 'en', labelKey: 'settings.localeEn', messages: en, elementLocale: enElement }
];

export const localeOptions = localeRegistry.map(({ code, labelKey }) => ({ code, labelKey }));
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

const storedLocale = typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : '';
const browserLocale = typeof navigator !== 'undefined' ? navigator.language : '';
const initialLocale = normalizeLocale(storedLocale || browserLocale);

export const i18n = createI18n({
  legacy: false,
  globalInjection: false,
  locale: initialLocale,
  fallbackLocale: DEFAULT_LOCALE,
  messages: Object.fromEntries(localeRegistry.map(item => [item.code, item.messages])),
  missingWarn: Boolean(import.meta.env?.DEV),
  fallbackWarn: false
});

export function translate(key, params) {
  return i18n.global.t(key, params);
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}

export function formatNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat(i18n.global.locale.value, options).format(number);
}

export function formatDate(value, options = {}) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return new Intl.DateTimeFormat(i18n.global.locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  }).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '').replace('T', ' ').slice(0, 19);
  return new Intl.DateTimeFormat(i18n.global.locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}
