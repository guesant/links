import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import configuration from './configuration.cjs';
import accessibilityViewports from './accessibility-viewports.mjs';
import { syncFederation } from './federation.mjs';
import { requireWebsite } from './paths.cjs';

const { parse } = requireWebsite('yaml');

const config = parse(await readFile('website/src/data/links.yaml', 'utf8'));

const command = (name, args = [], env = {}, cwd = process.cwd()) => {
  return new Promise((accept, reject) => {
    const process = spawn(name, args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...globalThis.process.env,
        ...env,
      },
    });

    process.on('error', reject);
    process.on('exit', (code, signal) => {
      if (code === 0) {
        return accept();
      }

      return reject(new Error(`${name} failed: ${code ?? signal}`));
    });
  });
};

const routes = config.language_options.flatMap((language) => {
  return configuration
    .pagesFor(config, language.id)
    .filter((page) => {
      return !page.fallback;
    })
    .map((page) => {
      return page.url;
    });
});

const build = async (destination = '.local/build/site') => {
  await syncFederation();
  await command('node', [
    '.config/scripts/prepare-svelte-assets.mjs',
  ]);

  return command(
    'npm',
    [
      '--prefix',
      'website',
      'run',
      'build',
    ],
    {
      SITE_OUTPUT_DIR: resolve(destination),
      GITHUB_REPOSITORY:
        process.env.GITHUB_REPOSITORY || config.site.repository,
      GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL || 'https://github.com',
      GITHUB_SHA: process.env.LOBBY_SOURCE_SHA || process.env.GITHUB_SHA || '',
      GITHUB_RUN_ID: process.env.GITHUB_RUN_ID || '',
    },
  );
};

async function withServer(task) {
  const server = spawn(
    'serve',
    [
      '--no-clipboard',
      '--no-etag',
      '--listen',
      'tcp://127.0.0.1:4173',
      '.local/build/qa',
    ],
    {
      stdio: [
        'ignore',
        'ignore',
        'inherit',
      ],
    },
  );

  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await fetch('http://127.0.0.1:4173/'); // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request

        await response.arrayBuffer();

        if (response.ok) {
          break;
        }
      } catch {}

      if (attempt >= 50) {
        throw new Error('Preview server did not start');
      }

      await setTimeout(100);
    }

    await task();
  } finally {
    server.kill('SIGTERM');
  }
}

async function tests() {
  await command('node', [
    '--test',
    '.config/scripts/check-stats.mjs',
    '.config/scripts/check-content.mjs',
    '.config/scripts/check-listing.test.mjs',
    '.config/scripts/check-link-retries.mjs',
    '.config/scripts/check-raster.mjs',
    '.config/scripts/check-pointer-sound.mjs',
    '.config/scripts/check-language-preference.mjs',
    '.config/scripts/check-language-navigation.test.mjs',
    '.config/scripts/check-link-view.mjs',
    '.config/scripts/check-federation.mjs',
    '.config/scripts/check-interface.mjs',
    '.config/scripts/check-search.mjs',
    '.config/scripts/check-quality-baseline.test.mjs',
    '.config/scripts/check-code-spacing.test.mjs',
    '.config/scripts/check-workspace.mjs',
    '.config/scripts/check-comment-policy.test.mjs',
    '.config/scripts/check-ci.test.mjs',
    '.config/scripts/check-publish-stats.test.mjs',
  ]);
}

async function secretScan() {
  const secretScanPaths = [
    '.config',
    '.github',
    'website/src',
    'website/package.json',
    'website/package-lock.json',
    'README.md',
    'justfile',
    'LICENSES',
  ];

  for (const path of secretScanPaths) {
    await command('gitleaks', [
      'dir',
      '--redact',
      '--no-banner',
      path,
    ]);
  }
}

async function security() {
  await command('node', [
    '.config/scripts/check-osv.mjs',
  ]);
  await command('trivy', [
    'fs',
    '--no-progress',
    '--scanners',
    'vuln,secret',
    '--severity',
    'CRITICAL,HIGH',
    '--exit-code',
    '1',
    '--skip-dirs',
    '.git',
    '--skip-dirs',
    '.cache',
    '--skip-dirs',
    '.local',
    '--skip-dirs',
    'website/node_modules',
    '--skip-dirs',
    'website/.svelte-kit',
    '.',
  ]);
  await command('semgrep', [
    'scan',
    '--config',
    'auto',
    '--error',
    '--exclude',
    'website/node_modules/**',
    '--exclude',
    'website/.svelte-kit/**',
    '--exclude',
    '.cache/**',
    '--exclude',
    '.local/**',
    'website/src',
    '.config/scripts',
  ]);
}

async function checkFast() {
  await command('npm', [
    '--prefix',
    'website',
    'run',
    'format',
  ]);
  await command('just', [
    '--fmt',
    '--check',
  ]);
  await command('npm', [
    '--prefix',
    'website',
    'run',
    'lint',
  ]);
  await command('npm', [
    '--prefix',
    'website',
    'run',
    'check',
  ]);
  await command('actionlint');
  await command('zizmor', [
    '--offline',
    '.github/workflows',
  ]);
  await secretScan();
  await tests();
}

async function check() {
  await checkFast();
  await security();
  await mkdir('.local/reports', {
    recursive: true,
  });
  await build('.local/build/qa');

  const pa11y = JSON.parse(await readFile('.config/pa11yci.json', 'utf8'));

  pa11y.urls = routes.flatMap((path) => {
    return [
      'dark',
      'light',
    ].map((theme) => {
      return {
        url: `http://127.0.0.1:4173${path}`,
        actions: [
          'click element [data-settings-open]',
          `click element label[for="theme-${theme}"]`,
          'click element #settings-dialog [data-dialog-close]',
        ],
      };
    });
  });

  const pageAudits = pa11y.urls.length;

  pa11y.urls.push(
    ...config.language_options.flatMap((language) => {
      return [
        language.path,
        `${language.path}code/`,
      ].flatMap((path) => {
        return [
          'dark',
          'light',
        ].map((theme) => {
          return {
            url: `http://127.0.0.1:4173${path}`,
            actions: [
              'click element label[for="link-view-detailed"]',
              'click element [data-settings-open]',
              `click element label[for="theme-${theme}"]`,
              'click element #settings-dialog [data-dialog-close]',
            ],
          };
        });
      });
    }),
  );
  pa11y.urls.push(
    ...config.language_options.flatMap((language) => {
      return [
        'dark',
        'light',
      ].map((theme) => {
        return {
          url: `http://127.0.0.1:4173${language.path}career/`,
          rootElement: '.profile-navigation',
          actions: [
            'click element [data-settings-open]',
            `click element label[for="theme-${theme}"]`,
            'click element #settings-dialog [data-dialog-close]',
          ],
        };
      });
    }),
    ...config.language_options.flatMap((language) => {
      return [
        'dark',
        'light',
      ].flatMap((theme) => {
        return [
          'settings',
          'credits',
        ].map((dialog) => {
          const resolveActions = () => {
            if (dialog === 'credits') {
              return [
                'click element #settings-dialog [data-dialog-close]',
                'click element [data-credits-open]',
              ];
            }

            return [];
          };

          return {
            url: `http://127.0.0.1:4173${language.path}`,
            actions: [
              'click element [data-settings-open]',
              `click element label[for="theme-${theme}"]`,
              ...resolveActions(),
            ],
          };
        });
      });
    }),
  );
  await withServer(async () => {
    await accessibilityViewports(
      pa11y.urls.slice(0, pageAudits + config.language_options.length * 6),
      pa11y.defaults,
    );
    await writeFile('.local/reports/pa11y.json', JSON.stringify(pa11y));
    await command('pa11y-ci', [
      '--config=.local/reports/pa11y.json',
    ]);
    await command(
      'node',
      [
        '.config/scripts/check-layout.cjs',
      ],
      {
        QA_BASE_URL: 'http://127.0.0.1:4173',
        QA_REPORT_DIR: resolve('.local/reports'),
      },
    );
  });
  await build('.local/build/lighthouse');

  const lighthouse = JSON.parse(
    await readFile('.config/lighthouserc.json', 'utf8'),
  );

  lighthouse.ci.collect.url = routes.map((path) => {
    return `http://localhost${path}`;
  });
  lighthouse.ci.collect.staticDistDir = resolve('.local/build/lighthouse');
  lighthouse.ci.upload.outputDir = 'reports';
  await writeFile('.local/reports/lighthouse.json', JSON.stringify(lighthouse));
  await mkdir('.cache/lighthouseci', {
    recursive: true,
  });
  await command(
    'lhci',
    [
      'autorun',
      `--config=${resolve('.local/reports/lighthouse.json')}`,
    ],
    {},
    resolve('.cache/lighthouseci'),
  );
  await build();
  await command('node', [
    '.config/scripts/verify-links.mjs',
  ]);
}

const task = process.argv[2];

try {
  const formatScript = () => {
    if (task === 'format') {
      return 'format';
    }

    return 'format-fix';
  };

  const justFormatArguments = () => {
    if (task === 'format') {
      return [
        '--check',
      ];
    }

    return [];
  };

  switch (task) {
    case 'dev':
      await syncFederation();
      await command('node', [
        '.config/scripts/prepare-svelte-assets.mjs',
      ]);
      await command('npm', [
        '--prefix',
        'website',
        'run',
        'dev',
      ]);
      break;

    case 'build':
      await build();
      break;

    case 'lighthouse-baseline':
      await build('.local/build/lighthouse-baseline');
      await command('node', [
        '.config/scripts/lighthouse-baseline.mjs',
      ]);
      break;

    case 'preview':
      await command('serve', [
        '--no-clipboard',
        '--no-etag',
        '--listen',
        'tcp://0.0.0.0:4173',
        '.local/build/site',
      ]);
      break;

    case 'test':
      await tests();
      break;

    case 'check':
      await check();
      break;

    case 'check-fast':
      await checkFast();
      break;

    case 'ci':
      await checkFast();
      await build();
      break;

    case 'format':
    case 'format-fix':
      await command('npm', [
        '--prefix',
        'website',
        'run',
        formatScript(),
      ]);
      await command('just', [
        '--fmt',
        ...justFormatArguments(),
      ]);
      break;

    default:
      throw new Error('Unknown task');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
