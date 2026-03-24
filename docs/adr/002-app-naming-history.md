# ADR 002: App Naming History

**Date:** 2026-03-23
**Status:** Accepted

## Naming Timeline

| Era | Name | Approximate Period | Reason for Change |
|-----|------|-------------------|-------------------|
| 1 | **TKA Constructor** | Early development | Original working name. Implied building/assembly, which was accurate for the initial sequence builder. |
| 2 | **TKA Studio** | Mid development | Broadened the identity beyond just "constructing" sequences. Studio implied a creative workspace with multiple tools. Changed because "Studio" was generic and didn't convey what the tool specifically does. |
| 3 | **TKA Scribe** | Late 2025 – March 2026 | Centered the notation system — TKA is a written language for movement, and a scribe writes. Changed because the app evolved beyond transcription into a full creation tool. "Scribe" implied recording what already exists, not creating something new. |
| 4 | **TKA Composer** | March 2026 – present | The app is a creation tool. Users compose sequences, choreographies, animations, and decks. "Composer" captures the creative authorship that "Scribe" missed. The Compose module is the flagship feature — elevating it to the app name makes the hierarchy honest. |

## Decision Record: Scribe → Composer (March 2026)

### Context

The app had outgrown the name "Scribe." The product trajectory was toward creation (Assemble Lab, beat-by-beat building, grid setup wizard, animation timeline, video export) not transcription. The notation reading/writing aspect ("scribing") was a subset of what the app did, handled by learning tools, books, and choreo cards.

### Arguments for Composer

- "Compose" is the verb users perform — they compose sequences, choreographies, animations
- The Compose module is the app's flagship feature
- "Composer" implies creative authorship; "Scribe" implies recording
- The "[System] + [Role]" pattern (like LabanWriter) reads as academic; "Composer" has more creative identity
- The word works across all domains: compose a sequence, a choreography, an act, a deck

### Arguments against (considered and accepted)

- Music connotation is strong — could set wrong first impression
- "Composer" is crowded in software (PHP Composer, Docker Compose, Cursor Composer) — but "TKA Composer" is unique
- Module name collision (Compose module inside Composer app) — accepted as reinforcing, not confusing. The verb/noun distinction is natural.
- "Scribe" had better phonetic punch (one syllable, hard consonants)

### What stayed

- The Compose module kept its name — "Compose" is the verb, "Composer" is the app
- Museum lore retained "scribe" as a historical role descriptor (not a faction name)
- "Free Scribe Collective" kept its fictional group name in retro lore

### What changed alongside

- Domain merged from tkascribe.com (app) + tkaflowarts.com (landing) into tkaflowarts.com with app at /app
- Mode detection switched from hostname-based to path-based
- Android package ID changed from com.tkascribe.app to com.tkacomposer.app

## The Pattern

Each rename followed the same arc: the app grew, the name didn't grow with it. Constructor was too narrow (just building). Studio was too vague (anything creative). Scribe was too passive (just writing). Composer captured the actual activity.

The app was never formally released under any of these names, so each rename had zero user migration cost.
