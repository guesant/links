import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  collectGitHub,
  collectLeetCode,
  updateStats,
} from "./update-stats.mjs";

const { parse, stringify } = createRequire(import.meta.url)("yaml");
const source = parse(await readFile("src/data/links.yaml", "utf8"));
const entries = source.sections.flatMap((section) => section.links);
const github = entries.find((entry) => entry.stats?.provider === "github");
const leetcode = entries.find((entry) => entry.stats?.provider === "leetcode");
const username = (entry) =>
  new URL(entry.url).pathname.split("/").filter(Boolean).at(-1);
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
const repository = (id) => ({
  id,
  private: false,
  owner: { login: username(github) },
  stargazers_count: 2,
  forks_count: 1,
});
const leetData = () => ({
  data: {
    matchedUser: {
      username: username(leetcode),
      profile: { ranking: 7 },
      submitStatsGlobal: {
        acSubmissionNum: [
          { difficulty: "All", count: 6 },
          { difficulty: "Easy", count: 3 },
          { difficulty: "Medium", count: 2 },
          { difficulty: "Hard", count: 1 },
        ],
      },
    },
    allQuestionsCount: ["All", "Easy", "Medium", "Hard"].map((difficulty) => ({
      difficulty,
      count: 100,
    })),
  },
});
const fetcher = async (url) => {
  if (String(url).startsWith("https://leetcode.com/"))
    return response(leetData());
  if (String(url).includes("/repos?")) return response([repository(1)]);
  return response({ login: username(github), followers: 4, public_repos: 1 });
};

test("public GitHub statistics and request boundaries", async () => {
  const requests = [];
  const result = await collectGitHub(github, async (url, options) => {
    requests.push({ url, options });
    return fetcher(url);
  });
  assert.deepEqual(result.metrics, {
    followers: 4,
    repositories: 1,
    stars: 2,
    forks: 1,
  });
  assert(
    requests.every(
      ({ url, options }) =>
        new URL(url).hostname === "api.github.com" &&
        options.signal &&
        options.redirect === "error",
    ),
  );
});
test("GitHub pagination does not duplicate repositories", async () => {
  const result = await collectGitHub(github, async (url) => {
    if (!String(url).includes("/repos?")) return fetcher(url);
    return response(
      String(url).includes("page=2")
        ? [repository(100), repository(101)]
        : Array.from({ length: 100 }, (_, index) => repository(index + 1)),
    );
  });
  assert.equal(result.metrics.stars, 202);
});
for (const [name, mutation] of [
  [
    "private",
    (item) => {
      item.private = true;
    },
  ],
  [
    "unknown visibility",
    (item) => {
      delete item.private;
    },
  ],
  [
    "other owner",
    (item) => {
      item.owner.login = "fixture-owner";
    },
  ],
  [
    "invalid count",
    (item) => {
      item.stargazers_count = -1;
    },
  ],
]) {
  test(`GitHub rejects ${name}`, async () => {
    const item = repository(1);
    mutation(item);
    await assert.rejects(
      collectGitHub(github, async (url) =>
        String(url).includes("/repos?") ? response([item]) : fetcher(url),
      ),
    );
  });
}
test("LeetCode uses public GraphQL data, not a card service", async () => {
  const result = await collectLeetCode(leetcode, async (url, options) => {
    assert.equal(new URL(url).hostname, "leetcode.com");
    assert.equal(
      JSON.parse(options.body).variables.username,
      username(leetcode),
    );
    return response(leetData());
  });
  assert.deepEqual(result.metrics, {
    ranking: 7,
    solved: 6,
    easy: 3,
    medium: 2,
    hard: 1,
  });
});
for (const [name, mutate] of [
  [
    "GraphQL errors",
    (data) => {
      data.errors = [{ message: "fixture-error" }];
    },
  ],
  [
    "missing account",
    (data) => {
      data.data.matchedUser = null;
    },
  ],
  [
    "mismatched account",
    (data) => {
      data.data.matchedUser.username = "fixture-account";
    },
  ],
  [
    "partial counts",
    (data) => {
      data.data.matchedUser.submitStatsGlobal.acSubmissionNum.pop();
    },
  ],
  [
    "invalid totals",
    (data) => {
      data.data.allQuestionsCount[0].count = 0;
    },
  ],
  [
    "inconsistent counts",
    (data) => {
      data.data.matchedUser.submitStatsGlobal.acSubmissionNum[0].count = 9;
    },
  ],
]) {
  test(`LeetCode rejects ${name}`, async () => {
    const data = leetData();
    mutate(data);
    await assert.rejects(collectLeetCode(leetcode, async () => response(data)));
  });
}
test("atomic cache updates and failure retention", async () => {
  const directory = await mkdtemp(join(tmpdir(), "links-statistics-"));
  try {
    const outputPath = join(directory, "statistics.yaml");
    const configurationPath = join(directory, "links.yaml");
    await writeFile(configurationPath, stringify(source));
    const options = {
      outputPath,
      configurationPath,
      fetcher,
      now: () => new Date("2026-01-01T00:00:00Z"),
    };
    const results = await updateStats(options);
    assert(results.every((result) => result.status === "updated"));
    const valid = await readFile(outputPath, "utf8");
    const cached = parse(valid);
    assert.equal(cached[github.id].profile_url, github.url);
    for (const failure of [
      async () => response({}, 429),
      async () => {
        throw new Error("fixture-timeout");
      },
      async () => new Response("invalid JSON"),
    ]) {
      const result = await updateStats({ ...options, fetcher: failure });
      assert(result.every((item) => item.status === "cached"));
      assert.equal(await readFile(outputPath, "utf8"), valid);
    }
    await updateStats({
      ...options,
      fetcher: async (url) =>
        String(url).includes("leetcode.com") ? response({}, 503) : fetcher(url),
      now: () => new Date("2026-01-02T00:00:00Z"),
    });
    const partial = parse(await readFile(outputPath, "utf8"));
    assert.deepEqual(partial[leetcode.id], cached[leetcode.id]);
    assert.notEqual(
      partial[github.id].updated_at,
      cached[github.id].updated_at,
    );
    const changed = structuredClone(source);
    changed.sections
      .flatMap((section) => section.links)
      .find((entry) => entry.id === github.id).url =
      "https://github.com/fixture-account";
    await writeFile(configurationPath, stringify(changed));
    const changedResults = await updateStats({
      ...options,
      fetcher: async () => response({}, 503),
    });
    assert.equal(
      changedResults.find((item) => item.id === github.id).status,
      "unavailable",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("first failed collection does not fabricate a cache", async () => {
  const directory = await mkdtemp(join(tmpdir(), "links-statistics-"));
  try {
    const outputPath = join(directory, "missing.yaml");
    const results = await updateStats({
      outputPath,
      fetcher: async () => response({}, 503),
    });
    assert(results.every((item) => item.status === "unavailable"));
    await assert.rejects(readFile(outputPath), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
