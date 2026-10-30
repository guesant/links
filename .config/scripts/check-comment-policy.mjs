import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const dockerfile = '.config/container/Dockerfile';

const dockerfileDirective =
  /^#\s*(?:syntax=|escape=|check=|hadolint\s+ignore=)/;

const plainCommentFiles = [
  '.config/lychee.toml',
  '.gitignore',
  '.dockerignore',
];

export function dockerfileCommentViolations(source) {
  return source.split(/\r?\n/).flatMap((line, index) => {
    const trimmed = line.trim();

    if (!trimmed.startsWith('#') || dockerfileDirective.test(trimmed)) {
      return [];
    }

    return [
      `${dockerfile}:${index + 1}: narrative comments are not allowed`,
    ];
  });
}

export function configCommentViolations(source, path) {
  return source.split(/\r?\n/).flatMap((line, index) => {
    const startsComment = line.trimStart().startsWith('#');

    const containsTomlComment = path.endsWith('.toml') && tomlHasComment(line);

    if (!startsComment && !containsTomlComment) {
      return [];
    }

    return [
      `${path}:${index + 1}: comments are not allowed in this config`,
    ];
  });
}

function tomlHasComment(line) {
  let quote = '';

  let escaped = false;

  for (const character of line) {
    const state = advanceTomlCommentState(character, quote, escaped);

    if (state.comment) {
      return true;
    }

    quote = state.quote;
    escaped = state.escaped;
  }

  return false;
}

function advanceTomlCommentState(character, quote, escaped) {
  if (escaped) {
    return {
      quote,
      escaped: false,
      comment: false,
    };
  }

  if (character === '\\' && quote === '"') {
    return {
      quote,
      escaped: true,
      comment: false,
    };
  }

  if (
    (character === '"' || character === "'") &&
    (!quote || quote === character)
  ) {
    if (quote) {
      return {
        quote: '',
        escaped: false,
        comment: false,
      };
    }

    return {
      quote: character,
      escaped: false,
      comment: false,
    };
  }

  if (character === '#' && !quote) {
    return {
      quote,
      escaped,
      comment: true,
    };
  }

  return {
    quote,
    escaped,
    comment: false,
  };
}

async function main() {
  const violations = dockerfileCommentViolations(
    await readFile(dockerfile, 'utf8'),
  );

  for (const path of plainCommentFiles) {
    violations.push(
      ...configCommentViolations(await readFile(path, 'utf8'), path),
    );
  }

  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
