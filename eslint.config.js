import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';

export default [
  {
    ignores: [
      '.cache/**',
      '.svelte-kit/**',
      '.local/**',
      'node_modules/**',
      'static/assets/**',
    ],
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.svelte'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-empty': 'off',
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/require-each-key': 'off',
    },
  },
  {
    files: ['**/+page.svelte'],
    rules: {
      'svelte/no-at-html-tags': 'off',
    },
  },
];
