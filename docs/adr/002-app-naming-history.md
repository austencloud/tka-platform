# ADR 002: App Naming History

**Date:** 2026-03-23
**Status:** Accepted

## Naming Timeline

| Era | Name | Approximate Period | Reason for Change |
|-----|------|-------------------|-------------------|
| 1 | **The Kinetic Constructor** | Early development | Original working name. Predated the "TKA" abbreviation. Implied building/assembly, which was accurate for the initial sequence builder. |
| 2 | **TKA Studio** | Mid development | Broadened the identity beyond just "constructing" sequences. Studio implied a creative workspace with multiple tools. Changed because "Studio" was generic and didn't convey what the tool specifically does. |
| 3 | **TKA Scribe** | Late 2025 – March 2026 | Centered the notation system — TKA is a written language for movement, and a scribe writes. Changed because the app evolved beyond transcription into a full creation tool. "Scribe" implied recording what already exists, not creating something new. |
| 4 | **TKA Composer** | March 2026 – July 2026 | The app is a creation tool. Users compose sequences, choreographies, animations, and decks. "Composer" captures the creative authorship that "Scribe" missed. The Compose module is the flagship feature — elevating it to the app name makes the hierarchy honest. |
| 5 | **Flow Arts Composer** | July 2026 – present | "TKA" is opaque to cold users — nobody searches it, nobody parses it in an app-store list. "Flow Arts Composer" self-describes at first contact: it names the audience (flow artists, the term users self-identify with) and the activity (composing). The Kinetic Alphabet stays as the notation-system name — the ownable, trademarkable layer under the descriptive app shell. |

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

## Decision Record: TKA Composer → Flow Arts Composer (July 2026)

### Context

Approaching first app-store release. Every future user is a cold user; "TKA Composer" requires already knowing the system to parse the name. Research showed (a) "The Kinetic Alphabet" already ranks #1 for itself and has festival-scene recognition — the system brand needs no help; (b) app-store keyword weight lives in title + subtitle, but *comprehension at first contact* — in a shared link, a store list, word of mouth — only comes from a self-describing display name.

### Arguments for Flow Arts Composer

- Self-describing in three words: names the audience and the activity before any click
- "Flow artist" is what target users call themselves (staff/static-prop practitioners included)
- Zero migration cost: nothing on any app store yet — the last free rename window
- Terminal point of the naming arc: every prior rename moved toward describing what the app does

### Arguments against (considered and accepted)

- Generic and un-trademarkable as words — accepted; the ownable brand lives one layer down in "The Kinetic Alphabet" (system name, unchanged). A stylized wordmark can be protected later.
- Overclaims prop breadth (flow arts includes poi/hoop/juggling; TKA is radial static-prop notation) — mitigated by a scope line in store description and onboarding.
- Three words, seven syllables, awkward abbreviation ("FAC") — accepted coolness tax.
- "AR Flow Arts" exists on Google Play; a generic "FLOW" trademark (entertainment) registered Nov 2025 — name collision risk assessed as low for the full three-word phrase.

### What stayed (identifier freeze)

The rename is display-string only. All identifiers are frozen and keep the `tka` token:
Android package `com.tkacomposer.app`, Firebase project ids (`tka-composer-*`), TWA keystore
path/alias (`tka-composer`), npm package names (`tka-composer-functions`), `tka-` localStorage
prefixes, domains (tkaflowarts.com, tka.run), and the Fraunces "TKA" nav wordmark (separate
design task if ever). "The Kinetic Alphabet" remains the notation-system name everywhere.
Historical specs/plans under `docs/superpowers/` keep the old name as records.

## The Pattern

Each rename followed the same arc: the app grew, the name didn't grow with it. Constructor was too narrow (just building). Studio was too vague (anything creative). Scribe was too passive (just writing). Composer captured the actual activity.

The app was never formally released under any of these names, so each rename had zero user migration cost.
