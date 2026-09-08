# Worktree Lifecycle

Apply this to repository-modifying tasks. Read-only work may remain in the
primary checkout.

## Start

1. Use one task-owned worktree based on current local `main`. The primary
   checkout at `E:/tka-platform` is reserved for the dev server and integration
   unless Austen explicitly requests direct edits there.
2. Prefer Codex Handoff. If unavailable, create one resolved,
   repository-adjacent worktree. Never nest or repurpose a worktree.
3. Create a unique `codex/<task-slug>` branch before committing.
4. Check status before editing and before every commit. Preserve unrelated work
   and follow `commit-only-your-own-changes.md`.

## Verify and Finish

1. Run proportionate verification in the task worktree. Documentation-only
   branches do not require the full Svelte check; code branches use the nearest
   tests and relevant type/build gate. Visual work also follows
   `visual-verification-mandatory.md`.
2. Commit only task-owned paths with explicit pathspecs.
3. Bring the task branch current with local `main`. Repeat only checks invalidated
   by that update.
4. Leave the worktree before invoking the guarded finish command:

```powershell
Set-Location E:/tka-platform
npm run wt:finish -- codex/<task-slug> --route /real-shipping-route
npm run wt:finish -- codex/<task-slug> --nonvisual
```

Use `--route` when a real app surface exists and `--nonvisual` otherwise. The
command checks cleanliness, ancestry, overlap with primary-checkout changes,
concurrent `main` movement, and the appropriate project gate. It merges to local
`main`, verifies ancestry, removes the clean worktree, and deletes the merged
local branch.

Implementation approval includes this guarded local integration and cleanup.
Stop with branch and worktree intact when a gate fails or integration is unsafe;
report the exact blocker. Never delete a dirty worktree, another task's branch,
or a `node_modules` path that may be a junction into the primary checkout.

`wt:status` and `wt:automerge` are diagnostic only. Do not use retired batch
apply/prune workflows. If the task depends on uncommitted primary-checkout state,
use Handoff or a working-tree starting state instead of copying files manually.
