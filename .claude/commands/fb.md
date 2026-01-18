---
description: Claim and work on feedback items
argument-hint: "[feedback-id]"
allowed-tools: Bash(node:*)
---

# Feedback Workflow

Work on a feedback item from the queue.

## Usage

- `/fb` - Auto-select and claim the best feedback item
- `/fb <id>` - Claim and work on a specific feedback item

## Arguments

$ARGUMENTS - Optional feedback ID (first 8+ characters)

## Instructions

### If no argument provided:

**STEP 1: Check for your in-progress items**

Run this command to check if you have any claimed items:
```bash
node scripts/fetch-feedback.js mine
```

**If items are found**, use AskUserQuestion tool to present options:

Question: "I found [N] item(s) you were working on. What would you like to do?"

Options:
1. "Resume [ID]: [Title]" (description: Continue working on this item)
2. "Unclaim it and start fresh" (description: Release this item and claim something new)

**If user chooses resume:** Run `node scripts/fetch-feedback.js <id>` to display and continue with that item.

**If user chooses unclaim:** Run `node scripts/fetch-feedback.js unclaim <id>` then proceed to STEP 2.

**If no in-progress items found:** Proceed directly to STEP 2.

---

**STEP 2: Auto-select a new item**

Run `node scripts/fetch-feedback.js list` to show the feedback queue.

**Auto-select the best item using this priority:**

1. **ONLY select from "new" (unclaimed) items** - never select in-progress items for auto-selection
2. **Bugs first** - bugs affect current users, features can wait
3. **Higher priority** - high > medium > low > unset
4. **Clear scope** - items with clear titles/descriptions over vague ones
5. **Achievable complexity** - prefer items that can be completed in one session
6. **Skip incomplete metadata** - avoid items with `--title` or `--description` placeholders

**BE DECISIVE.** Apply these criteria once and pick the first item that matches from the "🆕 UNCLAIMED" section. Do NOT:
- Cycle through multiple items looking for the "perfect" one
- Second-guess your selection
- Check the details of 3+ items before deciding
- Ask which item to work on

After selecting, announce your choice with a 1-sentence rationale, then immediately claim it.

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
