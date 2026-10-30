import { spawn } from 'node:child_process';

export function blockingAdvisories(report) {
  const results = report.results || [];

  return results
    .flatMap((result) => {
      return result.packages || [];
    })
    .flatMap((entry) => {
      const groups = entry.groups || [];

      return groups
        .filter((group) => {
          return Number(group.max_severity) >= 7;
        })
        .map((group) => {
          return {
            name: entry.package.name,
            version: entry.package.version,
            ids: group.ids,
            severity: group.max_severity,
          };
        });
    });
}

function reportedAdvisories(report) {
  const results = report.results || [];

  return results.flatMap((result) => {
    return (result.packages || []).flatMap((entry) => {
      return (entry.groups || []).map((group) => {
        return {
          name: entry.package.name,
          version: entry.package.version,
          ids: group.ids,
          severity: group.max_severity,
        };
      });
    });
  });
}

function runScanner() {
  return new Promise((resolve, reject) => {
    const output = [];

    const scanner = spawn(
      'osv-scanner',
      [
        'scan',
        'source',
        '--recursive',
        'website',
        '--format',
        'json',
      ],
      {
        stdio: [
          'ignore',
          'pipe',
          'inherit',
        ],
      },
    );

    scanner.stdout.on('data', (chunk) => {
      output.push(chunk);
    });

    scanner.on('error', reject);
    scanner.on('close', (code, signal) => {
      if (code === null) {
        reject(new Error(`osv-scanner terminated: ${signal}`));

        return;
      }

      resolve({
        code,
        output: Buffer.concat(output).toString('utf8'),
      });
    });
  });
}

const result = await runScanner();

if (result.code !== 0 && result.code !== 1) {
  throw new Error(`osv-scanner failed: ${result.code}`);
}

const report = JSON.parse(result.output);

const blocking = blockingAdvisories(report);

const allAdvisories = reportedAdvisories(report);

const nonBlocking = allAdvisories.filter((advisory) => {
  return Number(advisory.severity) < 7;
});

for (const advisory of nonBlocking) {
  console.warn(
    `OSV below HIGH threshold: ${advisory.name}@${advisory.version} ${advisory.ids.join(', ')} (${advisory.severity})`,
  );
}

if (blocking.length > 0) {
  console.error('OSV found HIGH or CRITICAL vulnerabilities:');

  for (const advisory of blocking) {
    console.error(
      `${advisory.name}@${advisory.version} ${advisory.ids.join(', ')} (${advisory.severity})`,
    );
  }

  process.exitCode = 1;
}
