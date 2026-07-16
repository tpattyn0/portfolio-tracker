#!/usr/bin/env bash
# Install the workflow git hooks into this repo. Run once per clone.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
src="$(cd "$(dirname "$0")" && pwd)"
cp "$src/pre-commit" "$root/.git/hooks/pre-commit"
chmod +x "$root/.git/hooks/pre-commit"
echo "✓ Installed pre-commit hook (blocks secrets + commits to main)."
