import fs from "node:fs";

const username = "donovanmchenry";
const trackedRepositories = [
  "donovanmchenry/njitschedulepro",
  "donovanmchenry/njitemptyroomfinder",
];
const maximumItems = 5;

const ignoredCommitMessages = [
  /^merge\b/i,
  /^auto-update course schedules\b/i,
  /^chore\(deps\)/i,
  /^bump\b/i,
];

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${username}-profile-readme`,
  "X-GitHub-Api-Version": "2022-11-28",
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

async function fetchCommits(repository) {
  const url = new URL(`https://api.github.com/repos/${repository}/commits`);
  url.searchParams.set("author", username);
  url.searchParams.set("per_page", "20");

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${repository}`);
  }

  const commits = await response.json();
  return commits
    .map((commit) => ({
      repository,
      sha: commit.sha,
      message: commit.commit.message.split("\n", 1)[0].trim(),
      date: commit.commit.author.date,
      url: commit.html_url,
    }))
    .filter((commit) =>
      commit.message && !ignoredCommitMessages.some((pattern) => pattern.test(commit.message)),
    );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function escapeMarkdown(value) {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

const commits = (await Promise.all(trackedRepositories.map(fetchCommits)))
  .flat()
  .sort((left, right) => new Date(right.date) - new Date(left.date))
  .slice(0, maximumItems);

if (commits.length === 0) {
  throw new Error("No meaningful commits were returned for the tracked repositories");
}

const generatedSection = commits
  .map((commit) => {
    const shortName = commit.repository.split("/")[1];
    return `- [\`${shortName}\`](https://github.com/${commit.repository}) [${escapeMarkdown(commit.message)}](${commit.url}) · ${formatDate(commit.date)}`;
  })
  .join("\n");

const readmePath = new URL("../README.md", import.meta.url);
const readme = fs.readFileSync(readmePath, "utf8");
const startMarker = "<!-- recent-work:start -->";
const endMarker = "<!-- recent-work:end -->";

if (!readme.includes(startMarker) || !readme.includes(endMarker)) {
  throw new Error("Recent-work markers are missing from README.md");
}

const nextReadme = readme.replace(
  new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`),
  `${startMarker}\n${generatedSection}\n${endMarker}`,
);

fs.writeFileSync(readmePath, nextReadme);
