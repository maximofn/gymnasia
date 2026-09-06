import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHECK = join(repositoryRoot, "scripts", "anthropic-proxy", "check.mjs");

function run(cwd) {
  try {
    const stdout = execFileSync("node", [join(cwd, "scripts", "anthropic-proxy", "check.mjs")], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

/** Copia mínima del repositorio: solo lo que el guard rail mira. */
function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), "gymnasia-proxy-check-"));
  mkdirSync(join(root, "apps", "anthropic_proxy"), { recursive: true });
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  mkdirSync(join(root, "scripts", "anthropic-proxy"), { recursive: true });
  mkdirSync(join(root, "scripts", "data-inventory"), { recursive: true });
  cpSync(CHECK, join(root, "scripts", "anthropic-proxy", "check.mjs"));
  writeFileSync(join(root, "apps", "anthropic_proxy", "cors-proxy.py"), "# proxy\n");
  writeFileSync(
    join(root, ".github", "workflows", "agent-tests.yml"),
    "jobs:\n  proxy:\n    steps:\n      - run: npm run test:proxy\n",
  );
  writeFileSync(
    join(root, "scripts", "data-inventory", "inventory.json"),
    JSON.stringify({ networkEndpoints: [{ host: "api.anthropic.com" }] }, null, 2),
  );
  return root;
}

test("acepta un repositorio donde el proxy sigue siendo local", () => {
  const root = fakeRepo();
  try {
    const { code, output } = run(root);
    assert.equal(code, 0, output);
    assert.match(output, /sigue siendo una herramienta local/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rechaza un Dockerfile junto al proxy", () => {
  const root = fakeRepo();
  try {
    writeFileSync(join(root, "apps", "anthropic_proxy", "Dockerfile"), "FROM python\n");
    const { code, output } = run(root);
    assert.equal(code, 1);
    assert.match(output, /Dockerfile/);
    assert.match(output, /no se despliega/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rechaza un workflow que arranca el proxy como servicio", () => {
  const root = fakeRepo();
  try {
    writeFileSync(
      join(root, ".github", "workflows", "serve.yml"),
      "jobs:\n  serve:\n    steps:\n      - run: python apps/anthropic_proxy/cors-proxy.py\n",
    );
    const { code, output } = run(root);
    assert.equal(code, 1);
    assert.match(output, /serve\.yml/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no confunde ejecutar la suite del proxy con desplegarlo", () => {
  const root = fakeRepo();
  try {
    // El workflow real menciona el proxy para correr sus pruebas. Si esto
    // fallara, el guard rail seria inservible: nadie mantiene un check que
    // salta con el uso legitimo.
    writeFileSync(
      join(root, ".github", "workflows", "tests.yml"),
      "jobs:\n  proxy:\n    steps:\n      - run: pytest apps/anthropic_proxy/tests\n",
    );
    const { code } = run(root);
    assert.equal(code, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no salta con el workflow que ejecuta el propio guard rail", () => {
  // Regresión: la primera versión buscaba el proxy y un verbo de despliegue en
  // cualquier parte del mismo fichero, y saltaba con `prompt-policy.yml`, que
  // nombra el proxy porque corre este check y más abajo habla de despliegues
  // por otros motivos. Un check que falla con su propio uso legítimo se acaba
  // desactivando, que es peor que no tenerlo.
  const root = fakeRepo();
  try {
    writeFileSync(
      join(root, ".github", "workflows", "prompt-policy.yml"),
      [
        "jobs:",
        "  policy:",
        "    steps:",
        "      - name: Verify the Anthropic proxy stays a local tool",
        "        run: npm run check:anthropic-proxy",
        "      - name: Run Anthropic proxy guard rail tests",
        "        run: npm run test:anthropic-proxy",
        "      - name: Summary",
        "        run: echo 'deployment protection rules apply to Production'",
        "",
      ].join("\n"),
    );
    const { code, output } = run(root);
    assert.equal(code, 0, output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rechaza que el proxy figure como destino de red de la app", () => {
  const root = fakeRepo();
  try {
    writeFileSync(
      join(root, "scripts", "data-inventory", "inventory.json"),
      JSON.stringify({
        networkEndpoints: [{ host: "anthropic-proxy.example.com", sends: "la clave BYOK" }],
      }, null, 2),
    );
    const { code, output } = run(root);
    assert.equal(code, 1);
    assert.match(output, /destino de red fijo/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
