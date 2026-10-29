import * as sveltePlugin from 'prettier-plugin-svelte';

export default {
  plugins: [sveltePlugin],
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '*.svelte',
      options: {
        htmlWhitespaceSensitivity: 'ignore',
      },
    },
  ],
};
