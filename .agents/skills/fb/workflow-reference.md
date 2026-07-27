# Feedback Workflow Reference

Detailed workflows, claim health, delegation, state machine, and commands.

---

## Fetch and triage

The top-level `$fb` workflow performs exactly one initial fetch command. Do
not run `whoami`, `mine`, `list`, or per-item detail calls before it.

| Input | Single initial command |
|---|---|
| No argument | `node scripts/fetch-feedback.js` |
| Feedback ID | `node scripts/fetch-feedback.js claim <id>` |
| `list` | `node scripts/fetch-feedback.js list` |

Use that command's complete output for the display and complexity triage. If it
reports an active claim owned by another session, do not bypass the protection.
Only the user can authorize a claim request or emergency takeover.

---

## Claim Health

Claims go stale after 45 minutes of inactivity. Keep yours active:

```powershell
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

```powershell
node scripts/fetch-feedback.js claim <id>
```

For the same agent session, this refreshes a live claim. It also reclaims an
expired lease. A live claim owned by another session remains protected.

---

## Delegating to subagents

For an independent TRIVIAL or MEDIUM implementation, delegate to a Codex
worker only when the user or applicable project instructions request subagent
work. Give the worker:

- feedback ID;
- task and expected behavior;
- exact file scope;
- required verification;
- the command that moves the item to `in-review` after verified completion.

Do not route by Anthropic model names. Let the selected Codex agent configuration
or current session choose the model and reasoning effort.

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
3. Include the verification evidence you gathered
4. Describe observed behavior; if visual verification still needs user action, name one specific check

---

## Commands Reference

```powershell
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
