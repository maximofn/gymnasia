import { CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION } from "./generated/chatSystemPrompt.generated";

export const CHAT_SYSTEM_PROMPT_CACHE_SCHEMA_VERSION = 3 as const;

export type ChatSystemPromptSource = "remote" | "cache" | "bundled";

export type ChatSystemPromptSelection = {
  content: string;
  source: ChatSystemPromptSource;
  sha256: string;
  version: string;
  environment: string;
  channel: string;
  candidate: string;
  deploymentId: number | null;
};

export type ChatSystemPromptDiagnostic = {
  event:
    | "remote-rejected"
    | "remote-error"
    | "cache-rejected"
    | "cache-read-error"
    | "cache-write-error"
    | "selected";
  source: ChatSystemPromptSource;
  reason?: string;
  status?: number;
  sha256?: string;
  version?: string;
  environment?: string;
  channel?: string;
  candidate?: string;
  deploymentId?: number | null;
};

export type ChatSystemPromptRemoteResponse = {
  ok: boolean;
  status: number;
  contentType: string | null;
  body: string;
  expectedSha256: string;
  environment: string;
  channel: string;
  candidate: string;
  deploymentId: number;
};

type BundledChatSystemPrompt = {
  content: string;
  sha256: string;
  version: string;
  normalizationVersion: number;
  environment: string;
  channel: string;
  candidate: string;
  deploymentId: number | null;
};

export type ChatSystemPromptDependencies = {
  fetchRemote?: () => Promise<ChatSystemPromptRemoteResponse>;
  readCurrentCache: () => Promise<string | null>;
  readLegacyCache: () => Promise<string | null>;
  writeCurrentCache: (value: string) => Promise<void>;
  sha256: (value: string) => Promise<string>;
  bundled: BundledChatSystemPrompt;
  scope: {
    environment: string;
    channel: string;
  };
  allowLegacyCache?: boolean;
  diagnostic?: (entry: ChatSystemPromptDiagnostic) => void;
};

type PromptValidationResult =
  | { valid: true; content: string }
  | { valid: false; reason: string };

type ChatSystemPromptCacheRecord = {
  schemaVersion: typeof CHAT_SYSTEM_PROMPT_CACHE_SCHEMA_VERSION;
  normalizationVersion: number;
  content: string;
  sha256: string;
  environment: string;
  channel: string;
  candidate: string;
  deploymentId: number | null;
};

type PolicySelectionMetadata = Pick<
  ChatSystemPromptSelection,
  "environment" | "channel" | "candidate" | "deploymentId"
>;

const ACCEPTED_REMOTE_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "text/markdown",
  "text/plain",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HTML_DOCUMENT_PATTERN = /^<(?:!doctype\s+html\b|html(?:\s|>)|head(?:\s|>)|body(?:\s|>))/i;

export function normalizeChatSystemPromptContent(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function validateChatSystemPromptContent(
  value: unknown,
  contentType: string | null = null,
): PromptValidationResult {
  if (typeof value !== "string") {
    return { valid: false, reason: "not-text" };
  }

  if (contentType) {
    const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (!ACCEPTED_REMOTE_CONTENT_TYPES.has(mediaType)) {
      return { valid: false, reason: "invalid-content-type" };
    }
  }

  const content = normalizeChatSystemPromptContent(value);
  const trimmedStart = content.trimStart();
  if (trimmedStart.trim().length === 0) {
    return { valid: false, reason: "empty" };
  }
  if (content.includes("\u0000")) {
    return { valid: false, reason: "null-byte" };
  }
  if (HTML_DOCUMENT_PATTERN.test(trimmedStart)) {
    return { valid: false, reason: "html" };
  }
  return { valid: true, content };
}

function promptVersion(sha256: string): string {
  return `sha256:${sha256}`;
}

function emitDiagnostic(
  dependencies: ChatSystemPromptDependencies,
  diagnostic: ChatSystemPromptDiagnostic,
): void {
  try {
    dependencies.diagnostic?.(diagnostic);
  } catch {
    // Un fallo al diagnosticar nunca debe impedir seleccionar una política segura.
  }
}

function createSelection(
  dependencies: ChatSystemPromptDependencies,
  content: string,
  source: ChatSystemPromptSource,
  sha256: string,
  metadata: PolicySelectionMetadata,
  version = promptVersion(sha256),
): ChatSystemPromptSelection {
  const selection = { content, source, sha256, version, ...metadata };
  emitDiagnostic(dependencies, {
    event: "selected",
    source,
    sha256,
    version,
    ...metadata,
  });
  return selection;
}

function serializeCacheRecord(
  content: string,
  sha256: string,
  metadata: PolicySelectionMetadata,
): string {
  const record: ChatSystemPromptCacheRecord = {
    schemaVersion: CHAT_SYSTEM_PROMPT_CACHE_SCHEMA_VERSION,
    normalizationVersion: CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION,
    content,
    sha256,
    ...metadata,
  };
  return JSON.stringify(record);
}

async function readValidCurrentCache(
  dependencies: ChatSystemPromptDependencies,
): Promise<ChatSystemPromptSelection | null> {
  let raw: string | null;
  try {
    raw = await dependencies.readCurrentCache();
  } catch {
    emitDiagnostic(dependencies, {
      event: "cache-read-error",
      source: "cache",
      reason: "current-storage-error",
    });
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    emitDiagnostic(dependencies, {
      event: "cache-rejected",
      source: "cache",
      reason: "invalid-json",
    });
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    emitDiagnostic(dependencies, {
      event: "cache-rejected",
      source: "cache",
      reason: "invalid-record",
    });
    return null;
  }
  const record = parsed as Partial<ChatSystemPromptCacheRecord>;

  if (
    record.schemaVersion !== CHAT_SYSTEM_PROMPT_CACHE_SCHEMA_VERSION
    || record.normalizationVersion !== CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION
    || typeof record.sha256 !== "string"
    || !SHA256_PATTERN.test(record.sha256)
    || record.environment !== dependencies.scope.environment
    || record.channel !== dependencies.scope.channel
    || typeof record.candidate !== "string"
    || record.candidate.trim().length === 0
    || (
      record.deploymentId !== null
      && (typeof record.deploymentId !== "number" || !Number.isSafeInteger(record.deploymentId))
    )
  ) {
    emitDiagnostic(dependencies, {
      event: "cache-rejected",
      source: "cache",
      reason: "invalid-metadata",
    });
    return null;
  }

  const validation = validateChatSystemPromptContent(record.content);
  if (!validation.valid) {
    emitDiagnostic(dependencies, {
      event: "cache-rejected",
      source: "cache",
      reason: validation.reason,
    });
    return null;
  }

  try {
    const calculatedHash = await dependencies.sha256(validation.content);
    if (calculatedHash !== record.sha256) {
      emitDiagnostic(dependencies, {
        event: "cache-rejected",
        source: "cache",
        reason: "hash-mismatch",
      });
      return null;
    }
    return createSelection(
      dependencies,
      validation.content,
      "cache",
      calculatedHash,
      {
        environment: record.environment,
        channel: record.channel,
        candidate: record.candidate,
        deploymentId: record.deploymentId,
      },
    );
  } catch {
    emitDiagnostic(dependencies, {
      event: "cache-rejected",
      source: "cache",
      reason: "hash-error",
    });
    return null;
  }
}

async function readValidLegacyCache(
  dependencies: ChatSystemPromptDependencies,
): Promise<ChatSystemPromptSelection | null> {
  let raw: string | null;
  try {
    raw = await dependencies.readLegacyCache();
  } catch {
    emitDiagnostic(dependencies, {
      event: "cache-read-error",
      source: "cache",
      reason: "legacy-storage-error",
    });
    return null;
  }
  if (!raw) return null;

  const validation = validateChatSystemPromptContent(raw);
  if (!validation.valid) {
    emitDiagnostic(dependencies, {
      event: "cache-rejected",
      source: "cache",
      reason: `legacy-${validation.reason}`,
    });
    return null;
  }

  try {
    const sha256 = await dependencies.sha256(validation.content);
    const metadata = {
      environment: dependencies.bundled.environment,
      channel: dependencies.bundled.channel,
      candidate: dependencies.bundled.candidate,
      deploymentId: dependencies.bundled.deploymentId,
    };
    try {
      await dependencies.writeCurrentCache(
        serializeCacheRecord(validation.content, sha256, metadata),
      );
    } catch {
      emitDiagnostic(dependencies, {
        event: "cache-write-error",
        source: "cache",
        reason: "legacy-migration-error",
      });
    }
    return createSelection(
      dependencies,
      validation.content,
      "cache",
      sha256,
      metadata,
    );
  } catch {
    emitDiagnostic(dependencies, {
      event: "cache-rejected",
      source: "cache",
      reason: "legacy-hash-error",
    });
    return null;
  }
}

async function readRemotePrompt(
  dependencies: ChatSystemPromptDependencies,
): Promise<ChatSystemPromptSelection | null> {
  if (!dependencies.fetchRemote) return null;
  let response: ChatSystemPromptRemoteResponse;
  try {
    response = await dependencies.fetchRemote();
  } catch {
    emitDiagnostic(dependencies, {
      event: "remote-error",
      source: "remote",
      reason: "request-error",
    });
    return null;
  }

  if (!response.ok) {
    emitDiagnostic(dependencies, {
      event: "remote-rejected",
      source: "remote",
      reason: "http-error",
      status: response.status,
    });
    return null;
  }

  if (
    response.environment !== dependencies.scope.environment
    || response.channel !== dependencies.scope.channel
    || !SHA256_PATTERN.test(response.expectedSha256)
    || !response.candidate.trim()
    || !Number.isSafeInteger(response.deploymentId)
  ) {
    emitDiagnostic(dependencies, {
      event: "remote-rejected",
      source: "remote",
      reason: "invalid-metadata",
      status: response.status,
    });
    return null;
  }

  const validation = validateChatSystemPromptContent(
    response.body,
    response.contentType,
  );
  if (!validation.valid) {
    emitDiagnostic(dependencies, {
      event: "remote-rejected",
      source: "remote",
      reason: validation.reason,
      status: response.status,
    });
    return null;
  }

  try {
    const sha256 = await dependencies.sha256(validation.content);
    if (sha256 !== response.expectedSha256) {
      emitDiagnostic(dependencies, {
        event: "remote-rejected",
        source: "remote",
        reason: "hash-mismatch",
        status: response.status,
      });
      return null;
    }
    const metadata = {
      environment: response.environment,
      channel: response.channel,
      candidate: response.candidate,
      deploymentId: response.deploymentId,
    };
    try {
      await dependencies.writeCurrentCache(
        serializeCacheRecord(validation.content, sha256, metadata),
      );
    } catch {
      emitDiagnostic(dependencies, {
        event: "cache-write-error",
        source: "remote",
        reason: "remote-cache-error",
      });
    }
    return createSelection(
      dependencies,
      validation.content,
      "remote",
      sha256,
      metadata,
    );
  } catch {
    emitDiagnostic(dependencies, {
      event: "remote-rejected",
      source: "remote",
      reason: "hash-error",
      status: response.status,
    });
    return null;
  }
}

function readBundledPrompt(
  dependencies: ChatSystemPromptDependencies,
): ChatSystemPromptSelection {
  const { bundled } = dependencies;
  const validation = validateChatSystemPromptContent(bundled.content);
  if (
    !validation.valid
    || !SHA256_PATTERN.test(bundled.sha256)
    || bundled.normalizationVersion !== CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION
    || bundled.version !== promptVersion(bundled.sha256)
    || bundled.environment !== dependencies.scope.environment
    || bundled.channel !== dependencies.scope.channel
    || !bundled.candidate.trim()
    || (
      bundled.deploymentId !== null
      && (!Number.isSafeInteger(bundled.deploymentId) || bundled.deploymentId < 1)
    )
  ) {
    throw new Error("El snapshot integrado del system prompt es inválido.");
  }
  return createSelection(
    dependencies,
    validation.content,
    "bundled",
    bundled.sha256,
    {
      environment: bundled.environment,
      channel: bundled.channel,
      candidate: bundled.candidate,
      deploymentId: bundled.deploymentId,
    },
    bundled.version,
  );
}

export async function selectChatSystemPrompt(
  dependencies: ChatSystemPromptDependencies,
): Promise<ChatSystemPromptSelection> {
  const remote = await readRemotePrompt(dependencies);
  if (remote) return remote;

  const currentCache = await readValidCurrentCache(dependencies);
  if (currentCache) return currentCache;

  if (dependencies.allowLegacyCache) {
    const legacyCache = await readValidLegacyCache(dependencies);
    if (legacyCache) return legacyCache;
  }

  return readBundledPrompt(dependencies);
}
