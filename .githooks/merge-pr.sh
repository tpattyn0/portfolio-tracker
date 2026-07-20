#!/usr/bin/env bash
# merge-pr.sh — merge a PR on GitHub AND immediately bring your LOCAL checkout
# forward to the merged commit, so local is never behind GitHub.
#
# The framework's split (feature branch → PR → merge on GitHub) otherwise leaves
# your local `main` pointing at the pre-merge commit and your checkout stranded
# on the merged-and-deleted feature branch — the feature "disappears" locally.
# Running the merge THROUGH this script closes that gap: after it returns, your
# working copy is on an up-to-date default branch with the merged code, ready to
# test. You keep the PR/Reviewer gate; you stop chasing GitHub by hand.
#
# Usage:
#   ./merge-pr.sh            # merge the PR for the current branch
#   ./merge-pr.sh <number>   # merge PR #<number>
#   ./merge-pr.sh <url>      # merge by PR URL
#
# Merge method defaults to --squash (override with MERGE_METHOD=merge|rebase).
# Requires: gh (authenticated), git. Run from inside the repo.
set -euo pipefail

command -v gh  >/dev/null || { echo "merge-pr: 'gh' CLI not found — install it and 'gh auth login'." >&2; exit 1; }
command -v git >/dev/null || { echo "merge-pr: 'git' not found." >&2; exit 1; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "merge-pr: not inside a git repository." >&2; exit 1; }

PR_ARG="${1:-}"
MERGE_METHOD="${MERGE_METHOD:-squash}"
case "$MERGE_METHOD" in
  squash|merge|rebase) ;;
  *) echo "merge-pr: MERGE_METHOD must be squash|merge|rebase (got '$MERGE_METHOD')." >&2; exit 1 ;;
esac

# Refuse to merge on top of uncommitted local work — it would be lost or confused
# by the checkout/pull below. This mirrors the framework's "never a dirty tree" rule.
if [ -n "$(git status --porcelain)" ]; then
  echo "merge-pr: working tree is dirty. Commit or stash before merging so the post-merge sync is safe." >&2
  git status --short >&2
  exit 1
fi

# Resolve the default branch from the remote (main/master/etc.).
default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true)"
[ -z "$default" ] && default="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo main)"

# The branch we're sitting on now — likely the PR's head branch, which the merge
# will delete on the remote. We must move off it before deleting it locally.
current="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

echo "→ Merging PR (${PR_ARG:-current branch}) with --$MERGE_METHOD, deleting the remote branch…"
# --delete-branch removes BOTH the remote branch and the local head branch that gh
# knows maps to it. We still fetch --prune afterwards to be certain.
gh pr merge $PR_ARG --"$MERGE_METHOD" --delete-branch

echo "→ Syncing local $default to the merged commit…"
git checkout "$default"
git fetch --prune origin
git pull --ff-only

# If gh didn't remove the old local feature branch (e.g. it wasn't the current one,
# or names didn't map), clean up any local branch whose upstream is now gone.
if [ -n "$current" ] && [ "$current" != "$default" ]; then
  if git show-ref --quiet --verify "refs/heads/$current" 2>/dev/null; then
    gone="$(git for-each-ref --format='%(upstream:track)' "refs/heads/$current" 2>/dev/null || true)"
    if [ "$gone" = "[gone]" ]; then
      git branch -D "$current" && echo "→ Deleted merged local branch '$current'."
    fi
  fi
fi

echo "✓ Done. Local checkout is on $default at the merged commit ($(git rev-parse --short HEAD)) — ready to test."
