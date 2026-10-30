import * as sveltePlugin from 'prettier-plugin-svelte';
import * as multilineArraysPlugin from 'prettier-plugin-multiline-arrays';

export default {
  plugins: [
    sveltePlugin,
    multilineArraysPlugin,
  ],
  singleQuote: true,
  trailingComma: 'all',
  objectWrap: 'preserve',
  multilineArraysWrapThreshold: 0,
  overrides: [
    {
      files: '*.svelte',
      options: {
        htmlWhitespaceSensitivity: 'ignore',
      },
    },
  ],
};
