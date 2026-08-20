# Watch Retirement and Performance Discovery

**Date:** 2026-08-20  
**Status:** Implemented locally; deployment, backfill, and visual verification pending

## Decision

Retire Watch as a top-level module. Performance video remains part of a
sequence, not a separate feed object:

```text
Sequence
  -> notation
  -> generated animation
  -> human performances (zero or more)
```

Browse owns discovery of sequences. The sequence viewer owns the presentation
of performances attached to a sequence. Creators owns discovery by person.
Browse > Library owns a user's saved work. Learn owns instructional video.

Old `/watch` links permanently redirect to `/browse/gallery`. The Watch name,
navigation entry, tabs, loaders, feature gate, voice destinations, screenshot
target, and feed implementation are removed.

## Why

The current feed has no distinct product job. It flattens generated sequence
animations and human performances into interchangeable posts, while the same
underlying work is already discoverable in Browse and the same performance
records already have a canonical per-sequence surface.

The production census taken on 2026-08-20 found seven public video records from
one creator, attached to six sequences. One was created in the preceding 30
days and two in the preceding 90 days. In contrast, the public sequence index
contained 563 sequences, with 519 owned by one account. That supply cannot
support a useful personalized or chronological feed without manufacturing the
appearance of community activity.

The MVP tracker requires video upload attached to sequences and playback from
Browse. It does not require a standalone Watch destination.

## Capability ownership

Discovery and playback reuse existing owners:

| Capability                                      | Owner                                                                     | Relationship                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Discover public work                            | `features/browse`                                                         | Reuse                                                               |
| Browse/upload/map performances for one sequence | `shared/sequence-viewer/components/sequence-videos/SequenceVideos.svelte` | Reuse                                                               |
| Reactive performance records for one sequence   | `shared/video-collaboration/state/sequence-videos-store.svelte.ts`        | Extend only when performance metadata changes                       |
| Create-module video presentation                | `shared/video-collaboration/components/VideosPanel.svelte`                | Keep as the documented second presentation backed by the same store |
| Choose upload visibility                        | Existing upload flows using `SegmentedControl`                            | Extend                                                              |

Search terms used before the decision: `performance video`, `collaborative
video`, `video gallery`, `upload a performance`, `visibility`, `privacy`,
`public`, `private`, `who can see`, and `SegmentedControl`.

No third performance list or public feed is introduced.

## Publishing contract

Publishing must be intentional:

- New videos default to **Private**, never Public.
- Both upload presentations show the same three choices before upload:
  Private, Collaborators, and Public.
- Copy says “visible in TKA” because Firestore protects discovery metadata but
  the current R2 delivery URL is public and unguessable, not authenticated.
- Firestore reads enforce the selected visibility. Rules are not filters, so
  sequence-video reads are split into public, creator, and collaborator queries
  whose constraints prove access.
- Unknown or missing visibility is treated as Private in client domain logic.
- The creator identity is immutable. Collaborators may update collaboration
  metadata and beat maps, but cannot publish the video or replace its media.

End-to-end private media requires authenticated or expiring GET delivery from
R2. Until that exists, no UI or policy may claim that the bytes themselves are
access-controlled.

## Information architecture after retirement

1. Browse Gallery finds a sequence.
2. Opening the sequence reveals its notation, animation, and any performances
   in one context.
3. Creator profiles remain the person-first path.
4. Browse Library remains the owner-first path for saved sequences and hosts a
   Performances shelf for uploads, collaborations, and invites.
5. Learn remains the home for tutorials.

Browse also exposes a **Performances** facet with two explicit choices: **Has
public performances** and **No public performances yet**. Sequence cards with
at least one public performance show a compact play-count badge. Both surfaces
read denormalized public-only metadata from `publicSequences`; Browse never
joins or probes the videos collection per card.

`publicPerformanceCount` and `latestPublicPerformanceAt` are server-owned. A
video-write trigger reconciles the old and new sequence whenever a public video
is created, deleted, relinked, published, or made restricted. A
public-sequence-create trigger covers performances uploaded before their
sequence was published. Reconciliation recomputes from authoritative videos in
one transaction snapshot, so retried and overlapping events converge rather
than drifting a counter.

Private and collaborators-only videos never contribute to either field. Rules
prevent client publication writes from forging or erasing the server-owned
metadata. Legacy public documents treat a missing count as zero until the
dry-run-first Admin backfill writes exact values to the full corpus.

## When a top-level performance destination is earned

A future destination is an editorial archive, not an infinite feed. Candidate
sections are Featured, New performances, Same sequence / different performers,
Mapped for practice, and Creator spotlight.

Do not expose it until all gates hold:

- at least three useful sections with six unique works each;
- at least eight participating creators;
- no creator supplies more than 40 percent of the visible catalog;
- at least eight new performances from four creators in the trailing 90 days;
- every featured item has a usable thumbnail, creator identity, sequence link,
  duration, and visibility metadata;
- reporting, moderation, consent, retention, caption expectations, and
  authenticated private-media delivery are documented and enforced.

## Implementation scope

1. Remove the standalone Watch module and all code used only by it.
2. Permanently redirect `/watch` and its former child paths to Browse Gallery.
3. Remove Watch from navigation, module loading, compile flags, voice routing,
   production visibility maps, and screenshot targets.
4. Move the existing personal performance library into Browse > Library so
   private uploads and collaboration invites remain reachable.
5. Default new performance records to Private and make visibility explicit in
   both existing upload presentations.
6. Enforce visibility in Firestore rules and align queries with those rules.
7. Add focused unit and emulator tests for the redirect contract, private
   defaults, reads, queries, and write boundaries.
8. Add the Performances Browse facet, public-only card badge, and filter-rule
   ownership mappings used by Gallery, Library, and smart collections.
9. Add idempotent server reconciliation, the supporting video index, and
   `scripts/migrations/backfill-public-performance-metadata.ts`.

## Verification

- SvelteKit route generation accepts the legacy redirect route.
- Focused Vitest tests prove Watch is absent and legacy IDs normalize to Browse.
- Video domain tests prove Private is the creation default.
- Firestore emulator tests prove public, creator, collaborator, pending-invite,
  query, and update boundaries.
- Focused Svelte/TypeScript diagnostics cover every changed source file.
- Projection, wire-schema, filter-composition, and Cloud Function tests prove
  public-only counts, legacy-zero behavior, retry-safe reconciliation, and
  preservation across sequence republishes.
- UI screenshots are required before calling the new visibility controls
  visually verified.
