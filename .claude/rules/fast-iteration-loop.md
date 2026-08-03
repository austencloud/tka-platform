# Fast Iteration Loop — ENFORCED

Full `npm run check` and `npm run build` are cold, multi-minute, whole-project
commands. They are pre-commit / pre-ship gates, not per-change feedback — the
dev server's HMR and the warm checker already give that for free.

## Inner loop (while iterating)

| Need | Command | Why |
|---|---|---|
| Live type errors | `npm run check:watch` | Compiler stays warm; start once in background, leave running |
| One-shot lighter check | `npm run check:fast` | `svelte-fast-check`, lighter pass |
| Runtime / visual bugs | dev server on :5173 (already running) | HMR catches most bugs live |
| Build without asset trim | `npm run build:fast` | Skips `trim-deploy-assets.js` |

## Capture once, grep many

A cold `npm run check` costs 2–3+ minutes and parallel runs don't share a
cache (3 parallel checks = 3× the wait). One `check` invocation per turn,
maximum — pipe it to a log and filter the log for free:

```bash
npm run check > /tmp/check.log 2>&1
grep -niE "error" /tmp/check.log
```

## When a full check/build IS warranted

Before a commit, before claiming done (per `verification-protocol.md`), after
a cross-cutting rename/refactor (scoped or watch-mode checks miss cross-file
errors — never ship a shared-symbol refactor on a scoped check alone), and
pre-deploy.

## Verified 2026-07-21 — don't re-optimize the build

`build:packages` is already incremental: `tsc --build packages/tsconfig.build.json`,
all 9 referenced packages have `composite: true` and live `.tsbuildinfo`. The
remaining cost is `svelte-check` itself, which `tsgo` cannot replace (it
doesn't parse Svelte). What actually moves check time: (1) not running it —
use `check:watch` + HMR; (2) machine contention — see `resource-budget.md`.
Re-verify against the repo before proposing any build-perf change; a stale
version of this section misled multiple sessions.
