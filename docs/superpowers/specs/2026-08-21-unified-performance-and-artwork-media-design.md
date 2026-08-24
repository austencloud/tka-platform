# Unified Performance and Artwork Media

**Date:** 2026-08-21  
**Status:** Approved for implementation

## Decision

Keep Browse as the discovery surface and make video a shared media record that
can describe more than one kind of work.

```text
Video
  -> performers and collaborators
  -> visibility and editorial approval
  -> typed associations
       -> sequence / performance
       -> tunnel / realization
```

A sequence performance means that a person performed the notation. A tunnel
realization means that a real-world video depicts a saved, reconstructible
tunnel artwork. A tunnel may retain source-sequence lineage, but that lineage
does not turn its realization video into a sequence performance.

Watch remains retired. Sequence discovery stays in Browse, sequence video stays
in the sequence viewer, and tunnel realization video belongs with the saved
tunnel. A future editorial media archive may compose these records once the
supply gates in the Watch-retirement specification are met.

## Current-state findings

Production data is split across three representations:

1. `videos` is the canonical collaboration collection. Its legacy shape
   requires one `sequenceId` per video.
2. `showcaseVideos` is the landing curator's collection. It supports multiple
   `linkedSequences` and explicit performer credits, but uses separate
   `approved` and `featured` flags.
3. `src/routes/landing/landing-videos.ts` is a static editorial list containing
   a URL, performer label, and content label. It does not preserve sequence
   links.

The 2026-08-21 census found seven canonical public videos, four exact published
sequence matches, 142 showcase records, and 17 showcase records carrying
sequence links. None of those 17 linked showcase records was marked approved,
so no migration may infer public consent from the existence of a link.

The Browse Performances facet is contextual by design: its counts apply every
other active filter. With `Recently added` selected, zero means zero performed
sequences among sequences created in the last 30 days. The current wording does
not disclose that scope and reads like a global claim.

## Domain contract

### Media association

Each canonical video carries one or more typed associations:

```ts
type MediaAssociation =
  | {
      subjectType: "sequence";
      subjectId: string;
      relationship: "performance";
      subjectLabel?: string;
    }
  | {
      subjectType: "tunnel";
      subjectId: string;
      relationship: "realization";
      subjectLabel?: string;
      sourceSequenceId?: string;
    };
```

`associationKeys` denormalizes each subject as `<subjectType>:<subjectId>` for
Firestore `array-contains` queries. During migration, sequence videos retain
their legacy `sequenceId` so deployed clients and the public-performance
projection continue to work.

Performer credits are separate from collaborators. A collaborator can edit a
record without appearing in the footage; a credited performer can appear in
the footage without owning a TKA account.

### Public sequence projection

Only public associations whose relationship is `performance` contribute to a
sequence's `publicPerformanceCount`. Tunnel lineage and tunnel realizations do
not contribute. The existing server reconciliation remains the authority for
the public projection while compatibility `sequenceId` is present.

### Tunnel identity

Saved tunnels already have a stable collection ID, steps, a complete visual
snapshot, poster, and optional source-sequence lineage. Tunnel realization
records target that stable saved-tunnel ID. Publishing a tunnel as community
art requires a separate public projection and explicit visibility decision; a
private saved tunnel is never made public merely because a video is public.

## Browse experience

The Performances editor must disclose its scope:

- Heading: **Performances in these results**
- Values: **With a public performance** and **Without a public performance**
- Counts remain contextual.
- When another filter is active, each value also exposes the global count so a
  local zero cannot be mistaken for a catalog-wide zero.
- `Recently added` explicitly means recently added sequences.
- `Recently performed` is a separate sequence filter based on
  `latestPublicPerformanceAt`.

## Landing reconciliation

The migration is dry-run-first and emits a review manifest. For every
`showcaseVideos` record it reports:

- canonical match by source URL or storage path;
- linked sequence IDs and whether each resolves to `publicSequences`;
- performer credits;
- `approved`, `featured`, and exclusion state;
- the proposed associations;
- blockers such as missing consent, missing subject, or duplicate media.

Apply mode may write only rows whose public decision is explicit. Ambiguous
rows remain untouched. The static landing list becomes an editorial selection
over canonical IDs after reconciliation; it does not remain a third catalog.

## Implementation order

1. Correct Browse scope language and add recently-performed filtering.
2. Add the typed association and performer-credit domain contract while
   preserving legacy sequence compatibility.
3. Add subject queries and tunnel realization creation/upload support.
4. Add the reviewable showcase reconciliation migration.
5. Introduce a public tunnel projection before exposing tunnel realizations in
   community discovery.
6. Replace static landing records with canonical media references, then retire
   `showcaseVideos` after verification.

## Risks and boundaries

- **Consent:** landing exposure, Firestore `approved`, and canonical `public`
  visibility currently disagree. Migration never guesses.
- **Identity:** sequence words and legacy IDs are not interchangeable. Exact
  document IDs or a verified resolver are required.
- **Duplicates:** the same R2/Instagram asset may exist in both collections.
  URL/storage identity is reconciled before creation.
- **Versioning:** a realization targets the saved tunnel snapshot represented by
  that tunnel ID. Replacing the snapshot later must not silently rewrite what an
  older video depicted.
- **Private bytes:** the existing R2 caveat remains. Firestore visibility does
  not make a public CDN URL authenticated.

## Verification

- Unit tests cover association normalization, legacy hydration, performer
  credits, contextual/global Browse counts, and recently-performed dates.
- Cloud Function tests prove tunnel associations never increment sequence
  performance metadata.
- Migration tests prove dry-run output, exact-ID resolution, duplicate
  detection, consent blocking, and idempotent apply behavior.
- Firestore rules prove clients cannot forge server-owned performance counts
  and can query typed subjects only through visibility-proving queries.
- Browse is visually checked at 1920×1080, 2560×1440, 3840×2160, 1440×900,
  820×1180, 960×412, and 375×667.
