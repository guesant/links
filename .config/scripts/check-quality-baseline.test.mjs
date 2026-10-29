import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { violationsFor } from './check-quality-baseline.mjs';
import { requireWebsite } from './paths.cjs';

const report = (messages) => {
  return [{ filePath: resolve('website/src/example.js'), messages }];
};

const baseline = {
  eslint: { 'website/src/example.js': { complexity: 2 } },
};

test('accepts warning counts at or below the baseline', () => {
  assert.deepEqual(
    violationsFor(
      report([
        { severity: 1, ruleId: 'complexity' },
        { severity: 1, ruleId: 'complexity' },
      ]),
      baseline,
    ),
    [],
  );
});

test('rejects new warning counts and errors', () => {
  assert.deepEqual(
    violationsFor(
      report([
        { severity: 1, ruleId: 'complexity' },
        { severity: 1, ruleId: 'complexity' },
        { severity: 1, ruleId: 'max-depth' },
        { severity: 2, ruleId: 'no-undef' },
      ]),
      baseline,
    ),
    [
      'website/src/example.js: ESLint error no-undef',
      'website/src/example.js: max-depth (1, baseline 0)',
    ],
  );
});

test('rejects regressions in a file without a baseline entry', () => {
  assert.deepEqual(
    violationsFor(
      [
        {
          filePath: resolve('website/src/new.js'),
          messages: [{ severity: 1, ruleId: 'max-depth' }],
        },
      ],
      baseline,
    ),
    ['website/src/new.js: max-depth (1, baseline 0)'],
  );
});

test('lint forbids ternaries in JavaScript, TypeScript and Svelte', async () => {
  const { ESLint } = requireWebsite('eslint');

  const eslint = new ESLint({
    overrideConfigFile: resolve('website/eslint.config.js'),
  });

  for (const [filePath, code] of [
    [
      'website/src/example.js',
      'export function label(active) { return active ? "yes" : "no"; }',
    ],
    [
      'website/src/example.ts',
      'export function label(active: boolean): string { return active ? "yes" : "no"; }',
    ],
    [
      'website/src/lib/Example.svelte',
      '<script lang="ts">let active = $state(true);</script><span>{active ? "yes" : "no"}</span>',
    ],
  ]) {
    const [result] = await eslint.lintText(code, { filePath });

    assert.ok(
      result.messages.some((message) => {
        return message.ruleId === 'no-ternary' && message.severity === 2;
      }),
      filePath,
    );
  }

  const [valid] = await eslint.lintText(
    `export function label(active: boolean): string {
  if (active) {
    return 'yes';
  }

  return 'no';
}
`,
    { filePath: 'website/src/example.ts' },
  );

  assert.equal(valid.errorCount, 0);
});
