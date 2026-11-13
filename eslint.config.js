// eslint.config.js — ESLint 9 flat config for the SendLog web app
// Docs: https://eslint.org/docs/latest/use/configure/configuration-files

import js from '@eslint/js';
import globals from 'globals';

// ─── Shared rule sets ────────────────────────────────────────────────────────

/** Rules applied to every JS file */
const BASE_RULES = {
  // Potential bugs
  'no-undef':             'error',
  'no-unused-vars':       ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-shadow':            'warn',
  'eqeqeq':              ['warn', 'smart'],
  'no-implicit-coercion': 'warn',

  // Code clarity
  'no-console':           ['warn', { allow: ['warn', 'error'] }],
  'no-debugger':          'error',
  'no-alert':             'warn',
};

/** Additional rules for modern ES-module files */
const MODULE_RULES = {
  ...BASE_RULES,
  'no-var':       'warn',
  'prefer-const': 'warn',
};

// ─── Config array ─────────────────────────────────────────────────────────────

export default [
  // 1. ESLint recommended as the baseline
  js.configs.recommended,

  // ── ES-module app files ──────────────────────────────────────────────────

  // 2. Firebase service modules + admin.js
  //    These import from firebase/* and from each other via import statements.
  {
    files: [
      'app/js/firebase-*.js',
      'app/js/admin.js',
      'app/js/iso-countries.js',
      'app/js/route-entries.js',
      'app/js/send-style.js',
      'app/js/overlay-country.js',
      'app/js/route-link-ui.js',
      'app/js/route-line-ui.js',
      'app/js/reverse-geocode.js',
      'app/js/ui-theme.js',
      'app/js/climb-inspector-ui.js',
      'app/js/training-ui.js',
      'app/js/account-ui.js',
      'app/js/climb-table-ui.js',
      'app/js/view-switcher.js',
      'app/js/overlay-common.js',
      'app/js/send-overlay-ui.js',
      'app/js/send-form-model.js',
      'app/js/project-overlay-ui.js',
      'app/js/project-form-model.js',
      'app/js/attempt-form-model.js',
      'app/js/lightbox-ui.js',
      'app/js/photo-dom.js',
      'app/js/photo-form-model.js',
      'app/js/photo-overlay-ui.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: MODULE_RULES,
  },

  // 3. ui.js — ES module (all helpers now live in focused view modules).
  {
    files: ['app/js/ui.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Declared as `function escapeHtml` at module scope and re-used in
        // template literals throughout the same file
        escapeHtml:        'readonly',
        showToast:         'readonly',
      },
    },
    rules: MODULE_RULES,
  },

  // 4. mock.js — ES module (has export, no top-level import).
  //    console.log is intentional here (dev/test feedback).
  {
    files: ['app/js/mock.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      ...MODULE_RULES,
      'no-console': 'off',
    },
  },

  // ── Legacy non-module browser scripts ────────────────────────────────────
  //    Loaded as plain <script> tags; share state via window globals.

  // 5. grades.js — source of `GRADES`, `detectGradeSystem`, `initGradePicker`.
  //    Uses `var` intentionally so these land on window.
  //    No cross-file globals needed here.
  {
    files: ['app/js/grades.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      ...BASE_RULES,
      'no-var': 'off',   // var is intentional for window-exposure
    },
  },

  // 6. stats.js — consumes globals from grades.js and ui.js.
  {
    files: ['app/js/stats.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        GRADES:            'readonly',
        detectGradeSystem: 'readonly',
        escapeHtml:        'readonly',
        showToast:         'readonly',
        Chart:             'readonly',  // chart.js loaded via CDN
      },
    },
    rules: BASE_RULES,
  },

  // ── One-off admin / migration scripts ────────────────────────────────────
  // Pasted into the browser DevTools console while the app is running.
  // They access the app's already-loaded Firebase instance (`db`, `auth`, etc.)
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Firebase app globals exposed on window by the running app
        db:       'readonly',
        auth:     'readonly',
        firebase: 'readonly',
      },
    },
    rules: {
      ...BASE_RULES,
      // Console output is the primary feedback mechanism in these scripts
      'no-console': 'off',
      'no-alert':   'off',
    },
  },

  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'brainstorm/**',
      'docs/**',
      'images/**',
      'pages/**',
      'css/**',
    ],
  },
];
