---
description: Claim and work on feedback items
argument-hint: "[feedback-id]"
allowed-tools: Bash(node:*)
---

# Feedback Workflow

Work on a feedback item from the queue.

## Usage

- `/fb` - List available feedback items
- `/fb <id>` - Claim and work on a specific feedback item

## Arguments

$ARGUMENTS - Optional feedback ID (first 8+ characters)

## Instructions

### If no argument provided:

Run `node scripts/fetch-feedback.js list` to show the feedback queue.

Present the unclaimed items and ask which one the user wants to work on.

### If argument provided (feedback ID):

1. **Claim the feedback:**
   ```bash
   node scripts/fetch-feedback.js $ARGUMENTS
   ```

2. **Display the feedback** with all details:
   - Title and ID
   - Type (bug/feature/enhancement) and Priority
   - Who submitted it and when
   - Module/Tab it affects
   - The full description - word for word
   - Any existing notes or subtasks

3. **Assess complexity** using model triage:
   - **TRIVIAL** (Haiku): Literal string swaps, single-line changes where solution is already known
   - **MEDIUM** (Sonnet): CSS fixes, single-file changes, clear bugs with repro steps
   - **COMPLEX** (Opus): Multi-module coordination, ambiguous requirements, 4+ files

4. **Announce triage decision:**
   ```
   **Complexity Assessment:** [TRIVIAL / MEDIUM / COMPLEX]
   **Model Routing:** [Delegating to Haiku / Delegating to Sonnet / Handling as Opus]
   **Reasoning:** [Brief explanation]
   ```

5. **Ask for confirmation** before proceeding with implementation.

### After implementing:

1. Move to review: `node scripts/fetch-feedback.js <id> in-review "Brief admin notes"`
2. Summarize what changed
3. Give clear testing steps
4. Describe expected behavior
