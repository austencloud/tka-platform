---
description: Use when ending a session with unfinished multi-phase work — "write a handoff", "hand this off", "I'm going to sleep, document where we are", "wrap up for the next agent", or when context is nearly exhausted mid-project. Writes the standard handoff doc another session can pick up cold.
argument-hint: "[optional slug for the handoff]"
---

# Write a Handoff

**Args:** `$ARGUMENTS`

The reader is a fresh agent with zero context. Everything it needs must be in
the doc or reachable from it. The counterpart skill (`pickup`) will AUDIT
your claims — write so that audit passes.

## File

`docs/superpowers/specs/YYYY-MM-DD-<slug>-handoff.md` (today's date; slug
from the work, or `$ARGUMENTS`).

## Required sections

```markdown
# <Title> — Handoff (YYYY-MM-DD)

## Mission
One paragraph: what this work is and why. Link the design spec if one exists.

## Done — verified
Per item: what + commit SHA + the evidence (test command and its result,
decode output, screenshot ref). No evidence → it goes in the next section.

## Believed done — unverified
Anything you couldn't prove. Say what verification it still needs.

## In flight
Uncommitted files and their state; which branch/worktree holds what.

## Loose ends (ranked)
Concrete, ordered. #1 is where the next agent starts.

## Decisions already made
Austen's calls (quote or paraphrase with date) so the next agent doesn't
re-litigate them.

## Gotchas
The things the next agent cannot derive from the code: dead ends already
tried, fragile spots, environment quirks.
```

## Rules

- Every "done" claim carries its evidence inline. The `verification-protocol`
  applies to handoffs doubly — a false "done" costs the next session hours.
- Convert all relative dates to absolute.
- If the work changed canon owned by an expert agent
  (`.Codex/rules/expert-routing.md` table), update that agent's `.md` too —
  a handoff is read once; the expert file is forever.
- Commit the doc with explicit pathspec and push it where the next agent will
  look: main if the work is on main, the work branch otherwise — then tell
  Austen exactly where it lives with a `file://` link.
