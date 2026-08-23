# Browse Phase 3 — Handoff (2026-08-23)

## Mission

Continue the Browse redesign from the completed immutable-revision foundation
into Phase 3, the public tunnel vertical slice. The program exists to replace
the retired Watch feed with a coherent `Explore | You` model, preserve
Collections as first-class authored objects, connect performances and tunnel
realizations to exact historical subjects, and expose public visual work only
after it has earned a safe publication path. Start with the
[program charter](./2026-08-21-browse-explore-you-public-contributions-design.md),
then read the
[Browse IA child specification](./2026-08-21-browse-ia-and-route-migration-design.md),
[versioned visual-artifact publication specification](./2026-08-21-versioned-visual-artifact-publication-design.md),
and
[media-authority specification](./2026-08-21-media-authority-and-immutable-subjects-design.md).

## Done — verified

All implementation below is uncommitted in the shared `main` checkout. The
base commit before this handoff was
`1e6b57453e95c25c11d1cc822b05fa1de1cb88b6`; there is no implementation commit
SHA to cite. Do not interpret the handoff-doc commit as containing these source
changes.

### Explore/You crossfade repair

- `BrowseModule.svelte` now uses the canonical `Crossfade` primitive keyed only
  by the primary `Explore | You` choice. It no longer applies a directional
  `fly`, translation, or cubic easing to the whole Browse surface.
- `navigation-coordinator.svelte.ts` now resolves the delayed route update to
  `/browse/explore/sequences` or `/browse/you/sequences`; inner Browse routes
  remain intact rather than being overwritten after the transition.
- Runtime proof on 2026-08-22: at the transition midpoint the top-level layers
  measured `0.92` and `0.08` opacity, both were `position: absolute`, and both
  had `transform: none`. The final path was `/browse/you/sequences`.
- Responsive proof on 2026-08-22: 820×1180, 960×412, and 375×667 all reported
  zero horizontal overflow. Primary Browse targets were 48×48 px and the
  secondary Sequence/Collection controls were 44 px tall. The page produced no
  console warnings, errors, or issues.
- Screenshot references on this workstation:
  `C:\Users\Austen\AppData\Local\Temp\browse-crossfade-settled-820.png`,
  `browse-crossfade-settled-960x412.png`,
  `browse-crossfade-settled-375.png`, and `browse-you-375.png` in that same
  directory.

### Phase 2 immutable subject foundation

- `src/lib/shared/artifact-revisions/domain/artifact-revision.ts` owns the
  shared `ArtifactRevisionRef`, SHA-256 digest policy, digest version, and
  content-addressed `v1_<digest>` revision IDs.
- Tunnel work keeps its stable mutable work ID while
  `tunnel-revision.ts` builds deterministic immutable payload revisions.
  `tunnel-collection-repository.ts` writes the stable parent and nested revision
  in one Firestore batch. Renaming does not create a content revision; changing
  the rendered content does.
- Public sequences now retain reconstructible immutable records under
  `sequenceRevisions/{revisionId}`. Revision identity is based on the canonical
  sequence content identity, not discovery-only fields such as profile or
  thumbnail changes.
- Media associations may carry an exact revision reference. Sequence and tunnel
  upload flows require the current immutable subject where public or historical
  truth depends on it. Tunnel playback queries may filter by exact revision.
- `media-revision-audit.ts` classifies only a structurally valid, matching
  reference as pinned. A missing or invalid legacy association remains
  ambiguous and never silently resolves to the current subject.
- Firestore rules protect owner-only private tunnel revisions, immutable
  retained sequence revisions, and idempotent content-addressed writes.
- The new canonical owner is recorded in
  `.claude/rules/canonical-capabilities.md`.

Verification evidence:

```text
pnpm exec vitest run --exclude ".codex-tmp/**" --exclude ".claude/worktrees/**" \
  src/lib/features/tunnel-collection/domain/__tests__/tunnel-collection-types.test.ts \
  tests/unit/video-collaboration/media-associations.test.ts \
  tests/unit/library/sequence-revision.test.ts \
  src/lib/shared/collections/__tests__/collection-state.test.ts \
  src/lib/features/library/services/__tests__/public-index-syncer-projection.test.ts

Result: 5 files passed, 36 tests passed.
```

The expected refusal-path tests print errors to stderr; the suite is green.

```text
pnpm exec svelte-check --tsconfig ./tsconfig.json
Result: 0 errors, 0 warnings.

pnpm run test:rules:core
Result: 97 passed.

pnpm run test:rules:parity
Result: 33 passed.
```

The relevant source set passes Prettier and a scoped `git diff --check`.

### Additive production migration

- `scripts/migrations/retain-media-subject-revisions.ts` is dry-run by default;
  applying requires both `--apply` and `TKA_ADMIN=1`.
- The migration retained 564 baseline public-sequence revisions and 9 saved
  tunnel revisions across 2 owners.
- It did not edit or guess any video association.
- The final production dry run on 2026-08-22 found 564 public sequences, 9 saved
  tunnels, 0 blocked tunnels, 7 ambiguous media associations, and 0 writes.
- Durable local evidence:
  `scripts/migrations/backups/media-subject-revisions-2026-08-22T19-57-42-010Z.json`.
  That backup directory may be ignored by Git.

## Believed done — unverified

- Much of Phase 0A/0B and Phase 1 appears implemented in the dirty checkout:
  direct tunnel editing, route work, the `Explore | You` shell, Sequences and
  Collections beneath Explore, the personal You surface, browse census work,
  and route evidence documents are present. The program charter marks only
  Phase 2 complete. Audit the Phase 0 and Phase 1 exit gates against the code
  before changing their status.
- The browser proof covered primary-route transitions and responsive layout,
  not every deep link, back/forward sequence, legacy printed QR path, guest
  session, or self-profile/private-management boundary required by the Phase 1
  exit gate.
- No real upload was created during Phase 2 browser verification. Domain,
  typecheck, and Firestore-rule evidence cover revision pinning; an authenticated
  end-to-end upload should be part of the relevant later media checkpoint.
- Two historical revisions of a tunnel are reconstructible by the domain and
  repository contracts, but there is not yet a public tunnel revision detail UI
  proving that reconstruction to a guest. That is Phase 3 work.

## In flight

- Branch: `main` in `E:\tka-platform`.
- Source changes are uncommitted. The worktree contains extensive unrelated
  changes from other live sessions. Never reset, clean, reformat globally, or
  assume every modified file belongs to this program.
- Core crossfade files:
  - `src/lib/features/browse/shared/components/BrowseModule.svelte`
  - `src/lib/shared/navigation-coordinator/navigation-coordinator.svelte.ts`
- Core Phase 2 files:
  - `.claude/rules/canonical-capabilities.md`
  - `firestore.rules`
  - `src/lib/shared/artifact-revisions/domain/artifact-revision.ts`
  - `src/lib/shared/collections/collection-state.svelte.ts`
  - `src/lib/features/tunnel-collection/domain/tunnel-revision.ts`
  - `src/lib/features/tunnel-collection/domain/tunnel-collection-types.ts`
  - `src/lib/features/tunnel-collection/services/tunnel-collection-repository.ts`
  - `src/lib/features/tunnel-collection/state/tunnel-collection-state.svelte.ts`
  - `src/lib/shared/library/data/firestore-paths.ts`
  - `src/lib/shared/library/services/sequence-revision.ts`
  - `src/lib/shared/library/services/sequence-revision-reader.ts`
  - `src/lib/shared/library/services/public-sequence-persister.ts`
  - `src/lib/shared/video-collaboration/domain/collaborative-video.ts`
  - `src/lib/shared/video-collaboration/domain/media-revision-audit.ts`
  - `src/lib/shared/video-collaboration/services/collaborative-video-manager.ts`
  - `src/lib/shared/video-collaboration/helpers/create-video-from-upload.ts`
  - `src/lib/shared/video-collaboration/components/VideoUploadSheet.svelte`
  - `src/lib/shared/sequence-viewer/components/sequence-videos/VideoUploadFlow.svelte`
  - `src/lib/features/tunnel-collection/TunnelCollectionModule.svelte`
  - `scripts/migrations/retain-media-subject-revisions.ts`
  - the focused unit and Firestore-rule tests named above.
- `TunnelCollectionModule.svelte` has a large diff because it also contains the
  earlier tunnel workflow and media-association work. Preserve it; do not reduce
  it to the Phase 2 lines in isolation.
- The program and child specifications are currently untracked, including the
  main charter and Browse/media child specs linked above.

## Loose ends (ranked)

1. **Begin Phase 3 from the publication spec, not directly from the UI.** Audit
   the existing public-sequence projection/save-path owner, then define the
   tunnel-specific private publication request, immutable approved revision,
   approved-only public projection, withdrawal cascade, preview builder, and
   Firestore authority. Extend the existing projection conventions rather than
   inventing a parallel generic publisher.
2. **Calibrate the tunnel promotion gate before exposing a permanent Visuals
   destination.** Phase 0B must establish real approved-supply, creator-diversity,
   concentration, preview-quality, report/takedown, and editorial-capacity
   thresholds. Infrastructure may remain hidden until the gate is earned.
3. **Implement the complete public tunnel vertical slice.** Explicit publish,
   publish-new-revision, unpublish, moderation, guest-readable projection,
   public detail route, creator-profile presentation, and exact realization
   media must converge on the same approved revision.
4. **Stop for Austen's visual checkpoint before promotion.** Show private You
   management, publication controls, public tunnel cards/detail, anonymous
   behavior, revision history, and responsive layouts. Do not expose a sparse
   top-level destination merely because the infrastructure exists.
5. **Audit Phase 0/1 exit gates.** In particular, test legacy `/browse`, Gallery,
   Library, collection, `/q`, `tka.run`, scanner, native handoff, pending-intent,
   back/forward, and printed `/browse/library/{id}?scan=1` behavior. Confirm the
   self-profile is public portfolio while private management lives only in You.
6. **Leave the 7 legacy video associations unresolved until the curator can
   supply evidence.** Four currently have a reconstructible present-day
   sequence, but that is not proof it was the historical subject filmed.
   Reconciliation belongs to Phase 4 and must never guess.
7. **Do not start a public performance archive or mixed Following media feed.**
   Those remain behind later supply, diversity, consent, moderation, and
   revocable-delivery gates.

## Decisions already made

- On 2026-08-21, Austen agreed that Browse should be restructured around two
  primary jobs: `Explore` for public discovery and `You` for work connected to
  the current viewer. Explore opens Sequences.
- Collections remain first-class routed authored objects beneath Explore and
  may also act as Sequence filters. They do not require a permanent primary-nav
  slot.
- Tunnels, Mandalas, and Scenes may eventually share a Visuals family, but each
  requires its own payload adapter, digest policy, preview, migration, and
  promotion gate.
- Performances remain contextual media attached to canonical typed subjects.
  A performance-first destination is earned later; retiring Watch did not
  authorize a replacement third feed.
- Saved visual artifacts are private until explicitly published. Public
  discovery reads a sanitized approved projection, never another user's private
  collection document.
- A tunnel realization and sequence performance must point to an exact immutable
  subject revision. Stable mutable work IDs alone are historically false.
- Missing legacy subject evidence is labeled ambiguous. Current data must not be
  used as a guessed historical answer.
- Performer credit is not performer consent. Public media later requires a real
  authority/consent/moderation contract and revocable delivery, not merely a
  visibility flag.
- Browse uses two primary mobile destinations so it works at 375 px without the
  former five-tab overflow. Global module and prop controls remain app-shell
  responsibilities.
- On 2026-08-22, Austen explicitly asked for the awkward Explore/You motion to
  be a real crossfade. The accepted behavior is opacity-only overlap with no
  directional movement or layout shift.
- Austen authorized autonomous progress through the approved phases, with
  visual checkpoints where product shape and publication surfaces become
  visible. Phase 3's public tunnel slice is such a checkpoint.

## Gotchas

- The production revision migration has already been applied. Its final dry run
  is idempotent. Do not rerun `--apply` casually, and never change the script to
  infer legacy video subjects.
- A Firestore `videos` document being marked public does not yet make it a safe
  anonymous archive record. Guest delivery, sanitized `publicMedia`, consent,
  moderation, subject visibility, and revocation are Phase 4 prerequisites.
- Existing R2 playback URLs are effectively durable. Removing a Firestore
  projection would delist rather than truly revoke an already-known raw URL.
  Do not promise revocation until delivery uses an opaque asset reference or
  short-lived authorized URL.
- `CollectionState.update()` historically preserved a mutable stable ID so
  videos stayed attached. The new revision repository is the correction. Do not
  regress media associations to stable-ID-only linkage.
- `git diff --check` across the whole checkout currently reports unrelated
  whitespace in `patches/@austencloud__scene-3d@0.1.6.patch`. Scope checks to the
  files being changed.
- Vitest discovers similarly named tests under `.codex-tmp` and
  `.claude/worktrees` unless those paths are excluded. Use the verified command
  above for the Phase 2 focused suite.
- Port 5173 is Austen's HTTPS/2 dev server. Do not start, stop, or kill it. Use
  `https://localhost:5173`, and follow the repository Chrome DevTools procedure
  for visual work. The task-owned browser tab used for the 2026-08-22 sweep was
  closed and its emulation cleared.
- Browse currently has nested `Crossfade` instances, so a raw `.layer` query may
  include an inner steady layer as well as the two primary transition layers.
  Identify layers by their shared top-level crossfade parent when measuring the
  Explore/You transition.
- The shared Git index and checkout are used by concurrent sessions. Commit only
  explicit paths and never stage or revert unrelated changes.
