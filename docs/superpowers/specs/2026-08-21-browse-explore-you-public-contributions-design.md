# Browse: Explore, You, and Public Contributions

**Date:** 2026-08-21  
**Status:** Proposed program charter after two adversarial architecture reviews  
**Authority:** This document coordinates separate governing specifications. It
does not authorize implementation by itself. Each workstream requires its own
approved contract and implementation plan.  
**Upon approval, amends:** The Browse destination model in
`2026-08-20-watch-retirement-and-performance-discovery-design.md` and the
mutable stable-ID assumption in the tunnel-association portions of
`2026-08-21-unified-performance-and-artwork-media-design.md`. It does not amend
Watch retirement, the ban on an unearned third media list, or the accepted
performance-archive gates.

## Decision

Browse is organized by two user jobs, not by Firestore collections:

```text
Browse
├─ Explore
│  ├─ Sequences
│  ├─ Collections
│  ├─ Visuals
│  │  ├─ Tunnels
│  │  ├─ Mandalas
│  │  └─ Scenes
│  └─ Performances       earned later; absent until its launch gates pass
└─ You
   ├─ Saved and created sequences
   ├─ Saved and published visual works
   ├─ Video uploads, collaborations, and invites
   └─ Owned, shared, and followed collections
```

`Explore` means public discovery. `You` means material connected to the current
viewer. Content types are secondary destinations within those two jobs.

Explore opens directly to Sequences, the highest-frequency discovery surface.
Collections and Visuals are sibling destinations within Explore. An Explore
overview is not part of the baseline and may be introduced only if observed
navigation demand justifies another step.

Collections remain first-class authored objects. They keep dedicated discovery,
detail, sharing, following, smart-membership, and deck-promotion surfaces. A
collection may also be selected as a Sequence filter, but the filter is not a
replacement for the collection itself.

Performances remain canonical media attached to typed subjects. Sequence pages
show sequence performances. Tunnel revision pages show tunnel realizations. A
performance-first Explore destination is permitted only after the existing
supply, diversity, freshness, metadata, consent, reporting, and moderation gates
pass.

Private saved visual artifacts stay private. Publication creates a public work
and an immutable public revision. Editing the private source never changes a
revision already referenced by media.

## Product model

### Top-level jobs

The primary Browse destinations answer different questions:

- **Explore:** What has the community published?
- **You:** Where is the work I created, saved, joined, or followed?

`You` is not a universal repository and does not impose one status taxonomy on
every domain. Each section uses the states its domain actually supports:

| Section     | Viewer-relative states           |
| ----------- | -------------------------------- |
| Sequences   | Created, saved, favorites        |
| Visuals     | Saved drafts, published works    |
| Videos      | Uploads, collaborations, invites |
| Collections | Owned, shared with you, followed |

Creator profiles remain person-first public portfolios. `You` is the private
retrieval and management home. Looking at one's own public profile must not be
the only way to manage private work.

### Content terminology

- **Sequence:** canonical notation and generated presentation.
- **Collection:** an authored organization of sequences, manual or smart.
- **Visual work:** a tunnel, mandala, or scene saved as a reconstructible
  artifact.
- **Performance:** approved human-movement media attached to a sequence
  revision.
- **Realization:** approved real-world media depicting a visual-work revision.
- **Editorial media:** approved footage whose purpose is explicitly typed but
  which is not claimed to depict a canonical sequence or visual-work revision.

The navigation label for the visual family is provisionally **Visuals** and the
page heading is **Visual works**. `Art` remains an acceptable label candidate,
but terminology testing is not allowed to change the underlying architecture.

## Current-state evidence

The design starts from these verified constraints:

1. Browse currently exposes `Gallery`, `Library`, and `Collections` as peer tab
   IDs in `src/lib/shared/navigation/config/tab-definitions.ts`.
2. `BrowseModule.svelte` owns the current Gallery, personal Library, community
   Collections, and Hall of Shame presentations.
3. Browse navigation state has unversioned compatibility logic and accepts
   printed `/browse/library/{collectionId}?scan=1` and legacy
   `/browse/collections/{collectionId}?scan=1` targets.
4. A `LibraryCollection` is an authored domain object with manual or smart
   membership, public state, sharing roles, independent following, and optional
   deck metadata.
5. Tunnels, mandalas, and scenes are stored in owner-only user subcollections.
   Their schemas do not contain public visibility or public projection data.
6. `CollectionState.update()` mutates a saved artifact beneath the same ID. Its
   current comment says this preserves attached video links. That behavior is
   incompatible with exact historical media subjects.
7. Canonical `/videos` records require authentication even when public.
   Anonymous Browse cannot use them as a public catalog.
8. Video create rules validate creator identity and the visibility enum, but do
   not establish subject existence, subject publication, association authority,
   performer consent, or the truth of client-written association keys.
9. Canonical video creation rejects records with no sequence or tunnel
   association. Untyped standalone footage is not currently a valid media kind.
10. Production media remains split across canonical `videos`, curator-owned
    `showcaseVideos`, and a static landing editorial list. The last verified
    census found 142 showcase records but only seven canonical public records.
11. The mobile Browse bar reserves 112 pixels for shell controls and 56 pixels
    per section. Five sections require 392 pixels; four require 336. A two-job
    Browse shell does not require relocating the global controls merely to fit.

## Hard invariants

1. **Private is the default.** Saving is not publishing.
2. **Publication is explicit.** Public video does not publish its private
   subject, and public subject does not publish attached private media.
3. **Media subjects are historical.** Approved media references an immutable
   subject revision or a preserved subject snapshot and content digest.
4. **Public reads use public projections.** Anonymous clients never traverse
   another user's private artifact collections.
5. **Public authority is server-controlled.** Clients may request publication;
   they may not forge public projections, approved consent, associations, feed
   events, or discovery counters.
6. **Credit is not consent.** Performer identity, collaboration permissions,
   publication authority, and consent/revocation are separate fields and flows.
7. **Collections retain identity.** No filter or generated result list replaces
   their editorial metadata, routes, sharing, following, or ordered membership.
8. **Watch stays retired.** This design does not restore a mixed infinite feed.
9. **No conditional primary navigation.** A released destination is stable for
   every eligible user. Supply gates are release gates, not per-user tab hiding.
10. **Profiles are public portfolios.** This remains true when the owner views
    their own profile. Private management belongs only in You.
11. **Public playback is revocable.** Delisting metadata is not access
    revocation. Public records expose an opaque delivery reference, never a
    permanent origin URL.
12. **Legacy links survive.** Printed QR paths and `/watch` redirects remain
    functional through explicit, tested compatibility rules.

## Capability ownership

Search terms used before this design: `browse gallery`, `my library`, `saved
work`, `public collection`, `smart collection`, `follow collection`, `creator
following`, `performance video`, `showcase video`, `media association`, `public
visibility`, `tunnel realization`, `artifact revision`, `public projection`,
`guest browse`, `collection scan`, `browse route`, and `bottom navigation`.

| Capability                                                              | Owner                                                         | Relationship                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Browse shell and public discovery composition                           | `features/browse`                                             | Extend                                                          |
| Sequence filtering, sorting, and card presentation                      | Existing shared Browse engine and components                  | Reuse                                                           |
| Personal sequence persistence and public sequence sync                  | Existing library save paths and `PublicIndexSyncer`           | Reuse; do not add this logic to `SequencePersister`             |
| Collection identity, membership, sharing, public loading, and following | Existing library collection domain and managers               | Reuse and compose                                               |
| Browse route parsing, canonicalization, and history                     | One consolidated navigation owner                             | Extract from the current three competing owners                 |
| Private tunnel, mandala, and scene storage                              | Existing per-feature collection states and repositories       | Reuse as authoring sources                                      |
| Shared publication conventions and immutable revision reference         | Existing public-sequence projection/save-path architecture    | Extract and extend; do not create a parallel publication system |
| Type-specific public payload creation                                   | Tunnel, mandala, and scene feature owners                     | Create one adapter per type                                     |
| Canonical collaborative media                                           | `shared/video-collaboration`                                  | Extend                                                          |
| Sequence-scoped video list                                              | `sequence-videos-store.svelte.ts` and `SequenceVideos.svelte` | Reuse; remain canonical per-sequence presentation               |
| Public media projection and denormalized counters                       | Firebase video functions                                      | Extend server ownership                                         |
| Creator relationships                                                   | Existing community/user repository                            | Reuse                                                           |
| Creator-follow discovery                                                | Separate future governing specification                       | No mixed feed or media events are approved by this charter      |
| Compact shell controls                                                  | Existing shared navigation components                         | Preserve until a separately verified shell design replaces them |

The new performance archive, if earned, becomes an explicitly approved third
presentation over canonical media. At that point the performance-video entry in
`.claude/rules/canonical-capabilities.md` must be updated. Until then, its ban on
a third list remains active.

## Data architecture

### Stable work identity and immutable revisions

Every publishable visual work has two identities:

```ts
interface ArtifactIdentity {
  artifactId: string; // stable conceptual work
  ownerId: string;
  artifactType: "tunnel" | "mandala" | "scene";
  currentRevisionId: string;
}

interface ArtifactRevisionRef {
  artifactId: string;
  revisionId: string; // immutable payload identity
  contentDigest: string; // deterministic digest of the canonical payload
}
```

Editing a draft may update the private working document. Publishing creates a
new immutable revision. Updating an already-published work creates another
revision and advances `currentRevisionId`; older revisions remain resolvable
while referenced by approved media or retained public history.

Tunnel revisioning is the first visual-work vertical slice. Retained sequence
revisions are a mandatory prerequisite to public media, not a design study.
`publicSequences/{sequenceId}` may remain the latest discovery projection, but
media must resolve through an immutable `sequenceRevisions/{revisionId}` (or an
equivalent immutable subject store) containing the canonical payload, stable
sequence ID, deterministic digest and digest version, provenance, and creation
time. Existing public sequences receive an explicit baseline revision through
an idempotent migration. Ambiguous historical videos remain unresolved and are
never guessed into an exact association.

### Public visual projection

The publication layer has a shared discovery envelope and separate type-owned
revision payloads:

```ts
interface PublicArtifactProjection {
  publicationId: string;
  artifactId: string;
  artifactType: "tunnel" | "mandala" | "scene";
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  posterUrl?: string;
  currentRevisionId: string;
  publishedAt: Date;
  updatedAt: Date;
  schemaVersion: number;
}
```

This approved-only projection is suitable for discovery cards and creator
profiles. Pending, rejected, removed, and appealed work lives in a separate
owner/moderator-readable publication request and audit ledger. A guest-readable
collection never contains non-approved records. The revision payload is not
universal:

- tunnel revisions own steps, tunnel snapshot, composition, lineage, and poster;
- mandala revisions own steps, hand variant, prop types, path shape, and a
  generated public preview;
- scene revisions own the versioned scene snapshot, optional choreography,
  camera, performers, effects, environment, and a public poster.

Inline data-URL posters are not copied blindly into public indexes. Public
preview assets use the existing media storage boundary or a dedicated public
asset path so projection documents remain bounded and cacheable.

### Canonical media and public media

`videos` remains the private/collaborative authority. A separate
guest-readable public projection contains only approved discovery metadata:

```ts
interface PublicMediaRecord {
  videoId: string;
  mediaKind: "subject" | "editorial";
  editorialKind?: string;
  publicAssociations: PublicMediaAssociation[];
  performerCredits: PublicPerformerCredit[];
  thumbnailUrl: string;
  deliveryAssetId: string;
  duration: number;
  publishedAt: Date;
  moderationState: "approved";
  approvalRevision: string;
}

interface PublicMediaAssociation {
  subjectType: "sequence" | "tunnel" | "mandala" | "scene";
  relationship: "performance" | "realization";
  publicationId: string;
  revisionId: string;
  contentDigest: string;
}
```

The exact allowed subject/relationship matrix is owned by the media domain and
validated on the server. A client cannot publish arbitrary labels or private
subject IDs into the public projection.

Editorial media requires an explicit reviewed taxonomy and must not use an
empty subject as an implicit type. The curator may keep unresolved footage in a
private review state without making it a public performance.

`deliveryAssetId` resolves through a revocable delivery boundary or a
short-lived signed URL issued only while the approved public projection remains
active. Public projections never expose a permanent R2 origin URL. The media
governing specification defines cache duration, derivative invalidation,
embedding behavior, and the difference between delisting and access revocation.

### Consent, credit, and revocation

The model separates:

- uploader and canonical record owner;
- collaborators who can edit timing or metadata;
- credited people shown in the footage;
- the authority that approved public display;
- one consent decision per depicted person, including identity, scope,
  evidence, recorder authority, recorded time, expiry where applicable, and
  current state;
- takedown, revocation, and audit history.

Media publication follows an explicit state machine covering request, identity
review, per-performer consent, subject authority, moderation approval,
publication, dispute, withdrawal, takedown, appeal, and removal. Minors require
a separately approved policy before publication. Removing required consent
revokes delivery, removes the `publicMedia` projection, and reconciles public
subject counters and landing references. Subject unpublication behavior is
defined by policy and cannot leak a private artifact through media metadata.
The private canonical record may remain when retention policy permits it.

### Following is a separate program

Following a creator and following a collection are distinct:

- **Creator following** may later power a creator roster, per-type filters, or a
  balanced activity feed after an evidence-backed product decision.
- **Collection following** remains a subscription to one live collection and
  appears under `You > Collections`.

This charter does not authorize a cross-type activity projection. In
particular, no Following surface may emit public media events until the
performance archive has independently passed its promotion gates and the
canonical presentation policy has been deliberately amended. Contextual media
on an approved subject page remains valid.

## Information architecture

### Explore

Explore opens to Sequences and provides these sibling content destinations:

1. **Sequences:** existing Gallery discovery, filters, and sorting.
2. **Collections:** public collection cards and stable detail routes, including
   author, framing, share, follow, and deck information.
3. **Visuals:** published Tunnels, Mandalas, and Scenes. A subtype is shown only
   after its publication contract and minimum supply gate pass at release time.
4. **Performances:** absent until the full archive gate passes.

Sequences keep the contextual performance controls:

- With a public performance
- Without a public performance
- Recently performed

Counts disclose whether they describe the current results or the full catalog.

### You

You is one retrieval and management home, composed from existing owners:

- saved and created sequences;
- private and published visual works;
- video uploads, collaborations, and invites;
- owned collections, collections shared with the viewer, and followed
  collections.

The page uses domain sections and contextual filters. The baseline has no mixed
"recent work" stream. Such a stream would require a separately owned bounded
personal activity projection; client-side merging and a new mega-index are both
out of scope.

Guests retain access to their on-device saved sequences. Signed-in-only sections
show an explanation and sign-in action instead of disappearing after release.

### Creator profiles

Creator profiles are public-portfolio views for every viewer, including the
owner. They read the same public projections as Explore. Private saved art must
never be loaded through an ordinary profile view.

The owner may reach public-profile preview from You, but publication management
stays in You. Creator profiles do not become a second private library.

### Hall of Shame

Hall of Shame remains outside ordinary Browse content because its age gate,
moderation state, reports, voting, and specialized rules are not collection
semantics. Its existing route remains separately gated. Removing it from primary
Browse navigation requires its own small routing and discoverability decision.

## Routes and state compatibility

Canonical route targets after the IA release:

```text
/browse/explore
/browse/explore/sequences
/browse/explore/collections
/browse/explore/collections/{ownerId}/{collectionId}
/browse/explore/visuals/{type}
/browse/explore/visuals/{type}/{publicationId}
/browse/explore/performances                 gated until earned
/browse/you
/browse/you/sequences
/browse/you/visuals/{type}
/browse/you/videos
/browse/you/collections
```

Compatibility behavior:

| Existing path                               | Canonical interpretation                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/browse`                                   | Explore > Sequences                                                                                                     |
| `/browse/gallery`                           | Explore > Sequences                                                                                                     |
| `/browse/library`                           | You                                                                                                                     |
| `/browse/collections`                       | Explore > Collections                                                                                                   |
| `/browse/library/{collectionId}?scan=1`     | Existing collection scan resolver; never reinterpret as a You child ID                                                  |
| `/browse/collections/{collectionId}?scan=1` | Existing legacy collection scan resolver                                                                                |
| `/watch` and former child paths             | Continue permanent redirect to sequence discovery until an earned performance archive has an explicit redirect decision |

Persisted Browse state gains a schema version. Each migration runs once from a
known prior version. No migration rewrites a tab string without considering the
stored schema version and route shape.

Before route implementation, the IA workstream must check in a complete manifest
covering `/browse`, legacy Browse tabs, viewer return paths and query state,
`/q/{code}`, `tka.run` printed QR entry, native and app scan handoffs,
`/browse/library/{collectionId}?scan=1`, shared/public collection details with
owner IDs, `url-parameter-policy.ts`, pending navigation intents, local history,
malformed IDs, and signed-out access. Route parsing, canonicalization, and
history restoration move under one owner; local component state, Browse state,
and the global coordinator may not remain competing authorities.

## Multi-phase delivery

This charter is delivered through separate governing specifications:

1. Browse IA and route migration.
2. Versioned visual-artifact publication, with independent tunnel, mandala, and
   scene adapters.
3. Media authority and immutable sequence subjects.
4. Creator-follow discovery, if product evidence earns it.
5. Performance archive eligibility and presentation.
6. Compatibility close-out and decommissioning.

The governing documents are:

- `2026-08-21-browse-ia-and-route-migration-design.md`
- `2026-08-21-versioned-visual-artifact-publication-design.md`
- `2026-08-21-media-authority-and-immutable-subjects-design.md`
- `2026-08-21-following-and-performance-promotion-design.md`
- `2026-08-21-browse-program-decommissioning-design.md`

Each workstream has its own approval gate and may not borrow unfinished
infrastructure from a later workstream. Pre-decommission releases must be
operationally rollbackable through feature flags and dual-read/dual-write
compatibility. Published URLs and data escape that boundary, and final cleanup
is intentionally irreversible; decommissioning therefore requires a backup,
rollback window, telemetry evidence, and explicit irreversible approval.

### Phase 0A: Immediate tunnel-edit path relief

**Purpose:** remove the immediate tunnel-editing friction without waiting for
the publication program.

**Scope**

- Add or verify stable saved-tunnel detail navigation.
- Expose the existing Edit choreography command directly from tunnel cards or
  their first detail surface. Reuse the current tunnel-to-viewer handoff.

**Exit gate**

- A tunnel can be opened for choreography editing from its Browse card path in
  no more than three deliberate interactions from another module.
- No public visibility or schema behavior changes.

**Verification**

- Focused tunnel handoff tests.
- Route fixture tests.
- Runtime click-path evidence on phone and desktop.

### Phase 0B: Evidence, route manifest, and instrumentation

**Purpose:** freeze current behavior before changing navigation or public data.

**Scope**

- Record production counts for public sequences, public collections, private
  saved visual types, canonical videos, showcase records, linked subjects,
  approved media, participating creators, and recent media.
- Check in the complete route, deep-link, QR, pending-intent, URL-parameter, and
  persisted-state manifest required above.
- Add analytics for Browse destination entry, collection-first browsing,
  visual-type entry, tunnel edit entry, and performance playback intent.

**Exit gate**

- Census queries and route fixtures are reproducible.
- Visual supply thresholds are calibrated from the census and moderation
  capacity. Any numeric threshold in this charter is a provisional hypothesis,
  not architectural truth.

### Phase 1: Versioned Browse navigation and `Explore | You`

**Purpose:** fix the information architecture using content that already exists.

**Scope**

- Introduce versioned Browse navigation state and explicit legacy migrations.
- Consolidate route parsing, canonicalization, and history restoration under one
  owner.
- Replace Gallery/Library/Collections peer tabs with Explore and You.
- Compose existing public sequence and public collection presentations beneath
  Explore.
- Compose existing personal sequences, visual galleries, video library, and
  collection management beneath You.
- Keep Collections as a dedicated Explore page and as a Sequence filter.
- Preserve Hall of Shame behind its specialized route/gate.
- Preserve global module and prop controls; do not redesign the app shell in
  this phase.
- Make creator profiles public-portfolio views for their owners as well as
  visitors; move all private management entry points to You.

**Exit gate**

- Every current Browse capability has one documented destination.
- All legacy and printed routes resolve correctly.
- No five-tab overflow is possible because Browse exposes two primary jobs.
- Guests can retrieve their local saves and explore public sequences and
  collections.

**Rollback**

- The new UI can be disabled while the versioned resolver continues accepting
  both old and new route vocabulary.

**Verification**

- Unit tests for state migrations and canonical routes.
- Browser back/forward and deep-link runtime proof.
- Accessibility and visual sweeps at 320, 360, 375, 412, tablet, 1440, 1920,
  2560, and 3840 widths.

### Phase 2: Immutable revision foundation

**Purpose:** make media-to-artifact relationships historically truthful.

**Implementation checkpoint (2026-08-22): complete**

- Added the shared content-addressed revision reference and retained immutable
  revisions for saved tunnels and public sequences.
- Updated media associations and upload flows to pin exact subject revisions;
  legacy links without evidence remain explicitly ambiguous.
- Applied the additive production migration for 564 public sequences and 9
  saved tunnels. The final dry run proposed zero writes and reported 7
  ambiguous legacy media associations for curator review.
- Verified the domain contracts, publication retention, Firestore rules, type
  surface, migration idempotence, and responsive Browse transition.

**Scope**

- Define the shared `ArtifactRevisionRef` and deterministic content-digest
  policy.
- Add immutable saved-tunnel revisions without replacing the stable tunnel work
  ID.
- Migrate current tunnel updates so a new publishable revision is created when
  content changes.
- Preserve existing tunnel-video links by resolving the referenced historical
  snapshot or blocking ambiguous links for curator review.
- Add immutable retained sequence revisions and idempotently create a baseline
  revision for every media-eligible existing public sequence.

**Exit gate**

- Editing a tunnel cannot change the payload rendered by an existing revision.
- Two revisions of one tunnel can be reconstructed independently.
- A realization association can name one immutable revision.
- A performance association can name one immutable sequence revision whose
  payload and digest remain reconstructible after later edits.
- Dry-run migration reports every ambiguous legacy link and never guesses.

**Verification**

- Domain tests for deterministic digests, revision creation, and reconstruction.
- Sequence baseline-revision and retained-history tests.
- Migration idempotence and ambiguity tests.
- Firestore emulator tests for owner-only private revisions.

### Phase 3: Public tunnel vertical slice

**Purpose:** prove the publication boundary with one complete visual type.

**Scope**

- Implement the shared public-artifact envelope.
- Implement the tunnel-specific public revision builder and public preview path.
- Add explicit publish, publish-new-revision, unpublish, and moderation flows.
- Add public tunnel discovery and detail under Explore > Visuals.
- Show published tunnel work on creator profiles using the same projection.
- Keep private tunnel drafts in You.

**Promotion prerequisite**

- Phase 0B establishes the approved-work, creator-diversity, concentration,
  preview-quality, report/takedown, and editorial-capacity thresholds before a
  public tunnel destination is exposed. Infrastructure may ship behind a flag
  before the destination earns promotion.

**Exit gate**

- Anonymous users can read approved public tunnel envelopes and revisions but
  cannot read private tunnel collections.
- Publishing and unpublishing converge across Explore, creator profiles, and
  You.
- An old public revision remains stable after a new revision is published.
- Moderation removal clears discovery without corrupting private authoring data.

**Verification**

- Projection-builder and content-digest tests.
- Firestore emulator matrix for guest, owner, unrelated user, moderator, and
  admin.
- Runtime publish/unpublish evidence and the full viewport sweep.

### Phase 4: Public media authority and curator reconciliation

**Purpose:** turn the hidden curator corpus into safe canonical media.

**Scope**

- Add a server-controlled, guest-readable `publicMedia` projection.
- Add a revocable delivery boundary that resolves opaque asset IDs to
  short-lived playback access and invalidates delivery on withdrawal.
- Validate subject existence, public revision, allowed relationship, uploader
  authority, consent state, and public association keys on the server.
- Build the curator review station around the existing dry-run reconciliation
  engine.
- Let a curator match an existing canonical record or create a private staged
  record, attach exact sequence/tunnel revisions, manage performer credits,
  detect duplicates, and resolve consent blockers.
- Enforce a separately approved per-performer consent, publication-authority,
  moderation, dispute, withdrawal, takedown, appeal, and audit state machine.
- Define explicit editorial media types before admitting subjectless footage.
- Replace the static landing list with canonical IDs after verified
  reconciliation; retire `showcaseVideos` only when parity is proven.
- Preserve the current private-byte warning until R2 delivery is authenticated
  or expiring.

**Exit gate**

- Anonymous Browse can read approved public media metadata and obtain
  short-lived playback access while approval remains active.
- Clients cannot forge a public association, approval, performer consent, or
  server-owned count.
- Every showcase record is ready, blocked with a reason, excluded, or migrated.
- Applying the migration twice produces no additional writes.
- Revocation disables new delivery, expires cached grants within the documented
  bound, and removes the public projection, counters, and landing references.

**Verification**

- Curator manifest tests for exact IDs, URL/storage duplicates, consent,
  unresolved subjects, and replay safety.
- Firestore and Functions emulator tests for all trust boundaries.
- Production dry run, reviewed apply manifest, apply, and zero-diff verification
  dry run.

### Phase 5A: Mandala publication adapter

**Purpose:** add mandalas without pretending their payload matches tunnels.

**Scope**

- Implement the mandala revision builder, schema, digest, preview generator,
  migration, and moderation flow.
- Give mandalas a deterministic public preview instead of copying no poster.
- Add Mandalas to Explore only after its contract, moderation, and calibrated
  supply gate pass.

**Promotion gate**

- Use the Phase 0B-calibrated supply, diversity, concentration, preview quality,
  reporting, and editorial-capacity thresholds.

**Verification**

- Type-specific projection and reconstruction tests.
- Document-size and preview-storage checks.
- Guest/rules matrix and visual sweep for each launched subtype.

### Phase 5B: Scene publication adapter

**Purpose:** publish versioned scenes on the 3D Studio's own stable contract.

**Scope**

- Freeze the scene schema version targeted by the adapter.
- Audit camera, environment, performers, effects, poster, optional choreography,
  lineage, and asset references for privacy and reconstructibility.
- Implement a scene-owned revision builder, digest, safe public payload, preview
  pipeline, migration, and moderation flow.
- Promote Scenes only after the adapter and the Phase 0B-calibrated gate pass.

Scene publication is not scheduled as a routine continuation of Mandalas. It
begins only when the in-flight 3D Studio schema is stable enough to govern.

**Verification**

- Scene-specific projection, reconstruction, document-size, storage, rules, and
  visual verification against the frozen schema version.

### Phase 6: Creator-follow discovery decision

**Purpose:** decide, with product evidence, whether following should produce a
creator roster, per-type filters, or a mixed feed.

**Scope**

- Write and approve a separate governing specification before creating any
  cross-type activity projection.
- Compare a creator roster, per-type `Following` filters, and a mixed activity
  feed using production behavior and pagination constraints.
- Keep collection subscriptions separate and surface them under You >
  Collections.
- Prohibit public media events until Phase 7 independently earns the performance
  archive and the canonical media-presentation rule is amended.

**Exit gate**

- One option is selected with evidence, or Following remains unchanged.
- If a feed is selected, its specification owns pagination, deduplication,
  balancing, removal, and empty states before implementation.

**Verification**

- Evidence report and approved follow-up specification.

### Phase 7: Performance archive decision and possible launch

**Purpose:** determine whether performance-first browsing has earned a durable
place in Explore.

**Required gates**

All Watch-retirement gates remain mandatory:

- at least three useful archive sections with six unique works each;
- at least eight participating creators;
- no creator supplies more than 40 percent of the visible catalog;
- at least eight new performances from four creators in the trailing 90 days;
- every visible item has a usable thumbnail, creator identity, typed subject or
  approved editorial type, duration, public projection, and consent metadata;
- reporting, moderation, takedown, retention, caption expectations, and private
  media delivery claims are documented and enforced.

**If the gates fail**

- Performances remain contextual on sequences, visual revisions, creator
  profiles, and the You video manager.
- Explore does not display a disabled, empty, or supply-poor category.

**If the gates pass**

- Add Explore > Performances as an editorial archive, not an infinite mixed
  feed.
- Candidate sections remain Featured, New performances, Same work/different
  performers, Mapped for practice, and Creator spotlight.
- Update canonical capability ownership to permit this public archive as the
  reviewed third media presentation.
- Keep generated animation visually and semantically distinct from human video.

**Verification**

- A checked-in gate report with production query evidence.
- Moderation, reporting, consent-revocation, and anonymous-read end-to-end tests.
- Accessibility and full viewport visual verification.

### Phase 8: Compatibility close-out and decommissioning

**Purpose:** remove only infrastructure proven obsolete.

**Scope**

- Verify route telemetry before deleting old UI vocabulary.
- Keep permanent redirect/resolver coverage for printed and external links.
- Retire `showcaseVideos` only after canonical and landing parity is proven.
- Remove obsolete unversioned navigation migration branches.
- Update architecture docs, canonical capability ownership, analytics taxonomy,
  screenshot targets, and operator runbooks.

**Exit gate**

- No unresolved media or route parity gaps.
- No production reads depend on retired collections.
- Legacy URL tests remain permanent even after old UI code is removed.
- A defined backup and rollback window has elapsed, and irreversible deletion
  has explicit approval.

## Security and moderation matrix

| Action                                   | Guest | Signed-in viewer | Owner/uploader    | Curator/moderator    | Server                   |
| ---------------------------------------- | ----- | ---------------- | ----------------- | -------------------- | ------------------------ |
| Read private artifact draft              | No    | No               | Yes               | Policy-limited       | Administrative only      |
| Read approved public envelope/revision   | Yes   | Yes              | Yes               | Yes                  | Yes                      |
| Request artifact publication             | No    | No               | Yes               | No                   | Validates/projects       |
| Write public artifact projection         | No    | No               | No                | Review decision only | Yes                      |
| Read private collaborative video record  | No    | Policy-limited   | Yes               | Policy-limited       | Yes                      |
| Read approved `publicMedia`              | Yes   | Yes              | Yes               | Yes                  | Yes                      |
| Attach public media to a public revision | No    | No               | Request only      | Review/approve       | Validates/projects       |
| Credit a performer                       | No    | No               | Proposed metadata | Review               | Projects approved credit |
| Submit performer consent evidence        | No    | No               | Request only      | Review per person    | Validates/projects       |
| Revoke approved media delivery           | No    | No               | Request only      | Approve/revoke       | Enforces immediately     |

Firestore rules are not filters. Every client query must prove the visibility
represented by its target projection. Public projections contain no private
labels, storage paths, collaborator rosters, invite data, or unpublished subject
identifiers.

## Analytics and decision evidence

Measure behavior without using engagement as a substitute for safety:

- Explore and You destination entries;
- content-category entries;
- collection card versus collection filter use;
- tunnel card-to-edit interaction count;
- visual publish, update, unpublish, report, and takedown rates;
- creator-follow scope use and empty-state rate;
- sequence performance badge opens;
- performance archive section depth and repeat use;
- reconciliation backlog by blocker reason;
- public catalog creator concentration and 90-day freshness.

Archive promotion uses the explicit Phase 7 gates, not a subjective impression
that the curator contains many videos.

## Migration and rollback rules

- Every data migration is dry-run-first and emits stable machine-readable output.
- Apply mode is explicit, idempotent, resumable, and followed by a zero-diff dry
  run.
- Ambiguous identity, consent, visibility, or duplicate state blocks a row.
- Public projections can be rebuilt from canonical private records plus approved
  moderation state.
- A phase rollback may hide a new presentation but must not delete revisions or
  break media associations created by that phase.
- No broad destructive cleanup occurs until Phase 8 parity evidence exists.

## Verification program

Each implementation plan selects the checks relevant to its phase, but the full
program includes:

- focused domain tests for routes, state versions, revisions, digests,
  associations, editorial types, consent, and projections;
- Firestore emulator matrices for guest, unrelated user, owner, collaborator,
  invite recipient, curator, moderator, admin, and server;
- Cloud Function retry, reordering, deletion, and idempotence tests;
- migration fixture, dry-run, apply, and verification tests;
- query/index tests proving rules-compatible pagination;
- legacy `/watch`, `/browse/gallery`, `/browse/library`,
  `/browse/collections`, and printed QR link tests;
- runtime proof for publish/unpublish, follow/unfollow, media playback,
  revocation, and browser history;
- reduced-motion, keyboard, focus, screen-reader label, and touch-target checks;
- visual verification at 320×568, 360×800, 375×667, 412×915, 960×412,
  820×1180, 1440×900, 1920×1080, 2560×1440, and 3840×2160.

No phase is called complete from a green build alone.

## Risks and responses

- **False public supply:** count only approved canonical public projections, not
  raw curator rows.
- **Historical mismatch:** immutable revisions and digest-pinned associations.
- **Private subject leakage:** server-built projections and visibility-proving
  queries.
- **Performer harm:** explicit consent authority, revocation, reporting, and
  takedown.
- **One-creator catalog:** release gates and concentration reporting.
- **Firestore document growth:** external preview assets, bounded envelopes, and
  type-specific payload sizing.
- **Feed starvation or domination:** server pagination and per-type balancing.
- **Navigation regressions:** versioned state, permanent route fixtures, and
  reversible presentation rollout.
- **You becomes a junk drawer:** domain-owned sections and contextual state,
  never one invented cross-type status model.
- **Collections lose meaning:** preserve collection-first cards, routes,
  metadata, sharing, following, and decks even when collections are also filters.
- **Shell churn spreads across modules:** Phase 1 preserves global controls; any
  later app-shell change requires its own cross-module spec.

## Non-goals

- Restoring Watch or rebuilding an infinite mixed feed.
- Making private visual drafts readable through user-profile paths.
- Treating a public video as permission to publish its subject.
- Treating performer credit as consent.
- Treating an empty subject association as a media category.
- Replacing collections with generated filters.
- Creating one universal artifact payload schema or renderer.
- Creating a client-owned mega-index of everything in You.
- Moving global module or prop controls as part of Browse IA cleanup.
- Promising authenticated private media bytes before the delivery layer provides
  them.
- Launching public Visuals, Following, or Performances merely because their
  schemas exist.

## Approval boundaries

This document approves no implementation by itself. Each phase receives a
focused implementation plan identifying exact files, indexes, rules, Functions,
migrations, tests, rollout evidence, and rollback switch. Phases 3 through 7
also require a production-data gate report before their public UI is enabled.
