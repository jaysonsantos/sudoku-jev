#!/usr/bin/env bash
# Lint, test, build. A green run here means a green pipeline.
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/lint.sh
scripts/test.sh
pnpm build
