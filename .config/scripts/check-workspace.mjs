import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { repositoryRoot, websiteRoot, requireWebsite } from './paths.cjs';

const appFiles = [
  'package.json',
  'package-lock.json',
  'svelte.config.js',
  'vite.config.js',
  'tsconfig.json',
  'eslint.config.js',
  'prettier.config.js',
  '.prettierignore',
  '.stylelintrc.json',
  'src',
];

test('application sources and npm tooling live exclusively in website', async () => {
  for (const file of appFiles) {
    await access(resolve(websiteRoot, file));
    await assert.rejects(access(resolve(repositoryRoot, file)), {
      code: 'ENOENT',
    });
  }
});

test('tooling resolves pinned dependencies from the website package', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(websiteRoot, 'package.json'), 'utf8'),
  );

  const lock = JSON.parse(
    await readFile(resolve(websiteRoot, 'package-lock.json'), 'utf8'),
  );

  assert.equal(manifest.name, lock.name);
  assert.deepEqual(manifest.dependencies, lock.packages[''].dependencies);
  assert.deepEqual(manifest.devDependencies, lock.packages[''].devDependencies);

  for (const dependency of [
    'yaml',
    'sharp',
    'typescript',
    'prettier-plugin-svelte',
  ]) {
    assert(
      requireWebsite
        .resolve(dependency)
        .startsWith(resolve(websiteRoot, 'node_modules')),
    );
  }
});

test('asset catalogs point to existing files in website', async () => {
  const { parse } = requireWebsite('yaml');

  for (const name of ['design-assets', 'cursor-assets']) {
    const catalog = parse(
      await readFile(resolve(repositoryRoot, `.config/${name}.yaml`), 'utf8'),
    );

    for (const asset of catalog.assets) {
      for (const file of [asset.file, asset.source].filter(Boolean)) {
        assert(file.startsWith('website/src/'));
        await access(resolve(repositoryRoot, file));
      }
    }
  }
});

test('style policy accepts relative tokens and equal grid tracks with intrinsic controls', async () => {
  const { default: stylelint } = await import(
    requireWebsite.resolve('stylelint')
  );

  const result = await stylelint.lint({
    code: `:root {
  --space-test: 1rem;
  --grid-track: minmax(0, 1fr);
}

.grid {
  display: grid;
  grid-template-columns: auto var(--grid-track) var(--space-test);
  gap: var(--space-test);
  width: 100%;
}

@media (width >= 36rem) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}`,
    configFile: resolve(websiteRoot, '.stylelintrc.json'),
  });

  assert.equal(
    result.errored,
    false,
    JSON.stringify(
      result.results.map((entry) => {
        return entry.warnings;
      }),
    ),
  );
});

test('style policy rejects absolute units, untokenized lengths and unequal fractional tracks', async () => {
  const { default: stylelint } = await import(
    requireWebsite.resolve('stylelint')
  );

  for (const [code, rule] of [
    [':root { --space-test: 12px; }', 'unit-disallowed-list'],
    ['.grid { padding: 1rem; }', 'declaration-property-value-disallowed-list'],
    [
      '.grid { width: calc(100% - 2rem); }',
      'declaration-property-value-disallowed-list',
    ],
    [
      '.grid { grid-template-columns: 2fr 1fr; }',
      'declaration-property-value-disallowed-list',
    ],
    [
      '.grid { grid-template-columns: minmax(0, .5fr) 1fr; }',
      'declaration-property-value-disallowed-list',
    ],
    [
      ':root { --grid-columns-2: 1fr 1.5fr; }',
      'declaration-property-value-disallowed-list',
    ],
  ]) {
    const result = await stylelint.lint({
      code,
      configFile: resolve(websiteRoot, '.stylelintrc.json'),
    });

    assert.equal(result.errored, true, code);
    assert.ok(
      result.results[0].warnings.some((warning) => {
        return warning.rule === rule;
      }),
      code,
    );
  }
});
