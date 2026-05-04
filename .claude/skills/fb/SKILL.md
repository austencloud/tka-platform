---
description: Use when starting work from the feedback queue or claiming a specific feedback item
argument-hint: "[feedback-id]"
---

# Feedback Workflow

Work on a feedback item from the queue.

## Usage

- `/fb` - Auto-claim next feedback item
- `/fb <id>` - Claim and work on a specific feedback item
- `/fb list` - Show queue

## Arguments

$ARGUMENTS - Optional feedback ID (first 8+ characters), or "list"

## Instructions

### Step 1: Fetch (ONE Bash call)

| Input | Command |
|-------|---------|
| No argument | `node scripts/fetch-feedback.js` |
| ID provided | `node scripts/fetch-feedback.js claim $ARGUMENTS` |
| "list" | `node scripts/fetch-feedback.js list` |

Auth is cached. Do not run `whoami`, `mine`, or any other pre-check. Go straight to the command above.

If auth fails (first-time setup), run `node scripts/fetch-feedback.js login`, then retry.

### Step 2: Display + Triage

Show: title, ID, type, priority, submitter, module/tab, full description.

If images attached, read each with Read tool AND open for user: `powershell -Command "Invoke-Item '<path>'"`

Assess complexity:
- **TRIVIAL** (Haiku): String swaps, single-line fixes, known solution
- **MEDIUM** (Sonnet): CSS fixes, single-file changes, clear bugs with repro
- **COMPLEX** (Opus): Multi-module, ambiguous requirements, 4+ files, new infra

Announce triage: complexity, model routing, reasoning. Ask for confirmation before implementing.

After approval: `/rename FB: [short title]`

### Step 3: Implement

Work the item. Use heartbeats for long sessions:
```bash
node scripts/fetch-feedback.js heartbeat <id> "status"
```

When done:
```bash
node scripts/fetch-feedback.js <id> in-review "Brief admin notes"
```

See `workflow-reference.md` for claim health, delegation, state machine, and full commands reference.
