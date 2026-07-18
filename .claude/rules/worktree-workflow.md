# Work on Main — ENFORCED (worktree mandate reversed 2026-07-18)

## The Rule (current)

**Work directly on `main` in the primary checkout (`C:/tka-platform`). Do not
spin up a worktree or a feature branch for routine work.** Commit to main and
push frequently.

Austen's directive (2026-07-18): revert the mandatory-worktree policy —
everything on main, all the time.

## Why this reverses the old policy

From 2026-07-14 until 2026-07-18, every branch/parallel task required its own
worktree, for isolation from clobbering + HMR churn across the many parallel
sessions Austen runs. That policy is retired. The worktree ceremony (junctions
vs real installs, `build:packages`, Vite `fs.allow`, the C-machine native-build
breakage that stops the full app from even booting in a fresh worktree) cost
more than the isolation was worth. Working on main directly is simpler.

## What this means

1. **Primary checkout stays on `main`.** Edit, commit, and push there.
2. **No feature-branch worktrees by default.** Don't create `C:/worktrees/...`
   for ordinary work.
3. **Commit + push frequently.** The sessions share the one checkout, so small
   frequent commits are how you avoid clobbering each other's uncommitted work:
   `git pull --rebase` before a big edit, commit a unit the moment it's done,
   push.
4. **Merge-to-main-when-done still stands** (that was never the friction) — see
   `feedback_merge_to_main_when_done`.

## The tradeoff being re-accepted

The old policy existed because concurrent sessions editing one working dir
clobber each other's uncommitted files and thrash `:5173`'s HMR. On main
directly, that risk returns. Mitigate with frequent commits/pushes and
`git pull --rebase`. If a task genuinely needs isolation (a risky refactor you
don't want touching others' in-flight work), a worktree is still **allowed** —
it is simply no longer the **default**, and no longer mandatory.

## Still true

- `:5173` is Austen's dev server on the primary checkout — never `npm run dev`,
  never kill it (`CLAUDE.md` → Dev Server). Use `vite --port <free>` for your own.
- **Scoped commits only** (`commit-only-your-own-changes.md`): the shared index
  means `git commit -- <paths>`, never a bare `git add -A` + commit that sweeps
  another session's staged work into yours.

## Related

- `commit-only-your-own-changes.md`, `fast-iteration-loop.md`, `resource-budget.md`
- Global `CLAUDE.md` → Branching & Worktrees
