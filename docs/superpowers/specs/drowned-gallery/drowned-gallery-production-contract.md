# Drowned Gallery (Three Channels) production contract

**Status:** Gate 0 verified; Gate 1 measured plan in progress

**Scene ID:** `drowned-gallery`

**Gate manifest:** `./scene-gates.json`

**Creative provenance:** design spec
`docs/superpowers/specs/2026-08-09-drowned-gallery-channels-design.md`
(directed by Austen 2026-08-09: "spec it" → "go"); museum tracker item pending
first capture session for this revision.

## Outcome

The visitor chooses ONE flooded channel and earns one private audience — the
letter they picked becomes their personal introduction to Water — then rises
the buoyant shaft to discover all three letters doubled in the mirror pool.
The other two bells stay open as optional dives and replay. One dive is
required; nothing is a checklist (2026-08-09 Codex-review amendment: earn the
room's transformation, not every letter — Fire keeps its full set because its
room state causally requires it). Felt sequence: descent → choice → breath →
weightlessness → reflection.

## Authority ledger

| Concern | Canonical owner | Evidence path | Current conflict |
|---|---|---|---|
| Creative direction | Design spec + this conversation's direction | `../2026-08-09-drowned-gallery-channels-design.md` | Supersedes the 2026-08-02 single S-path gallery; tracker capture pending |
| Story canon | Story bible | `docs/museum/story-bible.md` | None known for Water |
| Room shell and transitions | Compiled cave floor plan | `src/lib/features/museum/data/vulcan-cave-floor-plan.ts` | Bells may not fit the current gallery footprint (open question 3) |
| Performer roster | Live museum data | `vulcan-cave-floor-plan.ts` (`cave-water-a/b/c`) | Stale `CAVE_MODE_ROOMS` entry for `cave-water` (cosmetic, 2026-08-02 loose end #5) |
| TKA motion | Flow Arts MCP | Calls recorded 2026-08-09 (A, B, C explanations) | None |
| Selected sequences | `museum-exhibit-sequences.ts` | Fingerprints in `./scene-gates.json` | None — exact live loops, MCP-generated 2026-08-02 |
| Spatial geometry | `drowned-gallery-terrain.ts` layout | To be revised at Gate 1 (hub, channels, bells, shaft) | Current module still builds the S-path |
| Blender output | 2026-08-09 pipeline | `scripts/build-drowned-gallery-graybox.py` + manifest | Rebuilds from the revised layout after Gate 1 |
| Runtime behavior | `/test/drowned-gallery-graybox` walk route, then integrated museum | `src/routes/test/drowned-gallery-graybox/` | Buoyant-shaft gravity seam not yet wired |

## Claim ledger

| ID | Class | Statement | Evidence | Status |
|---|---|---|---|---|
| C-001 | literal | Water stages the exact museum sequences AAAA, BBBB, CCCC (`cave-water-seq-a/b/c`), alpha3→alpha3 loops. | `museum-exhibit-sequences.ts` + fingerprints in `scene-gates.json` | verified |
| C-002 | literal | A, B, C are the Split-Same group of Type 1 Dual-Shift: A blue pro/red pro, B anti/anti, C blue anti/red pro (the hybrid). | Flow Arts MCP `get_letter_explanation` A/B/C, 2026-08-09 | verified |
| C-003 | metaphor | Channel length encodes letter order (A shortest → C longest, the hybrid earning the longest dive). | Design spec | proposed |
| C-004 | metaphor | The mirror pool doubling all three performers expresses water showing motion twice. | Design spec; doubled-firelight reflection proven in the 2026-08-02 graybox | proposed |
| C-005 | invention | Private air-bell audiences: surfacing = meeting a letter. | Design spec | proposed |
| C-006 | invention | Buoyant shaft: reduced-gravity water column as the post-dive reward ascent. | Design spec; Moon gravity-scale seam precedent | proposed |
| C-007 | invention | Channel mouths glow with their bell's firelight color through the water. | Design spec | proposed |

## Experience sentence

> The player enters from the Squeeze, wades down the flooded approach until the
> rock closes overhead, chooses one of three dark channel mouths in the drowned
> hub, surfaces into a private air-bell where a single performer plays at arm's
> length, dives back to choose again, rises weightless up a glowing buoyant
> shaft to the grotto ring, watches A, B and C play doubled in the black mirror
> pool, and exits east through the gilded threshold toward Fire.

## Gate 0: Evidence preflight

### Sources and conflicts

- Room shell: `cave-water-approach` (interior 12.75–15.25 × 58.75–70.75),
  `cave-water-gallery` (7.25–20.75 × 29.75–53.75), `cave-water` grotto
  (1.25–26.25 × 2.75–24.75), world metres, from the compiled grid.
- Entry: Squeeze → approach north door. Exit: grotto east door → Fire.
- Performer roster: exactly three — `cave-water-a/b/c`.
- Exact sequences: `cave-water-seq-a/b/c` in `museum-exhibit-sequences.ts`
  (file sha256 `707a7111…ad3843`; per-sequence fingerprints in the manifest).
  MCP-generated 2026-08-02 at score 1.00; re-verified against
  `get_letter_explanation` 2026-08-09 — motion types and rotation directions
  match per letter.
- Production stack: Svelte/Threlte/Three/Rapier; the 2026-08-09 Blender
  graybox pipeline (commit `3b946cfae1`).
- Superseded: the 2026-08-02 single S-path drowned gallery layout. Its shipped
  graybox remains the Gate 2 baseline until the revised layout lands.
- Known conflicts: gallery footprint may need to grow for three bells (moves
  downstream cave rooms — must be settled at Gate 1); shared-avatar rig-space
  body-follow defect must be fixed before close-read judgment at Gate 2;
  stale `CAVE_MODE_ROOMS` entry (cosmetic).

### Live motion proof

MCP calls this session: A = Type 1 Dual-Shift, blue pro, red pro; B = blue
anti, red anti; C = blue anti, red pro; group Split-Same (ABC). The museum
loops are the exact catalog of these letters at four beats each, not newly
generated variants.

## Gate 1: Measured plan — IN PROGRESS

Deliverables per gate contract: revised layout module (drowned hub, three
channels, three air-bells, buoyant shaft), plan board (top-down + long section
through a channel-and-bell + numbered route strip + moving sightline windows
per bell + doubled final frame), automated report, plan contract in code.

The sightline check follows the Earth Gate 1.1 standard: continuous
route-sampled windows aimed at the performer floor, not fixed stops.

## Gates 2–6

Pending. Gate 2 regenerates the Blender manifest/build/GLB/walk route from the
revised layout and wires the buoyant-shaft gravity seam for the feel test.
