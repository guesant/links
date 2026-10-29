import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = JSON.parse(await readFile('.config/lighthouserc.json', 'utf8'));

const reports = resolve('.local/reports/lighthouse-baseline');

await mkdir(reports, { recursive: true });

async function verifyMedians(directory, formFactor) {
  const scores = new Map();

  for (const file of await readdir(directory)) {
    if (!file.endsWith('.report.json')) {
      continue;
    }

    const report = JSON.parse(await readFile(resolve(directory, file), 'utf8'));

    if (report.configSettings.formFactor !== formFactor) {
      throw new Error(
        `Unexpected Lighthouse form factor: ${report.configSettings.formFactor}`,
      );
    }

    const path = new URL(report.finalUrl).pathname;

    const values = scores.get(path) || [];

    values.push(report.categories.performance.score);
    scores.set(path, values);
  }

  if (scores.size !== 4) {
    throw new Error(`Expected four Lighthouse routes, received ${scores.size}`);
  }

  const threshold =
    base.ci.assert.assertions['categories:performance'][1].minScore;

  for (const [path, values] of scores) {
    values.sort((left, right) => {
      return left - right;
    });

    const median = values[1];

    console.log(
      `${formFactor} ${path}: ${values.join(', ')}; median ${median}`,
    );

    if (values.length !== 3 || median < threshold) {
      throw new Error(
        `Lighthouse ${formFactor} ${path} median must reach ${threshold}`,
      );
    }
  }
}

for (const formFactor of ['mobile', 'desktop']) {
  const config = structuredClone(base);

  const resolveSettings = () => {
    if (formFactor === 'desktop') {
      return { preset: 'desktop' };
    }

    return { formFactor };
  };

  config.ci.collect = {
    ...config.ci.collect,
    url: [
      'http://localhost/pt-br/',
      'http://localhost/pt-br/code/',
      'http://localhost/pt-br/terminal/',
      'http://localhost/pt-br/terminal/code/',
    ],
    staticDistDir: resolve('.local/build/lighthouse-baseline'),
    numberOfRuns: 3,
    settings: {
      ...config.ci.collect.settings,
      ...resolveSettings(),
    },
  };
  config.ci.upload.outputDir = resolve(reports, formFactor);

  const configPath = resolve(reports, `${formFactor}.json`);

  await rm(config.ci.upload.outputDir, { recursive: true, force: true });
  await mkdir(config.ci.upload.outputDir, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const result = spawnSync('lhci', ['autorun', `--config=${configPath}`], {
    cwd: config.ci.upload.outputDir,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Lighthouse ${formFactor} baseline failed`);
  }

  await verifyMedians(config.ci.upload.outputDir, formFactor);
}
