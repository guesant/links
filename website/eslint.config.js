import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';
import sonarjs from 'eslint-plugin-sonarjs';
import svelte from 'eslint-plugin-svelte';
import statementSpacing from './eslint-rules/statement-spacing.js';

const separatedStatements = [
  'const',
  'let',
  'var',
  'function',
  'class',
  'type',
  'interface',
  'enum',
  'if',
  'switch',
  'for',
  'while',
  'do',
  'try',
  'export',
  'cjs-export',
  'block',
  'iife',
];

export default [
  {
    ignores: [
      '.cache/**',
      'website/.svelte-kit/**',
      '.local/**',
      'website/node_modules/**',
      'website/static/assets/**',
    ],
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts,svelte}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { sonarjs, '@stylistic': stylistic, lobby: statementSpacing },
    rules: {
      'lobby/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: separatedStatements },
        { blankLine: 'always', prev: separatedStatements, next: '*' },
        {
          blankLine: 'always',
          prev: '*',
          next: ['return', 'throw'],
        },
        {
          blankLine: 'always',
          prev: { selector: 'SwitchCase[consequent.length>0]' },
          next: ['case', 'default'],
        },
        {
          blankLine: 'never',
          prev: { selector: 'SwitchCase[consequent.length=0]' },
          next: ['case', 'default'],
        },
        { blankLine: 'always', prev: ['import', 'cjs-import'], next: '*' },
        {
          blankLine: 'never',
          prev: ['import', 'cjs-import'],
          next: ['import', 'cjs-import'],
        },
      ],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/no-multiple-empty-lines': [
        'error',
        { max: 1, maxBOF: 0, maxEOF: 0 },
      ],
      '@stylistic/padded-blocks': ['error', 'never'],
      curly: ['error', 'all'],
      'arrow-body-style': ['error', 'always'],
      'no-ternary': 'error',
      'no-empty': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      complexity: ['warn', 15],
      'max-depth': ['warn', 4],
      'max-lines': [
        'warn',
        { max: 600, skipBlankLines: true, skipComments: true },
      ],
      'sonarjs/cognitive-complexity': ['warn', 15],
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/require-each-key': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: typescriptParser },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: typescriptParser },
    },
  },
  {
    files: ['.config/scripts/**/*.{js,mjs,cjs}'],
    rules: {
      'max-lines': [
        'warn',
        { max: 800, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['website/src/lib/SitePage.svelte'],
    rules: {
      'svelte/no-at-html-tags': 'off',
    },
  },
];
