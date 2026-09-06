#!/usr/bin/env node
/**
 * El proxy CORS de Anthropic es una herramienta de escritorio y no se despliega.
 *
 * GYM-180. La app dejó de necesitarlo cuando el navegador empezó a hablar con
 * Anthropic directamente, así que exponerlo ya no compensa ningún riesgo: sería
 * un intermediario compartido por el que viajarían las claves BYOK de terceros,
 * y el repositorio es público.
 *
 * Este guard rail existe porque una advertencia en un README no impide nada. Lo
 * que busca es infraestructura de despliegue apuntando al proxy: contenedores,
 * manifiestos de plataforma o workflows que lo publiquen. Es deliberadamente
 * conservador — señala lo que encuentra y explica por qué — porque un falso
 * positivo cuesta una línea de exclusión y un falso negativo cuesta las claves
 * de los usuarios.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROXY_DIR = "apps/anthropic_proxy";

// Ficheros cuyo solo nombre ya es infraestructura de despliegue.
const DEPLOYMENT_FILENAMES = [
  /^Dockerfile(\..+)?$/i,
  /^docker-compose(\..+)?\.ya?ml$/i,
  /^(fly|render|railway|vercel|netlify|app|procfile)(\..+)?$/i,
  /^Procfile$/i,
  /^k8s\.ya?ml$/i,
  /^deployment\.ya?ml$/i,
];

// Directorios que no aportan nada al análisis y sí mucho ruido.
const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".venv", "dist", "build", ".expo",
  "__pycache__", ".pytest_cache", ".hypothesis", "coverage",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const findings = [];

// 1. Infraestructura de despliegue dentro del propio directorio del proxy.
const proxyDir = join(repositoryRoot, PROXY_DIR);
for (const file of walk(proxyDir)) {
  const name = file.split("/").pop();
  if (DEPLOYMENT_FILENAMES.some((pattern) => pattern.test(name))) {
    findings.push({
      path: relative(repositoryRoot, file),
      reason: "es un fichero de despliegue dentro del directorio del proxy",
    });
  }
}

// 2. Workflows que arranquen o publiquen el proxy.
const workflowsDir = join(repositoryRoot, ".github", "workflows");
for (const file of walk(workflowsDir)) {
  if (!/\.ya?ml$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  // Se analiza línea a línea a propósito. Buscar el proxy y un verbo de
  // despliegue en cualquier parte del mismo fichero da falsos positivos
  // inmediatos: este mismo guard rail se ejecuta desde un workflow que nombra
  // el proxy y que, más abajo, habla de despliegues por otros motivos. Un check
  // que salta con su propio uso legítimo no lo mantiene nadie.
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    const mencionaProxy = /cors-proxy\.py|anthropic[_-]proxy/i.test(line);
    if (!mencionaProxy) continue;
    // Ejecutar su suite es legítimo; arrancarlo o publicarlo, no.
    const esPrueba = /test:proxy|test:anthropic-proxy|check:anthropic-proxy|pytest/.test(line);
    if (esPrueba) continue;
    const arranca = /cors-proxy\.py/.test(line) && /(python|uvicorn|run )/i.test(line);
    const despliega = /(deploy|publish|fly |render|railway|helm|kubectl)/i.test(line);
    if (arranca || despliega) {
      findings.push({
        path: `${relative(repositoryRoot, file)}:${index + 1}`,
        reason: "un workflow arranca o publica el proxy",
      });
    }
  }
}

// 3. El host del proxy declarado como destino de red de la app. El inventario
//    describe lo que la app contacta de verdad; si el proxy aparece ahí como
//    endpoint fijo, es que alguien lo ha desplegado.
const inventoryPath = join(repositoryRoot, "scripts", "data-inventory", "inventory.json");
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
for (const endpoint of inventory.networkEndpoints ?? []) {
  if (/anthropic[_-]proxy|cors-proxy/i.test(JSON.stringify(endpoint))) {
    findings.push({
      path: "scripts/data-inventory/inventory.json",
      reason: `el proxy figura como destino de red fijo (${endpoint.host})`,
    });
  }
}

if (findings.length > 0) {
  console.error(
    "El proxy CORS de Anthropic no se despliega: es una herramienta de desarrollo local.\n"
    + "La app llama a Anthropic directamente, también en el navegador, así que exponerlo\n"
    + "solo añadiría un intermediario por el que viajarían claves ajenas.\n",
  );
  for (const finding of findings) {
    console.error(`  ${finding.path}: ${finding.reason}`);
  }
  console.error(
    "\nSi de verdad hace falta un puente compartido, necesita un ticket que autorice la\n"
    + "excepción de backend, igual que se hizo con apps/feedback-worker.",
  );
  process.exit(1);
}

console.log(
  "Proxy de Anthropic conforme: sigue siendo una herramienta local, sin despliegue declarado.",
);
