#!/bin/sh
# install-hooks.sh — installs Git hooks for the sendlog-website repo.
# Run once after cloning: sh scripts/install-hooks.sh

set -e

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPTS_DIR="$REPO_ROOT/scripts"

install_hook() {
  local name="$1"
  local src="$SCRIPTS_DIR/hooks/$name"

  if [ ! -f "$src" ]; then
    echo "⚠️  Hook source not found: $src" >&2
    return
  fi

  cp "$src" "$HOOKS_DIR/$name"
  chmod +x "$HOOKS_DIR/$name"
  echo "✅  Installed .git/hooks/$name"
}

# ── pre-commit ──────────────────────────────────────────────────────────────
# Writes the pre-commit hook inline so this script is self-contained.
cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/bin/sh
# pre-commit: run ESLint on staged JS files before every commit.

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

STAGED_JS=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^(app/js|scripts)/.+\.js$' || true)

if [ -z "$STAGED_JS" ]; then
  exit 0
fi

echo "🔍  ESLint — linting staged files…"

if ! command -v npx >/dev/null 2>&1; then
  echo "⚠️   npx not found. Run 'npm install' first." >&2
  exit 1
fi

# shellcheck disable=SC2086
npx eslint $STAGED_JS
ESLINT_EXIT=$?

if [ $ESLINT_EXIT -ne 0 ]; then
  echo ""
  echo "❌  ESLint found errors. Fix them before committing."
  echo "    Run 'npm run lint:fix' to auto-fix what's possible."
  exit $ESLINT_EXIT
fi

echo "✅  ESLint passed."
HOOK

chmod +x "$HOOKS_DIR/pre-commit"
echo "✅  Installed .git/hooks/pre-commit"

echo ""
echo "All hooks installed. Run 'npm install' if you haven't already."
