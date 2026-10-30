import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  configCommentViolations,
  dockerfileCommentViolations,
} from './check-comment-policy.mjs';
import { requireWebsite, websiteRoot } from './paths.cjs';

const { ESLint } = requireWebsite('eslint');

const eslint = new ESLint({
  overrideConfigFile: resolve(websiteRoot, 'eslint.config.js'),
});

async function svelteViolations(source) {
  const [
    result,
  ] = await eslint.lintText(source, {
    filePath: resolve(websiteRoot, 'src/lib/CommentPolicyFixture.svelte'),
  });

  return result.messages.filter((message) => {
    return message.ruleId === 'lobby/no-narrative-comments';
  });
}

test('Dockerfile comment policy permits tool directives only', () => {
  assert.deepEqual(
    dockerfileCommentViolations(
      '# syntax=docker/dockerfile:1\n# hadolint ignore=DL3008\nFROM node:24\n',
    ),
    [],
  );
  assert.deepEqual(
    dockerfileCommentViolations('# Keep the image small\nFROM node:24\n'),
    [
      '.config/container/Dockerfile:1: narrative comments are not allowed',
    ],
  );
});

test('plain text configuration files reject comment-only lines', () => {
  assert.deepEqual(
    configCommentViolations('cache = true\n', 'config.toml'),
    [],
  );
  assert.deepEqual(
    configCommentViolations(
      '# retry temporarily\ncache = true\n',
      'config.toml',
    ),
    [
      'config.toml:1: comments are not allowed in this config',
    ],
  );
  assert.deepEqual(
    configCommentViolations(
      'url = "https://example.com/#fragment"\n',
      'config.toml',
    ),
    [],
  );
  assert.deepEqual(
    configCommentViolations('timeout = 10 # retry once\n', 'config.toml'),
    [
      'config.toml:1: comments are not allowed in this config',
    ],
  );
});

test('Svelte comments permit tool directives but reject narrative text', async () => {
  assert.deepEqual(
    await svelteViolations(
      '<!-- prettier-ignore -->\n<script>\n// eslint-disable-next-line no-console\nconst url = "https://example.com/a//b";\n</script>',
    ),
    [],
  );
  assert.equal(
    (
      await svelteViolations(
        '<!-- The page header starts here. -->\n<script>\n// Normalize values before rendering.\nconst value = 1;\n</script>',
      )
    ).length,
    2,
  );
});
