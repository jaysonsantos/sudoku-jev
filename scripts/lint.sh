#!/usr/bin/env bash
# Runs every linter. Works inside and outside the nix shell when prek is on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."
prek run --all-files
