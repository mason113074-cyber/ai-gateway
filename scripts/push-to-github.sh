#!/usr/bin/env bash
set -euo pipefail

REMOTE_URL="${1:-}"
BRANCH="${2:-main}"

if [[ -z "$REMOTE_URL" ]]; then
  echo "Usage: ./scripts/push-to-github.sh <remote-url> [branch]"
  exit 1
fi

if [[ ! -d .git ]]; then
  git init
fi

git add .
if ! git diff --cached --quiet; then
  git commit -m "chore: bootstrap agent control tower"
fi

git branch -M "$BRANCH"
if git remote get-url origin >/dev/null 2>&1; then
  git remote remove origin
fi
git remote add origin "$REMOTE_URL"
git push -u origin "$BRANCH"
