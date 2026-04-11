#!/usr/bin/env bash
set -euo pipefail

# Parse --backend flag before passing remaining args to Python
BACKEND_ARG=""
REMAINING_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      BACKEND_ARG="--backend $2"
      shift 2
      ;;
    *)
      REMAINING_ARGS+=("$1")
      shift
      ;;
  esac
done

cd "$(dirname "$0")/../../../../image-generation"
conda deactivate 2>/dev/null || true
exec uv run generate_images.py $BACKEND_ARG foods "${REMAINING_ARGS[@]}"
