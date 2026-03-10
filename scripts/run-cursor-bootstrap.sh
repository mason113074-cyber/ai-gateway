#!/usr/bin/env bash
set -euo pipefail

if ! command -v cursor-agent >/dev/null 2>&1; then
  echo "cursor-agent is not installed. Install Cursor CLI first."
  exit 1
fi

PROMPT_FILE="${1:-docs/prompts/00-bootstrap.md}"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Prompt file not found: $PROMPT_FILE"
  exit 1
fi

cursor-agent -p "$(cat "$PROMPT_FILE")" --output-format text
