#!/usr/bin/env node
import {
  evaluateAuthorization,
  evaluatePolicyPromotion,
  loadPolicy,
} from "./policy.mjs";

const token = process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const requestedPull = process.env.PR_NUMBER?.trim();
const runUrl = process.env.RUN_URL?.trim()
  || `https://github.com/${repository}/actions/workflows/owner-authorization.yml`;

if (!token || !repository || !repository.includes("/")) {
  throw new Error("GH_TOKEN y GITHUB_REPOSITORY son obligatorios.");
}

const policy = loadPolicy();

async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${await response.text()}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function paginate(path) {
  const nodes = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await api(`${path}${separator}per_page=100&page=${page}`);
    nodes.push(...batch);
    if (batch.length < 100) {
      return nodes;
    }
  }
}

async function publishStatus(sha, context, result) {
  const combined = await api(`/repos/${repository}/commits/${sha}/status`);
  const current = combined.statuses.find((status) => status.context === context);
  if (current?.state === result.state && current?.description === result.description) {
    console.log(`${sha.slice(0, 7)}: sin cambios (${result.state})`);
    return;
  }
  await api(`/repos/${repository}/statuses/${sha}`, {
    method: "POST",
    body: JSON.stringify({
      state: result.state,
      context,
      description: result.description,
      target_url: runUrl,
    }),
  });
  console.log(`${sha.slice(0, 7)}: ${result.state} — ${result.description}`);
}

async function productionDeploymentsForCommit(headSha) {
  const deployments = await paginate(
    `/repos/${repository}/deployments?environment=Production&ref=${encodeURIComponent(headSha)}&task=gymnasia-policy`,
  );
  return Promise.all(deployments.map(async (deployment) => {
    const statusesPath = new URL(deployment.statuses_url).pathname;
    const statuses = await paginate(statusesPath);
    return { ...deployment, latestStatus: statuses[0]?.state ?? null };
  }));
}

async function reconcilePull(number) {
  const pull = await api(`/repos/${repository}/pulls/${number}`);
  if (pull.state !== "open" || pull.base.ref !== policy.defaultBranch) {
    console.log(`#${number}: ignorada (${pull.state}, base ${pull.base.ref})`);
    return;
  }
  const [fileNodes, reviews] = await Promise.all([
    paginate(`/repos/${repository}/pulls/${number}/files`),
    paginate(`/repos/${repository}/pulls/${number}/reviews`),
  ]);
  const authorization = evaluateAuthorization({
    policy,
    author: pull.user,
    headSha: pull.head.sha,
    files: fileNodes.map((node) => node.filename),
    reviews,
  });
  const promotion = evaluatePolicyPromotion({
    policy,
    headSha: pull.head.sha,
    files: fileNodes.map((node) => node.filename),
    deployments: await productionDeploymentsForCommit(pull.head.sha),
  });
  await publishStatus(
    pull.head.sha,
    policy.checks.ownerAuthorization,
    authorization,
  );
  await publishStatus(
    pull.head.sha,
    policy.checks.policyPromotion,
    promotion,
  );
}

let pullNumbers;
if (requestedPull) {
  if (!/^\d+$/.test(requestedPull)) {
    throw new Error("PR_NUMBER debe ser un entero positivo.");
  }
  pullNumbers = [Number(requestedPull)];
} else {
  const pulls = await paginate(`/repos/${repository}/pulls?state=open&base=${encodeURIComponent(policy.defaultBranch)}`);
  pullNumbers = pulls.map((pull) => pull.number);
}

const failures = [];
for (const number of pullNumbers) {
  try {
    await reconcilePull(number);
  } catch (error) {
    failures.push(`#${number}: ${error.message}`);
  }
}
if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}
