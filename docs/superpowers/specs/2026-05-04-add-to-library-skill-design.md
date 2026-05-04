# Add-to-Library Skill Design

**Date:** 2026-05-04
**Status:** Approved
**Scope:** New Claude Code skill for importing sequences into the Firestore library

## Problem

Adding a sequence to the library from beat notation requires Claude to:
1. Investigate how import-sequence.cjs works
2. Manually convert notation to JSON
3. Figure out the correct enum values
4. Run the script with the right flags

This wastes context and time. A skill codifies the knowledge so future imports are one-shot.

## Design

### Approach

Claude-as-parser. The skill provides Claude with the target JSON schema, canonical enum values, and the import command. Claude parses any input format — structured beat notation, raw JSON, natural language — into the JSON that `import-sequence.cjs --stdin` expects.

No new scripts. The skill is a reference document; the existing import script handles Firestore persistence.

### Skill location

```
.claude/skills/add-to-library/
  SKILL.md              — trigger, parsing rules, workflow
  format-reference.md   — enum values, JSON schema, annotated example
```

### Trigger

- `/add-to-library` slash command
- User says "add this to my library" alongside sequence data

### Recognized input formats

| Format | Example | Parsing strategy |
|--------|---------|-----------------|
| Structured beat notation | Header block + per-beat motion data (the format from the TKA dictionary) | Parse header for metadata, parse each beat line into step JSON |
| Raw JSON | MCP `generate_sequence` output or app export | Pass through with minimal normalization |
| Natural language | "4-beat sequence, J at alpha7→beta1, blue pro ccw..." | Extract fields from description, ask for anything ambiguous |
| Partial / mixed | JSON with missing fields + text annotations | Merge what's parseable, ask for gaps |

### Workflow

1. **Parse** — convert input to `import-sequence.cjs` JSON format
2. **Extract metadata** — word, loop type, grid mode, circularity, difficulty, tags
3. **Confidence gate** — if any metadata is ambiguous, ask one focused question; otherwise proceed
4. **Circularity check** — if last beat's `endPosition` matches start position, sequence is circular
5. **Write temp file** — write JSON to `tmp-import-<word>.json`
6. **Import** — `node scripts/import-sequence.cjs tmp-import-<word>.json [--circular] [--loop-type X] [--notes "Y"]`
7. **Clean up** — delete temp file
8. **Report** — sequence ID, Firestore path, confirmation of metadata

### Enum values (reference)

Documented in `format-reference.md`:
- `motionType`: pro, anti, dash, static, float
- `rotationDirection`: cw, ccw, noRotation
- `orientation`: in, out, clock, counter, clockIn, clockOut, counterIn, counterOut
- `location`: n, e, s, w, ne, se, sw, nw, c
- Position groups: alpha, beta, gamma (+ variant number, e.g. alpha7, beta1)
- `gridMode`: diamond, box, skewed
- `loopType`: rotated, mirrored, swapped, inverted, mirrored_swapped, etc.
- `visibility`: private (default), unlisted, public

### What the skill does NOT do

- Generate sequences (use `generate_sequence` MCP)
- Modify existing library entries
- Handle thumbnails (app generates on next view)
- Default to public visibility (always private unless told otherwise)

## Changes to import-sequence.cjs

Already applied (2026-05-04):
- Added `--circular` flag to force circularity when LOOP detector misses it
- Added `--loop-type <type>` flag for manual LOOP type override
- Fixed `??` bug where `false ?? true` = `false` (now uses proper null check)
- Dry-run output now shows `isCircular` and `loopType` values

## Dependencies

- `scripts/import-sequence.cjs` — Firestore write path
- `scripts/lib/compose-sequence.cjs` — compositional field computation
- `serviceAccountKey.json` — Firebase Admin SDK credential (must exist in project root)
- `packages/sequence-engine` — LOOP detection (optional, graceful fallback)
