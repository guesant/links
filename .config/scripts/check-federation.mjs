import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadFeed, validateFeed } from './federation.mjs';

const source = {
  id: 'blog',
  origin: 'https://blog.guesant.net',
  url: 'https://blog.guesant.net/lobby.json',
};
const entry = {
  id: 'post-one',
  language: 'pt-br',
  type: 'post',
  title: 'A public post',
  summary: 'Public summary',
  url: 'https://blog.guesant.net/posts/one/',
  tags: ['testing'],
  metadata: { date: '2026-01-01' },
};
const feed = (items = [entry]) => ({ version: 1, source: 'blog', items });
test('federation keeps only public allowlisted fields', () => {
  const result = validateFeed(
    feed([
      {
        ...entry,
        secret: 'hidden',
        metadata: { secret: 'hidden', date: '2026-01-01' },
      },
    ]),
    source,
  );
  assert(!JSON.stringify(result).includes('hidden'));
  assert.equal(result.items[0].source, 'blog');
  assert.equal(result.items[0].metadata.date, '2026-01-01');
  assert.deepEqual(validateFeed(feed([]), source).items, []);
});
test('resume projects retain only safe declared public platform URLs', () => {
  const resume = { id: 'resume', origin: 'https://curriculum.guesant.net' };
  const project = {
    ...entry,
    type: 'project',
    url: 'https://curriculum.guesant.net/en/#project-one',
    metadata: { content_url: 'https://github.com/guesant/ava-pro' },
  };
  const input = { version: 1, source: 'resume', items: [project] };
  const result = validateFeed(input, resume).items[0];
  assert.equal(result.url, project.url);
  assert.equal(result.metadata.content_url, project.metadata.content_url);
  for (const url of [
    'javascript:alert(1)',
    'http://github.com/guesant/ava-pro',
    'https://github.com.evil.test/guesant/ava-pro',
    'https://user:secret@github.com/guesant/ava-pro',
    'https://github.com:444/guesant/ava-pro',
  ])
    assert.throws(() =>
      validateFeed(
        { ...input, items: [{ ...project, metadata: { content_url: url } }] },
        resume,
      ),
    );
  assert.throws(() =>
    validateFeed({ ...input, items: [{ ...project, type: 'case' }] }, resume),
  );
  assert.throws(() =>
    validateFeed(feed([{ ...entry, metadata: project.metadata }]), source),
  );
});
for (const [name, modify] of [
  [
    'unknown version',
    (value) => {
      value.version = 2;
    },
  ],
  [
    'wrong source',
    (value) => {
      value.source = 'resume';
    },
  ],
  [
    'unknown type',
    (value) => {
      value.items[0].type = 'unknown';
    },
  ],
  [
    'missing title',
    (value) => {
      value.items[0].title = '';
    },
  ],
  [
    'duplicate identifier',
    (value) => {
      value.items.push({ ...value.items[0] });
    },
  ],
  [
    'unsafe URL',
    (value) => {
      value.items[0].url = 'javascript:alert(1)';
    },
  ],
  [
    'wrong canonical host',
    (value) => {
      value.items[0].url = 'https://blog.guesant.net.evil.test/post';
    },
  ],
  [
    'credentials',
    (value) => {
      value.items[0].url = 'https://user:pass@blog.guesant.net/post';
    },
  ],
  [
    'private',
    (value) => {
      value.items[0].private = true;
    },
  ],
  [
    'disabled',
    (value) => {
      value.items[0].enabled = false;
    },
  ],
  [
    'draft',
    (value) => {
      value.items[0].draft = true;
    },
  ],
  [
    'nonpublic',
    (value) => {
      value.items[0].public = false;
    },
  ],
]) {
  test(`federation rejects ${name}`, () => {
    const value = structuredClone(feed());
    modify(value);
    assert.throws(() => validateFeed(value, source));
  });
}
test('federation uses valid cache only for network failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lobby-feed-'));
  try {
    const messages = [];
    const options = {
      cacheDirectory: directory,
      warn: (message) => messages.push(message),
    };
    await loadFeed(source, {
      ...options,
      fetcher: async () => ({
        ok: true,
        text: async () => JSON.stringify(feed()),
      }),
    });
    const result = await loadFeed(source, {
      ...options,
      fetcher: async () => {
        throw new Error('Offline');
      },
    });
    assert.equal(result.items.length, 1);
    assert.equal(messages.length, 1);
    await assert.rejects(
      loadFeed(source, {
        ...options,
        fetcher: async () => ({
          ok: true,
          text: async () => JSON.stringify({ ...feed(), version: 9 }),
        }),
      }),
    );
    assert.equal(
      JSON.parse(await readFile(join(directory, 'blog.json'), 'utf8')).version,
      1,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('federation fails without usable cache and supports local generated inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lobby-feed-'));
  try {
    const fetcher = async () => {
      throw new Error('Offline');
    };
    await assert.rejects(
      loadFeed(source, { cacheDirectory: directory, fetcher }),
      /No valid feed/,
    );
    const localFile = join(directory, 'local.json');
    await writeFile(localFile, JSON.stringify(feed([])));
    assert.deepEqual(
      (
        await loadFeed(source, {
          cacheDirectory: directory,
          fetcher,
          localFile,
        })
      ).items,
      [],
    );
    await writeFile(localFile, '{}');
    await assert.rejects(
      loadFeed(source, { cacheDirectory: directory, localFile }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
