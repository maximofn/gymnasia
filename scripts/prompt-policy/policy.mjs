import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(moduleDirectory, "../..");
export const policyPath = join(repositoryRoot, ".github", "prompt-policy.json");
export const codeownersPath = join(repositoryRoot, ".github", "CODEOWNERS");
export const rulesetPath = join(repositoryRoot, ".github", "rulesets", "protect-main.json");

export function loadPolicy() {
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  validatePolicy(policy);
  return policy;
}

export function validatePolicy(policy) {
  if (policy?.schemaVersion !== 1) {
    throw new Error("prompt-policy.json debe usar schemaVersion 1.");
  }
  if (policy.defaultBranch !== "main") {
    throw new Error("La rama protegida debe ser main.");
  }
  if (policy.owner?.login !== "maximofn" || policy.owner?.userId !== 15805036) {
    throw new Error("El único propietario válido debe ser maximofn (15805036).");
  }
  if (policy.owner.codeowner !== "@maximofn") {
    throw new Error("El CODEOWNER debe ser @maximofn.");
  }
  if (!Array.isArray(policy.sensitivePaths) || policy.sensitivePaths.length === 0) {
    throw new Error("La política debe declarar rutas sensibles.");
  }

  const paths = new Set();
  for (const entry of policy.sensitivePaths) {
    if (!entry || !["directory", "file"].includes(entry.kind)) {
      throw new Error("Cada ruta sensible debe declarar kind directory o file.");
    }
    if (typeof entry.path !== "string" || entry.path.startsWith("/") || entry.path.includes("..")) {
      throw new Error(`Ruta sensible inválida: ${entry.path}`);
    }
    if (entry.kind === "directory" && !entry.path.endsWith("/")) {
      throw new Error(`El directorio sensible debe terminar en /: ${entry.path}`);
    }
    if (entry.kind === "file" && entry.path.endsWith("/")) {
      throw new Error(`El fichero sensible no puede terminar en /: ${entry.path}`);
    }
    if (paths.has(entry.path)) {
      throw new Error(`Ruta sensible duplicada: ${entry.path}`);
    }
    paths.add(entry.path);
  }

  for (const required of [".github/", "prompts/", "apps/mobile/", "policy/", "AGENTS.md", "CLAUDE.md"] ) {
    if (!paths.has(required)) {
      throw new Error(`Falta la frontera sensible obligatoria ${required}.`);
    }
  }

  if (policy.checks?.policy !== "prompt-policy"
    || policy.checks?.ownerAuthorization !== "gymnasia/owner-authorization"
    || policy.checks?.githubActionsAppId !== 15368) {
    throw new Error("El catálogo de checks obligatorios no coincide con la política aprobada.");
  }
}

export function normalizeRepositoryPath(value) {
  return `${value}`
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

export function matchingSensitiveEntry(value, policy = loadPolicy()) {
  const normalized = normalizeRepositoryPath(value);
  return policy.sensitivePaths.find((entry) => entry.kind === "directory"
    ? normalized.startsWith(entry.path)
    : normalized === entry.path);
}

export function isSensitivePath(value, policy = loadPolicy()) {
  return Boolean(matchingSensitiveEntry(value, policy));
}

export function renderCodeowners(policy = loadPolicy()) {
  const lines = [
    "# Generated from .github/prompt-policy.json. Do not edit by hand.",
    "# Run: npm run sync:prompt-policy",
    "",
  ];
  for (const entry of policy.sensitivePaths) {
    lines.push(`/${entry.path} ${policy.owner.codeowner}`);
  }
  return `${lines.join("\n")}\n`;
}

export function createRuleset(policy = loadPolicy()) {
  return {
    name: "Protect main and sensitive policy",
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: {
      ref_name: {
        include: ["~DEFAULT_BRANCH"],
        exclude: [],
      },
    },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: true,
          allowed_merge_methods: ["merge", "squash", "rebase"],
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: false,
          required_status_checks: [
            {
              context: policy.checks.policy,
              integration_id: policy.checks.githubActionsAppId,
            },
            {
              context: policy.checks.ownerAuthorization,
              integration_id: policy.checks.githubActionsAppId,
            },
          ],
        },
      },
    ],
  };
}

export function renderRuleset(policy = loadPolicy()) {
  return `${JSON.stringify(createRuleset(policy), null, 2)}\n`;
}

export function evaluateAuthorization({ policy, author, headSha, files, reviews }) {
  const sensitiveFiles = files.filter((file) => isSensitivePath(file, policy));
  if (sensitiveFiles.length === 0) {
    return {
      state: "success",
      description: "No sensitive paths changed; merge remains manual",
      sensitiveFiles,
    };
  }

  if (author?.login === policy.owner.login && author?.id === policy.owner.userId) {
    return {
      state: "success",
      description: "Sensitive change authored by @maximofn",
      sensitiveFiles,
    };
  }

  const decisiveReviews = reviews
    .filter((review) => review?.user?.login === policy.owner.login
      && review?.user?.id === policy.owner.userId
      && review.commit_id === headSha
      && ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state))
    .sort((left, right) => Number(left.id || 0) - Number(right.id || 0));
  const approved = decisiveReviews.at(-1)?.state === "APPROVED";

  return {
    state: approved ? "success" : "pending",
    description: approved
      ? "Current commit approved by @maximofn"
      : "Sensitive change requires @maximofn approval",
    sensitiveFiles,
  };
}

function walkYamlFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkYamlFiles(path));
    } else if (/\.ya?ml$/i.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

export function workflowFiles() {
  return [
    ...walkYamlFiles(join(repositoryRoot, ".github", "workflows")),
    ...walkYamlFiles(join(repositoryRoot, "ops", "openwiki-automation-template", ".github", "workflows")),
  ];
}

export function assertWorkflowPolicy() {
  const errors = [];
  for (const path of workflowFiles()) {
    const source = readFileSync(path, "utf8");
    const displayPath = relative(repositoryRoot, path);
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)) {
      const reference = match[1];
      if (!reference.startsWith("./") && !/@[0-9a-f]{40}$/i.test(reference)) {
        errors.push(`${displayPath}: Action mutable ${reference}`);
      }
    }

    const runsOnUntrustedPullRequest = /^\s{2}pull_request:\s*$/m.test(source);
    if (runsOnUntrustedPullRequest) {
      if (/\$\{\{\s*secrets\./.test(source)) {
        errors.push(`${displayPath}: un workflow de PR no puede leer secrets`);
      }
      if (/^\s{2,}[a-zA-Z_-]+:\s*write\s*$/m.test(source)) {
        errors.push(`${displayPath}: un workflow de PR no puede tener permisos write`);
      }
    }

    if (/^\s{2}pull_request_target:\s*$/m.test(source)) {
      if (displayPath !== ".github/workflows/owner-authorization.yml") {
        errors.push(`${displayPath}: pull_request_target solo está permitido para la autorización de metadatos`);
      }
      for (const forbidden of [
        "github.event.pull_request.head",
        "actions/checkout",
        "secrets.",
        "npm ci",
      ]) {
        if (source.includes(forbidden)) {
          errors.push(`${displayPath}: pull_request_target contiene el patrón prohibido ${forbidden}`);
        }
      }
    }
  }

  const promptWorkflow = readFileSync(join(repositoryRoot, ".github", "workflows", "prompt-policy.yml"), "utf8");
  if (!/^\s{2}pull_request:\s*$/m.test(promptWorkflow)
    || !/^\s{2}push:\s*$/m.test(promptWorkflow)
    || !/^\s{2}prompt-policy:\s*$/m.test(promptWorkflow)) {
    errors.push("prompt-policy.yml debe publicar el job prompt-policy en PR y push");
  }
  if (/^\s+paths(?:-ignore)?:/m.test(promptWorkflow)) {
    errors.push("prompt-policy.yml no puede usar filtros de rutas porque es un check obligatorio");
  }

  const ownerWorkflow = readFileSync(join(repositoryRoot, ".github", "workflows", "owner-authorization.yml"), "utf8");
  for (const event of ["pull_request_target", "schedule", "workflow_dispatch"]) {
    if (!new RegExp(`^\\s{2}${event}:`, "m").test(ownerWorkflow)) {
      errors.push(`owner-authorization.yml debe escuchar ${event}`);
    }
  }
  if (!/^\s{2}statuses:\s*write\s*$/m.test(ownerWorkflow)
    || !/^\s{2}contents:\s*read\s*$/m.test(ownerWorkflow)
    || !/^\s{2}pull-requests:\s*read\s*$/m.test(ownerWorkflow)) {
    errors.push("owner-authorization.yml debe limitarse a contents/pull-requests read y statuses write");
  }

  const buildWorkflow = readFileSync(join(repositoryRoot, ".github", "workflows", "build-apk.yml"), "utf8");
  if (/^\s*git push(?:\s|$)/m.test(buildWorkflow)) {
    errors.push("build-apk.yml no puede hacer push directo a main");
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
