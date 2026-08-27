# Commit Only Your Own Changes — ENFORCED

Modifying tasks normally use dedicated worktrees, so their working trees and
indexes are isolated. Git objects and refs are still shared, Local sessions may
still share the primary checkout and index, and path ownership remains strict.
A bare `git commit` in the primary checkout is how commit `0ec96666` swept ~16
unrelated refactor files into an agent's commit even though its own `git add`
used explicit paths. The pre-commit hook does not auto-stage; the shared primary
index was the cause.

**Always scope commits to an explicit pathspec** — this commits only the
listed paths regardless of what else is staged:

```bash
git commit -m "message" -- path/to/file-a path/to/file-b
```

Before every commit: run `git status --short`, identify exactly which files
YOUR task created or modified (if you can't name why a file is in your diff,
it isn't yours), and list those paths on the commit command. Files you didn't
touch — staged or not — belong to another agent or an in-flight refactor:
don't stage them, commit them, or revert them to "clean up." Broad staging
(`git add -A`, `git add .`, `git add -u`, whole directories) stays banned per
global Git Safety. Subagent prompts that include committing must carry the
pathspec instruction.

If a commit already swept in unrelated work: do NOT rewrite history while
parallel agents run. Report the SHA and the unrelated files, and let Austen
reconcile.
