---
description: Auto-claim and work on the next feedback item in the queue
allowed-tools: Bash Read Edit Write Glob Grep Task mcp__playwright__browser_navigate mcp__playwright__browser_snapshot mcp__playwright__browser_click mcp__playwright__browser_resize mcp__playwright__browser_take_screenshot mcp__playwright__browser_close mcp__playwright__browser_wait_for
---

# Feedback Queue Command

**Arguments:** `$ARGUMENTS`

Supports optional priority filter:

- `/fb` - claim next item (highest priority first), or resume in-progress if queue is empty
- `/fb low` - claim next LOW priority item (quick wins)
- `/fb medium` - claim next MEDIUM priority item
- `/fb high` - claim next HIGH priority item

## TKA Domain Context

Users may use vague or incorrect terminology. Here's the actual structure:

**Modules** (main nav items):

- `create` - Build sequences (tabs: assembler, constructor, generator)
- `discover` - Browse sequences (tabs: gallery, collections, creators)
- `compose` - Animate sequences (tabs: arrange, browse)
- `learn` - Educational content (tabs: concepts, play, codex)
- `train` - Practice with camera (tabs: practice, challenges, progress)
- `settings` - App preferences (tabs: profile, props, background, visibility, misc)
- `feedback` - Feedback system (tabs: submit, my-feedback, manage)
- `dashboard` - Home/launcher

**Common user confusions:**

- "main screen" / "home" → likely `discover` gallery or `dashboard`
- "my sequences" / "saved" → `discover/gallery` with "My Library" scope toggle
- "practice mode" / "camera thing" → `train`
- "generator" / "random" → `create/generator` tab
- "builder" / "manual" → `create/constructor` tab
- "settings tabs missing" → check if bottom nav shows for settings module
- "can't see X" → could be visibility settings or UI bug

## Workflow

Run `scripts/node scripts/fetch-feedback.js.js $ARGUMENTS` to auto-claim the next unclaimed feedback item.

The script will:

1. Find the oldest feedback with status "new" (prioritized by priority level)
2. If no "new" items exist, resume the oldest "in-progress" item
3. Mark it as "in-progress" with a timestamp (so other agents skip it)
4. Output the full details for you to work on

If another agent runs `/fb` at the same time, they'll get a different item - no collisions!

---

## CRITICAL FIRST STEP: Display feedback verbatim before ANY analysis

When running `/fb`, you MUST start your response with the raw feedback details in this exact format:

```
## Claimed Feedback: [Title or "Untitled"]

**ID:** [document-id]
**Type:** [bug/feature/enhancement]
**Priority:** [low/medium/high]
**User:** [username]
**Created:** [timestamp]
**Module/Tab:** [module] / [tab]

---

**Description:**
[Full feedback text exactly as provided]

---

**Previous Notes:** [if any]

**Subtasks:** [if any]

---
```

**Then and only then** proceed with your assessment, interpretation, and recommendations.

---

## Workflow Overview

```
1. Display feedback verbatim ↓
2. Assess complexity (TRIVIAL / MEDIUM / COMPLEX) ↓
3. Express your thoughts and interpretation ↓
4. ASK FOR CONFIRMATION before proceeding ↓
5. After user approves, route decision:
   ├─ TRIVIAL → Delegate to Haiku (do NOT implement yourself)
   ├─ MEDIUM → Delegate to Sonnet (do NOT implement yourself)
   └─ COMPLEX → Handle as Opus (follow Standard Workflow)
6. Review delegated results (if applicable)
7. Move to in-review with admin notes
8. Offer to mark complete (wait for user confirmation)
```

**Key principle:** Save tokens by routing work to cheaper models. Opus is for coordination, not CSS tweaks.

**CRITICAL: NEVER start working or delegating without explicit user confirmation. This applies to ALL complexity levels.**

---

## Model Triage System (MANDATORY - Do This First!)

After displaying feedback, **immediately assess complexity** to route to the most cost-effective model.

**This is NOT optional.** Every feedback item must go through triage before any work begins.

### Step 1: Complexity Assessment

Evaluate the feedback against these criteria:

#### TRIVIAL → Delegate to Haiku (VERY restrictive - only truly menial tasks)

**IMPORTANT:** Haiku is unreliable for anything beyond the absolute simplest changes. When in doubt, use Sonnet.

**Only use Haiku for:**

- Literal string/text swaps (changing one word to another)
- Single-line icon class changes (e.g., `icon-send` → `icon-plane`)
- Updating a hardcoded number or string constant
- Adding/removing a single CSS property where the exact change is specified

**NOT for Haiku (use Sonnet instead):**

- CSS fixes requiring any investigation
- Anything involving component logic
- Changes where the exact solution isn't already known
- Multi-property CSS changes
- Anything requiring reading context from other files

**Examples that qualify for Haiku:**

- "Change 'Submit' button text to 'Send'"
- "Update the max value from 10 to 15 in this constant"
- "Swap the fa-send icon class to fa-paper-plane"

#### MEDIUM → Delegate to Sonnet (default choice for most tasks)

**Indicators:**

- CSS tweaks (colors, spacing, sizing, overflow fixes)
- Icon or visual changes requiring any investigation
- Validation constraints or simple logic changes
- Single-file changes even when pattern exists
- Applying an existing pattern to a new location
- Clear bug with specific reproduction steps
- Feature scoped to 1-3 files
- "When X happens, do Y" patterns
- Component state fixes
- Adding a button/control with straightforward behavior
- Form field additions
- Event handler fixes

**Examples:**

- "Change the icon for X to Y" (needs to find the right file)
- "The text spills over" (CSS overflow)
- "Cap the value at 3"
- "When I click X, nothing happens"
- "The panel doesn't close when..."
- "Add a clear button to the form"
- "Filter not persisting correctly"

#### COMPLEX → Handle directly with Opus

**Indicators:**

- Keywords: "Dashboard", "System", "Architecture", "Authentication"
- Multi-module coordination
- Security/auth features
- Ambiguous requirements ("I've been thinking...")
- New infrastructure or patterns
- Performance optimization requiring profiling
- Features touching 4+ files
- Policy/UX decisions needed

**Examples:**

- "Add Two-Factor Authentication"
- "Admin monitoring dashboard"
- "Rethink how X works"
- "Session-based autosave system"

### Step 2: Announce Your Triage Decision

**MANDATORY:** After assessing complexity, explicitly state your decision:

```
**Complexity Assessment:** [TRIVIAL / MEDIUM / COMPLEX]
**Model Routing:** [Delegating to Haiku / Delegating to Sonnet / Handling as Opus]
**Reasoning:** [Brief explanation of why this classification]
```

**Example:**

```
**Complexity Assessment:** TRIVIAL
**Model Routing:** Delegating to Haiku
**Reasoning:** Simple CSS overflow fix in a single component. Pattern already exists elsewhere.
```

### Step 3: Get Confirmation Before Proceeding

**MANDATORY:** After announcing your triage decision, you MUST:

1. **Express your interpretation** - Explain what you understand the feedback to be asking for
2. **Share your assessment** - Is this a good idea? Any concerns? Any clarifications needed?
3. **ASK FOR EXPLICIT CONFIRMATION** - "Should I proceed?" or "Would you like me to implement this?"

**DO NOT:**

- Start working without confirmation
- Delegate to a subagent without confirmation
- Assume approval based on the feedback being in the queue
- Skip this step for "simple" tasks

**Example:**

```
Based on this feedback, I understand you want to change the submit button icon from "send" to "paper airplane". This seems straightforward and should improve the visual metaphor for submission.

Should I proceed with delegating this to Haiku?
```

### Step 4: Execute Based on Triage (Only After Confirmation)

#### For TRIVIAL tasks (DELEGATE to Haiku):

**DO NOT implement yourself.** Use the Task tool with:

```
Task tool parameters:
- subagent_type: "general-purpose"
- model: "haiku"
- description: "Fix [short description]"
- prompt: Include ALL context:
  1. Full feedback details (ID: [id], Description: [text])
  2. Exact file(s) to modify with paths
  3. Specific change to make
  4. How to verify it worked
  5. After completing: "Move to in-review with: node scripts/fetch-feedback.js.js [id] in-review '[admin notes]'"
```

#### For MEDIUM tasks (DELEGATE to Sonnet):

**DO NOT implement yourself.** Use the Task tool with:

```
Task tool parameters:
- subagent_type: "general-purpose"
- model: "sonnet"
- description: "Implement [short description]"
- prompt: Include ALL context:
  1. Full feedback details
  2. Likely files involved (provide starting points)
  3. Expected behavior vs current behavior
  4. Suggested implementation approach
  5. Testing steps
  6. After completing: "Move to in-review with: node scripts/fetch-feedback.js.js [id] in-review '[admin notes]'"
```

#### For COMPLEX tasks (Handle as Opus):

**DO NOT delegate.** Handle directly following the Standard Workflow below.

### Step 5: Review Delegated Results (TRIVIAL/MEDIUM only)

When a Haiku/Sonnet agent completes:

1. Read their implementation summary
2. Verify approach is sound (spot-check key changes)
3. If good: Confirm completion to user, offer to mark complete
4. If issues: Either fix them yourself or re-delegate with corrections

**DO NOT:**

- Re-implement trivial changes yourself "just to be sure"
- Spend more tokens reviewing than the task itself would have cost
- Delegate upward (don't send Haiku tasks to Sonnet)

---

## Standard Workflow (for COMPLEX items handled as Opus)

**Note:** If you reached this section, you already:

1. Completed Model Triage and determined this is a COMPLEX task requiring Opus
2. Got user confirmation to proceed

### Implementation Process

1. **Assign a short title:**
   - Generate a concise title (2-5 words max)
   - Should capture the essence at a glance (e.g., "Mobile nav overlap", "Slow gallery load", "Missing undo button")
   - Update Firebase:
     ```
     node scripts/fetch-feedback.js.js <document-id> title "Your short title"
     ```

2. **Assess the feedback honestly:**
   - Is this a good idea? Mediocre? Or is the user confused?
   - Consider: Does it improve UX? Is it feature creep? Does the user misunderstand the product?
   - If from Austen: likely well-considered, but still evaluate critically
   - If from others: may be based on confusion, edge cases, or unrealistic expectations
   - Give a direct recommendation: implement, modify approach, decline, or cannot reproduce

3. **Interpret what they mean:**
   - What is the user actually describing?
   - Map vague terms to actual modules/tabs/components
   - Don't blindly trust the "Module/Tab" field - users often submit from a different screen

4. **Get confirmation before implementing:**
   - State your assessment and interpretation
   - Ask if Austen wants to proceed
   - For COMPLEX items, don't assume - clarify ambiguities

5. **Implement or investigate** (only after approval)
   - For bugs: try to reproduce first, fix if confirmed
   - For features: implement if approved
   - For unclear issues: investigate and report findings

6. **Move to review and add resolution notes:**
   After implementation, move to `in-review` with brief admin notes:

   ```
   node scripts/fetch-feedback.js.js <document-id> in-review "Fixed card height overflow in Kanban board"
   ```

   **Admin notes (internal reference - only visible to admins):**
   - Brief summary of what was fixed (1 line, ~5-10 words)
   - Focus on WHAT was addressed, not HOW
   - Example: "Fixed card height overflow" not "Updated MyFeedbackCard.svelte:88-92 to set min-height: 120px"
   - NO file paths, line numbers, or testing steps
   - Think: "What would I search for later to find this fix?"
   - **Visibility:** Only shown to admin users - never visible to regular users
   - **Always required** for all feedback

   **Resolution notes (user-facing - visible to everyone):**
   - **Only needed for user-facing features** (things regular users interact with)
   - Skip resolution notes for admin-only features (Manage Feedback Kanban, admin dashboards, internal tools, etc.)
   - Explain what was changed from the user's perspective in plain English
   - Clear and concise (1-3 sentences)
   - Focus on the outcome and user benefit
   - Help users understand how their feedback was addressed
   - Avoid technical jargon (no "localStorage", "state management", "persistence", etc.)
   - Write for flow artists, not developers
   - **Visibility:** Shown to all users who submitted the feedback

   **When to add resolution notes:**

   ```bash
   # User-facing feature (needs resolution notes)
   node scripts/fetch-feedback.js.js <id> in-review "Fixed gallery card overflow"
   node scripts/fetch-feedback.js.js <id> resolution "Sequence cards in the gallery now display correctly without being cut off."

   # Admin-only feature (skip resolution notes)
   node scripts/fetch-feedback.js.js <id> in-review "Fixed Kanban column drag-drop"
   # No resolution command needed - admin notes are sufficient
   ```

   **Where technical details go:**
   - File paths, line numbers → Commit messages
   - Testing steps, reproduction steps → PR descriptions or issue comments
   - Implementation approach → Code comments or architecture docs

7. **CRITICAL: Offer to mark as completed (don't do it automatically):**
   After moving to `in-review` and adding resolution notes, END your response by offering to mark as completed.

   **Examples:**
   - "Should I mark this feedback as completed?"
   - "Ready to mark as complete?"
   - "Would you like me to mark this as completed?"

   **DO NOT** automatically mark as completed. Wait for user confirmation.
   This gives the user a chance to test first and verify it actually works.

8. **When user confirms the fix works:**
   Only after the user confirms, mark as completed:

   ```
   node scripts/fetch-feedback.js.js <document-id> completed "Verified working"
   ```

   **Workflow context:**
   - `completed` items are staged for the next release
   - They stay visible in the "completed" column until `/release` is run
   - When `/release` runs, they're archived and tagged with the version number
   - This lets you batch multiple fixes into one release

### Complex feedback with subtasks

When you claim feedback that's too large to implement directly (requires multiple prerequisites, infrastructure changes, or multi-sprint work):

1. **Break it down into subtasks** instead of deferring:

   ```
   node scripts/fetch-feedback.js.js <id> subtask add "Short title" "What needs to be done"
   ```

2. **Specify dependencies** if subtasks must be done in order:

   ```
   node scripts/fetch-feedback.js.js <id> subtask add "Step 2" "Description" 1
   node scripts/fetch-feedback.js.js <id> subtask add "Step 3" "Description" 1 2
   ```

   (The numbers at the end are IDs of subtasks this depends on)

3. **Update subtask status** as you work:

   ```
   node scripts/fetch-feedback.js.js <id> subtask 1 in-progress
   node scripts/fetch-feedback.js.js <id> subtask 1 completed
   ```

4. **View subtasks**:
   ```
   node scripts/fetch-feedback.js.js <id> subtask list
   ```

The feedback stays in the queue. When agents claim it, they see the subtasks and can work on the next available one (pending with all dependencies completed).

### Archiving without releasing

When feedback won't be implemented, move directly to `archived` with a clear reason:

```bash
# Item declined (not a good fit for the product)
node scripts/fetch-feedback.js.js <id> archived "Declined: Out of scope for v1 vision"

# Won't fix (working as intended)
node scripts/fetch-feedback.js.js <id> archived "Won't fix: This is expected behavior"

# Duplicate of another item
node scripts/fetch-feedback.js.js <id> archived "Duplicate of #xyz123abc"

# Cannot reproduce
node scripts/fetch-feedback.js.js <id> archived "Cannot reproduce: Needs more details"
```

**Important:** Archived items bypass the release process. They don't get a `fixedInVersion` tag and won't appear in What's New. Use this for items that are closed but not shipped.

### Deferring to a future date

**NEW:** Instead of archiving permanently, defer items with automatic reactivation:

```bash
# Defer until specific date (YYYY-MM-DD format)
node scripts/fetch-feedback.js.js <id> defer "2026-03-15" "Revisit after Q1 roadmap finalized"
node scripts/fetch-feedback.js.js <id> defer "2026-06-01" "Wait for Svelte 6 release"
node scripts/fetch-feedback.js.js <id> defer "2026-01-15" "Low priority, defer 6 weeks"
```

**How it works:**

1. Item moves to `archived` status with `deferredUntil` timestamp
2. Daily cron job (GitHub Actions) runs `scripts/reactivate-deferred.js`
3. When date arrives, item automatically moves back to `new` status
4. You can manually trigger: `node scripts/reactivate-deferred.js`

**Preview deferred items:**

```bash
node scripts/reactivate-deferred.js --dry-run
```

Shows what will reactivate without making changes.

**Why use defer instead of archive:**

- Items resurface automatically - you don't forget about them
- Clear timeline expectations ("revisit in 3 months")
- Keeps backlog clean while preserving valid feedback
- Don't defer things you'll never do - use `archived` for permanent closure

### Other commands

- `node scripts/fetch-feedback.js.js list` - See queue status
- `node scripts/fetch-feedback.js.js <id>` - View a specific item by document ID
- `node scripts/fetch-feedback.js.js <id> title "short title"` - Update title
- `node scripts/fetch-feedback.js.js <id> resolution "notes"` - Add resolution notes (user-facing summary)
- `node scripts/fetch-feedback.js.js <id> <status> "notes"` - Update status
- `node scripts/fetch-feedback.js.js delete <id>` - Delete a feedback item
- `node scripts/release.js --show-last` - View what shipped in last release

### Stale claims

If a feedback item has been "in-progress" for over 2 hours, it's considered stale and will be auto-reclaimed by the next agent that runs `/fb`.

### Status values (4 columns matching Kanban board)

- `new` - Unclaimed, ready to be picked up
- `in-progress` - Being worked on
- `in-review` - Done, waiting for tester confirmation
- `archived` - Closed (use adminNotes to explain: fixed, declined, deferred, etc.)

---

## Real-World Triage Examples

### Example 1: TRIVIAL → Delegate to Haiku (rare)

**Feedback:** "Change the 'Submit' button text to 'Send Feedback'"

**Triage Decision:**

```
Complexity Assessment: TRIVIAL
Model Routing: Delegating to Haiku
Reasoning: Literal text swap. The exact file and change are already known. No investigation needed.
```

**Confirmation Step:**

```
This is a simple text change on the submit button. No logic changes, just swapping the label.

Should I proceed with delegating this to Haiku?
```

**Action (after user confirms):**

```typescript
Task({
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Change button text",
  prompt: `
    Feedback ID: abc123
    Task: Change button text from "Submit" to "Send Feedback"

    File to modify: src/lib/features/feedback/components/submit/FeedbackForm.svelte
    Line ~45: Change the button text

    This is a literal string swap, nothing else.

    After completing, run:
    node scripts/fetch-feedback.js.js abc123 in-review "Changed submit button text"
  `,
});
```

**Note:** Most tasks that seem "trivial" should actually go to Sonnet. Haiku is only for the absolute simplest changes where you already know exactly what to change.

### Example 2: "Seems trivial" but → Delegate to Sonnet

**Feedback:** "The feedback submit button icon should be a paper airplane instead of a send icon"

**Triage Decision:**

```
Complexity Assessment: MEDIUM
Model Routing: Delegating to Sonnet
Reasoning: Icon change requires finding the correct file, identifying the icon system used, and making the swap. Not a literal known change.
```

**Why not Haiku?** Even though this is "just an icon swap," the agent needs to:

- Find the correct component file
- Understand the icon system (FontAwesome? Custom SVGs? Icon component?)
- Locate the specific icon reference
- Make the appropriate change

Haiku struggles with investigation. Sonnet handles this reliably.

### Example 3: MEDIUM → Delegate to Sonnet (most common)

**Feedback:** "When I close the feedback panel, it should save my draft automatically"

**Triage Decision:**

```
Complexity Assessment: MEDIUM
Model Routing: Delegating to Sonnet
Reasoning: Clear feature request. Requires state management and persistence logic, but scope is well-defined (1-2 files).
```

**Confirmation Step:**

```
This is a quality-of-life improvement that prevents users from losing their work when they accidentally close the feedback panel. The implementation would involve:
- Persisting draft text to localStorage on panel close
- Restoring it when the panel reopens
- Clearing the draft after successful submission

This is a good UX enhancement with clear scope. Should I proceed with delegating this to Sonnet?
```

**Action (after user confirms):**

```typescript
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Add auto-save to feedback",
  prompt: `
    Feedback ID: def456
    Task: Auto-save feedback drafts when panel closes

    Starting point: src/lib/features/feedback/components/submit/FeedbackForm.svelte

    Expected behavior:
    - When user types feedback and closes panel, content should persist
    - On next open, pre-populate with saved draft
    - Clear draft after successful submission

    Implementation approach:
    - Use localStorage for persistence (key: 'feedback_draft')
    - Listen for panel close event
    - Restore draft in onMount if present

    Testing:
    1. Type feedback text
    2. Close panel without submitting
    3. Reopen panel - text should still be there
    4. Submit feedback - draft should clear

    After completing, run:
    node scripts/fetch-feedback.js.js def456 in-review "Added auto-save for feedback drafts"
  `,
});
```

### Example 4: COMPLEX → Handle as Opus

**Feedback:** "I've been thinking about how users discover new features. We should add a What's New notification system that shows release notes in-app when users log in after an update."

**Triage Decision:**

```
Complexity Assessment: COMPLEX
Model Routing: Handling as Opus
Reasoning: Ambiguous requirements, multi-module feature (auth, settings, notifications), requires UX decisions (how intrusive? dismissible? persistent?), touches 4+ files, needs architectural planning.
```

**Confirmation Step:**

```
This is a significant feature that would help users stay informed about new capabilities. However, there are several architectural decisions to make:

1. **Display method**: Modal (blocking), banner (dismissible), toast (auto-hide), or settings tab entry?
2. **Trigger**: Show once per version, on every login until dismissed, or user-toggled?
3. **Persistence**: How do we track which releases the user has seen?
4. **Scope**: Full release notes, highlights only, or link to external changelog?

**Assessment**: This is a valuable feature for user engagement, but we need to be careful about:
- Not being intrusive (avoid blocking critical workflows)
- Giving users control (dismissible + settings toggle)
- Keeping implementation maintainable

**Recommendation**: I'd suggest starting with a non-intrusive banner in the dashboard that shows on first login after an update, with a link to full release notes in settings.

Does this sound like the right approach, or would you prefer a different UX pattern?
```

**Action (after user confirms approach):** Handle directly as Opus, following Standard Workflow steps 1-8.
