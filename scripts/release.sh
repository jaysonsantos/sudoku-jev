#!/usr/bin/env bash
# Bumps the version from the commit messages, writes the changelog, commits, and tags.
# Usage: scripts/release.sh [version]
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "tracked files have changes, commit or stash them first" >&2
  exit 1
fi

version="${1:-$(git cliff --bumped-version | sed 's/^v//')}"
tag="v${version}"

# One release, one version, every manifest.
pnpm version "$version" --no-git-tag-version --allow-same-version > /dev/null

git cliff --tag "$tag" --output CHANGELOG.md

git add package.json CHANGELOG.md
git commit --quiet --message "chore(release): ${tag}"

# The release carries the version already, so drop the version heading from the notes.
notes="$(git cliff --tag "$tag" --unreleased --strip all | sed '1{/^## /d;}' | sed '1{/^$/d;}')"
git tag --annotate --cleanup=whitespace --message "$notes" "$tag"

echo "tagged ${tag}. Next: git push --follow-tags"
