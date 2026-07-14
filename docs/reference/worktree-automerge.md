# worktree-automerge

Auto-merges finished worktrees to `main` so you never have to remember to. Runs
on a schedule, hands-off. **Pushing `main` auto-deploys to production (CF Pages)**,
so every merge here ships — that's intentional, which is why the gate is strict.

## The gate (a worktree merges only when ALL hold)

- branch isn't `main` and isn't a skip-prefix (`wip/ spike/ experiment/ tmp/ draft/`)
- no `.automerge-skip` file in the worktree (explicit opt-out)
- working tree is clean (nothing uncommitted)
- **quiescent** — last commit older than 30 min (an actively-worked branch is left
  alone; the bot never yanks a worktree out from under a live session)
- ahead of `origin/main` (something to merge)
- merges into `origin/main` with no conflicts
- **`npm run check` passes** in the worktree

It merges **server-side via `gh`** (push branch → PR → `gh pr merge --admin`), so it
never touches your primary checkout's (usually dirty) working tree.

## Commands

```bash
npm run wt:status           # fast preview: which worktrees pass the cheap gates (no check run)
npm run wt:automerge        # full dry run incl. `npm run check` — reports, merges nothing
npm run wt:automerge:apply  # actually merge the ready ones
```

Add `--prune` to `:apply` to also remove each merged worktree (and its node_modules
junction) after merge.

## Opt a worktree out

Drop an empty file to keep a worktree from auto-shipping (e.g. it's mid-review, or
gated on an external step):

```bash
touch E:/worktrees/tka-platform/<name>/.automerge-skip
```

`.automerge-skip` is gitignored — it's a local, per-worktree marker, never committed.
Delete it when the branch is ready to ship.

## Audit + revert

Every merge appends to `.git/automerge-log.jsonl` with the branch, its head, and the
**pre-merge `origin/main` SHA**. To revert a bad auto-merge:

```bash
git push origin <preMergeOriginMain>:refs/heads/main --force-with-lease
```

(Prod redeploys from the reverted `main`.)

## Schedule (Windows)

Registered as a Scheduled Task running `:apply` every 20 min. Manage it:

```powershell
schtasks /query /tn "tka-worktree-automerge"    # status
schtasks /change /tn "tka-worktree-automerge" /disable   # pause
schtasks /delete /tn "tka-worktree-automerge" /f         # remove
```

A lock (`.git/automerge.lock`, stale after 60 min) keeps a slow run and the next tick
from colliding.
