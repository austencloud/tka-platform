# Sequence Generation Workflow

## ⛔ CRITICAL: Always Use `constraintPreset: "smooth"`

**The legacy builder fails for most words. Always use a constraint preset to trigger the reliable builder.**

### The Correct Way (Single Tool Call)

```
generate_sequence(word: "BOOK", constraintPreset: "smooth")
```

That's it. One tool call. Works every time.

### Why This Matters

There are **two sequence builders** in the MCP server:
1. **Legacy builder** - Random walk with 500 retries. Fails for most real words.
2. **Constrained builder** - Beam search with backtracking. Handles bridges reliably.

**Adding `constraintPreset: "smooth"` triggers the constrained builder.** Without it, you get the legacy builder which will fail.

### If User Specifies a Different Constraint

Use their constraint instead:
```
generate_sequence(word: "CAKE", constraintPreset: "reversal")
generate_sequence(word: "FLOW", constraints: "all pro motions")
```

Any constraint (preset or natural language) triggers the reliable builder.

---

## Tool Selection

| Tool | Use When | Returns |
|------|----------|---------|
| `generate_sequence` | **Default.** Show sequence to user | Opens in viewer, ~50 tokens |
| `generate_pictograph` | Single letter | Opens in viewer, ~50 tokens |
| `get_sequence_data` | Need step data without image | Data, ~500 tokens |

**Always include a constraint** unless the user explicitly says "no constraints" or "random":
- Default: `constraintPreset: "smooth"`
- User wants reversals: `constraintPreset: "reversal"`
- User wants specific style: pass their `constraints` string

---

## Bridge Letters

The constrained builder handles bridges automatically. The response may include notes like:
- "Σ inserted between B and O"
- "W inserted between O and K"

You don't need to pre-compute bridges. Just call `generate_sequence` with a constraint preset.

---

## When Generating Sequences with Creative Freedom

**This ONLY applies when the user provides a specific named word with creative intent** (e.g. "generate CAKE", "make me a NOVA sequence"). It does NOT apply when the user asks for a sequence by letter, level, loop type, length, or constraints (e.g. "level 2 starting with G", "6-beat rotated loop"). In those cases, just generate immediately — no tagline workflow.

If the user provides a specific word without specifying an exact tagline (notes field), this is a **humor training opportunity**.

### The Workflow (IN THIS ORDER)

1. **Read the humor profile** from `mcp-server/src/core/humor-profile.json`
   - Understand preferences BEFORE presenting options

2. **Present 4 tagline options** based on the humor profile

3. **Wait for selection** - user picks one, or says "none" and provides their own

4. **Generate the sequence** with the chosen tagline:
   ```
   generate_sequence(word: "USERWORD", constraintPreset: "smooth", notes: "<tagline>")
   ```
   Always include `constraintPreset: "smooth"` to ensure reliable generation.

5. **Save the training pair** using the script below

### Humor Profile Location

`mcp-server/src/core/humor-profile.json`

**READ THIS FIRST** before presenting tagline options. The profile contains:
- User's preferred humor lenses (ranked)
- Examples of what works and what doesn't
- Training pairs from previous selections

### Austen's Humor Profile (Summary)

- **Primary:** DEADPAN - Flat, understated observations. Minimal words. Let absurdity speak for itself.
- **Secondary:** ABSURDIST - Non-sequiturs, logic breaks, wrong references, intentional confusion.
- **Secondary:** SARDONIC - Bitter cultural observations, ironic praise, wry commentary.
- **Tertiary:** DICTIONARY - Fake definitions with semicolons, multiple meanings, formal tone for informal content.
- **Tertiary:** DOMAIN - Flow arts in-jokes, prop references, festival culture, TKA-specific humor.
- **Occasional:** ACRONYM - Fake backronyms that redefine words in TKA context.
- **AVOID:** SELF_DEPRECATING - Being the butt of the joke.

### Key Preferences

- Intentional ambiguity ("The prop or the admirer?")
- Double meanings
- No Twitter/X references (user doesn't use it)
- Dictionary format works well for reclaiming internet slang

### Generating Good Options

1. Read the humor profile for context and existing training pairs
2. Generate 4 options, ideally spanning different lenses
3. At least one should be DEADPAN (primary preference)
4. Make sure options actually make sense - avoid obscure references
5. Keep them short (under 8 words ideal)

### After User Selects

Save the training pair:

```bash
node scripts/add-humor-pair.cjs "<WORD>" "<selected text>" "<LENS>" '[{"text":"rejected1","lens":"LENS1"},{"text":"rejected2","lens":"LENS2"}]'
```

Example:
```bash
node scripts/add-humor-pair.cjs "NOVA" "A star's dramatic exit" "DICTIONARY" '[{"text":"Briefly notable","lens":"DEADPAN"},{"text":"The car or the explosion?","lens":"ABSURDIST"}]'
```

### When NOT to Do This

- User specifies exact tagline text
- User says "no tagline" or "leave it blank"
- User indicates time pressure ("just generate it quick")
- Sequence is for sharing and user specifies the message

### When to Auto-Select

Once the humor profile has 100+ training pairs for a given theme/category, Claude may auto-select based on learned preferences, but should still mention what was chosen so user can object.
