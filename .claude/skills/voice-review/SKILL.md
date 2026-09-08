---
description: Use when reviewing voice session data for recurring failures, patterns, or T2 promotion candidates
argument-hint: "[analyze|stats|<session-id>]"
---

# Voice Session Review

**Args:** `$ARGUMENTS`

Subcommands:
- `analyze` - Cross-session pattern analysis (default)
- `stats` - Quick stats summary
- `<session-id>` - Review a specific session in detail

---

## What This Does

Reviews voice command sessions recorded by the Voice Session Analysis System. Identifies:

1. **Recurring failures** - transcripts that consistently fail or go unresolved
2. **T2 promotion candidates** - transcripts that hit LLM but always resolve the same way (should become regex)
3. **Latency concerns** - tiers with unusually high latency
4. **Success rate trends** - is voice control getting better or worse over time?
5. **Unresolved patterns** - common phrases users say that the system can't handle

---

## Workflow

### For `analyze` (default, or no args):

1. **Fetch sessions and run analysis:**
   ```bash
   node scripts/fetch-voice-sessions.cjs analyze --limit 50
   ```

2. **Review the output and identify actionable items:**

   **T2 promotion candidates (3+ consistent LLM hits):** Suggest regex pattern + target sub-interpreter file in `src/lib/shared/voice-control/services/interpreters/`.

   **Recurring failures:** Missing command (suggest implementation) vs recognition issue (note only).

   **Latency concerns:** T1 <5ms, T2 <500ms, T3 variable. Flag outliers.

3. **Present findings with priorities:**
   ```
   ## Voice Control Analysis

   ### High Priority (T2 Promotion Candidates)
   [List candidates with suggested regex]

   ### Medium Priority (Recurring Failures)
   [List with suggested fixes]

   ### Low Priority (Latency / Trends)
   [Notes and observations]
   ```

4. **Ask for confirmation** before implementing any changes

### For `stats`:

```bash
node scripts/fetch-voice-sessions.cjs stats
```

Display the summary and note any concerns.

### For `<session-id>`:

```bash
node scripts/fetch-voice-sessions.cjs <session-id> --format md
```

Review the specific session in detail. Check each event for correctness and note any issues.

---

## Suggesting Regex Patterns

When a T2 candidate is identified, suggest the exact regex to add. Follow the existing pattern in the sub-interpreters:

```typescript
// Example: "go to compose" / "open compose" / "switch to compose"
// All resolve to navigation:navigate(compose) via T2 LLM
// Suggested T1 regex:
{ pattern: /(?:go\s+to|open|switch\s+to)\s+compose/i, command: { category: 'navigation', action: 'navigate', target: 'compose' } }
```

Read the target sub-interpreter file first to match the existing pattern format before suggesting additions.

---

## Creating Feedback Items

If analysis reveals issues that need dedicated work (new command categories, interpreter restructuring), create feedback items:

```bash
node scripts/fetch-feedback.js submit --type enhancement --module lab --tab voice --title "Add regex for [pattern]" --description "[details]" --priority medium --user austen
```

---

## Output Format

Present findings in three tiers: High Priority (T2 promotions with suggested regex), Medium Priority (recurring failures with fixes), Low Priority (latency/trends). Include hit counts, confidence %, and target files.
