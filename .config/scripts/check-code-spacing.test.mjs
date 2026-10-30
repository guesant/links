import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { requireWebsite, websiteRoot } from './paths.cjs';

const { ESLint } = requireWebsite('eslint');

const prettier = requireWebsite('prettier');

const typescript = requireWebsite('typescript');

const configFile = resolve(websiteRoot, 'eslint.config.js');

const spacingRules = new Set([
  'lobby/padding-line-between-statements',
  '@stylistic/lines-between-class-members',
  '@stylistic/object-curly-newline',
  '@stylistic/no-multiple-empty-lines',
  '@stylistic/padded-blocks',
]);

const fixtures = [
  {
    file: 'src/spacing-fixture.js',
    source: `import 'node:assert';

import 'node:path';
const initial = 2;
const limit = 4;
export function collect(ready) {
  let total = initial;
  if (!ready) { return total; }
  for (const value of [initial, limit]) { total += value; }
  while (total < limit) { total += 1; }
  do { total += 1; } while (total < limit);
  try { total += 1; } catch { total = initial; }
  switch (total) {
    case 0: return initial;
    default: return total;
  }
}`,
  },
  {
    file: 'src/spacing-fixture.ts',
    source: `type Count = number;
interface Totals { value: Count; }
export enum Phase { Ready }
export function total(record: Totals): Count {
  const next = (): Count => { return record.value; };
  if (Phase.Ready === 0) { return next(); }
  throw new Error('Unexpected phase');
}`,
  },
  {
    file: 'src/class-spacing-fixture.ts',
    source: `export class Counter {
  value = 0;
  increment(): void { this.value += 1; }
  reset(): void { this.value = 0; }
}`,
  },
  {
    file: 'src/object-spacing-fixture.js',
    source: `export default { meta: { type: 'problem', docs: { description: 'rule' }, schema: ['rule'] }, create(context) { return context.report({ loc, messageId: 'narrative' }); } };`,
  },
  {
    file: 'src/lib/SpacingFixture.svelte',
    source: `<script lang="ts">
import 'node:assert';

import 'node:path';
let { active = true }: { active?: boolean } = $props();
const start = 1;
const end = 2;
function label(): number {
  if (active) { return start; }
  return end;
}
</script>
<span>{label()}</span>`,
  },
];

function scriptTokens(source) {
  const code = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] || source;

  const scanner = typescript.createScanner(
    typescript.ScriptTarget.Latest,
    true,
    typescript.LanguageVariant.Standard,
    code,
  );

  const tokens = [];

  while (scanner.scan() !== typescript.SyntaxKind.EndOfFileToken) {
    tokens.push(scanner.getTokenText());
  }

  return tokens;
}

function semanticTokens(source) {
  const tokens = scriptTokens(source);

  return tokens.filter((token, index) => {
    const next = tokens[index + 1];

    return (
      token !== ',' ||
      ![
        '}',
        ']',
        ')',
      ].includes(next)
    );
  });
}

for (const fixture of fixtures) {
  test(`spacing is detected, fixed and stable in ${fixture.file}`, async () => {
    const filePath = resolve(websiteRoot, fixture.file);

    const options = await prettier.resolveConfig(filePath, {
      config: resolve(websiteRoot, 'prettier.config.js'),
    });

    const format = (source) => {
      return prettier.format(source, {
        ...options,
        filepath: filePath,
      });
    };

    const before = await format(fixture.source);

    const eslint = new ESLint({
      overrideConfigFile: configFile,
    });

    const [
      unformatted,
    ] = await eslint.lintText(before, {
      filePath,
    });

    assert.ok(
      unformatted.messages.some((message) => {
        return spacingRules.has(message.ruleId);
      }),
      fixture.file,
    );

    const fixer = new ESLint({
      overrideConfigFile: configFile,
      fix: true,
      fixTypes: [
        'layout',
      ],
    });

    const [
      fixed,
    ] = await fixer.lintText(before, {
      filePath,
    });

    const after = await format(fixed.output || before);

    const [
      checked,
    ] = await eslint.lintText(after, {
      filePath,
    });

    assert.deepEqual(
      checked.messages.filter((message) => {
        return spacingRules.has(message.ruleId);
      }),
      [],
    );
    assert.deepEqual(semanticTokens(after), semanticTokens(before));

    const [
      repeated,
    ] = await fixer.lintText(after, {
      filePath,
    });

    assert.equal(await format(repeated.output || after), after);

    if (fixture.file.endsWith('.svelte')) {
      assert.match(after, /const start = 1;\n\s*\n\s*const end = 2;/);
      assert.match(after, /const end = 2;\n\s*\n\s*function label/);
    }

    if (fixture.source.includes("import 'node:path'")) {
      assert.match(
        after,
        /import 'node:assert';\n\s*import 'node:path';\n\s*\n/,
      );
    }

    if (fixture.file.endsWith('object-spacing-fixture.js')) {
      assert.match(after, /export default \{\n/);
      assert.match(after, /docs: \{\n/);
      assert.match(after, /context\.report\(\{\n/);
      assert.match(after, /schema: \[\n\s*'rule',\n\s*\],/);
    }
  });
}
