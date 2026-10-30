import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baselinePath = resolve('.config/quality-baseline.json');

function warningCounts(messages) {
  return messages.reduce((counts, message) => {
    if (message.severity === 1 && message.ruleId) {
      counts[message.ruleId] = (counts[message.ruleId] || 0) + 1;
    }

    return counts;
  }, {});
}

function fileViolations(file, baseline) {
  const path = relative(process.cwd(), file.filePath).replaceAll('\\', '/');

  const errors = file.messages
    .filter((message) => {
      return message.severity === 2;
    })
    .map((message) => {
      return `${path}: ESLint error ${message.ruleId}`;
    });

  const warnings = Object.entries(warningCounts(file.messages))
    .filter(
      ([
        rule,
        count,
      ]) => {
        return count > (baseline.eslint?.[path]?.[rule] || 0);
      },
    )
    .map(
      ([
        rule,
        count,
      ]) => {
        const allowed = baseline.eslint?.[path]?.[rule] || 0;

        return `${path}: ${rule} (${count}, baseline ${allowed})`;
      },
    );

  return [
    ...errors,
    ...warnings,
  ];
}

export function violationsFor(report, baseline) {
  return report.flatMap((file) => {
    return fileViolations(file, baseline);
  });
}

function currentBaseline(report) {
  const eslint = {};

  for (const file of report) {
    const path = relative(process.cwd(), file.filePath).replaceAll('\\', '/');

    const counts = warningCounts(file.messages);

    if (Object.keys(counts).length) {
      eslint[path] = counts;
    }
  }

  return {
    eslint,
  };
}

function runEslint() {
  const eslint = spawnSync(
    'website/node_modules/.bin/eslint',
    [
      '--config',
      'website/eslint.config.js',
      '.',
      '--format',
      'json',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  if (eslint.error) {
    throw eslint.error;
  }

  let report;

  try {
    report = JSON.parse(eslint.stdout);
  } catch {
    process.stderr.write(eslint.stderr);

    throw new Error('ESLint did not return a valid JSON report');
  }

  return {
    ...eslint,
    report,
  };
}

async function updateBaseline(report, eslintStatus) {
  let baseline;

  try {
    baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (baseline) {
    const regressions = violationsFor(report, baseline);

    if (regressions.length) {
      throw new Error(regressions.join('\n'));
    }
  }

  await writeFile(
    baselinePath,
    `${JSON.stringify(currentBaseline(report), null, 2)}\n`,
  );
  process.exit(eslintStatus || 0);
}

async function main() {
  const eslint = runEslint();

  if (process.argv.includes('--update-baseline')) {
    await updateBaseline(eslint.report, eslint.status);

    return;
  }

  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));

  const violations = violationsFor(eslint.report, baseline);

  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else if (eslint.status) {
    process.exit(eslint.status);
  } else {
    console.log('ESLint errors clear; warning counts are within the baseline.');
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
