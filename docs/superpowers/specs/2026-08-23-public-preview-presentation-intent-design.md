# Public Preview Presentation Intent

**Date:** 2026-08-23
**Status:** Proposed — consultation output, awaiting Austen's approval. No
implementation authorized by this document.
**Context:** Follow-up to the Creators Recent Work live showcase
(`2026-08-23-creators-recent-work-presentation-intent-handoff.md`). Sibling
programs: `shipped/2026-07-26-profile-as-stage-design.md`,
`2026-08-21-unified-performance-and-artwork-media-design.md`,
`2026-08-21-versioned-visual-artifact-publication-design.md`.

## The question

Public and social surfaces (the Creators Recent Work wall, the standalone
sequence page, social previews) currently render every sequence with the
visitor's own prop settings, because `InlineAnimationPlayer` builds its
orchestrator with `getViewerAnimationPropConfig`, which reads global Settings.
Krysten's buugeng piece renders as staffs on every visitor's screen. Should
public previews show the visitor's props, the creator's recorded presentation,
or wait for the larger published-artifact model?

## Recommendation

Adopt the creator-intent contract. It is the leading proposal from the
2026-08-22 discussion, and the code audit confirms it is both correct and
cheap: every consumer except one already has the override seam.

### The contract

| Surface | Prop context |
|---|---|
| Public/social display (Creators wall, `/sequence/[id]` public view, social previews, future public art) | **Creator-recorded** (`creatorIntent.propConfig`, else `intendedProp`) |
| Public record without recorded intent | **Visitor's current props** (today's behavior; no guessed backfill) |
| Create, Remix, Practice — anything the visitor authors or drills | **Visitor's current props** |
| Opening or closing public work | **Never mutates global Settings** |

1. **Sequence identity is untouched.** A sequence remains raw notation
   (Profile-as-Stage decision). `creatorIntent` is a presentation annotation
   that rides the public projection; it participates in the
   `publicProjectionDigest` (so changing it bumps the public revision, giving
   provenance for free — `public-sequence-projection.ts:641-658`) but never in
   notation identity (`contentHash`, path hashes, word).
2. **Mode-free.** No `Creator props / My props` remembered toggle — Austen
   rejected hidden sticky modes on 2026-08-22. The visitor's Settings mean
   "what I animate MY work with"; public surfaces mean "what the creator made."
   Two contexts, no state. A passive label on the preview ("shown with
   buugeng") is acceptable to evaluate visually; it is display-only.
3. **Remix is the adoption boundary.** The moment a visitor remixes public
   work into Create, the notation enters their context and renders with their
   props. That is the natural, visible seam where presentation ownership
   changes hands — no setting required.
4. **Legacy stays honest.** The 104 public records without intent keep
   visitor-context rendering. No staff backfill; a guessed value would look
   authoritative.

### Why not the alternatives

- **Visitor-props everywhere (status quo):** flattens every creator into the
  visitor's prop choice; with 452/460 recorded intents being staff/staff today
  the wall looks the same, but every future fan/club/buugeng publication is
  misrepresented, and the Recent Work wall claims to show creators' work while
  showing the visitor's mirror.
- **Wait for the versioned-artifact program:** that program (immutable
  revisions, approval ledgers, publication state machines) is the right
  machinery for publishing tunnels/mandalas/scenes — heavyweight artifacts with
  moderation and consent stakes. A prop pair on an already-public sequence
  preview does not need a revision store; the projection digest already
  versions it. Blocking a two-field display fix on a five-phase publication
  program is the wrong coupling. The contract above is forward-compatible: if
  a sequence-revision store lands (media-authority Phase 1), `creatorIntent`
  snapshots into revisions unchanged.

## Findings from the code audit that shape the design

These three are new relative to the handoff:

1. **`hydrate()` fabricates staff intent.** When a sequence has an
   `effortTimeline` but no `intendedProp`, hydration constructs a
   `creatorIntent` with a hardcoded staff/staff `propConfig`
   (`sequence-hydrator.ts:130-148`) because `CreatorIntent.propConfig` is
   required. Hydration runs at save boundaries, so a fabricated staff intent
   can persist and is indistinguishable from a genuine staff recording. The
   production census (460 with intent) may include such records. Fix as part
   of this work: make `propConfig` optional on `CreatorIntent` (or add a
   source marker) and stop inventing it. The resolver then treats
   "intent without propConfig" as no recorded prop intent.
2. **Motion data is unusable as a fallback tier for public previews.**
   `resolveScanPropConfig` falls back to per-motion `propType` from steps —
   valid for scan's historical payloads. But the public loader hydrates steps
   from compositional fields via `deriveSteps(..., { staff, staff, false })`,
   so hydrated public steps always carry staff motion propTypes. A motion-data
   tier on public previews would silently resolve everything to staff. The
   public resolver must not include it.
3. **Capture census.** `intendedProp`/`creatorIntent` is written by exactly
   two entry points: `VisualSequenceSaveCoordinator.withPresentationIntent`
   (visual saves) and `FuseLayout` (Fuse saves). The ordinary Create library
   save does not capture intent. Separately, `/sequence/[id]` writes URL prop
   params into global Settings (`SequenceViewerPage.svelte:268`) — the
   scan-historical pattern this contract prohibits for browse-style surfaces.

## Resolver design (single owner, caller-owned tails)

Promote the candidate-chain machinery from
`src/lib/shared/qr/services/scan-prop-resolver.ts` into a shared
sequence-intent resolver. One extraction of creator evidence
(`creatorIntent.propConfig` → `intendedProp`), then each caller owns its tail:

- **Scan** (existing behavior, unchanged): scan telemetry candidates first,
  then creator evidence, then motion data, then STAFF.
- **Public preview** (new): creator evidence, else **visitor settings** — and
  the catDog inference for mixed pairs that scan already encodes.

`SequenceShowcasePreview` resolves **once** per sequence and passes the same
resolved `{bluePropType, redPropType, catDogMode}` to all three renderers.
The seams already exist for two of the three:

| Consumer | Seam | Status |
|---|---|---|
| `StepStrip` | `bluePropType` / `redPropType` props → pictograph overrides | exists |
| `PropAwareThumbnail` | `bluePropType` / `redPropType` props | exists |
| `InlineAnimationPlayer` | orchestrator already takes an `AnimationPropConfigProvider` (`sequence-animation-orchestrator.ts:79`), but the player hardcodes `getViewerAnimationPropConfig` at `InlineAnimationPlayer.svelte:427` | **one new optional prop** |

## Capture policy recommendation

Capture presentation intent at **deliberate publication/share moments**, from
the creator's active prop settings at that moment: save-as-public, share/QR
generation, and the visual-save coordinator (already does). Do not capture on
every private save — a private working save is not a presentation statement,
and silently restamping public presentation whenever the creator happens to
fiddle with Settings mid-edit would change what visitors see without a
deliberate act.

Sub-decision for Austen: the simpler alternative is capture-on-every-save
("intent = however you last left it"), which matches the existing `intendedProp`
field comment. Recommend publication-moment capture; either is compatible with
the display contract above.

## Implementation slices (only after approval)

1. Preserve `creatorIntent` and `intendedProp` in
   `PublicSequencesLoader.mapPublicIndexToSequenceData` (currently dropped,
   `public-sequences-loader.ts:428-505`).
2. Extract the shared sequence-intent resolver; re-express
   `resolveScanPropConfig` on top of it (its tests already exist:
   `tests/unit/scan-prop-resolver.test.ts`).
3. Add the optional prop-config provider prop to `InlineAnimationPlayer`;
   default stays `getViewerAnimationPropConfig` so every existing consumer is
   untouched.
4. `SequenceShowcasePreview` resolves once and distributes to player, strip,
   and thumbnail.
5. Fix the `hydrate()` staff fabrication (finding 1).
6. Evaluate the passive prop label visually (optional, separate slice).
7. Extend intent capture to the publication/share entry points per the capture
   policy Austen picks.

Visual verification per `visual-verification-mandatory.md` at all seven
viewports on the authenticated `/creators` page, plus `/sequence/[id]` for a
record with non-staff intent.

## Out of scope

- Publishing tunnels/mandalas/scenes (versioned-artifact program owns it).
- Any backfill of the 104 intent-less records.
- Any write to global Settings from browse/preview surfaces.
- Changing `/q` scan behavior (its resolver keeps its own precedence and
  STAFF tail). Whether `/sequence/[id]` should stop writing URL props into
  Settings is flagged but deferred — it is shared with the scan workflow and
  deserves its own look.
