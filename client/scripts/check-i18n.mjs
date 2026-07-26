import zhCN from '../src/i18n/locales/zh-CN.js';
import en from '../src/i18n/locales/en.js';

function flattenMessages(messages, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenMessages(value, path, result);
    } else {
      result[path] = value;
    }
  }
  return result;
}

const locales = {
  'zh-CN': flattenMessages(zhCN),
  en: flattenMessages(en)
};
const referenceLocale = 'zh-CN';
const referenceKeys = Object.keys(locales[referenceLocale]);
let hasErrors = false;

for (const [locale, messages] of Object.entries(locales)) {
  const keys = Object.keys(messages);
  const missing = referenceKeys.filter(key => !(key in messages));
  const extra = keys.filter(key => !(key in locales[referenceLocale]));

  if (missing.length || extra.length) {
    hasErrors = true;
    console.error(`[i18n] ${locale}`);
    if (missing.length) console.error(`  Missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  Extra: ${extra.join(', ')}`);
  }
}

if (hasErrors) process.exit(1);
console.log(`[i18n] ${Object.keys(locales).length} locales, ${referenceKeys.length} keys: OK`);
