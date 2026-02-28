---
description: Claim and work on feedback items
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

### If no argument provided:

**STEP 1: Check for in-progress items**

Run this command to check if there are any in-progress items:
```bash
node scripts/fetch-feedback.js mine
```

**If items are found:**

1. **Fetch full details for EACH in-progress item** - the `mine` list is truncated, so you MUST run:
   ```bash
   node scripts/fetch-feedback.js <id>
   ```
   for each item to show the user the complete title, description, module/tab, and any images.

2. **Display the full details** so the user can actually understand what each item is.

3. **Then ask:** "This item is in-progress from another session (claim token `[xxxxxxxx]`). Want me to continue working on it, or skip to unclaimed items?"

**IMPORTANT:** The claim token identifies which session owns the claim. If another agent is actively working on it in a different terminal, they should finish. But often in-progress items are from dead/disconnected sessions.

**If user says continue:**
1. First try: `node scripts/fetch-feedback.js claim <id>`
2. If claim succeeds -> proceed with work
3. If claim fails with "active work in progress" -> the claim is still fresh (<45 min activity)
   - **DO NOT bypass the protection** - this would steal another agent's active work
   - Tell the user the options:
     a. "Wait for the claim to become stale (45 min inactivity)"
     b. "Submit a claim request: `request-claim <id> 'reason'` (starts 15-min countdown)"
     c. "Emergency takeover: `unclaim <id> --emergency 'reason'` (audited, requires justification)"
   - **Only the USER can decide to force or use emergency** - never do it automatically

**If user says skip:** Proceed to STEP 2 and pick from unclaimed items only.

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

---

## Claim Health

Claims go stale after 45 minutes of inactivity. Keep yours active during long sessions:

```bash
# Heartbeat every 30 min while working
node scripts/fetch-feedback.js heartbeat <id> "Brief status message"

# Record files being edited (optional, helps recovery)
node scripts/fetch-feedback.js touch <id> "src/path/to/file.svelte"

# View all activity on an item
node scripts/fetch-feedback.js journal <id>
```

---

## Delegating to Subagents

For TRIVIAL/MEDIUM items, delegate via Task:

```typescript
Task({
  subagent_type: "general-purpose",
  model: "haiku" or "sonnet",
  description: "Fix/Implement [short description]",
  prompt: `
    Feedback ID: <id>
    Task: [description]
    File(s): [paths]
    Expected behavior: [what should happen]

    After completing:
    node scripts/fetch-feedback.js <id> in-review "[admin notes]"
  `
})
```

---

## Status State Machine

Valid statuses and allowed transitions:

| From | Allowed To |
|------|------------|
| `new` | `in-progress` |
| `in-progress` | `new`, `in-review` |
| `in-review` | `in-progress`, `completed` |
| `completed` | `archived`, `in-review` |
| `archived` | `new` |

Invalid transitions are blocked. You cannot skip steps (e.g., `new` -> `completed`).

---

## After Implementing

1. Move to review: `node scripts/fetch-feedback.js <id> in-review "Brief admin notes"`
2. Summarize what changed
3. Give clear testing steps
4. Describe expected behavior

---

## Commands Reference

```bash
# Queue
node scripts/fetch-feedback.js              # Auto-claim next
node scripts/fetch-feedback.js claim <id>   # Claim specific
node scripts/fetch-feedback.js list         # See queue
node scripts/fetch-feedback.js mine         # Your items

# Claim health
node scripts/fetch-feedback.js heartbeat <id> "status"
node scripts/fetch-feedback.js touch <id> "filepath"
node scripts/fetch-feedback.js journal <id>

# Claim takeover
node scripts/fetch-feedback.js unclaim <id>
node scripts/fetch-feedback.js request-claim <id> "why"
node scripts/fetch-feedback.js unclaim <id> --emergency "reason"

# Item management
node scripts/fetch-feedback.js <id>                    # View details
node scripts/fetch-feedback.js <id> <status> "notes"   # Update status
node scripts/fetch-feedback.js <id> priority <level>    # Set priority
node scripts/fetch-feedback.js <id> resolution "notes"  # Add resolution
```
