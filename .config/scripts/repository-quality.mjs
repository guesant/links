import { spawn } from 'node:child_process';

const commands = [
  [
    'node',
    [
      '.config/scripts/check-comment-policy.mjs',
    ],
  ],
  [
    'ast-grep',
    [
      'test',
      '--config',
      '.config/ast-grep/sgconfig.yml',
    ],
  ],
  [
    'ast-grep',
    [
      'scan',
      '--config',
      '.config/ast-grep/sgconfig.yml',
      '.',
    ],
  ],
  [
    'yamllint',
    [
      '-c',
      '.config/yamllint.yml',
      '.config',
      '.github',
      'website/src/data',
    ],
  ],
  [
    'markdownlint-cli2',
    [
      '--config',
      '.config/.markdownlint-cli2.jsonc',
      'README.md',
      'LICENSES/**/*.md',
      'website/src/content/**/*.md',
    ],
  ],
  [
    'hadolint',
    [
      '--config',
      '.config/hadolint.yaml',
      '.config/container/Dockerfile',
    ],
  ],
];

for (const [
  name,
  args,
] of commands) {
  await new Promise((resolve, reject) => {
    const child = spawn(name, args, {
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();

        return;
      }

      reject(new Error(`${name} failed: ${code ?? signal}`));
    });
  });
}
