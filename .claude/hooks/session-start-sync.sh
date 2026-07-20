#!/usr/bin/env bash
# Claude Code SessionStart hook: keep local state honest with the remote.
# GitHub is the single source of truth; merging a PR there does NOT touch the
# local clone, so a session that starts from a stale local tree can silently
# reintroduce merged-away code or branch new work off an already-merged base.
# This hook is ADVISORY (exit 0 always) — it fetches and warns, it never blocks
# or mutates the tree. The agent's "At the start of every session" step and the
# human do the actual fast-forward; forcing it here would be wrong offline or
# mid-branch. Warnings go to stderr so they surface to the agent as context.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0

# No remote yet (brand-new project before the Coding agent's first push): nothing to sync.
if [ -z "$(git remote 2>/dev/null)" ]; then
  exit 0
fi

# Update remote-tracking refs and drop branches deleted on merge. Best-effort:
# offline or auth-less environments simply skip the warnings below.
if ! git fetch --quiet --prune origin 2>/dev/null; then
  echo "session-start-sync: could not reach the remote (offline?) — skipping the staleness check. Verify your branch is current before starting new work." >&2
  exit 0
fi

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
[ -z "$default" ] && default="main"

# 1. On the default branch but behind the remote → local looks "older than GitHub".
if [ "$branch" = "$default" ]; then
  behind="$(git rev-list --count "HEAD..origin/$default" 2>/dev/null || echo 0)"
  if [ "$behind" -gt 0 ] 2>/dev/null; then
    echo "session-start-sync: local $default is $behind commit(s) behind origin/$default — a merged PR is not present locally yet. Run 'git pull --ff-only' before starting, and branch new work from the updated $default." >&2
  fi
  exit 0
fi

# 2. On a feature branch whose upstream is gone (merged + auto-deleted on the remote)
#    → new work must not fork off this branch.
upstream_gone="$(git for-each-ref --format='%(upstream:track)' "refs/heads/$branch" 2>/dev/null)"
if [ "$upstream_gone" = "[gone]" ]; then
  echo "session-start-sync: branch '$branch' has been merged and deleted on the remote. Switch to $default, 'git pull --ff-only', and branch fresh — do not start new work on top of a merged-and-gone branch." >&2
fi
exit 0
