---
description: Track MVP scope, priorities, and progress toward March 17, 2026 launch
argument-hint: "[status|scope|next|add <area> <item>|complete <id>]"
---

# MVP Tracker

**Target:** March 17, 2026 (TKA 4th Birthday)
**One sentence:** Create, record, share, and save your choreography to learn and grow as a flow artist.
**Mantra:** If it's not on this list, it's not MVP.

## Purpose

Keep development focused on shipping. This skill is the single source of truth for what's in scope, what's done, and what's next. When scope creep tempts, this skill says no.

## Commands

| Command | What it does |
|---------|-------------|
| `/mvp` or `/mvp status` | Show current progress across all areas |
| `/mvp scope` | Show full scope definition with acceptance criteria |
| `/mvp next` | Show the single highest-priority unfinished item |
| `/mvp add <area> <item>` | Propose adding something (requires justification) |
| `/mvp complete <id>` | Mark an item done with verification proof |

## How It Works

1. Read the MVP tracker file: `docs/plans/mvp-tracker.md`
2. Execute the requested command
3. For `status`: show completion percentage per area + overall
4. For `scope`: display the full scope with acceptance criteria
5. For `next`: find the highest-priority incomplete item and present it
6. For `add`: require the user to justify why this is MVP, not post-MVP. Push back if it's scope creep.
7. For `complete`: require verification evidence before marking done

## Scope Guard

**The default answer to "should we add this?" is NO.**

### The 5-Verb Test

Every item must directly enable one of: **create, record, share, save, learn.**
If it doesn't serve one of these verbs, it's post-MVP.

### Scope Gate Questions (ask all 4)

| Question | If yes... |
|----------|-----------|
| "Can a user complete the core flow without this?" | Cut it |
| "Is a workaround available?" | Cut it |
| "Does nothing else depend on this?" | Cut it |
| "Has nobody been promised this?" | Cut it |

If all 4 answers are "yes," it's out. No debate.

### Emergency Scope Reduction

When time pressure hits (and it will), apply the Value Quotient:

> VQ = (Problem Severity x User Impact) / (Dev Time x Integration Complexity)

Score each remaining item 1-5 on each factor. VQ > 1.0 stays. VQ < 1.0 gets cut or moved to post-MVP.

### Red Flags (stop and reassess)

- More than 2 items in-progress simultaneously
- Can't explain what you're working on in one sentence
- "While I'm in here, I might as well..." — NO. File it and move on.
- A single item has been in-progress for more than 2 sessions

## The Tracker File

The source of truth lives at `docs/plans/mvp-tracker.md`. This skill reads and updates that file. The file structure:

```markdown
# MVP Tracker - TKA Platform
**Target: March 17, 2026**

## Area: [Name]
Status: X/Y complete

### [ID] Item Name
- **Priority:** P0 (blocker) | P1 (must-have) | P2 (should-have)
- **Status:** not-started | in-progress | complete
- **Acceptance criteria:**
  - [ ] Criterion 1
  - [ ] Criterion 2
- **Completed:** (date + verification evidence when done)
- **Notes:** (context, decisions, links)
```

## Priority Definitions

| Priority | Meaning | Example |
|----------|---------|---------|
| P0 | App is broken/unusable without this | Share button exports nothing |
| P1 | Core flow works but users will be confused/stuck | No loading state on Browse |
| P2 | Noticeable gap but users can work around it | Codex visual polish |

## Progress Display Format

```
MVP Progress: 12/34 items (35%)
Target: March 17, 2026 (12 days remaining)

Create:     [####------] 4/10
Browse:     [##--------] 2/8
Learn:      [#---------] 1/7
Share:      [###-------] 3/5
Cross-cut:  [##--------] 2/4
```

## WIP Limit

**Maximum 2 items in-progress at once.** If 2 items are already in-progress, one must be completed or cut before starting another. This prevents the "everything is 80% done" trap.

## Rules

1. **Never add items without user approval.** Present the proposal, get a yes.
2. **Push back on scope creep.** "That sounds like a post-MVP feature. Want to add it to the backlog instead?"
3. **Verification required for completion.** "I ran X and confirmed Y" or "User confirmed Z works."
4. **One next item at a time.** `/mvp next` returns ONE thing, not a list.
5. **Track decisions.** When we decide something is out of scope, note it in the tracker under a "Post-MVP" section so it doesn't come back.
6. **"While I'm in here..."** is scope creep in disguise. File it, move on.
7. **P0s first, always.** Don't touch P1s while P0s remain. Don't touch P2s while P1s remain.
