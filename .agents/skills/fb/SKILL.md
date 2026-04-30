---
description: Use when starting work from the feedback queue or claiming a specific feedback item
argument-hint: "[feedback-id]"
---

# Feedback Workflow

Work on a feedback item from the queue.

## Usage

- `/fb` - Auto-select and claim the best feedback item
- `/fb <id>` - Claim and work on a specific feedback item

## Arguments

$ARGUMENTS - Optional feedback ID (first 8+ characters)

## Instructions

### Step 0: Ensure authenticated

```bash
node scripts/fetch-feedback.js whoami
```

If not authenticated, run `node scripts/fetch-feedback.js login`. If permission denied, tell the user to ask Austen to run `add-developer` with their email.

### If no argument provided

1. Check `node scripts/fetch-feedback.js mine` for in-progress items
2. If found, fetch full details for each (`node scripts/fetch-feedback.js <id>`), display them, and ask whether to continue or skip
3. If none (or skipped), run `node scripts/fetch-feedback.js list`
4. Auto-delete obvious test submissions (99%+ confidence only)
5. Auto-select: bugs first, higher priority, skip incomplete metadata. Pick the FIRST viable item, don't overthink
6. Announce choice with 1-sentence rationale, then claim it

### If argument provided (feedback ID)

1. Claim: `node scripts/fetch-feedback.js claim $ARGUMENTS`
2. Display all details (title, type, priority, submitter, module/tab, full description, notes, subtasks)
3. If images attached, read each with Read tool AND open for user: `powershell -Command "Invoke-Item '<path>'"`
4. Assess complexity:
   - **TRIVIAL** (Haiku): String swaps, single-line fixes with known solution
   - **MEDIUM** (Sonnet): CSS fixes, single-file changes, clear bugs
   - **COMPLEX** (Opus): Multi-module, ambiguous requirements, 4+ files
5. Announce triage: complexity, model routing, reasoning
6. Ask for confirmation before implementing
7. After approval: `/rename FB: [short title]`

See `workflow-reference.md` for detailed claim health, delegation, state machine, and commands.
