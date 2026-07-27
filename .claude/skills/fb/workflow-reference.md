# Feedback Workflow Reference

Detailed workflows, claim health, delegation, state machine, and commands.

---

## Auto-Select Workflow (no argument)

### Step 1: Check for in-progress items

```bash
node scripts/fetch-feedback.js mine
```

**If items found:**

1. Fetch full details for EACH in-progress item (the `mine` list is truncated):
   ```bash
   node scripts/fetch-feedback.js <id>
   ```
2. Display full details so the user understands each item.
3. Ask: "This item is in-progress from another session (claim token `[xxxxxxxx]`). Want me to continue working on it, or skip to unclaimed items?"

The claim token identifies which session owns the claim. If another agent is actively working on it in a different terminal, they should finish. But often in-progress items are from dead/disconnected sessions.

**If user says continue:**
1. Try: `node scripts/fetch-feedback.js claim <id>`
2. If claim succeeds -> proceed with work
3. If claim fails with "active work in progress" -> the claim is still fresh (<45 min activity)
   - **DO NOT bypass the protection** - this would steal another agent's active work
   - Tell the user the options:
     a. "Wait for the claim to become stale (45 min inactivity)"
     b. "Submit a claim request: `request-claim <id> 'reason'` (starts 15-min countdown)"
     c. "Emergency takeover: `unclaim <id> --emergency 'reason'` (audited, requires justification)"
   - **Only the USER can decide to force or use emergency** - never do it automatically

**If user says skip:** Proceed to Step 2.

**If no in-progress items found:** Proceed to Step 2.

### Step 2: Auto-select a new item

Run `node scripts/fetch-feedback.js list` to show the feedback queue.

**Auto-delete obvious test submissions** before selecting (e.g., "This is a test", "asdfgh"). Only delete when 99%+ confident it's a test:
```bash
node scripts/fetch-feedback.js delete <id>
```

**Auto-select priority:**
1. ONLY select from "new" (unclaimed) items
2. Bugs first (affect current users)
3. Higher priority (high > medium > low > unset)
4. Skip incomplete metadata (`--title` or `--description` placeholders)

**STOP OVERTHINKING. JUST PICK ONE.**
- Look at the list ONCE, pick the FIRST viable item
- "Too complex for one session" is NOT a reason to skip
- Large features are fine - break into subtasks and make progress

After selecting, announce with a 1-sentence rationale, then claim:
```bash
node scripts/fetch-feedback.js claim <id>
```

---

## Claim Health

Claims go stale after 45 minutes of inactivity. Keep yours active:

```bash
# Heartbeat every 30 min while working
node scripts/fetch-feedback.js heartbeat <id> "Brief status message"

# Record files being edited (optional, helps recovery)
node scripts/fetch-feedback.js touch <id> "src/path/to/file.svelte"

# View all activity on an item
node scripts/fetch-feedback.js journal <id>
```

### Approval boundary

User confirmation may arrive after the original claim expires. Before editing,
always run:

```bash
node scripts/fetch-feedback.js claim <id>
```

For the same agent session, this refreshes a live claim. It also reclaims an
expired lease. A live claim owned by another session remains protected.

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
