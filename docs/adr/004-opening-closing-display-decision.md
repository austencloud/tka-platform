# ADR 004: Opening/Closing Display — Data Only, No Glyph Rendering

**Date:** 2026-04-19
**Status:** Accepted

---

## Decision

**Opening/closing (`op`/`cl`) per-hand rotational state is preserved as data but never rendered inside the pictograph glyph.** The glyph continues to show letter, turns column, same/opp dot, and dash suffix. The `op`/`cl` tokens remain visible only in the raw turns tuple surfaced by the pictograph inspect modal, and as theory material in the MCP glossary entries for *opening* and *closing*.

The tuple parser (`src/lib/shared/pictograph/tka-glyph/utils/turn-tuple-parser.ts`) captures `topOpenClose` and `bottomOpenClose` fields on every parse, so the data is available to any future consumer that wants it — but no current consumer reads those fields, and none is planned.

---

## Context

Opening and closing are per-hand designations that apply to rotating props in Lambda (Λ), Lambda-Dash (Λ-), and Gamma (γ) pictographs. "Opening" means the hand's rotational trajectory, if extrapolated into a subsequent pro-shift, would resolve to an alpha end position (hands at opposite grid points — spatially open). "Closing" means it would resolve to a beta end position (hands at the same point — closed). These designations are necessary because these three letters have rotational-state variants that cannot be produced from each other by rotation, reflection, or mirroring — a TKA invariant that same/opp rotational relationship alone cannot capture.

The tokens appear in the turns tuple strings emitted by `TurnsTupleGenerator` — e.g. `Λ(0, 1, op)` for a Lambda with a single rotating hand, or `Λ-(s, 1, 1, op, cl)` for a Lambda-Dash with both hands rotating. These strings are the key into the arrow special-placement tables, so the generator has always emitted them. The *parser* that consumes those strings, however, dropped the `op`/`cl` tokens entirely, breaking a roundtrip that nobody had exercised because no consumer needed it.

The 2026-04-19 session surfaced the gap. Extending the parser was mechanical. The real question was what to do with the recovered fields: render them in the glyph, or store them as latent data.

---

## The Deliberation

Two frames were considered:

**Render-in-glyph (initial proposal).** Display "open"/"close" (full words) in blue and red at the center-bottom of the pictograph, below the same/opp dot, for Λ/Λ-/γ pictographs whose tuple carries the tokens. The short forms "op"/"cl" were rejected early because they collide with "opp" (the rotational-relationship dot meaning "opposite direction") for newcomers.

**Data-only (final choice).** Preserve the data in parsed form, leave the glyph unchanged, rely on existing surfaces (inspect modal debug field, MCP glossary) for theory-oriented exposure.

### Why render-in-glyph was rejected

- **It forces a visibility toggle.** Many users — including most beginners — will never care about op/cl. Adding inline text to Λ/Λ-/γ glyphs by default clutters the glyph for the majority; making it opt-in requires a UI control, help copy, and settings surface.
- **The toggle forces explaining an edge case to everyone.** Every user who encounters the toggle has to read the explanation even if they decide to leave it off. The cost is borne by the majority to serve the minority.
- **Net-negative UX asymmetry.** The people who care about op/cl deeply (curriculum authors, advanced students, theorists) are a small, motivated group. They can easily decode the raw tuple or consult the glossary. The people who don't care (most users) cannot easily *un-encounter* the chrome.
- **No real pull.** No user has asked for op/cl in the glyph. The display question surfaced as a side effect of fixing the parser, not from a feature request.

### Why data-only was accepted

- **The data stays load-bearing.** `topOpenClose` and `bottomOpenClose` are on the parsed result for any consumer that wants them. Future curriculum tooling, theory-mode rendering, print layouts for Level 2+ materials — all can read the fields without a re-parse.
- **Existing theory surfaces are sufficient.** The pictograph inspect modal already shows the raw turns tuple string as a debug field, so inspecting any Λ/Λ-/γ beat reveals `op`/`cl` in context. The MCP glossary entries for *opening* and *closing* (added in the same session) explain the concept in depth with cross-references to same/opp, gamma asymmetry, and the alpha/beta trajectory rationale. These two surfaces together cover the curiosity path.
- **The glyph's job is signal, not completeness.** A pictograph glyph is meant to be read at a glance. Every additional ink stroke trades against that glanceability. Opening/closing is load-bearing for classification correctness, not for visual reading — the reader does not need to see it to recognize the letter. Keeping it out of the glyph matches the principle that "the symbol carries what a performer needs; the data carries what a theorist needs."
- **Reversible.** If future work reveals a legitimate need for op/cl in the glyph (a print format, a teaching mode), the parser already exposes the fields. This ADR can be revisited and superseded. Nothing in the current decision locks out future work.

### The steel-man against data-only, and why it doesn't bite

**Steel-man:** The Level 2 Guide treats op/cl as part of the written notation. Not rendering them in the glyph means the app's glyph disagrees with the canonical reference. A student learning from both will get confused.

**Why it doesn't bite:** The Level 2 Guide's written notation *is* the raw turns tuple — `Λ-(1,1,op,cl)`. That exact string is what appears in the inspect modal. A student following the Guide reads the tuple, not the glyph. The glyph is a visual summary; the tuple is the authoritative string. Nothing is lost for a student comparing against the Guide, because the Guide's op/cl notation appears in the tuple surface, not in Guide illustrations of glyphs (which typically omit op/cl too, exactly because the tokens are generator output, not glyph ornaments).

---

## Invariants

1. **Parser lossless.** `parseTurnsTuple` MUST recover `topOpenClose` and `bottomOpenClose` for every form the generator emits. Regression test: `tests/unit/pictograph/tka-glyph/turn-tuple-parser.test.ts` covers 10 direct parse forms and 4 end-to-end generator roundtrips (Λ static-only, Λ dash-only, Λ- both hands, γ both hands).
2. **Glyph unchanged.** `TKAGlyph.svelte`, `TurnsColumn.svelte`, `DirectionDot.svelte`, and `Dash.svelte` do not render any op/cl indicator. No component should introduce one without first superseding this ADR.
3. **Raw tuple visible.** The pictograph inspect modal (`BasicInfoColumn.svelte`) continues to display the full turns tuple string including `op`/`cl` tokens. This is the primary theory-surface for curious users.
4. **Data round-trips.** Any serialization path that preserves the turns tuple string preserves op/cl trivially (it's just text). Parsed-form consumers that currently read only `direction`/`top`/`bottom` remain unaffected — the new fields are additive.

---

## Implementation Notes

The parser extension shipped 2026-04-19. Specifically:

- `ParsedTurnsTuple` gained two optional fields, both typed as `OpenCloseValue = "op" | "cl" | null`.
- The parser now handles three new forms: 3-part `(top, bottom, oc)` where the op/cl binds to the non-zero slot; 5-part `(direction, top, bottom, topOC, bottomOC)` with both slots populated; and gracefully falls back for malformed input.
- No rendering code was modified. Existing consumers continue to read `direction`, `top`, `bottom` as before.

Future consumers that want to surface opening/closing (e.g. a curriculum print target, a theory-mode toggle for Level 2+ students) can read the new fields directly without re-parsing.

---

## Migration

None required. No saved sequence format or storage schema is affected — op/cl has always been embedded in the turns tuple string, which was and remains the canonical form on disk.

---

## Related

- `src/lib/shared/pictograph/tka-glyph/utils/turn-tuple-parser.ts` — the parser with op/cl fields
- `tests/unit/pictograph/tka-glyph/turn-tuple-parser.test.ts` — the roundtrip regression test
- `packages/domain/src/data/glossary.ts` — MCP glossary entries for *opening*, *closing*, *pads*, *rotational-relationship*
- `packages/domain/src/reference/domain-topics.ts` — *glyph-anatomy* topic covers the full op/cl rationale
- ADR 003 — Level-1-Base Float Classification (same session; both decisions derived from the 2026-04-18/19 deliberation)
