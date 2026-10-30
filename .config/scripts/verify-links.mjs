import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function verifyTransientFailures(report, request = fetch) {
  const failures = Object.values(report.error_map || {}).flat();

  if (!failures.length && !report.errors) {
    return [];
  }

  const transient = new Set([
    429,
    500,
    502,
    503,
    504,
  ]);

  if (
    !failures.length ||
    failures.some((entry) => {
      return !transient.has(entry.status.code);
    })
  ) {
    throw new Error('Link validation contains non-retriable errors');
  }

  const verified = [];

  for (const url of new Set(
    failures.map((entry) => {
      return entry.url;
    }),
  )) {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Invalid retry URL');
    }

    const response = await request(url, {
      method: 'GET',
      signal: AbortSignal.timeout(20000),
      headers: {
        'User-Agent': 'links-validation',
      },
    });

    await response.body?.cancel();

    if (!response.ok) {
      throw new Error(`Link retry failed: HTTP ${response.status} ${url}`);
    }

    verified.push({
      url,
      status: response.status,
      method: 'GET',
    });
  }

  return verified;
}

async function main() {
  const cacheDirectory = resolve('.cache/lychee');

  const configPath = resolve('.config/lychee.toml');

  const publicPath = resolve('.local/build/site');

  const reportPath = resolve('.local/reports/links.json');

  await mkdir(cacheDirectory, {
    recursive: true,
  });
  await mkdir('.local/reports', {
    recursive: true,
  });
  await writeFile(reportPath, '');

  const result = spawnSync(
    'lychee',
    [
      '--config',
      configPath,
      '--root-dir',
      publicPath,
      '--format',
      'json',
      '--output',
      reportPath,
      publicPath,
    ],
    {
      cwd: cacheDirectory,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && result.status !== 2) {
    throw new Error(`Link checker failed: ${result.status}`);
  }

  const report = JSON.parse(await readFile(reportPath, 'utf8'));

  let verified = [];

  if (result.status !== 0) {
    await setTimeout(2000);
    verified = await verifyTransientFailures(report);
  }

  await writeFile(
    '.local/reports/link-retries.json',
    JSON.stringify(
      {
        verified,
        checked_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      unique: report.unique,
      errors: 0,
      verified_retries: verified,
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
