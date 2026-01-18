# Feedback Workflow

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
- "main screen" / "home" -> likely `discover` gallery or `dashboard`
- "my sequences" / "saved" -> `discover/gallery` with "My Library" scope toggle
- "practice mode" / "camera thing" -> `train`
- "generator" / "random" -> `create/generator` tab
- "builder" / "manual" -> `create/constructor` tab

---

## Auto-Selection (when no ID provided)

When running `/fb` without an argument, Claude auto-selects the best item.

**Selection priority:**

1. **Bugs first** - bugs affect current users, features can wait
2. **Higher priority** - high > medium > low > unset
3. **Clear scope** - items with clear titles/descriptions over vague ones
4. **Achievable complexity** - prefer items that can be completed in one session
5. **Skip incomplete metadata** - avoid items with `--title` or `--description` placeholders

After selecting, announce the choice with brief rationale, then proceed to claim and display it.

---

## Display Feedback First

When running `/fb`, start your response with raw feedback details:

```
## Claimed Feedback: [Title or "Untitled"]

**ID:** [document-id]
**Type:** [bug/feature/enhancement]
**Priority:** [low/medium/high]
**User:** [username]
**Module/Tab:** [module] / [tab]

---

**Description:**
[Full feedback text exactly as provided]

---
```

**Then** proceed with assessment and recommendations.

---

## Model Triage (Mandatory)

After displaying feedback, assess complexity to route to the most cost-effective model.

### TRIVIAL -> Delegate to Haiku

**Only for:**
- Literal string/text swaps
- Single-line icon class changes
- Updating a hardcoded number

**NOT for Haiku:**
- CSS fixes requiring investigation
- Component logic changes
- Changes where solution isn't already known

### MEDIUM -> Delegate to Sonnet (default)

- CSS tweaks, overflow fixes
- Icon or visual changes requiring investigation
- Single-file changes with clear pattern
- Clear bug with reproduction steps
- Feature scoped to 1-3 files

### COMPLEX -> Handle as Opus

- Multi-module coordination
- Security/auth features
- Ambiguous requirements
- New infrastructure or patterns
- Features touching 4+ files

---

## Announce Triage Decision

```
**Complexity Assessment:** [TRIVIAL / MEDIUM / COMPLEX]
**Model Routing:** [Delegating to Haiku / Delegating to Sonnet / Handling as Opus]
**Reasoning:** [Brief explanation]
```

---

## Get Confirmation

**MANDATORY:** After triage, ask for explicit confirmation before proceeding.

**DO NOT:**
- Start working without confirmation
- Delegate without confirmation
- Skip this step for "simple" tasks

---

## Execute Based on Triage

### For TRIVIAL/MEDIUM (delegate):

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

### For COMPLEX (handle directly):

1. **Assign short title:** `node scripts/fetch-feedback.js <id> title "Short title"`
2. **Assess honestly:** Is this a good idea? Consider UX impact.
3. **Implement** after approval
4. **Move to review:** `node scripts/fetch-feedback.js <id> in-review "Brief notes"`
5. **Add resolution notes** (user-facing, if applicable)
6. **Offer to mark complete** - don't auto-complete

---

## Status Values

- `new` - Unclaimed, ready to be picked up
- `in-progress` - Being worked on
- `in-review` - Done, waiting for confirmation
- `completed` - Ready for next release
- `archived` - Closed (released or declined)

---

## Other Commands

- `node scripts/fetch-feedback.js list` - See queue status
- `node scripts/fetch-feedback.js <id>` - View specific item
- `node scripts/fetch-feedback.js <id> priority <level>` - Set priority
- `node scripts/fetch-feedback.js <id> resolution "notes"` - Add user-facing notes
- `node scripts/fetch-feedback.js <id> subtask add "title" "desc"` - Add subtask
- `node scripts/fetch-feedback.js <id> defer "YYYY-MM-DD" "reason"` - Defer item
