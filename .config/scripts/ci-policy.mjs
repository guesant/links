import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateSha(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    throw new Error('Invalid CI source SHA');
  }

  return value;
}

export function validateRepository(value) {
  if (typeof value !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(value)) {
    throw new Error('Invalid CI repository');
  }

  return value;
}

export function resolveRun({ eventName, ref, sha, operation = 'validate' }) {
  const operations = {
    push: 'publish',
    pull_request: 'validate',
    schedule: 'statistics',
    workflow_dispatch: operation,
  };

  const selected = operations[eventName];

  if (
    ![
      'validate',
      'audit',
      'publish',
      'statistics',
    ].includes(selected)
  ) {
    throw new Error('Unsupported CI operation or event');
  }

  const publish = [
    'publish',
    'statistics',
  ].includes(selected);

  if (publish && ref !== 'refs/heads/main') {
    throw new Error('Publication and statistics require the main branch');
  }

  return {
    operation: selected,
    update_statistics: selected === 'statistics',
    source_sha: validateSha(sha),
    publish,
  };
}

export async function deploymentStatus({
  sha,
  repository,
  token,
  fetcher = fetch,
}) {
  validateSha(sha);
  validateRepository(repository);

  if (!token) {
    throw new Error('Missing deployment verification credentials');
  }

  const response = await fetcher(
    `https://api.github.com/repos/${repository}/git/ref/heads/main`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'guesant-lobby-ci',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    },
  );

  if (!response.ok) {
    throw new Error(`Cannot verify current main: HTTP ${response.status}`);
  }

  const current = validateSha((await response.json()).object?.sha);

  return {
    current: current === sha,
    source_sha: sha,
    main_sha: current,
  };
}

export async function writeCiOutputs(result, summary, env = process.env) {
  const output = env.CI_OUTPUT_PATH;

  const summaryPath = env.CI_SUMMARY_PATH;

  if (!output || !summaryPath) {
    throw new Error('Missing CI output or summary path');
  }

  for (const path of [
    output,
    summaryPath,
  ]) {
    await mkdir(dirname(path), {
      recursive: true,
    });
  }

  await writeFile(
    output,
    Object.entries(result)
      .map(
        ([
          key,
          value,
        ]) => {
          return `${key}=${value}\n`;
        },
      )
      .join(''),
  );
  await writeFile(summaryPath, `${summary}\n`);
}

async function main() {
  if (process.argv[2] === 'plan') {
    const result = resolveRun({
      eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      operation: process.env.CI_OPERATION || 'validate',
    });

    await writeCiOutputs(
      result,
      `Operation: ${result.operation}. Source: ${result.source_sha}.`,
    );

    return;
  }

  if (process.argv[2] !== 'deployment') {
    throw new Error('Unknown CI policy command');
  }

  const result = await deploymentStatus({
    sha: process.env.CI_SOURCE_SHA,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
  });

  let summary = `Deploying current main ${result.source_sha}.`;

  if (!result.current) {
    summary = `Deployment skipped: built ${result.source_sha}, but main is now ${result.main_sha}.`;
  }

  await writeCiOutputs(result, summary);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
