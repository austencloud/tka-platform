# Commit Only Your Own Changes — ENFORCED

## The Problem This Solves

Austen runs many Claude agents simultaneously, and a large refactor is often in
flight on the side. The git **index (staging area) is shared** — at any moment it
may already contain files staged by another agent or by an in-progress refactor.

Agents (especially subagents) reflexively stage their work and then run a bare
`git commit`, assuming the index contains only their changes. It does not. A bare
`git commit` commits the **entire staged index**, so the agent sweeps unrelated
in-flight work into its commit. This muddies history, mis-attributes changes, and
commits another agent's work before that agent is ready.

Austen's feedback (2026-05-29): *"they tend to think their job ... is just to
commit the whole work tree after everything but they need to be careful because
sometimes the work tree is really dense with a lot of changes and they should
really only commit their own changes ... you just had an agent who committed
their work alongside a bunch of unrelated work which kind of muddied up the git
history."*

Verified root cause (2026-05-29): commit `0ec96666` swept ~16 unrelated refactor
files in even though the agent ran `git add <explicit paths>`. The extra files
were **already staged** in the shared index; the bare `git commit` that followed
committed all of them. The pre-commit hook does NOT auto-stage — the shared index
was the cause.

## The Rule

**Always scope `git commit` to an explicit pathspec. Never run a bare
`git commit` that commits whatever happens to be staged.**

Correct pattern (commits ONLY the listed paths, ignoring anything else in the
index):

```bash
git commit -m "message" -- path/to/file-a path/to/file-b
```

Or stage-then-commit with the SAME pathspec on the commit:

```bash
git add path/to/file-a path/to/file-b
git commit -m "message" -- path/to/file-a path/to/file-b
```

Passing the pathspec to `git commit` makes git commit only those paths regardless
of what else is staged. This is the robust fix: it works even when the shared
index already contains other agents' changes.

### Before every commit

1. Run `git status --short` and identify exactly which files are YOURS (the ones
   your task created or modified).
2. List those exact paths on the `git commit -- <paths>` command.
3. If files you did not touch are staged or modified, **leave them alone** — they
   belong to another agent or the side refactor. Do not stage them, do not commit
   them, do not revert them.

### Forbidden

| Pattern | Why |
|---|---|
| `git commit -m "..."` with no pathspec | Commits the whole shared index, sweeping in others' staged work |
| `git add -A`, `git add .`, `git add -u` | Stages unrelated in-flight changes (already banned in global rules; restated here) |
| `git add <broad dir>` when you only touched 2 files in it | May catch sibling changes from another agent |
| Assuming "I only staged my files, so commit is safe" | The index may have been pre-populated by another agent before you staged |
| Reverting/unstaging files you didn't create to "clean up" before committing | That is another agent's work — destructive |

### What counts as "your own changes"

Files your current task explicitly created or edited. If you can't name why a file
is in your diff, it is not yours — exclude it.

## For Subagents Specifically

Every implementer/executor subagent MUST commit with an explicit pathspec
(`git commit -m "..." -- <files>`). The dispatching controller MUST include this
instruction in the subagent prompt. A subagent that commits a bare `git commit`
has violated this rule even if its own `git add` was scoped.

## If You Already Muddied a Commit

Do NOT rewrite history while parallel agents are running — a rebase/reset can
destroy another session's uncommitted or in-flight work. Stop, report the muddied
commit SHA + the unrelated files it swept in, and let Austen decide how to
reconcile. History rewrites on a shared, actively-edited tree require explicit
permission (see global Git Safety rules).

## Related

- Global `CLAUDE.md` → Git Safety (no broad `git add -A`/`.`, no destructive ops)
- `.claude/rules/autonomy-and-completeness.md`
- Memory: `feedback_no_stash_multi_agent.md` (multi-agent exclusive-access ops)
