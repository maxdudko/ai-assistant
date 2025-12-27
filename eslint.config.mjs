import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import prettierPlugin from 'eslint-plugin-prettier';

import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';

// ──────────────
// Global ignores
// ──────────────
const ignores = ['node_modules/**', 'dist/**', '.next/**', 'build/**', 'coverage/**'];

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
    rules: baseTSRules,
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

  // ──────────────
  // Client-specific rules (Next.js / React)
  // ──────────────
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
    },
    settings: {
      react: { version: 'detect' },
    },
  },
];
