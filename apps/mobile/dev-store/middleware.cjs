const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const policy = require("./policy.json");

const DEV_STORE_ENDPOINT = "/dev-store";
const sensitiveFieldNames = new Set(policy.sensitiveFieldNames);
const allowedRootFields = new Set(policy.allowedRootFields);
const requiredRootFields = new Set(policy.requiredRootFields);
const allowedProviderFields = new Set(policy.allowedProviderFields);
const providers = new Set(policy.providers);
const reasoningEfforts = new Set(policy.reasoningEfforts);

class DevStoreRequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeValue(value, ancestors) {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError("circular dev store value");
    ancestors.add(value);
    const sanitized = value.map((entry) => sanitizeValue(entry, ancestors));
    ancestors.delete(value);
    return sanitized;
  }
  if (!value || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError("circular dev store value");

  ancestors.add(value);
  const sanitized = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveFieldNames.has(key.toLowerCase())
        ? ""
        : sanitizeValue(entry, ancestors),
    ]),
  );
  ancestors.delete(value);
  return sanitized;
}

function sanitizeDevStoreValue(value) {
  return sanitizeValue(value, new WeakSet());
}

function validateDevStorePayload(value) {
  if (!isPlainObject(value)) return { ok: false, error: "root" };

  const rootFields = Object.keys(value);
  if (rootFields.some((field) => !allowedRootFields.has(field))) {
    return { ok: false, error: "unknown-root-field" };
  }
  if ([...requiredRootFields].some((field) => !Object.hasOwn(value, field))) {
    return { ok: false, error: "missing-root-field" };
  }

  for (const field of ["templates", "workoutHistory", "measurements", "threads", "keys"]) {
    if (!Array.isArray(value[field])) return { ok: false, error: `invalid-${field}` };
  }
  for (const field of ["dietByDate", "dietSettings", "messagesByThread"]) {
    if (!isPlainObject(value[field])) return { ok: false, error: `invalid-${field}` };
  }

  if (value.keys.length > providers.size) return { ok: false, error: "too-many-providers" };
  const seenProviders = new Set();
  for (const credential of value.keys) {
    if (!isPlainObject(credential)) return { ok: false, error: "invalid-provider" };
    if (Object.keys(credential).some((field) => !allowedProviderFields.has(field))) {
      return { ok: false, error: "unknown-provider-field" };
    }
    if (!providers.has(credential.provider) || seenProviders.has(credential.provider)) {
      return { ok: false, error: "invalid-provider-name" };
    }
    seenProviders.add(credential.provider);
    if (typeof credential.is_active !== "boolean" || typeof credential.model !== "string") {
      return { ok: false, error: "invalid-provider-settings" };
    }
    if (credential.api_key !== "" || (credential.workspace_id ?? "") !== "") {
      return { ok: false, error: "provider-secret-not-redacted" };
    }
    if (
      credential.reasoning_effort !== undefined
      && credential.reasoning_effort !== null
      && !reasoningEfforts.has(credential.reasoning_effort)
    ) {
      return { ok: false, error: "invalid-reasoning-effort" };
    }
  }

  for (const field of ["chatProvider", "foodAIProvider"]) {
    if (value[field] !== undefined && !providers.has(value[field])) {
      return { ok: false, error: `invalid-${field}` };
    }
  }
  return { ok: true };
}

function loopbackHostname(hostHeader) {
  if (typeof hostHeader !== "string" || !hostHeader.trim()) return null;
  try {
    const hostname = new URL(`http://${hostHeader}`).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)
      ? hostname
      : null;
  } catch {
    return null;
  }
}

function authorizeDevStoreRequest(headers) {
  const host = headers.host;
  if (!loopbackHostname(host)) return { ok: false, statusCode: 403 };

  const fetchSite = headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin") {
    return { ok: false, statusCode: 403 };
  }

  const origin = headers.origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.host.toLowerCase() !== host.toLowerCase()) {
        return { ok: false, statusCode: 403 };
      }
    } catch {
      return { ok: false, statusCode: 403 };
    }
  }
  return { ok: true };
}

function resolveDevStorePath(defaultPath, environment = process.env) {
  const testPath = environment.GYMNASIA_DEV_STORE_TEST_FILE;
  if (!testPath) return defaultPath;
  if (environment.GYMNASIA_DEV_STORE_TEST_MODE !== "1") {
    throw new Error("GYMNASIA_DEV_STORE_TEST_FILE solo puede usarse en modo de test.");
  }
  const resolved = path.resolve(testPath);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("El archivo temporal del espejo debe vivir dentro de os.tmpdir().");
  }
  return resolved;
}

async function atomicWriteFile(filePath, contents, fileSystem = fs.promises) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    await fileSystem.mkdir(directory, { recursive: true });
    handle = await fileSystem.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await fileSystem.rename(temporaryPath, filePath);
    await fileSystem.chmod(filePath, 0o600);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fileSystem.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function readRequestBody(request, maxBytes) {
  const declaredLength = request.headers["content-length"];
  if (declaredLength !== undefined) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return Promise.reject(new DevStoreRequestError(400, "invalid content length"));
    }
    if (parsedLength > maxBytes) {
      request.resume();
      return Promise.reject(new DevStoreRequestError(413, "body too large"));
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    request.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        request.resume();
        reject(new DevStoreRequestError(413, "body too large"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function sendResponse(response, statusCode, body = "") {
  if (response.headersSent || response.writableEnded) return;
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (body) response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(body);
}

function createDevStoreMiddleware({
  storePath,
  enabled = () => process.env[policy.enabledEnvVar] === "1",
  maxBytes = policy.maxBytes,
  atomicWriter = atomicWriteFile,
} = {}) {
  if (!storePath) throw new Error("storePath es obligatorio.");
  let writeQueue = Promise.resolve();

  function enqueueWrite(contents) {
    const operation = writeQueue.then(() => atomicWriter(storePath, contents));
    writeQueue = operation.catch(() => {});
    return operation;
  }

  async function readStoredValue() {
    await writeQueue;
    let stats;
    try {
      stats = await fs.promises.stat(storePath);
    } catch (error) {
      if (error && error.code === "ENOENT") return null;
      throw error;
    }
    if (stats.size > maxBytes) throw new DevStoreRequestError(422, "stored file too large");

    const raw = await fs.promises.readFile(storePath, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DevStoreRequestError(422, "stored file is not json");
    }
    const sanitized = sanitizeDevStoreValue(parsed);
    if (!validateDevStorePayload(sanitized).ok) {
      throw new DevStoreRequestError(422, "stored file has invalid schema");
    }
    const serialized = JSON.stringify(sanitized);
    if (serialized !== raw || (stats.mode & 0o777) !== 0o600) {
      await enqueueWrite(serialized);
    }
    return serialized;
  }

  async function handle(request, response) {
    if (!enabled()) {
      sendResponse(response, 404, "{}");
      return;
    }
    const authorization = authorizeDevStoreRequest(request.headers);
    if (!authorization.ok) {
      sendResponse(response, authorization.statusCode, "{\"error\":\"forbidden\"}");
      return;
    }

    if (request.method === "GET") {
      const stored = await readStoredValue();
      sendResponse(response, stored === null ? 404 : 200, stored ?? "{}");
      return;
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      sendResponse(response, 405, "{\"error\":\"method_not_allowed\"}");
      return;
    }

    const contentType = (request.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      sendResponse(response, 415, "{\"error\":\"unsupported_media_type\"}");
      return;
    }

    const body = await readRequestBody(request, maxBytes);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new DevStoreRequestError(400, "invalid json");
    }
    const sanitized = sanitizeDevStoreValue(parsed);
    if (!validateDevStorePayload(sanitized).ok) {
      throw new DevStoreRequestError(422, "invalid schema");
    }
    const serialized = JSON.stringify(sanitized);
    if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
      throw new DevStoreRequestError(413, "sanitized body too large");
    }
    await enqueueWrite(serialized);
    sendResponse(response, 204);
  }

  return (request, response, next) => {
    let pathname;
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
      return next();
    }
    if (pathname !== DEV_STORE_ENDPOINT) return next();

    handle(request, response).catch((error) => {
      const statusCode = error instanceof DevStoreRequestError ? error.statusCode : 500;
      sendResponse(
        response,
        statusCode,
        statusCode === 500 ? "{\"error\":\"internal_error\"}" : "{\"error\":\"invalid_request\"}",
      );
    });
  };
}

module.exports = {
  DEV_STORE_ENDPOINT,
  DevStoreRequestError,
  atomicWriteFile,
  authorizeDevStoreRequest,
  createDevStoreMiddleware,
  policy,
  resolveDevStorePath,
  sanitizeDevStoreValue,
  validateDevStorePayload,
};
