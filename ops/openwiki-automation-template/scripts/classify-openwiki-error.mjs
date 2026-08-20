import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const CATEGORIES = Object.freeze([
  "oauth",
  "managed-markers",
  "langsmith",
  "rate-limit",
  "model",
  "context-limit",
  "network",
  "unknown",
]);

const STRONG_OAUTH_PATTERNS = [
  /\binvalid[_ -]?grant\b/u,
  /\b(?:failed|failure|error|unable|could not|cannot|expired|invalid|revoked)[^\n]{0,80}\brefresh(?:ing)? (?:the )?(?:oauth )?(?:access )?token\b/u,
  /\brefresh(?:ing)? (?:the )?(?:oauth )?(?:access )?token[^\n]{0,80}\b(?:failed|failure|error|unable|could not|cannot|expired|invalid|revoked)\b/u,
  /\btoken refresh[^\n]{0,80}\b(?:failed|failure|unable|could not|cannot|expired|invalid|revoked)\b/u,
  /\boauth[^\n]{0,80}\b(?:expired|invalid|failed|failure|unauthorized|revoked)\b/u,
  /\b(?:expired|invalid|failed|failure|unauthorized|revoked)[^\n]{0,80}\boauth\b/u,
  /\bchatgpt (?:login|authentication|authorization)[^\n]{0,80}\b(?:expired|invalid|failed|failure|required|unauthorized)\b/u,
  /\bchatgpt token request failed\b/u,
  /\bchatgpt token response missing required fields\b/u,
  /\bfailed to extract account id from chatgpt access token\b/u,
];

const CATEGORY_PATTERNS = Object.freeze({
  "managed-markers": [
    /\bopenwiki managed markers are (?:malformed|duplicated)\b/u,
    /\bmarkers (?:are )?(?:malformed|duplicated)\b[^\n]{0,100}\bopenwiki\b/u,
  ],
  langsmith: [
    /\b(?:langsmith|langchain tracing|langchain[_ -]api[_ -]key)\b[^\n]{0,100}\b(?:error|failed|failure|unauthorized|forbidden|invalid|missing|required|timed? ?out|401|403|429)\b/u,
    /\b(?:error|failed|failure|unauthorized|forbidden|invalid|missing|required|timed? ?out|401|403|429)\b[^\n]{0,100}\b(?:langsmith|langchain tracing|langchain[_ -]api[_ -]key)\b/u,
  ],
  "rate-limit": [
    /\brate[ _-]?limit(?:ed|ing)?\b/u,
    /\btoo many requests\b/u,
    /\bquota (?:exceeded|exhausted)\b/u,
    /\b(?:http(?: status)?\s*)?429\b/u,
  ],
  "context-limit": [
    /\bcontext (?:length|limit|window)[^\n]{0,100}\b(?:exceed|too (?:large|long)|maximum|max)\w*\b/u,
    /\bmaximum context (?:length|window)\b/u,
    /\btoo many tokens\b/u,
    /\btoken limit[^\n]{0,80}\b(?:exceed|maximum|max)\w*\b/u,
    /\bcontext_length_exceeded\b/u,
  ],
  model: [
    /\bmodel(?: id)?[^\n]{0,100}\b(?:not found|does not exist|unsupported|unavailable|invalid|deprecated|not available)\b/u,
    /\b(?:unknown|unsupported|invalid) model\b/u,
    /\bmodel_not_found\b/u,
  ],
  network: [
    /\b(?:econnreset|econnrefused|enotfound|etimedout|eai_again)\b/u,
    /\b(?:network|socket|connection|dns)[^\n]{0,80}\b(?:error|failed|failure|reset|refused|timed? ?out|unreachable)\b/u,
    /\b(?:fetch failed|failed to fetch|request timed? ?out|tls handshake)\b/u,
  ],
});

const BROAD_OAUTH_PATTERNS = [
  /\bunauthorized\b/u,
  /\bauthentication failed\b/u,
  /(^|[^0-9])401([^0-9]|$)/u,
];

export function classifyOpenWikiError(logText) {
  const normalized = String(logText).toLowerCase();

  if (STRONG_OAUTH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "oauth";
  }

  for (const category of [
    "managed-markers",
    "langsmith",
    "rate-limit",
    "context-limit",
    "model",
    "network",
  ]) {
    if (CATEGORY_PATTERNS[category].some((pattern) => pattern.test(normalized))) {
      return category;
    }
  }

  if (BROAD_OAUTH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "oauth";
  }

  return "unknown";
}

async function main() {
  if (process.argv.length !== 3) {
    process.stdout.write("unknown\n");
    return;
  }

  try {
    const logText = await readFile(process.argv[2], "utf8");
    process.stdout.write(`${classifyOpenWikiError(logText)}\n`);
  } catch {
    // File paths and read errors can also contain secrets. Keep CLI output closed.
    process.stdout.write("unknown\n");
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  await main();
}

export { CATEGORIES };
