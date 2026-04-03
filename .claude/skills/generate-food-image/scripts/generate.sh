#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../../../image-generation"
conda deactivate 2>/dev/null || true
exec uv run generate_images.py foods "$@"
