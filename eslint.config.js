import eslint from '@eslint/js';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**']
  },
  eslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['client/src/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        Intl: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-unsafe-finally': 'off',
      'vue/attributes-order': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off'
    }
  }
];
