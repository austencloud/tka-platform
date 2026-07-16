---
description: Use when picking up another agent's handoff — "pull the X handoff", "pick up where they left off", "continue the Y work", "read the handoff and take over", or any session that starts from a handoff doc or handoff/* branch. Fetches it, audits the claimed work with real evidence, then continues the work.
argument-hint: "[handoff name, spec file, or branch]"
---

# Pick Up a Handoff

**Args:** `$ARGUMENTS`

Take over another agent's in-flight work without trusting its claims blindly.
Austen asks for the audit step explicitly and repeatedly — it is not optional.

## 1. Locate

```bash
git fetch origin
```

- Named handoff → match against `docs/superpowers/specs/*handoff*.md`
  (convention: `YYYY-MM-DD-<slug>-handoff.md`), newest first. Check both the
  working tree and `git show origin/main:<path>` — it may have landed on main
  after this checkout last pulled.
- Branch handoff → `handoff/<name>` branches (e.g. `handoff/hero-split-4k`).
  Work in a worktree per `worktree-workflow.md`; never switch this checkout.
- No match → list the candidates you did find and ask which one. Don't guess
  between two plausible handoffs.

## 2. Read, then audit before continuing

Read the whole doc. Extract: claimed-done items, the evidence cited for each,
loose ends, and next steps.

Then audit the claims — the previous agent's context is gone and its "done"
may be aspirational:

- Cited commits exist? (`git log --oneline`, `git show --stat <sha>`)
- Cited files/functions exist and do what's claimed? (Read them)
- Cited tests pass NOW? (run them)
- Anything listed "believed done, unverified" → verify it first; it's the
  likeliest rot.

Report the audit result to Austen in one short block — confirmed / diverged /
broken — BEFORE doing new work. If a claim is false, that's finding #1, not a
footnote.

## 3. Continue

Start at the first loose end or next step, honoring the handoff's recorded
decisions (they were Austen's). Route domain work per
`.claude/rules/expert-routing.md`, commit with explicit pathspec per
`commit-only-your-own-changes.md`, and when the session winds down with work
still open, write the counterpart doc via the `handoff` skill.
