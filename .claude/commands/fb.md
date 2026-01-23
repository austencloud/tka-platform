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

**STEP 1: Check for in-progress items**

Run this command to check if there are any in-progress items:
```bash
node scripts/fetch-feedback.js mine
```

**IMPORTANT: The `mine` command shows ALL in-progress items, including ones claimed by OTHER agents in different sessions.** The claim token (shown in brackets like `[0c8265ee]`) identifies which session owns the claim. You cannot "resume" an item claimed by another session - you must either:
- Wait for them to finish
- Ask the user if they want to unclaim it (if the other agent died/disconnected)

**If items are found**, tell the user:
- How many in-progress items exist
- Their claim tokens
- That these may belong to other active Claude sessions

Then ask: "Is another agent currently working on these, or should I unclaim and take over?"

**If user says another agent is working on it:** Skip to STEP 2 and pick from unclaimed items only.

**If user says to take over:** Run `node scripts/fetch-feedback.js unclaim <id>` then re-claim it.

**If no in-progress items found:** Proceed directly to STEP 2.

---

**STEP 2: Auto-select a new item**

Run `node scripts/fetch-feedback.js list` to show the feedback queue.

**Auto-delete obvious test submissions:** Before selecting, scan the unclaimed list for items that are clearly just testing the feedback system (e.g., "This is a test", "Testing again", "asdfgh", single words like "test"). Delete these immediately without asking:
```bash
node scripts/fetch-feedback.js delete <id>
```
Do NOT delete items that might be real feedback with poor titles - only delete when 99%+ confident it's just a test.

**Auto-select the best item using this priority:**

1. **ONLY select from "new" (unclaimed) items** - never select in-progress items for auto-selection
2. **Bugs first** - bugs affect current users, features can wait
3. **Higher priority** - high > medium > low > unset
4. **Skip incomplete metadata** - avoid items with `--title` or `--description` placeholders

**STOP OVERTHINKING. JUST PICK ONE.**

- Look at the list ONCE
- Pick the FIRST item that isn't obviously broken metadata
- If there are no bugs, pick the first feature
- "Too complex for one session" is NOT a reason to skip - you have plenty of tokens
- Large features are fine - break them into subtasks and make progress
- Do NOT check 2+ items before deciding
- Do NOT reject items for being "ambitious"

The goal is PROGRESS, not finding the "perfect" item.

After selecting, announce your choice with a 1-sentence rationale, then immediately claim it:
```bash
node scripts/fetch-feedback.js claim <id>
```
This atomically claims the item with a unique token, preventing race conditions with other agents.

### If argument provided (feedback ID):

1. **Claim the feedback:**
   ```bash
   node scripts/fetch-feedback.js claim $ARGUMENTS
   ```
   This atomically claims the item with a unique token, preventing other agents from picking it up.

2. **Display the feedback** with all details:
   - Title and ID
   - Type (bug/feature/enhancement) and Priority
   - Who submitted it and when
   - Module/Tab it affects
   - The full description - word for word
   - Any existing notes or subtasks

3. **If feedback has images attached:**
   - Read each image with the Read tool (so Claude can analyze it)
   - **ALSO open each image for the user** so they see what you see:
     ```bash
     powershell -Command "Invoke-Item '<absolute-path-to-image>'"
     ```
   - This ensures both Claude and the user are looking at the same thing

4. **Assess complexity** using model triage:
   - **TRIVIAL** (Haiku): Literal string swaps, single-line changes where solution is already known
   - **MEDIUM** (Sonnet): CSS fixes, single-file changes, clear bugs with repro steps
   - **COMPLEX** (Opus): Multi-module coordination, ambiguous requirements, 4+ files

5. **Announce triage decision:**
   ```
   **Complexity Assessment:** [TRIVIAL / MEDIUM / COMPLEX]
   **Model Routing:** [Delegating to Haiku / Delegating to Sonnet / Handling as Opus]
   **Reasoning:** [Brief explanation]
   ```

6. **Ask for confirmation** before proceeding with implementation.

7. **After user approves**, rename the conversation to reflect the feedback item:
   ```
   /rename FB: [short descriptive title]
   ```
   Use the feedback title if it's concise, or write a 2-4 word summary of what you're fixing/implementing.

### After implementing:

1. Move to review: `node scripts/fetch-feedback.js <id> in-review "Brief admin notes"`
2. Summarize what changed
3. Give clear testing steps
4. Describe expected behavior
