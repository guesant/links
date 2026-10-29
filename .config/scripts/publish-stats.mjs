import { spawnSync } from 'node:child_process';

const token = process.env.GITHUB_STATS_TOKEN;

const repository = process.env.GITHUB_REPOSITORY;

if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository || '')) {
  throw new Error('Missing workflow credentials or repository');
}

const git = (...args) => {
  const result = spawnSync(
    'git',
    ['-c', 'safe.directory=/workspace', ...args],
    { stdio: 'inherit' },
  );

  if (result.error) throw new Error('Git could not run');

  return result.status;
};

if (git('diff', '--quiet', '--', 'src/data/statistics.yaml') === 0)
  process.exit(0);

for (const args of [
  ['add', '--', 'src/data/statistics.yaml'],
  [
    '-c',
    'user.name=github-actions[bot]',
    '-c',
    'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit',
    '-m',
    'chore(stats): refresh public statistics',
    '--',
    'src/data/statistics.yaml',
  ],
  [
    '-c',
    'credential.helper=',
    '-c',
    `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
    'push',
    `https://github.com/${repository}.git`,
    'HEAD:main',
  ],
]) {
  if (git(...args) !== 0) throw new Error('Statistics publication failed');
}

const response = await fetch(
  `https://api.github.com/repos/${repository}/actions/workflows/pages.yml/dispatches`,
  {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({ ref: 'main' }),
    signal: AbortSignal.timeout(20000),
  },
);

if (!response.ok)
  throw new Error(`Pages dispatch failed: HTTP ${response.status}`);
