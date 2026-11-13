# AGENTS.md — SendLog Website (web repo)

Companion rules for the SendLog web app. Shared rules (push approval,
SonarQube disk-flood triage, never `--no-verify`) live in the iOS repo's
`AGENTS.md` (`../../ClimbingNotes/AGENTS.md`) and apply here too.

## CodeScene

After changing code, run `code_health_review` on the changed files. If Code Health drops, fix the issues, run the review again, and use `code_health_score` to confirm the result. Before finishing, run `pre_commit_code_health_safeguard` and only stop when it passes.

## Web Gate Sequence (per refactor chunk / feature)

1. `npx vitest run`
2. `npx eslint app/js tests` — 0 errors (pre-existing `no-alert` warnings are tolerated)
3. `code_health_review` on every changed code file (no drop, report score)
4. `pre_commit_code_health_safeguard`
5. `graphify update .` (repo root)
6. **Reviewer subagent on the staged diff** — dispatch the `reviewer` agent
   (pi subagent extension, GPT-6 Luna high thinking) via
   `git diff --staged`; fix all Critical findings before committing.

   Reviewer quirks (learned 2026-11-13):
   - **cwd quirk:** the pi subagent tool rejects `cwd` together with a task
     ("Provide exactly one mode"), so the reviewer always runs in the *other*
     repo's cwd and sees no staged diff → it stops with "Nothing is staged".
     **Workaround:** write the diff to a file and point the task at it:
     `git diff --staged > /tmp/review-staged.diff`, then dispatch with a task
     starting "do NOT run any git commands — the ONLY input is
     /tmp/review-staged.diff; read it with the read tool".
   - **Repeat findings:** the reviewer starts each pass from zero and
     re-raises findings that were already declined. Preface the task with the
     declined findings **and their justification** (with file/line evidence).
   - **Fix rounds:** for data-integrity-heavy changes, re-dispatch to verify
     fixes; for trivial diffs, do one full review and verify fixes locally
     instead of re-dispatching per round (saves cycle time and tokens).
7. Mock-mode smoke: `node serve.cjs` → `http://localhost:8080/app/?mock=true`
   — views open, overlays open, save flows work. Have the user verify.
8. Commit (one commit per chunk), then request push approval.

## SonarQube Push Gate (SendLogWebsite project)

- **Never use bare `window.*` in new code** — use `globalThis`
  (rule S7764). For legacy globals from non-module scripts read them via
  `globalThis.<name>` (e.g. `globalThis.getPreferredGradeSystem()`).
- **New DOM-heavy view module → add it to `sonar.coverage.exclusions`** in
  `sonar-project.properties` (browser-side modules can't be meaningfully
  unit-tested; pure-logic modules stay measured). Forgetting this fails
  the `new_coverage` gate at push time.
- Gate failures are always `new_*` metrics vs. the previous push. Violation
  list: Sonar dashboard `http://localhost:9000/dashboard?id=SendLogWebsite`.
- "SonarQube analysis task FAILED" = usually Elasticsearch disk-flood mode,
  not a code problem — see iOS `AGENTS.md` for triage.

## Unit Tests — browser-module mocking pattern

Importing any module that transitively reaches `firebase-config.js` fails in
vitest (Firebase SDK isn't installed). Mock at the top of the test file, in
this order, before the import:

```js
vi.mock("firebase/firestore", () => ({ /* see tests/training-ui.test.js */ }));
vi.mock("../app/js/firebase-config.js", () => ({ db: {}, auth: { currentUser: null } }));
vi.mock("../app/js/firebase-auth.js", () => ({ getCurrentUser: () => ({ uid: "test-uid" }) }));
```

Canonical example: `tests/training-ui.test.js`, `tests/climb-table-ui.test.js`.
Pure-logic modules belong in `vitest.config.js` `coverage.include`; DOM view
modules do not.

## Local Dev

- `node serve.cjs` (repo root) → `http://localhost:8080/app/?mock=true`.
  A stale server instance can wedge and 404 every path — kill it
  (`lsof -iTCP:8080 -sTCP:LISTEN`) and restart.
- Python 3.14's `http.server` has a known empty-response bug — always use
  the included Node server (see README).

## Internal Documentation

- `docs/codebase/` (STACK, STRUCTURE, ARCHITECTURE, CONCERNS, …) is the web
  app's internal reference — **update it after every push** when modules,
  commands, or conventions changed. Refactor plans live in
  `docs/plan-*.md` (authoritative tracker: `docs/plan-uijs-refactor.md`).
