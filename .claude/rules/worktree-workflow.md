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

Implementation approval is approval for this whole lifecycle: edit, verify,
commit, integrate into the local `main` checkout, remove the task worktree and
branch, and deliver the integrated result. Do not insert separate “may I merge?”
or “may I delete the worktree?” gates after the implementation was approved.

## Integration and cleanup

1. Complete proportionate verification in the worktree and commit the finished
   unit with explicit pathspecs.
2. Fetch remote state, bring the task branch current with local `main`, and
   repeat any verification invalidated by that update. Never rewrite a branch
   shared by another task.
3. Change the terminal's current directory to the primary checkout, then finish
   the lifecycle with one guarded command. This matters on Windows: a terminal
   whose current directory is inside the task worktree prevents that directory
   from being deleted.

   ```powershell
   Set-Location E:/tka-platform
   npm run wt:finish -- codex/<task-slug> --route /real-shipping-route
   npm run wt:finish -- codex/<task-slug> --nonvisual
   ```

   Use `--route` for anything Austen can inspect in the app and `--nonvisual`
   only when there is genuinely no page to review. The command refuses dirty
   task work, stale branches, overlapping primary-checkout edits, in-progress
   Git operations, failed checks, and a `main` race. Unrelated uncommitted work
   in the primary checkout is preserved.

4. The command merges the branch into the **local** primary checkout with one
   merge commit, verifies ancestry, removes the task worktree, deletes the
   merged local branch, and prints the `https://localhost:5173` delivery URL.
   That single integration is the intended HMR event on Austen's dev server.
5. For a visual task, immediately open the printed URL in the desktop app's
   in-app Browser pane and ask for feedback on the integrated `main` result.
   In Codex use `open_in_codex` with a browser target; in Claude use the
   available in-app preview tool. A worktree preview on another port is useful
   for verification but is never the final handoff.

Do not leave completed work parked in a worktree merely to await merge,
cleanup, or review permission. Stop with the worktree intact only when a gate
fails or integration is genuinely unsafe, and report the exact blocker plus
the evidence. Feedback that requires another edit starts a new task worktree
from the newly integrated `main`.

Never use the retired server-side batch `--apply`/`--prune` workflow. It can
advance remote `main` without updating the local checkout that serves port 5173
and can leave completed worktrees behind. `wt:status` and `wt:automerge` are
read-only diagnostics; `wt:finish` is the only mutating lifecycle command.

Never delete a dirty worktree until every uncommitted path is proven landed,
intentionally discarded by Austen, or preserved elsewhere.

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
