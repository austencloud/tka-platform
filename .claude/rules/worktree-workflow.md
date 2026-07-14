# Worktree Workflow — ENFORCED

## The Problem This Solves

Austen runs up to ~6 Claude sessions against this repo at once. When they all
edit the **same** working directory (`E:/tka-platform`), two things break:

1. **Clobbering.** Concurrent agents overwrite each other's uncommitted files.
   This is the documented root cause of repeated data loss (see global
   `CLAUDE.md` → Git Safety, and `commit-only-your-own-changes.md`).
2. **HMR churn.** The VS Code dev server (`:5173`) watches `E:/tka-platform`
   and hot-reloads on every file write. Six agents writing at once =
   constant HMR thrash → the running app becomes unusable while work is in
   flight. (`vite.config.ts` already fights this with `awaitWriteFinish` +
   an aggressive `server.watch.ignored` list — worktrees are the structural
   fix on top of that.)

Worktrees solve both: each session's edits live in a **separate directory
outside the watched checkout**, so they can't clobber and the primary's dev
server never sees them. Austen's directive (2026-07-14): *"change our policies
so we actually do use them."*

## The Rule

**Any branch or parallel task gets its own worktree. Default, not a fallback.**
The primary checkout `E:/tka-platform` stays on `main` (global rule).

### 1. Create it in the shared worktrees root, outside the checkout

```bash
mkdir -p E:/worktrees/tka-platform            # once; reused thereafter
git worktree add E:/worktrees/tka-platform/<name> -b <branch>
```

- **Location = `E:/worktrees/tka-platform/<name>`** — one tidy parent outside
  every checkout. Two reasons it lives there and nowhere else:
  - **Outside the checkout** → HMR isolation. Do NOT nest under
    `.claude/worktrees/`: `vite.config.ts`'s watcher does not ignore `.claude/`,
    so a nested worktree's `src/` edits fall inside the primary dev server's
    watch and reintroduce the churn we're eliminating. (The
    `.claude/worktrees/` `.gitignore` entry predates this and is a trap; the
    `**/.claude/**` / `**/.worktrees/**` watch-ignore added 2026-07-14 is
    belt-and-suspenders.)
  - **One parent, not loose in `E:/`** → don't scatter `E:/worktrees/tka-platform/<name>`
    dirs across the drive root. Keep them grouped under `E:/worktrees/`.
- Correct example: `E:/worktrees/tka-platform/wall-plane-feasibility`.
- Legacy loose siblings still exist and are ACTIVE: `E:/tka-platform-shop-cart`,
  `E:/tka-platform-shop-perf`. Leave them where they are while in use; migrate
  into `E:/worktrees/tka-platform/` (via `git worktree move`, content-safe)
  only once their sessions wrap — never yank a worktree a live session is in.

### 2. Wire up node_modules — cheap, two paths

This is **pnpm 10.28** (`packageManager` in `package.json`) with the store at
`E:\.pnpm-store\v10` — same volume as the worktrees, so installs hardlink and
cost almost no disk.

- **Source-only work (same deps as main) — junction to the primary's
  node_modules. Zero disk, zero install:**
  ```bash
  cmd //c "mklink /J E:\worktrees\tka-platform\<name>\node_modules E:\tka-platform\node_modules"
  ```
  (`ln -s` also works in this Git Bash — the existing worktrees use a symlink:
  `shop-cart/node_modules -> /e/tka-platform/node_modules/`. Junction is the
  admin-free Windows default and is preferred.)
- **Work that CHANGES dependencies or touches `packages/*` — do a real install
  instead** (never mutate the shared node_modules through a junction):
  ```bash
  cd E:/worktrees/tka-platform/<name> && pnpm install
  ```
  pnpm replaces the junction with a real tree hardlinked from `E:\.pnpm-store`
  — still cheap, and correctly resolves the `packages/*` workspace + the
  `svelte-fast-check` patch.

Because node_modules is a junction/symlink for the common case: **never run
`rm -rf node_modules` in a worktree** — you'd delete the primary's. Remove the
junction with `cmd //c "rmdir E:\worktrees\tka-platform\<name>\node_modules"` (no `/s`).

### 3. Verifying your own work visually

The primary `:5173` serves the primary checkout — it will NOT show a worktree's
edits. To see your change in a browser, run your own dev server pointed at the
worktree on a free port:

```bash
cd E:/worktrees/tka-platform/<name> && vite --port 5174   # or any free port ≠ 5173
```

Never touch `:5173` (it's Austen's — see `CLAUDE.md` → Dev Server). Follow
`fast-iteration-loop.md` for the check/build cadence inside the worktree.

### 4. Commit + finish

- Commit with an explicit pathspec (`commit-only-your-own-changes.md`) — the
  index is still shared conceptually across sessions; scope every commit.
- Before `git worktree remove`, the worktree must be clean: commit or
  stash-with-permission. Removing a dirty worktree drops its changes.
- Remove the node_modules junction first (step 2) if you used one, then
  `git worktree remove E:/worktrees/tka-platform/<name>`.

## Forbidden

- Doing branch/parallel work by editing `E:/tka-platform` directly instead of
  spinning up a worktree.
- Switching the primary checkout off `main` (global rule).
- Nesting a worktree inside the checkout (`.claude/worktrees/…`) when HMR
  isolation is the goal — use a sibling dir.
- `rm -rf node_modules` (or `rmdir /s`) inside a worktree whose node_modules is
  a junction/symlink to the primary.
- `git worktree remove` on a dirty worktree.

## Related

- Global `CLAUDE.md` → Branching & Worktrees (the default-use policy)
- `commit-only-your-own-changes.md` — scoped commits across parallel sessions
- `fast-iteration-loop.md` — check/build cadence
- `CLAUDE.md` → Dev Server — `:5173` is Austen's; use `vite --port 5174`
- `superpowers:using-git-worktrees` skill, `EnterWorktree` tool
