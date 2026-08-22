import { BUNDLED_HEALTH_SAFETY_POLICY } from "./generated/healthSafetyPolicy.generated";

export type HealthRiskLevel = "none" | "elevated" | "high" | "critical";
export type HealthSafetyLocale = "es" | "en" | "pt";
export type HealthSafetyTarget = "input" | "output";
export type HealthSafetyToolMode = "none" | "read-only" | "all";
export type ToolEffect = "read" | "local_write" | "external_write";

export type HealthSafetySignal = {
  id: string;
  locale: HealthSafetyLocale;
  level: Exclude<HealthRiskLevel, "none">;
  all: readonly string[];
  any?: readonly string[];
  none?: readonly string[];
};

export type HealthSafetyLocalizedResponse = {
  reason: string;
  message: string;
};

export type HealthSafetyRuntimeRule = {
  id: string;
  version: string;
  risk: "high" | "critical";
  toolMode: HealthSafetyToolMode;
  fallbackRuleId?: string;
  inputSignals: readonly HealthSafetySignal[];
  outputSignals: readonly HealthSafetySignal[];
  responses: Readonly<Record<HealthSafetyLocale, HealthSafetyLocalizedResponse>>;
};

export type HealthSafetyRuntimePolicy = {
  schemaVersion: 1;
  policyVersion: string;
  consentVersion: string;
  defaultLocale: HealthSafetyLocale;
  supportedLocales: readonly HealthSafetyLocale[];
  rules: readonly HealthSafetyRuntimeRule[];
  normalExamples: ReadonlyArray<{ locale: HealthSafetyLocale; text: string }>;
};

export type HealthSafetyDecisionSource =
  | "deterministic-input"
  | "deterministic-output"
  | "evaluator"
  | "evaluator-failure";

export type HealthSafetyDecision = {
  level: HealthRiskLevel;
  ruleIds: string[];
  signalIds: string[];
  reasonCode: string;
  locale: HealthSafetyLocale;
  source: HealthSafetyDecisionSource;
  policyVersion: string;
};

export type HealthSafetyMessageMetadata = {
  level: Exclude<HealthRiskLevel, "none">;
  locale: HealthSafetyLocale;
  ruleIds: string[];
  reasonCode: string;
  source: HealthSafetyDecisionSource;
  policyVersion: string;
};

export type HealthSafetyResponse = {
  title: string;
  reason: string;
  message: string;
  metadata: HealthSafetyMessageMetadata;
};

export type HealthSafetyEvaluatorResult = {
  level: HealthRiskLevel;
  ruleIds: string[];
  reasonCode: string;
};

const RISK_ORDER: Record<HealthRiskLevel, number> = {
  none: 0,
  elevated: 1,
  high: 2,
  critical: 3,
};

const TOOL_MODE_ORDER: Record<HealthSafetyToolMode, number> = {
  none: 0,
  "read-only": 1,
  all: 2,
};

const RULE_ID_PATTERN = /^HS-[A-Z]+(?:-[A-Z]+)*-[0-9]{3}$/;
const VERSION_PATTERN = /^[0-9]{4}\.[0-9]{2}\.[0-9]+$/;
const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const LOCALES = new Set<HealthSafetyLocale>(["es", "en", "pt"]);

export const BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY =
  BUNDLED_HEALTH_SAFETY_POLICY as unknown as HealthSafetyRuntimePolicy;

export function normalizeHealthSafetyText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function healthSafetySignalMatches(signal: HealthSafetySignal, text: string): boolean {
  const normalized = normalizeHealthSafetyText(text);
  const includes = (value: string) => normalized.includes(normalizeHealthSafetyText(value));
  return signal.all.every(includes)
    && (!signal.any?.length || signal.any.some(includes))
    && !signal.none?.some(includes);
}

export function classifyHealthSafetyText(
  text: string,
  target: HealthSafetyTarget = "input",
  policy: HealthSafetyRuntimePolicy = BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
): HealthSafetyDecision {
  const matches: Array<{ rule: HealthSafetyRuntimeRule; signal: HealthSafetySignal }> = [];
  const field = target === "output" ? "outputSignals" : "inputSignals";
  for (const rule of policy.rules) {
    for (const signal of rule[field]) {
      if (healthSafetySignalMatches(signal, text)) matches.push({ rule, signal });
    }
  }
  matches.sort((left, right) => (
    RISK_ORDER[right.signal.level] - RISK_ORDER[left.signal.level]
  ));
  const top = matches[0];
  return {
    level: top?.signal.level ?? "none",
    ruleIds: [...new Set(matches.map(({ rule }) => rule.id))],
    signalIds: matches.map(({ signal }) => signal.id),
    reasonCode: top?.signal.id ?? "health-safety-clear",
    locale: top?.signal.locale ?? policy.defaultLocale,
    source: target === "output" ? "deterministic-output" : "deterministic-input",
    policyVersion: policy.policyVersion,
  };
}

export function maxHealthRisk(
  left: HealthRiskLevel,
  right: HealthRiskLevel,
): HealthRiskLevel {
  return RISK_ORDER[left] >= RISK_ORDER[right] ? left : right;
}

export function isBlockingHealthRisk(level: HealthRiskLevel): boolean {
  return level === "high" || level === "critical";
}

export function effectiveToolModeForRisk(level: HealthRiskLevel): HealthSafetyToolMode {
  if (isBlockingHealthRisk(level)) return "none";
  if (level === "elevated") return "read-only";
  return "all";
}

export function healthSafetyToolAllowed(
  effect: ToolEffect,
  decision: HealthSafetyDecision,
  toolArgumentDecision?: HealthSafetyDecision,
): boolean {
  const level = toolArgumentDecision
    ? maxHealthRisk(decision.level, toolArgumentDecision.level)
    : decision.level;
  const mode = effectiveToolModeForRisk(level);
  return mode === "all" || (mode === "read-only" && effect === "read");
}

function ruleForDecision(
  decision: HealthSafetyDecision,
  policy: HealthSafetyRuntimePolicy,
): HealthSafetyRuntimeRule {
  const byId = new Map(policy.rules.map((rule) => [rule.id, rule]));
  const selected = decision.ruleIds.map((id) => byId.get(id)).find(Boolean);
  if (selected) {
    const fallback = selected.fallbackRuleId ? byId.get(selected.fallbackRuleId) : null;
    return fallback ?? selected;
  }
  return byId.get("HS-EMERGENCY-001") ?? policy.rules[0];
}

const SAFETY_TITLES: Record<HealthSafetyLocale, string> = {
  es: "Respuesta limitada por seguridad",
  en: "Response limited for safety",
  pt: "Resposta limitada por segurança",
};

export function createLocalHealthSafetyResponse(
  decision: HealthSafetyDecision,
  policy: HealthSafetyRuntimePolicy = BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
): HealthSafetyResponse {
  const rule = ruleForDecision(decision, policy);
  const locale = LOCALES.has(decision.locale) ? decision.locale : policy.defaultLocale;
  const response = rule.responses[locale] ?? rule.responses[policy.defaultLocale];
  const level = decision.level === "none" ? "elevated" : decision.level;
  return {
    title: SAFETY_TITLES[locale],
    reason: response.reason,
    message: response.message,
    metadata: {
      level,
      locale,
      ruleIds: decision.ruleIds.length > 0 ? decision.ruleIds : [rule.id],
      reasonCode: decision.reasonCode,
      source: decision.source,
      policyVersion: decision.policyVersion,
    },
  };
}

function lastCompleteSegmentBoundary(value: string): number {
  const pattern = /[.!?](?:\s|$)|\n+/g;
  let boundary = 0;
  for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
    boundary = match.index + match[0].length;
  }
  return boundary;
}

export type HealthSafeStreamState = {
  visibleContent: string;
  heldContent: string;
  blockedDecision: HealthSafetyDecision | null;
};

export function createHealthSafeStreamGate(input: {
  inputDecision: HealthSafetyDecision;
  policy?: HealthSafetyRuntimePolicy;
}) {
  const policy = input.policy ?? BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY;
  let aggregate = "";
  let visibleContent = "";
  let blockedDecision: HealthSafetyDecision | null = null;
  const fullBuffer = input.inputDecision.level !== "none";

  const state = (): HealthSafeStreamState => ({
    visibleContent,
    heldContent: aggregate.slice(visibleContent.length),
    blockedDecision,
  });

  return {
    push(nextAggregate: string): HealthSafeStreamState {
      aggregate = nextAggregate;
      if (fullBuffer || blockedDecision) return state();
      const boundary = lastCompleteSegmentBoundary(aggregate);
      if (boundary <= visibleContent.length) return state();
      const candidate = aggregate.slice(0, boundary);
      const decision = classifyHealthSafetyText(candidate, "output", policy);
      if (decision.level !== "none") {
        blockedDecision = decision;
        return state();
      }
      visibleContent = candidate;
      return state();
    },
    finish(finalContent = aggregate): HealthSafeStreamState {
      aggregate = finalContent;
      const decision = classifyHealthSafetyText(aggregate, "output", policy);
      if (decision.level !== "none") {
        blockedDecision = decision;
        return state();
      }
      visibleContent = aggregate;
      return state();
    },
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSignal(value: unknown): value is HealthSafetySignal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const signal = value as Partial<HealthSafetySignal>;
  return typeof signal.id === "string"
    && /^[a-z0-9-]+$/.test(signal.id)
    && LOCALES.has(signal.locale as HealthSafetyLocale)
    && ["elevated", "high", "critical"].includes(signal.level ?? "")
    && isStringArray(signal.all)
    && signal.all.length > 0
    && (signal.any === undefined || (isStringArray(signal.any) && signal.any.length > 0))
    && (signal.none === undefined || (isStringArray(signal.none) && signal.none.length > 0));
}

export function validateRemoteHealthSafetyPolicy(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["La política remota no es un objeto."];
  }
  const policy = value as Partial<HealthSafetyRuntimePolicy>;
  if (policy.schemaVersion !== 1) errors.push("schemaVersion remoto no compatible.");
  if (!VERSION_PATTERN.test(policy.policyVersion ?? "")) errors.push("policyVersion remoto inválido.");
  if (!VERSION_PATTERN.test(policy.consentVersion ?? "")) errors.push("consentVersion remoto inválido.");
  if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
    errors.push("La política remota no contiene reglas.");
    return errors;
  }
  const ids = new Set<string>();
  for (const rule of policy.rules) {
    if (!RULE_ID_PATTERN.test(rule.id ?? "")) errors.push("ID de regla remota inválido.");
    if (ids.has(rule.id)) errors.push(`Regla remota duplicada: ${rule.id}.`);
    ids.add(rule.id);
    if (!SEMVER_PATTERN.test(rule.version ?? "")) errors.push(`${rule.id}: versión inválida.`);
    if (!["high", "critical"].includes(rule.risk ?? "")) errors.push(`${rule.id}: riesgo inválido.`);
    if (!["none", "read-only", "all"].includes(rule.toolMode ?? "")) errors.push(`${rule.id}: toolMode inválido.`);
    if (!Array.isArray(rule.inputSignals) || !rule.inputSignals.every(isSignal)) {
      errors.push(`${rule.id}: inputSignals inválidas.`);
    }
    if (!Array.isArray(rule.outputSignals) || !rule.outputSignals.every(isSignal)) {
      errors.push(`${rule.id}: outputSignals inválidas.`);
    }
  }
  return errors;
}

function unionSignals(
  base: readonly HealthSafetySignal[],
  remote: readonly HealthSafetySignal[],
): HealthSafetySignal[] {
  const byId = new Map(base.map((signal) => [signal.id, signal]));
  for (const signal of remote) {
    if (!byId.has(signal.id)) byId.set(signal.id, signal);
  }
  return [...byId.values()];
}

export function mergeHealthSafetyPolicies(
  base: HealthSafetyRuntimePolicy,
  remoteValue: unknown,
): { policy: HealthSafetyRuntimePolicy; errors: string[] } {
  const errors = validateRemoteHealthSafetyPolicy(remoteValue);
  if (errors.length > 0) return { policy: base, errors };
  const remote = remoteValue as HealthSafetyRuntimePolicy;
  const baseById = new Map(base.rules.map((rule) => [rule.id, rule]));
  const rules: HealthSafetyRuntimeRule[] = base.rules.map((rule) => ({
    ...rule,
    inputSignals: [...rule.inputSignals],
    outputSignals: [...rule.outputSignals],
  }));
  const mergedById = new Map(rules.map((rule) => [rule.id, rule]));

  for (const remoteRule of remote.rules) {
    const existing = mergedById.get(remoteRule.id);
    if (existing) {
      const risk = RISK_ORDER[remoteRule.risk] > RISK_ORDER[existing.risk]
        ? remoteRule.risk
        : existing.risk;
      const toolMode = TOOL_MODE_ORDER[remoteRule.toolMode] < TOOL_MODE_ORDER[existing.toolMode]
        ? remoteRule.toolMode
        : existing.toolMode;
      mergedById.set(existing.id, {
        ...existing,
        version: remoteRule.version,
        risk,
        toolMode,
        inputSignals: unionSignals(existing.inputSignals, remoteRule.inputSignals),
        outputSignals: unionSignals(existing.outputSignals, remoteRule.outputSignals),
      });
      continue;
    }
    const fallback = remoteRule.fallbackRuleId
      ? baseById.get(remoteRule.fallbackRuleId)
      : undefined;
    if (!fallback) {
      errors.push(`${remoteRule.id}: una regla nueva necesita un fallbackRuleId compilado.`);
      continue;
    }
    mergedById.set(remoteRule.id, {
      ...remoteRule,
      responses: fallback.responses,
    });
  }

  if (errors.length > 0) return { policy: base, errors };
  return {
    errors: [],
    policy: {
      ...base,
      policyVersion: remote.policyVersion,
      rules: [...mergedById.values()],
    },
  };
}

export function parseHealthSafetyEvaluatorResult(
  raw: string,
  policy: HealthSafetyRuntimePolicy = BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
): HealthSafetyEvaluatorResult | null {
  const source = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(source) as Partial<HealthSafetyEvaluatorResult>;
    if (!["none", "elevated", "high", "critical"].includes(parsed.level ?? "")) return null;
    if (!isStringArray(parsed.ruleIds)) return null;
    if ((parsed.level === "high" || parsed.level === "critical") && parsed.ruleIds.length === 0) {
      return null;
    }
    const knownIds = new Set(policy.rules.map((rule) => rule.id));
    if (parsed.ruleIds.some((id) => !knownIds.has(id))) return null;
    if (typeof parsed.reasonCode !== "string" || !parsed.reasonCode.trim()) return null;
    return {
      level: parsed.level as HealthRiskLevel,
      ruleIds: parsed.ruleIds,
      reasonCode: parsed.reasonCode,
    };
  } catch {
    return null;
  }
}
