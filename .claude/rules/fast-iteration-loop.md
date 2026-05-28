# Fast Iteration Loop — ENFORCED

## The Problem This Solves

Agents reflexively run `npm run check` and `npm run build` after every edit. Both are cold, full-project commands. `build` rebuilds 9 tsc packages from scratch + svelte-kit sync + full vite build + asset trim. Running either in the inner edit loop wastes minutes of Austen's time per change for feedback the dev server already gives for free.

Austen's feedback (2026-05-28): *"it takes forever every goddamn time."*

## The Rule

**Never run full `npm run check` or `npm run build` in the inner edit loop.** They are pre-commit / pre-ship gates, not per-change feedback.

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

## Known optimization (not yet applied)

`build:packages` (9 tsc projects) is non-incremental — the package `tsconfig.json` files lack `composite: true`. Making them composite + switching to `tsc --build` would skip unchanged packages on rebuild. TypeScript native preview (`tsgo`, ~10x faster) is also worth piloting for `type-check`. Flag these to Austen if build time is the bottleneck.

## Related

- `verification-protocol.md` — what counts as proof before "done"
- `CLAUDE.md` → Dev Server — port 5173 is the user's; never run `npm run dev`
