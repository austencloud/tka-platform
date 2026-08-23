# Creators Recent Work and Presentation Intent — Handoff (2026-08-23)

## Mission

Hand this product/architecture decision to Fable 5 after the Creators `Recent
Work` wall was upgraded from cropped static Choreo Cards to a live sequence
showcase. The remaining question is how public/social previews choose props:
the visitor's selected props, the creator's recorded presentation, or a larger
published-artifact model. This is consultation work first. Do not implement a
new mode or toggle until Austen approves the recommendation. Relevant existing
designs are [Profile as Stage](shipped/2026-07-26-profile-as-stage-design.md)
and the currently untracked
[Versioned Visual-Artifact Publication](2026-08-21-versioned-visual-artifact-publication-design.md).

## Done — verified

### Recent Work is a live-first square showcase

- Shared behavior landed in commit `46e2544a73` (`feat(inbox): add adaptive
message actions and previews`):
  `src/lib/shared/sequence-preview/components/SequenceShowcasePreview.svelte`
  owns the animation, synchronized `StepStrip`, Choreo Card layer, ambient
  hover/focus behavior, manual Messages behavior, lazy mounting, visibility
  gating, and reduced-motion fallback.
- Creators integration landed in commit `4cee80ec9f` (`fix(video): preserve
public media associations`):
  `src/lib/features/creators/components/WorkTile.svelte` uses
  `activation="ambient"`; `WorkWall.svelte` documents square aligned stages.
  The old forced `4 / 3` crop and bottom mask are gone.
- Current-turn proof on 2026-08-23:
  `npx vitest run --config tests/config/vitest.config.ts tests/unit/inbox/inbox-inline-sequence-player-contract.test.ts`
  passed 5/5 tests.
- Current-turn proof on 2026-08-23:
  `npx vitest run --config tests/config/vitest.components.config.ts src/lib/shared/inbox/components/messages/SequenceMessagePreview.svelte.test.ts`
  passed 4/4 Chromium component tests.
- The originating session visually inspected the real authenticated
  `/creators` page at 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180,
  960×412, and 375×667. Hovering Krysten Ryan's long sequence revealed its
  complete card inside the square stage. No screenshot files were retained.
  Austen supplied the stronger acceptance signal on 2026-08-22: "It's great
  now."

### The current prop path and production population are known

- Read-only production census on 2026-08-23 (Admin SDK, aggregate output only):
  `publicSequences` contains 564 documents; 460 have
  `creatorIntent.propConfig`; 104 do not.
- Recorded pairs among those 460: 452 staff/staff, 2 staff_v2/staff_v2, 2
  club/club, and one each of staff/staff cat-dog, buugeng/buugeng,
  buugeng/club cat-dog, and minihoop/minihoop.
- `SequenceData` already owns optional `intendedProp` and `creatorIntent`
  (`src/lib/shared/foundation/domain/models/sequence-data.ts:173-184`).
- The public projection includes non-null `creatorIntent`
  (`src/lib/shared/library/services/public-sequence-projection.ts:641-644`).
- The committed visual-save coordinator captures presentation intent in commit
  `8f74d8edd9` (`refactor(library): centralize visual sequence saves`).
- `PublicSequencesLoader.mapPublicIndexToSequenceData()` currently does not
  copy `creatorIntent` into its `SequenceData` result
  (`src/lib/shared/browse/services/public-sequences-loader.ts:428-505`).
- `InlineAnimationPlayer` constructs its orchestrator with
  `getViewerAnimationPropConfig`
  (`src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte:418-428`),
  which reads the visitor's global Settings. This is why Recent Work currently
  renders in the visitor's prop context.

## Believed done — unverified

None. The prop-presentation policy is deliberately not described as done: no
implementation was authorized after the discussion, and Fable 5 is being asked
to review the product model first.

## In flight

- Checkout: `E:/tka-platform`, branch `main`.
- HEAD at handoff preparation: `c65de34bd0d91aaedfef95d27a0bdbcf1f07d58d`,
  equal to `origin/main` at that check.
- The five Recent Work/shared-preview source and test paths are clean.
- The shared checkout is extremely dirty with many unrelated agents' edits,
  staged deletions, generated assets, and untracked specs. Do not clean, stage,
  revert, or commit any of them.
- Three directly relevant designs are untracked and belong to other in-flight
  work:
  - `docs/superpowers/specs/2026-08-21-unified-performance-and-artwork-media-design.md`
  - `docs/superpowers/specs/2026-08-21-versioned-visual-artifact-publication-design.md`
  - `docs/superpowers/specs/2026-08-21-media-authority-and-immutable-subjects-design.md`
- The first is marked approved for implementation. The latter two are proposed
  child specifications. Read and coordinate with them; do not create a parallel
  public-art publication system.

## Loose ends (ranked)

1. **Fable 5 product consultation.** Recommend a prop-presentation contract
   that avoids hidden persistent modes. Austen explicitly wants this reviewed
   before more code.
2. **Resolve the context policy.** The leading proposal, not yet approved, is:
   public/social surfaces show the creator-recorded prop pair; Create/Remix use
   the visitor's current props; opening or closing public work never mutates
   global Settings; legacy records without intent retain visitor-context
   behavior.
3. **Keep the surface mode-free.** If Fable agrees with the leading proposal,
   do not add `Creator props / My props` as a remembered toggle. A passive prop
   label is acceptable to evaluate. An explicit `Remix` boundary is the natural
   moment to adopt the visitor's prop context.
4. **Write/approve the governing spec before implementation.** Reconcile it
   with the shipped Profile-as-Stage decision that a sequence is raw notation
   while a saved artifact is notation plus the conditions it was left in. The
   narrow prop-preview policy must not silently redefine sequence identity.
5. **First implementation slice, only after approval:** preserve
   `creatorIntent` in `PublicSequencesLoader`; establish one shared resolver for
   public preview prop context; pass the exact same resolved blue/red/cat-dog
   values to `InlineAnimationPlayer`, `StepStrip`, and `PropAwareThumbnail` in
   `SequenceShowcasePreview`. Reuse/extend the existing resolver concepts rather
   than adding another precedence implementation.
6. **Capture policy audit.** Confirm which save/publish entry points populate
   `creatorIntent`. The visual-save coordinator does, but the ordinary Create
   save path must not be assumed to do so merely because the model has the
   field. Decide whether capture belongs at public publication/share time rather
   than every private raw-sequence save.
7. **Legacy policy and migration.** Do not backfill missing intent as staff.
   There are 104 public records without intent, and a guessed value would look
   authoritative. If provenance is needed, version the presentation snapshot.
8. **Full Art remains a separate program.** Tunnels, mandalas, and scenes are
   currently owner-only collections under `firestore.rules:728-752`. Publishing
   them requires the versioned immutable-revision/public-projection work already
   proposed. Recent Work should not query private collections or treat a public
   video as permission to publish its private subject.

## Decisions already made

- **2026-08-22 — Recent Work presentation:** Austen accepted the live-first
  animation + synchronized strip with hover/focus revealing the complete card.
- **2026-08-22 — no confusing sticky prop mode:** Austen's concern is
  load-bearing: people must not forget a persistent `Creator/My props` setting
  and then wonder why everything changed from fans to staffs. Do not solve this
  with another remembered toggle.
- **2026-08-22 — sequence versus art distinction remains meaningful:** Austen
  described Art as a sequence with specific settings applied and wants public
  work to represent creators' ideas rather than flatten everyone into the same
  staff presentation. The precise data boundary is what Fable 5 must review;
  it is not approval to publish all private artifacts.
- **2026-08-23 — consultation gate:** Austen explicitly requested a handoff to
  Fable 5 and is ending the current chat. No further implementation is
  authorized in this session.

## Gotchas

- The relevant source landed inside unrelated larger commits. The shared
  showcase is in the Inbox commit `46e2544a73`; the Creators tile is in the
  video commit `4cee80ec9f`. Do not infer ownership from those subjects and do
  not revert either whole commit to change this feature.
- Current public variety is modest because 452/460 recorded intents are
  staff/staff. Respecting intent fixes correctness and future fidelity; it will
  not instantly make the existing wall visually diverse.
- `creatorIntent` existing in the public projection is not enough. The public
  loader drops it, and the animation, strip, and card can otherwise resolve
  props differently. The implementation must resolve once and distribute the
  result.
- Never implement author-preview behavior by writing into global Settings.
  Scan bootstrap currently updates Settings for its own historical workflow;
  that is not a safe pattern for browsing a wall of public work.
- `resolveScanPropConfig` already encodes scan-specific precedence, including
  scan telemetry and motion-data fallback. It is the closest existing resolver,
  but public preview semantics are not identical. Extract/promote shared
  sequence-intent resolution or explicitly compose it; do not duplicate the
  precedence ad hoc.
- The shipped Profile-as-Stage spec says sequences remain raw notation and
  saved artifacts retain presentation conditions. The newer visual-artifact
  publication spec extends that idea with immutable revisions and approved-only
  public projections. Preserve that separation.
- If implementation changes appearance, follow the mandatory authenticated
  Chrome DevTools viewport sweep. Port 5173 is Austen's HTTPS/2 server; never
  start, stop, or resize it. Work on `main`; do not create a branch or worktree
  without Austen's explicit request.
