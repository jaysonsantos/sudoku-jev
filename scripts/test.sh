#!/usr/bin/env bash
# Typechecks both trees and runs the Node test suites.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
