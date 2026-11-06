import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['js/**/*.js'], languageOptions: { sourceType: 'module', globals: globals.browser } },
  { files: ['sw.js'], languageOptions: { sourceType: 'script', globals: globals.serviceworker } },
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
