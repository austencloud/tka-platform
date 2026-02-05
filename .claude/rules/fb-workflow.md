# Feedback Workflow

## TKA Domain Context

Users may use vague or incorrect terminology. Here's the actual structure:

**Modules** (main nav items):
- `create` - Build sequences (tabs: assembler, constructor, generator)
- `browse` - Browse sequences (tabs: gallery, collections, creators)
- `compose` - Animate sequences (tabs: arrange, browse)
- `learn` - Educational content (tabs: concepts, play, codex)
- `train` - Practice with camera (tabs: practice, challenges, progress)
- `settings` - App preferences (tabs: profile, props, background, visibility, misc)
- `feedback` - Feedback system (tabs: submit, my-feedback, manage)

**Common user confusions:**
- "main screen" / "home" -> likely `browse` gallery
- "my sequences" / "saved" -> `browse/gallery` with "My Library" scope toggle
- "practice mode" / "camera thing" -> `train`
- "generator" / "random" -> `create/generator` tab
- "builder" / "manual" -> `create/constructor` tab

---

## Claim Health System

**Claims go stale after 45 minutes of inactivity.** Stale claims can be taken over by other agents.

### Keep Your Claim Active

Every 30 minutes while actively working, run:
```bash
node scripts/fetch-feedback.js heartbeat <id> "Brief status message"
```

This resets the 45-minute staleness timer.

### Record Files Being Edited (Optional)

For better work recovery if your session dies:
```bash
node scripts/fetch-feedback.js touch <id> "src/path/to/file.svelte"
```

### View Work History

See all activity on an item (claims, heartbeats, status changes):
```bash
node scripts/fetch-feedback.js journal <id>
```

---

## Claim Takeover Protocol

**Fresh claims (<45 min activity) are protected.** You cannot just unclaim them.

### If You Need Someone Else's Claim:

1. **Check if stale first:**
   ```bash
   node scripts/fetch-feedback.js list  # Shows staleness info
   ```

2. **If stale (>45 min inactive):** Just claim it normally
   ```bash
   node scripts/fetch-feedback.js claim <id>
   ```

3. **If active:** Submit a request and wait 15 minutes
   ```bash
   node scripts/fetch-feedback.js request-claim <id> "Why you need it"
   ```
   After 15 minutes, claim normally. The current holder can see your request.

4. **True emergency only:** Use emergency flag (audited, logged, flagged for review)
   ```bash
   node scripts/fetch-feedback.js unclaim <id> --emergency "Blocking release 0.3.0"
   ```

### What NOT to Do

- **NEVER bypass protection** by chaining unclaim/claim
- **NEVER use --emergency for non-emergencies** - it's audited
- **NEVER assume a fresh claim is abandoned** - the agent may be actively working

---

## Auto-Selection (when no ID provided)

When running `/fb` without an argument, Claude auto-selects the best item.

**Selection priority:**

1. **Bugs first** - bugs affect current users, features can wait
2. **Higher priority** - high > medium > low > unset
3. **Clear scope** - items with clear titles/descriptions over vague ones
4. **Achievable complexity** - prefer items that can be completed in one session
5. **Skip incomplete metadata** - avoid items with `--title` or `--description` placeholders

**BE DECISIVE.** Run `list` once, apply criteria, pick the first match, claim it. Do NOT cycle through 3+ items second-guessing yourself.

After selecting, announce the choice with 1-sentence rationale, then immediately claim and display it.

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

## Feedback Images

The `fetch-feedback.js` script auto-opens images in the user's default viewer when claiming or viewing feedback. Items with images show a 📸 indicator in the list view.

**When images are present, Claude must:**

1. **Read each image** using the Read tool with the absolute paths printed by the script
2. **Describe what you see** before proposing solutions - narrate the key visual details so the user can confirm Claude is interpreting the screenshot correctly
3. **Reference the images** throughout the discussion when relevant

The user sees the images automatically (opened by the script). Claude sees them via the Read tool. Both parties are looking at the same thing.

**Pass `--no-open` to suppress auto-open** if running in a non-interactive context:
```bash
node scripts/fetch-feedback.js claim <id> --no-open
```

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

## Status Values & State Machine

Valid statuses and allowed transitions:

| From | Allowed To | Action |
|------|------------|--------|
| `new` | `in-progress` | Claim the item |
| `in-progress` | `new`, `in-review` | Unclaim or resolve |
| `in-review` | `in-progress`, `completed` | Needs more work or confirm fixed |
| `completed` | `archived`, `in-review` | Release or retest |
| `archived` | `new` | Reopen (admin only) |

**Invalid transitions are blocked.** You cannot skip steps (e.g., `new` → `completed`).

---

## Commands Quick Reference

### Queue Commands
```bash
node scripts/fetch-feedback.js              # Auto-claim next item
node scripts/fetch-feedback.js claim <id>   # Claim specific item
node scripts/fetch-feedback.js list         # See queue status
node scripts/fetch-feedback.js mine         # Your in-progress items
```

### Claim Health
```bash
node scripts/fetch-feedback.js heartbeat <id> "status"   # Keep claim active
node scripts/fetch-feedback.js touch <id> "filepath"     # Record file edit
node scripts/fetch-feedback.js journal <id>              # View activity log
```

### Claim Takeover
```bash
node scripts/fetch-feedback.js unclaim <id>              # Release stale claim
node scripts/fetch-feedback.js request-claim <id> "why"  # Request active claim
node scripts/fetch-feedback.js unclaim <id> --emergency "reason"  # Emergency only
```

### Item Management
```bash
node scripts/fetch-feedback.js <id>                      # View item details
node scripts/fetch-feedback.js <id> <status> "notes"     # Update status
node scripts/fetch-feedback.js <id> priority <level>     # Set priority
node scripts/fetch-feedback.js <id> resolution "notes"   # Add resolution
```

**CRITICAL:** Always use `claim <id>` before working on an item. Just viewing with `<id>` alone does NOT prevent other agents from picking it up.
