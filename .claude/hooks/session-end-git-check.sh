#!/usr/bin/env bash
# Claude Code Stop hook (assessment A-2.2): refuse to end a session with a dirty
# or unpushed working tree. Plans, reviews, and docs are code — they must be
# committed and pushed before the session closes.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$PWD}"

dirty="$(git status --porcelain 2>/dev/null || true)"
if [ -n "$dirty" ]; then
  echo "Session cannot close: uncommitted work on $(git rev-parse --abbrev-ref HEAD). Commit to the feature branch (or stash and log it in STATUS.md), then finish." >&2
  exit 2   # non-zero blocks the Stop and returns the message to the agent
fi

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)"
if [ -n "$upstream" ]; then
  unpushed="$(git log @{u}.. --oneline 2>/dev/null || true)"
  if [ -n "$unpushed" ]; then
    echo "Session cannot close: unpushed commits on this branch. Push before ending." >&2
    exit 2
  fi
fi
exit 0
