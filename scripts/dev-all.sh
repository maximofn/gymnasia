#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PIDS=()

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Falta comando requerido: $cmd"
    exit 1
  fi
}

warn_missing_env() {
  local file_path="$1"
  local template_path="$2"
  if [[ ! -f "$file_path" ]]; then
    echo "[WARN] No existe $file_path"
    echo "[WARN] Crea el archivo desde $template_path"
  fi
}

start_service() {
  local name="$1"
  shift

  (
    "$@" 2>&1 | sed -u "s/^/[$name] /"
  ) &

  PIDS+=("$!")
}

cleanup() {
  echo
  echo "[INFO] Deteniendo servicios..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      pkill -TERM -P "$pid" >/dev/null 2>&1 || true
      kill -TERM "$pid" >/dev/null 2>&1 || true
    fi
  done

  wait || true
  echo "[INFO] Servicios detenidos."
}

trap cleanup INT TERM EXIT

require_cmd pnpm
require_cmd uvicorn
require_cmd sed

warn_missing_env "apps/api/.env" "apps/api/.env.example"
warn_missing_env "apps/web/.env.local" "apps/web/.env.example"
warn_missing_env "apps/mobile/.env" "apps/mobile/.env.example"

if [[ ! -d "node_modules" ]]; then
  echo "[WARN] No existe node_modules en raiz. Ejecuta: pnpm install"
fi

echo "[INFO] Iniciando API, Web y Mobile..."

action_api=(uvicorn app.main:app --reload --app-dir apps/api)
action_web=(pnpm --filter web dev)
action_mobile=(pnpm --filter mobile start)

start_service "api" "${action_api[@]}"
start_service "web" "${action_web[@]}"
start_service "mobile" "${action_mobile[@]}"

echo "[INFO] API: http://localhost:8000/api/v1/health"
echo "[INFO] Web: http://localhost:3000"
echo "[INFO] Mobile: panel Expo en terminal"
echo "[INFO] Pulsa Ctrl+C para detener todo"

wait
