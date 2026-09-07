---
description: Use when TIKA conversations need quality review, grading, or flagging for issues
argument-hint: "[session|capture|create|link|search|<id>]"
---

# TIKA Quality Monitor

**Args:** `$ARGUMENTS`

Subcommands:
- `review` - Pull and review pending conversations from Firestore
- `approve <id> "Grade: notes"` - Approve a conversation with grade
- `flag <id> "reason"` - Flag for human review
- `stats` - Show quality metrics
- (no args) - Same as `review`

---

## Philosophy

You are the quality gatekeeper for TIKA. Your job: verify domain accuracy, judge communication quality, auto-approve good responses, flag problems for human review.

**Use MCP tools to verify facts. Don't guess.**

```
mcp__tka-domain__get_letter_explanation({ letter: "A" })
mcp__tka-domain__get_term_definition({ term: "shift" })
```

If unsure about domain rules, read `.claude/rules/tka-domain.md` or `src/lib/features/tika/ai/system-prompts.ts`.

---

## Workflow

### For `review`:

1. Fetch pending: `node scripts/fetch-tika-conversations.cjs --status pending --limit 5`
2. Claim: `node scripts/fetch-tika-conversations.cjs <session-id> claim`
3. Read conversation: `node scripts/fetch-tika-conversations.cjs <session-id>`
4. For each conversation: read question, read response, verify domain facts via MCP, grade using rubric, decide approve or flag
5. Auto-approve if grade >= B, confidence >= 85%, no red flags
6. Flag if grade < B, confidence < 85%, or red flags detected
7. Report summary after batch

### For `stats`:
```bash
node scripts/fetch-tika-conversations.cjs stats
```

---

## CLI Commands Reference

```bash
# List pending conversations
node scripts/fetch-tika-conversations.cjs

# List by status
node scripts/fetch-tika-conversations.cjs --status pending
node scripts/fetch-tika-conversations.cjs --status in-review
node scripts/fetch-tika-conversations.cjs --status approved

# Show all
node scripts/fetch-tika-conversations.cjs --all

# View specific conversation
node scripts/fetch-tika-conversations.cjs <session-id>

# Claim for review
node scripts/fetch-tika-conversations.cjs <session-id> claim

# Submit review
node scripts/fetch-tika-conversations.cjs <session-id> approve "A (95%): Notes here"
node scripts/fetch-tika-conversations.cjs <session-id> flag "C: Needs work because..."

# Archive completed review
node scripts/fetch-tika-conversations.cjs <session-id> archive

# Statistics
node scripts/fetch-tika-conversations.cjs stats
```

---

See `grading-reference.md` for rubric, red flags, example reviews, fix plan format, and review status flow.
