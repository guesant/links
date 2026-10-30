import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { requireWebsite } from './paths.cjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { parse, stringify } = requireWebsite('yaml');

const root = fileURLToPath(new URL('../../', import.meta.url));

const integer = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid public statistic');
  }

  return value;
};

async function request(url, options, fetcher) {
  const response = await fetcher(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function collectGitHub(entry, fetcher = fetch) {
  const url = new URL(entry.url);

  const parts = url.pathname.split('/').filter(Boolean);

  if (url.hostname !== 'github.com' || parts.length !== 1) {
    throw new Error('GitHub statistics require a profile URL');
  }

  const username = parts[0];

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
  };

  if (process.env.GITHUB_STATS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_STATS_TOKEN}`;
  }

  const endpoint = `https://api.github.com/users/${encodeURIComponent(username)}`;

  const user = await request(
    endpoint,
    {
      headers,
    },
    fetcher,
  );

  if (user.login?.toLowerCase() !== username.toLowerCase()) {
    throw new Error('GitHub returned a different profile');
  }

  const repositories = new Map();

  for (let page = 1; ; page += 1) {
    if (page > 100) {
      throw new Error('GitHub pagination exceeded safety limit');
    }

    const entries = await request(
      `${endpoint}/repos?type=owner&per_page=100&page=${page}`,
      {
        headers,
      },
      fetcher,
    );

    if (!Array.isArray(entries)) {
      throw new Error('Invalid repository response');
    }

    for (const repository of entries) {
      if (repository.private !== false || !repository.id) {
        throw new Error('Repository response is not explicitly public');
      }

      if (repository.owner?.login?.toLowerCase() !== username.toLowerCase()) {
        throw new Error('Repository belongs to another account');
      }

      repositories.set(repository.id, repository);
    }

    if (entries.length < 100) {
      break;
    }
  }

  const publicRepositories = [
    ...repositories.values(),
  ];

  return {
    username: user.login,
    metrics: {
      followers: integer(user.followers),
      repositories: integer(user.public_repos),
      stars: publicRepositories.reduce((sum, item) => {
        return sum + integer(item.stargazers_count);
      }, 0),
      forks: publicRepositories.reduce((sum, item) => {
        return sum + integer(item.forks_count);
      }, 0),
    },
  };
}

export async function collectLeetCode(entry, fetcher = fetch) {
  const url = new URL(entry.url);

  const parts = url.pathname.split('/').filter(Boolean);

  if (
    url.hostname !== 'leetcode.com' ||
    parts[0] !== 'u' ||
    parts.length !== 2
  ) {
    throw new Error('LeetCode statistics require a profile URL');
  }

  const username = parts[1];

  const result = await request(
    'https://leetcode.com/graphql/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.com/',
      },
      body: JSON.stringify({
        query:
          'query($username: String!) { matchedUser(username: $username) { username profile { ranking } submitStatsGlobal { acSubmissionNum { difficulty count } } } allQuestionsCount { difficulty count } }',
        variables: {
          username,
        },
      }),
    },
    fetcher,
  );

  const user = result.data?.matchedUser;

  if (
    result.errors?.length ||
    user?.username?.toLowerCase() !== username.toLowerCase()
  ) {
    throw new Error('LeetCode returned an invalid profile');
  }

  const solved = user.submitStatsGlobal?.acSubmissionNum;

  const totals = result.data.allQuestionsCount;

  if (!Array.isArray(solved) || !Array.isArray(totals)) {
    throw new Error('LeetCode returned invalid counts');
  }

  const metrics = {
    ranking: integer(user.profile?.ranking),
  };

  const available = {};

  for (const difficulty of [
    'All',
    'Easy',
    'Medium',
    'Hard',
  ]) {
    const resolveKey = () => {
      if (difficulty === 'All') {
        return 'solved';
      }

      return difficulty.toLowerCase();
    };

    const key = resolveKey();

    metrics[key] = integer(
      solved.find((item) => {
        return item.difficulty === difficulty;
      })?.count,
    );
    available[key] = integer(
      totals.find((item) => {
        return item.difficulty === difficulty;
      })?.count,
    );

    if (metrics[key] > available[key]) {
      throw new Error('Solved count exceeds total');
    }
  }

  if (metrics.easy + metrics.medium + metrics.hard !== metrics.solved) {
    throw new Error('LeetCode difficulty counts do not add up');
  }

  return {
    username: user.username,
    metrics,
    available,
  };
}

export async function updateStats({
  configurationPath = resolve(root, 'website/src/data/links.yaml'),
  outputPath = resolve(root, 'website/src/data/statistics.yaml'),
  fetcher = fetch,
  now = () => {
    return new Date();
  },
} = {}) {
  const configuration = parse(await readFile(configurationPath, 'utf8'));

  let previousText = '';

  try {
    previousText = await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const resolvePrevious = () => {
    if (previousText) {
      return parse(previousText);
    }

    return {};
  };

  const previous = resolvePrevious();

  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) {
    throw new Error('Invalid statistics cache');
  }

  const next = {
    ...previous,
  };

  const providers = {
    github: collectGitHub,
    leetcode: collectLeetCode,
  };

  const results = [];

  const entries = configuration.sections
    .filter((section) => {
      return section.enabled !== false && section.public !== false;
    })
    .flatMap((section) => {
      return section.links;
    })
    .filter((entry) => {
      return entry.enabled !== false && entry.public !== false && entry.stats;
    });

  const ids = new Set();

  for (const entry of entries) {
    if (
      !entry.id ||
      ids.has(entry.id) ||
      !providers[entry.stats.provider] ||
      !Array.isArray(entry.stats.metrics) ||
      !entry.stats.metrics.length
    ) {
      throw new Error('Invalid statistics provider configuration');
    }

    ids.add(entry.id);

    try {
      const data = await providers[entry.stats.provider](entry, fetcher);

      const snapshot = {
        ...data,
        profile_url: entry.url,
        provider: entry.stats.provider,
        updated_at: now().toISOString(),
      };

      for (const key of entry.stats.metrics) {
        integer(snapshot.metrics[key]);
      }

      next[entry.id] = snapshot;
      results.push({
        id: entry.id,
        status: 'updated',
      });
    } catch (error) {
      const cached =
        previous[entry.id]?.profile_url === entry.url &&
        previous[entry.id]?.provider === entry.stats.provider;

      const resolveStatus = () => {
        if (cached) {
          return 'cached';
        }

        return 'unavailable';
      };

      results.push({
        id: entry.id,
        status: resolveStatus(),
        reason: error.message,
      });
    }
  }

  if (
    results.some((entry) => {
      return entry.status === 'updated';
    })
  ) {
    await mkdir(dirname(outputPath), {
      recursive: true,
    });

    const temporary = `${outputPath}.${process.pid}.tmp`;

    await writeFile(temporary, stringify(next), {
      mode: 0o644,
    });
    await rename(temporary, outputPath);
  }

  return results;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(JSON.stringify(await updateStats()));
}
