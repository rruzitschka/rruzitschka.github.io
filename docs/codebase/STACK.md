# STACK — SendLog Web App

Canonical stack reference. Update after every dependency or tooling change.

## Runtime

| Layer | Choice |
| --- | --- |
| Hosting | GitHub Pages (`rruzitschka.github.io` repo, custom domain `www.sendlog.at`) |
| Architecture | Static ES modules, **no bundler** — native `<script type="module">` + import map |
| Firebase SDK | firebase-js SDK 12.x, loaded from `gstatic` CDN via import map in `app/index.html` |
| Backend | Firebase Auth + Firestore (client SDK); Cloud Functions REST API (v1, lives in the **iOS repo** `ClimbingNotes/functions`) |
| Storage | Firebase Storage (route photos) |

## Dev tooling

| Tool | Purpose |
| --- | --- |
| vitest | Unit tests (`npx vitest run`), v8 coverage → `coverage/lcov.info` |
| ESLint 9 (flat config) | Lint (`npx eslint app/js tests`) |
| SonarQube (pre-push hook) | Quality gate: new violations = 0, new coverage ≥ 80 |
| CodeScene MCP | `code_health_review` on changed files; `pre_commit_code_health_safeguard` before finishing |
| Node static server | `node serve.cjs . <port>` for local dev (no build step) |

## Module system

- ES modules only; **no bundler, no TypeScript, no framework**.
- Third-party deps resolve through the **import map** in `app/index.html` — add new packages there, not in package.json (package.json holds dev tooling only).
- `stats.js` and `grades.js` are legacy **non-module** scripts loaded as plain `<script>` tags; they communicate via `window` globals (`GRADES`, `detectGradeSystem`, `renderStatsPage`, …). Do not convert casually — `ui.js` depends on those globals.
