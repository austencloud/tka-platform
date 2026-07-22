# Fast Iteration Loop — ENFORCED

## The Problem This Solves

Agents reflexively run `npm run check` and `npm run build` after every edit. Both are cold, full-project commands. `build` rebuilds 9 tsc packages from scratch + svelte-kit sync + full vite build + asset trim. Running either in the inner edit loop wastes minutes of Austen's time per change for feedback the dev server already gives for free.

Austen's feedback (2026-05-28): *"it takes forever every goddamn time."*

## The Rule

**Never run full `npm run check` or `npm run build` in the inner edit loop.** They are pre-commit / pre-ship gates, not per-change feedback.

### CAPTURE ONCE, GREP MANY — never re-run check to re-filter

A cold `npm run check` costs 2-3+ minutes. NEVER run it again just to apply a different grep/sed/filter, and NEVER run it multiple times in parallel — parallel cold runs do NOT share a cache, so 3x check = 3x the wait (this wasted ~10 min on 2026-05-28).

Correct pattern — run once into a log, then filter the log for free:

```bash
npm run check > /tmp/check.log 2>&1   # ONE cold run
grep -niE "error" /tmp/check.log       # filter as many times as you want
grep -iE "\.svelte:" /tmp/check.log    # free — reads the file, not the compiler
```

If you need iterative error triage, prefer `npm run check:watch` (warm, in-memory) over repeated one-shots. One `check` invocation per turn, maximum.

### Inner loop (while iterating) — use these instead

| Need | Command | Why fast |
|------|---------|----------|
| Live type errors | `npm run check:watch` | Compiler stays in memory; only re-checks changed files. Start ONCE in background, leave running. |
| One-shot lighter check | `npm run check:fast` | `svelte-fast-check` binary, lighter pass than full `svelte-check`. |
| Runtime / visual bugs | Dev server on :5173 (already running) | Vite HMR catches the vast majority of bugs live. No build needed. |
| Build without asset trim | `npm run build:fast` | Skips `trim-deploy-assets.js`. |

### When a full check/build IS warranted

- Before a commit (one full `npm run check`)
- Before claiming a task "done" per verification rules
- After a cross-cutting rename/refactor (changed-file checks miss cross-file errors — see caveat below)
- Pre-ship / pre-deploy (full `npm run build`)

### Scoped checking caveat

`svelte-check` needs the whole project to catch cross-file errors (rename a prop → usage sites break elsewhere). You can narrow it by pointing at a tsconfig with a tighter `include`, but a scoped pass can MISS errors in files it didn't look at. So: use `check:watch` for speed during iteration, then ONE full `check` before commit. Never ship on a scoped check alone after a refactor that touched shared symbols.

## Recommended default

Start `npm run check:watch` in a background terminal at session start. Stream errors as you save. Reserve full `check`/`build` for the commit gate. This is the 2026 AI-assisted loop: warm incremental checker + HMR for runtime, heavy gates only at boundaries.

## Where the time actually goes (verified 2026-07-21)

**`build:packages` is already incremental — do not "optimize" it again.** An
earlier version of this section claimed the 9 tsc projects lacked
`composite: true` and needed `tsc --build`. Both landed since; the section went
stale and kept sending agents after work already done. Current state:

- `build:packages = tsc --build packages/tsconfig.build.json`
- All 9 packages referenced by `packages/tsconfig.build.json` declare
  `"composite": true`, and each carries a live `tsconfig.tsbuildinfo`.
- The other packages (`camera-3d`, `feedback-types`, `mcp-game-controller`,
  `mcp-tika-talk`, `render-composition`) are not in the build graph. Adding
  `composite` to them buys nothing.

**The remaining cost is `check`, and it is not a `tsc` problem.** `npm run check`
is `svelte-check` over `.svelte` files with an 8 GB heap. `tsgo` (TypeScript
native preview) does not parse Svelte, so it cannot replace `svelte-check` —
piloting it would only touch the `type-check` script, which is not the
bottleneck. Do not propose it as a fix for check time.

What genuinely moves check time, in order:

1. **Not running it.** `check:watch` + HMR per the table above.
2. **Machine contention.** A cold check competes with every other vite server
   and check on the box. See `resource-budget.md` — the 2026-07-17 incident was
   7 concurrent dev servers plus two checks, not a compiler problem.

Before proposing a build-perf change, re-verify the claim against the repo —
this section was wrong for long enough to mislead multiple sessions.

## Related

- `verification-protocol.md` — what counts as proof before "done"
- `CLAUDE.md` → Dev Server — port 5173 is the user's; never run `npm run dev`
