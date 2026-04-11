#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../../../image-generation"
conda deactivate || true
exec uv run generate_images.py exercises "$@"
