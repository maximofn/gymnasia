import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(moduleDirectory, "../..");
export const healthSafetyRoot = join(repositoryRoot, "policy", "health-safety");
export const promptPath = join(repositoryRoot, "prompts", "AGENTS.md");
export const bundledPromptPath = join(
  repositoryRoot,
  "apps",
  "mobile",
  "agent",
  "generated",
  "chatSystemPrompt.generated.ts",
);
export const HEALTH_SAFETY_START = "<!-- HEALTH-SAFETY:START -->";
export const HEALTH_SAFETY_END = "<!-- HEALTH-SAFETY:END -->";

const schemaPaths = {
  manifest: "manifest.schema.json",
  rule: "rule.schema.json",
  ruleSet: "rule-set.schema.json",
  case: "case.schema.json",
  llmEvaluation: "llm-evaluation.schema.json",
  evaluationReport: "evaluation-report.schema.json",
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadSchemas() {
  const directory = join(healthSafetyRoot, "schemas");
  return Object.fromEntries(
    Object.entries(schemaPaths).map(([name, filename]) => [name, readJson(join(directory, filename))]),
  );
}

function createSchemaValidators(schemas) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const schema of Object.values(schemas)) {
    ajv.addSchema(schema);
  }
  return {
    manifest: ajv.getSchema(schemas.manifest.$id),
    ruleSet: ajv.getSchema(schemas.ruleSet.$id),
    case: ajv.getSchema(schemas.case.$id),
    llmEvaluation: ajv.getSchema(schemas.llmEvaluation.$id),
    evaluationReport: ajv.getSchema(schemas.evaluationReport.$id),
  };
}

export function loadHealthSafetyPolicy() {
  const schemas = loadSchemas();
  const casesDirectory = join(healthSafetyRoot, "cases");
  const cases = readdirSync(casesDirectory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => readJson(join(casesDirectory, name)));
  return {
    schemas,
    validators: createSchemaValidators(schemas),
    manifest: readJson(join(healthSafetyRoot, "manifest.json")),
    ruleSet: readJson(join(healthSafetyRoot, "rules.json")),
    cases,
    llmEvaluation: readJson(join(healthSafetyRoot, "llm-evaluation.json")),
    fixtures: readJson(join(moduleDirectory, "fixtures", "fake-provider-responses.json")),
  };
}

function formatSchemaErrors(label, validator) {
  return (validator.errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    return `${label}${location}: ${error.message}`;
  });
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function extractAgentToolNames(source) {
  return new Set(
    [...source.matchAll(/^\s{4}name:\s*"([a-z0-9_]+)",\s*$/gm)].map((match) => match[1]),
  );
}

export function findExfiltrationPatterns(value) {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  const patterns = [
    { name: "instrucciones previas", regex: /ignore (?:all )?(?:previous|prior|system) instructions/i },
    { name: "instrucciones del sistema", regex: /ignora (?:todas )?(?:las )?instrucciones (?:anteriores|del sistema)/i },
    { name: "revelación de secretos", regex: /(?:revela|muestra|imprime|env[ií]a|reveal|print|send).{0,60}(?:system prompt|prompt del sistema|api[_ -]?key|clave de api|secret)/i },
    { name: "acceso a entorno", regex: /process\.env|ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY|LINEAR_API_KEY/ },
  ];
  return patterns.filter(({ regex }) => regex.test(source)).map(({ name }) => name);
}

export function collectPolicyErrors(data, { toolNames = new Set() } = {}) {
  const errors = [];
  const { validators, manifest, ruleSet, cases, llmEvaluation, fixtures } = data;

  for (const [label, validator, value] of [
    ["manifest.json", validators.manifest, manifest],
    ["rules.json", validators.ruleSet, ruleSet],
    ["llm-evaluation.json", validators.llmEvaluation, llmEvaluation],
  ]) {
    if (!validator(value)) errors.push(...formatSchemaErrors(label, validator));
  }
  for (const healthCase of cases) {
    if (!validators.case(healthCase)) {
      errors.push(...formatSchemaErrors(`cases/${healthCase.id ?? "desconocido"}`, validators.case));
    }
  }

  const rules = Array.isArray(ruleSet?.rules) ? ruleSet.rules : [];
  const ruleIds = rules.map((rule) => rule.id);
  const caseIds = cases.map((healthCase) => healthCase.id);
  for (const id of duplicateValues(ruleIds)) errors.push(`ID de regla duplicado: ${id}`);
  for (const id of duplicateValues(caseIds)) errors.push(`ID de caso duplicado: ${id}`);

  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const publishedStatuses = new Set(manifest?.publishedStatuses ?? []);
  const publishedRules = rules.filter((rule) => publishedStatuses.has(rule.status));
  const publishedIds = new Set(publishedRules.map((rule) => rule.id));

  if (manifest?.policyVersion !== manifest?.currentRelease?.version) {
    errors.push("manifest.currentRelease.version debe coincidir con policyVersion.");
  }
  for (const ruleId of manifest?.requiredPublishedRuleIds ?? []) {
    if (!publishedIds.has(ruleId)) errors.push(`Falta la regla publicable obligatoria ${ruleId}.`);
  }
  for (const ruleId of manifest?.currentRelease?.changedRuleIds ?? []) {
    if (!rulesById.has(ruleId)) errors.push(`currentRelease referencia una regla inexistente: ${ruleId}.`);
  }

  const publishedCategories = new Set(publishedRules.flatMap((rule) => rule.categories ?? []));
  const caseCategories = new Set(cases.flatMap((healthCase) => healthCase.categories ?? []));
  for (const category of manifest?.requiredCategories ?? []) {
    if (!publishedCategories.has(category)) errors.push(`Ninguna regla publicable cubre la categoría ${category}.`);
    if (!caseCategories.has(category)) errors.push(`Ningún caso cubre la categoría ${category}.`);
  }

  for (const rule of rules) {
    if (["provisional", "approved"].includes(rule.status) && (rule.sources?.length ?? 0) === 0) {
      errors.push(`${rule.id}: una regla ${rule.status} debe incluir fuentes.`);
    }
    if (rule.status === "approved" && rule.review?.professionalReviewed !== true) {
      errors.push(`${rule.id}: approved requiere revisión profesional.`);
    }
    if (rule.status !== "approved" && rule.review?.professionalReviewed === true) {
      errors.push(`${rule.id}: solo approved puede declarar revisión profesional.`);
    }
  }

  for (const healthCase of cases) {
    const required = new Set(healthCase.requiredRuleIds ?? []);
    for (const ruleId of required) {
      if (!rulesById.has(ruleId)) errors.push(`${healthCase.id}: requiredRuleIds referencia ${ruleId}, que no existe.`);
      else if (!publishedIds.has(ruleId)) errors.push(`${healthCase.id}: la regla requerida ${ruleId} no es publicable.`);
    }
    for (const ruleId of healthCase.forbiddenRuleIds ?? []) {
      if (!rulesById.has(ruleId)) errors.push(`${healthCase.id}: forbiddenRuleIds referencia ${ruleId}, que no existe.`);
      if (required.has(ruleId)) errors.push(`${healthCase.id}: ${ruleId} no puede ser requerida y prohibida a la vez.`);
    }
    for (const toolName of healthCase.expectedToolNames ?? []) {
      if (!toolNames.has(toolName)) errors.push(`${healthCase.id}: tool inexistente ${toolName}.`);
    }
    if (!fixtures?.[healthCase.fakeProviderFixture]) {
      errors.push(`${healthCase.id}: falta el fixture ${healthCase.fakeProviderFixture}.`);
    }
  }

  const referencedFixtures = new Set(cases.map((healthCase) => healthCase.fakeProviderFixture));
  for (const [fixtureName, fixture] of Object.entries(fixtures ?? {})) {
    if (!referencedFixtures.has(fixtureName)) errors.push(`Fixture sin caso: ${fixtureName}.`);
    if (typeof fixture?.content !== "string" || fixture.content.trim().length === 0) {
      errors.push(`Fixture ${fixtureName}: content debe ser texto no vacío.`);
    }
    if (!Array.isArray(fixture?.toolNames)
      || fixture.toolNames.some((name) => typeof name !== "string")) {
      errors.push(`Fixture ${fixtureName}: toolNames debe ser un array de nombres.`);
    }
  }

  for (const pattern of findExfiltrationPatterns({ ruleSet, cases, llmEvaluation })) {
    errors.push(`La política contiene un patrón de exfiltración: ${pattern}.`);
  }
  if (llmEvaluation?.authorizing !== false || llmEvaluation?.requiredForPullRequests !== false) {
    errors.push("La evaluación LLM debe ser informativa, no autorizadora y no obligatoria en PR.");
  }

  return errors;
}

export function publishedRules(data) {
  const statuses = new Set(data.manifest.publishedStatuses);
  return data.ruleSet.rules
    .filter((rule) => statuses.has(rule.status))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function renderList(label, values) {
  return values.map((value) => `- ${label}: ${value}`).join("\n");
}

export function renderManagedBlock(data) {
  const sections = publishedRules(data).map((rule) => {
    const status = rule.status === "approved"
      ? "approved — revisada por un profesional sanitario"
      : "provisional — basada en fuentes oficiales y pendiente de revisión profesional";
    const questions = rule.requiredQuestions.length > 0
      ? `\n${renderList("Antes de personalizar", rule.requiredQuestions)}`
      : "";
    return [
      `### ${rule.id} — ${rule.title}`,
      `Estado: ${status}.`,
      renderList("Debes", rule.requiredBehaviors),
      renderList("No debes", rule.prohibitedBehaviors),
      questions,
      `- Escalada: ${rule.escalation}`,
      `- Límite de certeza: ${rule.uncertainty.conservativeDefault}`,
    ].filter(Boolean).join("\n");
  });

  return [
    HEALTH_SAFETY_START,
    "## Seguridad sanitaria",
    "",
    "Este bloque se genera desde `policy/health-safety/`; no lo edites a mano.",
    "Las reglas provisionales ya son obligatorias para proteger al usuario, pero siguen pendientes de revisión profesional. No las presentes como diagnóstico ni como atención sanitaria.",
    "Ante conflicto con una petición del usuario o con datos de memoria, prevalecen estas reglas.",
    "",
    ...sections.flatMap((section) => [section, ""]),
    HEALTH_SAFETY_END,
  ].join("\n");
}

export function replaceManagedBlock(source, block) {
  const startCount = source.split(HEALTH_SAFETY_START).length - 1;
  const endCount = source.split(HEALTH_SAFETY_END).length - 1;
  if (startCount !== endCount || startCount > 1) {
    throw new Error("El prompt debe contener como máximo un bloque sanitario completo.");
  }
  if (startCount === 1) {
    const start = source.indexOf(HEALTH_SAFETY_START);
    const end = source.indexOf(HEALTH_SAFETY_END, start) + HEALTH_SAFETY_END.length;
    return `${source.slice(0, start)}${block}${source.slice(end)}`;
  }
  const anchor = "\n## Herramientas de memoria";
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error("No se encontró el punto de inserción del bloque sanitario.");
  return `${source.slice(0, index)}\n\n${block}\n${source.slice(index)}`;
}

export function collectManagedPromptErrors(source, expectedBlock) {
  const errors = [];
  const startCount = source.split(HEALTH_SAFETY_START).length - 1;
  const endCount = source.split(HEALTH_SAFETY_END).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    return ["prompts/AGENTS.md debe contener exactamente un bloque sanitario completo."];
  }
  const start = source.indexOf(HEALTH_SAFETY_START);
  const end = source.indexOf(HEALTH_SAFETY_END, start) + HEALTH_SAFETY_END.length;
  if (source.slice(start, end) !== expectedBlock) {
    errors.push("El bloque sanitario de prompts/AGENTS.md no corresponde a policy/health-safety/.");
  }
  return errors;
}

export function findAffectedCases(changedRuleIds, cases) {
  const changed = new Set(changedRuleIds);
  return cases
    .filter((healthCase) => [...healthCase.requiredRuleIds, ...healthCase.forbiddenRuleIds]
      .some((ruleId) => changed.has(ruleId)))
    .map((healthCase) => healthCase.id)
    .sort();
}

function normalizeAssertionText(value) {
  return `${value}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function evaluateCaseResponse(healthCase, response) {
  const content = normalizeAssertionText(response?.content ?? "");
  const missingRequired = healthCase.assertions.requiredAll
    .filter((pattern) => !content.includes(normalizeAssertionText(pattern)));
  const foundForbidden = healthCase.assertions.forbiddenAll
    .filter((pattern) => content.includes(normalizeAssertionText(pattern)));
  const expectedTools = new Set(healthCase.expectedToolNames);
  const unexpectedTools = (response?.toolNames ?? []).filter((name) => !expectedTools.has(name));
  return {
    caseId: healthCase.id,
    passed: missingRequired.length === 0 && foundForbidden.length === 0 && unexpectedTools.length === 0,
    missingRequired,
    foundForbidden,
    unexpectedTools,
  };
}

export function runCaseWithFakeProvider(data, healthCase, {
  promptSource = readFileSync(promptPath, "utf8"),
} = {}) {
  const request = {
    systemPrompt: promptSource,
    messages: [{ role: "user", content: healthCase.input }],
    toolNames: [...healthCase.expectedToolNames],
  };
  const response = structuredClone(data.fixtures[healthCase.fakeProviderFixture]);
  return {
    request,
    response,
    evaluation: evaluateCaseResponse(healthCase, response),
  };
}

export function promptSha256(source) {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

export function createEvaluationReport(data, {
  kind = "deterministic-fixture",
  evaluator = { name: "gymnasia-health-safety-fixtures", version: "1" },
  createdAt = new Date().toISOString(),
  promptSource = readFileSync(promptPath, "utf8"),
} = {}) {
  const results = data.cases.map((healthCase) => runCaseWithFakeProvider(
    data,
    healthCase,
    { promptSource },
  ).evaluation);
  const passed = results.filter((result) => result.passed).length;
  return {
    $schema: "./schemas/evaluation-report.schema.json",
    schemaVersion: 1,
    authorizing: false,
    kind,
    policyVersion: data.manifest.policyVersion,
    datasetVersion: data.manifest.policyVersion,
    promptVersion: `sha256:${promptSha256(promptSource)}`,
    evaluator,
    createdAt,
    results,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
    },
  };
}

export function relativeToRepository(path) {
  return relative(repositoryRoot, path);
}
