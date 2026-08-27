# Worktree-First Workflow (ENFORCED)

## The rule

**Every task that may modify repository files works in one dedicated Git
worktree. The primary checkout (`E:/tka-platform`) stays on `main` and is
reserved for Austen's dev server, final integration, and explicitly requested
local work.**

Read-only investigation may run in the primary checkout. Direct edits there are
an exception and require Austen to request that exact workflow in the current
conversation.

## Operating pattern

1. Classify the task as read-only or modifying before the first edit.
2. Start modifying chats in the Codex app's Worktree environment based on
   `main`. The app may begin on a detached HEAD.
3. If a modifying chat starts in the primary checkout, use Handoff to move it
   to a worktree before editing. When product-managed Handoff is unavailable,
   create exactly one task-owned worktree at a resolved, repository-adjacent
   path. Never nest worktrees or reuse one for unrelated work.
4. Create a unique task branch before the first commit (`codex/<task-slug>` for
   Codex; use the current client's configured agent prefix elsewhere).
5. Run all edits, commands, and verification from the task worktree. Check
   `git status --short` before editing and before every commit. Do not touch
   paths owned by another task.
6. Commit only files owned by the task, using explicit pathspecs. Push completed
   units when remote backup or cross-session synchronization is useful.

## Integration and cleanup

1. Complete proportionate verification in the worktree before integration.
2. Fetch remote state and bring the task branch current with `main` without
   rewriting a branch shared by another task.
3. Inspect the primary checkout. Integrate the completed branch only when its
   uncommitted paths do not overlap this task. If integration is unsafe, leave
   the branch and worktree intact and report the exact conflict.
4. Confirm the integrated commit and paths are present on `main`.
5. Remove the task worktree and branch after integration. Never delete a dirty
   worktree until every uncommitted path is proven landed, intentionally
   discarded by Austen, or preserved elsewhere.

If the task depends on uncommitted primary-checkout changes, use the Codex app's
working-tree starting state or Handoff. Do not copy the files manually between
checkouts.

## Still true

- `:5173` is Austen's dev server on the primary checkout. Never run, restart,
  or kill it (`CLAUDE.md` -> Dev Server). Use `vite --port <free>` for a
  worktree that needs its own server, and obey `resource-budget.md`.
- Each worktree has its own index, while Git objects and refs are shared.
  **Scoped commits are still mandatory** (`commit-only-your-own-changes.md`):
  use `git commit -- <paths>`, never broad staging or a bare commit.
- Never recursively delete a worktree `node_modules` path until it is proven not
  to be a junction into the primary checkout.

## Explicit exceptions

- When Austen explicitly requests work in the primary checkout, follow that
  exact request without creating an extra worktree.
- When Austen specifies a branch, worktree, or starting state, follow the named
  target instead of the defaults above.
- Non-Git projects cannot use Git worktrees and may be edited in their designated
  local directory.

## Related

- `commit-only-your-own-changes.md`, `fast-iteration-loop.md`, `resource-budget.md`
- Root `AGENTS.md` -> Git Branches and Worktrees
