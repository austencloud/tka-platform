---
description: Analyze voice command sessions for patterns, failures, and T2 promotion candidates
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

   **For T2 promotion candidates (3+ consistent LLM hits):**
   - These are transcripts the LLM resolves identically every time
   - Suggest the specific regex pattern to add to the appropriate sub-interpreter
   - Show which file to modify:
     - Navigation commands: `src/lib/shared/voice-control/services/implementations/interpreters/NavigationInterpreter.ts`
     - Settings commands: `src/lib/shared/voice-control/services/implementations/interpreters/SettingsInterpreter.ts`
     - Playback commands: `src/lib/shared/voice-control/services/implementations/interpreters/PlaybackInterpreter.ts`
     - UI commands: `src/lib/shared/voice-control/services/implementations/interpreters/UIInterpreter.ts`

   **For recurring failures:**
   - Determine if it's a missing command (needs new interpreter support) or a recognition issue
   - If missing command: suggest implementation approach
   - If recognition issue: note it but don't suggest code changes

   **For latency concerns:**
   - T1 should be <5ms (regex is instant)
   - T2 should be <500ms (LLM call)
   - T3 is variable (streaming chat)
   - Flag anything significantly above these baselines

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

## Example Output

```
## Voice Control Analysis (50 sessions, 342 events)

### T2 Promotion Candidates

1. "go to settings" -> navigation:navigate(settings) (7 hits, 95% LLM confidence)
   Suggested regex: /(?:go\s+to|open)\s+settings/i
   File: NavigationInterpreter.ts

2. "play the sequence" -> playback:play(sequence) (5 hits, 92% LLM confidence)
   Suggested regex: /play\s+(?:the\s+)?sequence/i
   File: PlaybackInterpreter.ts

### Recurring Failures

1. "undo that" (4 occurrences) - No undo command exists yet
   Recommendation: Add undo support to UIInterpreter

### Trends

- Overall success rate: 78% (up from 71% last week)
- T1 hit rate increasing (more regex patterns catching commands)
- Average T2 latency: 380ms (normal)
```
