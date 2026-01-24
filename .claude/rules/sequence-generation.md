# Sequence Generation Workflow

## Tool Selection

| Tool | Use When | Returns |
|------|----------|---------|
| `generate_sequence` | **Default.** User needs to see the sequence | Opens in viewer, ~50 tokens |
| `generate_pictograph` | User needs to see a single letter | Opens in viewer, ~50 tokens |
| `get_sequence_data` | You need step data without showing user | Data only, ~500 tokens |

**Always use `generate_sequence`** unless you specifically need data without showing the image.

---

## Constraints: Just Use Them

When the user specifies constraints ("make it smooth", "no reversals", etc.), pass them directly to `generate_sequence`:

```
generate_sequence(word: "CAKE", constraintPreset: "smooth")
generate_sequence(word: "FLOW", constraints: "all pro motions")
```

**The tool handles feasibility internally.** If a constraint can't be fully satisfied, the response includes a note like:
- "Prop continuity limited: min 2 reversal(s) unavoidable"

You don't need to call `analyze_word_feasibility` separately. Just generate.

---

## Bridge Letters: Automatic

The generator auto-inserts bridge letters for impossible transitions. You don't need to:
- Warn the user about bridge count
- Suggest alternative words
- Check feasibility first

The beat count is what it is. Users can request shorter or longer words as needed.

---

## When Generating Sequences with Creative Freedom

If the user requests a sequence without specifying an exact tagline (notes field), this is a **humor training opportunity**.

### The Workflow (IN THIS ORDER)

1. **Generate directly** using `generate_sequence`
   - Bridges are handled automatically
   - Constraints are handled automatically

2. **Read the humor profile** from `mcp-server/src/core/humor-profile.json`
   - Understand preferences BEFORE generating anything
   - Check if user has established preferences

3. **Present 4 tagline options** based on the humor profile

4. **Wait for selection** - user picks one, or says "none" and provides their own

5. **Generate the sequence** using `generate_sequence` WITH the chosen tagline in `notes`
   - Only generate ONCE with the final tagline
   - Don't generate without a tagline then regenerate - that's wasteful

6. **Save the training pair** using the script below

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
