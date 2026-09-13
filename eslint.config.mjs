import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import prettierPlugin from 'eslint-plugin-prettier';

import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';

import globals from 'globals';

// ──────────────
// Global ignores
// ──────────────
const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/build/**',
  '**/coverage/**',
  '**/generated/**',
  '**/next-env.d.ts',
  // Test files
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.e2e-spec.ts',
];

// ──────────────
// Base TS + JS rules
// ──────────────
const baseTSRules = {
  'prettier/prettier': 'error',

  // imports
  'import/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
    },
  ],

  // unused
  'unused-imports/no-unused-imports': 'error',
  '@typescript-eslint/no-unused-vars': 'off',

  // TypeScript
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/consistent-type-imports': 'error',
};

// ──────────────
// ESLint flat config export
// ──────────────
export default [
  // Global ignores
  { ignores },

  // Node.js global variables
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript rules (applies to all TS/TSX)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'unused-imports': unusedImportsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...baseTSRules,
      'no-unused-vars': 'off',
    },
  },

  // ──────────────
  // API-specific rules (NestJS)
  // ──────────────
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/require-await': 'warn',
    },
  },

  // Service worker globals (self, caches, clients)
  {
    files: ['**/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },

  // ──────────────
  // WEB-specific rules (Next.js / React)
  // ──────────────
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ignores: ['**/.next/**'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
];
