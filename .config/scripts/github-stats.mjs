import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const username = process.env.GITHUB_STATS_USERNAME || "guesant";
const token = process.env.GITHUB_STATS_TOKEN || "";
const outputPath = process.env.GITHUB_STATS_OUTPUT;

if (!outputPath) {
  throw new Error("GITHUB_STATS_OUTPUT is required");
}

const request = async (url) => {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }

  return response.json();
};

const user = await request(`https://api.github.com/users/${username}`);
const repositories = [];

for (let page = 1; ; page += 1) {
  const pageRepositories = await request(
    `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`,
  );
  repositories.push(...pageRepositories);
  if (pageRepositories.length < 100) {
    break;
  }
}

const stars = repositories.reduce(
  (total, repository) => total + repository.stargazers_count,
  0,
);
const forks = repositories.reduce(
  (total, repository) => total + repository.forks_count,
  0,
);
const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="467" height="195" viewBox="0 0 467 195" role="img" aria-labelledby="title description">
  <title id="title">GitHub activity for ${escapeXml(user.login)}</title>
  <desc id="description">Public GitHub profile activity summary, refreshed by GitHub Actions.</desc>
  <rect width="467" height="195" rx="8" fill="#1d2b3b" />
  <rect x="1" y="1" width="465" height="193" rx="7" fill="none" stroke="#72b7ff" stroke-width="2" />
  <text x="24" y="42" fill="#a7d4ff" font-family="Arial, sans-serif" font-size="23" font-weight="700">GitHub activity</text>
  <text x="24" y="70" fill="#c2c2c2" font-family="Arial, sans-serif" font-size="16">${escapeXml(user.login)}</text>
  <g fill="#f4f4f4" font-family="Arial, sans-serif" font-size="15">
    <text x="24" y="108">${user.followers} followers</text>
    <text x="220" y="108">${user.public_repos} repositories</text>
    <text x="24" y="140">${stars} stars</text>
    <text x="220" y="140">${forks} forks</text>
  </g>
  <text x="24" y="174" fill="#72b7ff" font-family="Arial, sans-serif" font-size="12">Updated by GitHub Actions</text>
</svg>
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, card, "utf8");
