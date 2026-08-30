# SpiroAnim → Flow Arts Composer Bridge (v1) — Design

**Date:** 2026-08-30
**Status:** Approved direction, spec under review
**Owner:** Austen (both halves; the SpiroAnim half ships as a PR to `rbgirard/spiroanim`)

## Context

Mentive's SpiroAnim app ships a placeholder pane titled "The Kinetic Alphabet"
("Concept in development / Possibly coming soon / Austin might be working on
something for us..."), added 2026-08-10 — one day after the 2026-08-09 DM
exchange — and extended 2026-08-14 (`681e220` "TKA Note"). It is a standing
public invitation for a TKA contribution.

The transcription work (commit `6463afb867`, artifacts in
`docs/research/spiroanim/`) already proves every SpiroAnim concept-catalog
pattern resolves to TKA: 1,584 patterns / 8,640 steps, 100% resolved, zero
exceptions. This feature turns that proof into a product surface: a button next
to every compatible animation in his app that opens the same material as TKA
pictographs in the Composer.

Mentive's stated positions (DM, 2026-08-09): lukewarm on UI PRs, "not gonna be
changing my pane layout," emphatic that UI must resize small AND large and
adapt portrait/landscape — but "if you're talking communication protocols and
such, probably." This design is protocol-first and touches only UI real estate
he created for TKA himself.

## Goals

1. A compact **"TKA" chip next to the animation player** in SpiroAnim, visible
   whenever the current animation corresponds to a concept-catalog cell.
   Clicking opens the transcribed sequence in the Composer's sequence viewer in
   a new tab.
2. **Upgrade his TKA placeholder pane** from "possibly coming soon" to a real
   explainer: what TKA is, how his labels map to TKA letters, and the same
   open-in-Composer affordance for the current selection.
3. **A "The Kinetic Alphabet" entry in his concept docs menu**
   (`ConceptDocsMenu.vue`) linking to the Composer guide at
   `https://tkaflowarts.com/guide` (external, new tab — no return-query
   round-trip needed).
4. A **stable public URL contract** between the two apps that never requires
   touching his repo again to evolve the Composer side.

## Non-goals (v1)

- **No layout or styling improvements to his app.** His pane layout is
  explicitly off-limits per his own words, and broader UI improvement has the
  highest rejection risk of anything we could send. The path to influence over
  his UI is a ladder of small landed PRs, not a redesign drop. Park it;
  revisit only after v1 lands and only with his invitation.
- **No Pattern Builder / play-edit decoding.** Hand-authored content (45° arcs,
  L6 quarter turns, 1:3/1:5 ratios beyond the catalog, motion tracks) is v2.
  The route design leaves room for it (payload parameter on the same route).
- **No reimplementation of his query-string codec, in either direction.** His
  QS format is a 9-version persisted contract; we never parse or generate it in
  shipped code. Return links are pre-generated with his own codec offline and
  vendored (same method as `eightstep-deep-links.json`).
- **No in-pane pictograph rendering inside SpiroAnim.** The bridge opens the
  Composer; it does not port the renderer.

## The protocol: cell-identity URL

```
https://tkaflowarts.com/from/spiroanim/<cellKey>
```

`cellKey` = `<concept>.<reference>.<ratio>.<shape>.<variant>`, all lowercase,
dot-separated, URL-safe:

| Field | Values | Source |
|---|---|---|
| `concept` | `vtg` \| `qtr` \| `8stp` | his concept ids |
| `reference` | e.g. `1-1`, `6-3` (column-row, END-START) | his cell reference |
| `ratio` | `1x1`, `1x3`, `1x5` (`x` replaces `:`) | speed ratio |
| `shape` | `diamond` \| `box` | grid mode |
| `variant` | `base` \| `anti` | `isAnti` in the transcription |

Example: `/from/spiroanim/vtg.1-1.1x1.diamond.base`.

The key identifies a catalog cell — nothing more. All meaning (letters,
positions, turns) lives on the Composer side in the shipped mapping. The key
grammar is documented in both repos (his `docs/`, our
`docs/research/spiroanim/bridge.md`). Unknown fields added later must be
ignored by the resolver (forward compatibility); unknown keys produce the
error state, never a guess.

## Composer side (ships first)

**Route:** `src/routes/from/spiroanim/[cellKey]/`.

**Resolution:** the route resolves `cellKey` against a build-time mapping
derived from `docs/research/spiroanim/tka-transcription.json` (1,584 entries:
concept, reference, speedRatio, isAnti, shape, word, full steps with letters,
start/end positions, and per-hand turns). Resolution builds the sequence
in memory — no Firestore read, no publishing 1,500 library entries.

**Viewer:** the route is a thin third host for `SequenceViewerShell` per the
shell contract (`sequence-viewer-shell.md`): it owns data bootstrap and
host-specific chrome only. The contract test is extended to cover the new
host — extended, not loosened. `contextContent` renders provenance:
"Opened from SpiroAnim · VTG cell 6-3 · <his relationship labels>" plus a
return link to the exact cell in his app (from the vendored codec-generated
link table; target is the `/player` alias — `/play` is a 404 and the bare
root restores pane layouts).

**Error state:** an unknown/malformed key renders an honest message naming the
key and linking to spiroanim.com and the Composer home. No silent fallback,
no redirect to an unrelated sequence.

**SEO:** `noindex` at launch. Revisit once the contract has survived contact
with his release cadence.

**Word display:** any rendered word goes through `simplifyRepeatedWord`
(e.g. the vtg 1-1 cell's word `GGGG` displays as `G`).

## SpiroAnim side (the PR)

All inside his existing `src/features/kinetic-alphabet/` feature, per his
AGENTS.md (Composition API, `<script setup lang="ts">`, setup-style Pinia, no
`any`, feature-owned code, regression tests for every feature).

1. **`buildComposerUrl(cell): string`** — a pure module mapping a resolved
   catalog cell to the bridge URL. No network, no TKA logic. Snapshot test
   pins the emitted key for every catalog cell so key drift fails his CI, not
   a user's click.
2. **The TKA chip** — a compact control rendered adjacent to the animation
   player chrome, labeled with the TKA roundel mark ("TKA"), full name in
   tooltip and `aria-label` ("Open in Flow Arts Composer"). Visible/enabled
   exactly when the current animation corresponds to a concept-catalog cell;
   his app already carries concept-matching infrastructure — the chip hooks
   the cheapest reliable signal (active concept cell selection in v1; his
   matcher in free play if it proves cheap to consume, otherwise that waits
   for v2). Opens a new tab (`rel="noopener"`).
3. **KineticAlphabetPane upgrade** — replaces the placeholder copy with a
   short explainer: what TKA is, the label↔letter correspondence at summary
   level (his six relationship labels land in TKA letters A–V; hands/props
   dual labels acknowledged), the open-in-Composer affordance for the current
   selection, and a general link to tkaflowarts.com. **Every TKA claim in this
   copy is MCP-verified and Austen-approved verbatim before it enters a
   component** (`mcp-ground-truth.md` copy gate). Tone follows his existing
   docs voice, not marketing.
4. **ConceptDocsMenu entry** — "The Kinetic Alphabet" link to
   `https://tkaflowarts.com/guide`, external, new tab, alongside his VTG4/VTG3
   entries.
5. **Responsive proof** — the chip and pane verified at phone-portrait through
   desktop-wide sizes; his explicit requirement, and screenshots ship in the
   PR description.

## Sequencing and diplomacy

1. Composer route ships and is live at tkaflowarts.com first.
2. DM heads-up to Mentive before the PR opens (per the 2026-08-09 decision
   record: "he should know it's coming"), framed as filling the pane he built.
3. PR opens with: working button on first click, screenshots at his required
   sizes, test evidence, and the key-grammar doc.
4. The open attribution PR (#2) stays independent — this PR neither depends on
   nor mentions it.

Risk: he sits on the PR (as with PR #2, closed once without comment, reopened,
uncommented). Mitigation is structural: smallest possible footprint, fills his
own placeholder, works on first click, and the Composer side delivers value
regardless (the route is a shareable surface for VTG-speaking visitors even
before his button exists).

## v2 (recorded, not designed)

- Pattern Builder bridging: same route, payload parameter, general decoder for
  his authoring space (45° arcs pairing into 90° shifts, L6 quarter turns,
  interradial orientations — feasibility proven 2026-08-23 on a hand-authored
  v9 URL).
- Free-play chip lighting via his matching worker if not landed in v1.
- Possible `index` flip on the bridge route.

## Verification

- **Composer route:** unit tests for key parsing (round-trip all 1,584
  transcription entries; malformed/unknown keys hit the error state), shell
  contract test extended, visual pass at the seven required viewports for the
  new host chrome, `simplifyRepeatedWord` grep on the diff.
- **SpiroAnim PR:** his suite green (`npm run test:unit`, `type-check`,
  `build`), snapshot test over all catalog cell keys, component tests for
  chip visibility states and pane content, responsive screenshots.
- **End-to-end:** click from a local SpiroAnim build → live Composer route →
  correct sequence renders; verified for at least one cell per concept ×
  shape × ratio class before the PR opens.

## Open items

- Exact chip placement within his player chrome (his `AnimPlayer.vue` control
  cluster vs. adjacent to the concept pane header) — decided during
  implementation against his real layout at all sizes.
- The TKA roundel asset (SVG, dark-UI-friendly) — needs a pass that looks at
  his existing iconography.
- Whether his matcher is cheap enough to consume in v1 (see chip item above).
