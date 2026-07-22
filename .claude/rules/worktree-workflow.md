# Work on Main (ENFORCED)

## The rule

**Work directly on `main` in the primary checkout (`E:/tka-platform`). Never
create a Git branch or Git worktree unless Austen explicitly requests that exact
action in the current conversation.**

Task size, risk, parallelism, handoffs, pull requests, and a dirty working tree
do not grant permission. If the requested files overlap another session's
in-flight changes, do not edit those files and do not create an isolated
checkout. Report the exact overlap as the blocker.

## Operating pattern

1. Keep the primary checkout on `main`.
2. Fetch before integrating remote work. Update `main` only when incoming paths
   do not overlap uncommitted changes.
3. Commit only the files owned by the current task, using explicit pathspecs.
4. Push completed units frequently so other sessions can synchronize safely.

## Explicitly requested exceptions

When Austen explicitly requests a branch or worktree in the current
conversation:

- Create only the requested branch or worktree. Do not add an integration or
  verification worktree around it.
- Merge completed work into `main` and remove the branch or worktree in the same
  task.
- Never delete a dirty worktree until every uncommitted path is proven landed,
  intentionally discarded by Austen, or preserved elsewhere.

## Still true

- `:5173` is Austen's dev server on the primary checkout — never `npm run dev`,
  never kill it (`CLAUDE.md` → Dev Server). Use `vite --port <free>` for your own.
- **Scoped commits only** (`commit-only-your-own-changes.md`): the shared index
  means `git commit -- <paths>`, never a bare `git add -A` plus commit that
  sweeps another session's staged work into yours.

## Related

- `commit-only-your-own-changes.md`, `fast-iteration-loop.md`, `resource-budget.md`
- Root `AGENTS.md` -> Git Branches and Worktrees
