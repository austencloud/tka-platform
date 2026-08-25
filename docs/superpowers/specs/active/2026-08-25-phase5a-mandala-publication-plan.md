# Phase 5A Implementation Plan — Mandala Publication Adapter

**Date:** 2026-08-25
**Parent charter:** `../2026-08-21-browse-explore-you-public-contributions-design.md`
**Governing child spec:** `../2026-08-21-versioned-visual-artifact-publication-design.md`
**Base state:** Phase 3 public tunnel vertical slice, commit `2cfa65b41e`.

Charter scope for this phase: _"Implement the mandala revision builder, schema,
digest, preview generator, migration, and moderation flow. Give mandalas a
deterministic public preview instead of copying no poster. Add Mandalas to
Explore only after its contract, moderation, and calibrated supply gate pass."_

## Capability ownership (primitive-discovery report)

Search terms used: `publishTunnel`, `artifactPublicationRequests`,
`artifactType`, `mandala-collection`, `mandala revision`, `poster`,
`exportMandalaPNG`, `renderMandalaToCanvas`, `listPublicArtifacts`,
`visualType`, `SegmentedControl`.

- **Extending** `shared/artifact-revisions`. Phase 3 left the publication batch,
  idempotency, and withdrawal inside `tunnel-publication-service.ts`. Mandala is
  the second use, which is the ownership decision point in `never-hand-roll.md`,
  so that behavior moved to
  `shared/artifact-revisions/services/artifact-publication-service.ts` and the
  tunnel service became a thin adapter over it. Two adapters, one publisher.
- **Reusing** the public boundary unchanged. `firestore.rules` was written
  type-generic in Phase 3 (`artifactType in ['tunnel', 'mandala', 'scene']`) and
  `public-artifact-loader.ts` is payload-agnostic. Neither needed an edit; the
  rules suite now proves that instead of assuming it.
- **Reusing** the admin moderation feed. `ArtifactPublicationQueuePanel` already
  renders whatever is live and labels it by type, so the mandala appears there
  with no change.
- **Extending** `mandala-export.ts` with `renderMandalaPosterDataUrl`, sharing
  its existing `calculateMandalaGeometry` + `renderMandalaToCanvas` path
  (factored out as a private `drawMandala`). No parallel mandala renderer.
- **Extending** `ExploreVisualsPanel.svelte` to be visual-type aware rather than
  adding a second Explore panel.
- **Creating** the mandala adapter files — private revision, public revision,
  repository, publication service, publication controls, detail preview — as the
  mandala feature's owned payload builders, which is exactly the adapter
  boundary the child spec defines.

## Design decisions

### The poster is derived at publish time, not baked into the digest

A tunnel's poster is authored at save time and rides _inside_ the digest: it is
part of what the owner saved. A mandala's image is a pure function of its
payload — the guest detail view redraws it from `steps`. Baking a rasterized
poster into the mandala digest would make two identical mandalas
content-address differently across browsers, because canvas rasterization is not
byte-stable across implementations. That breaks the "same content, same revision
id" invariant the whole publication boundary rests on.

So `MandalaPublicPayload` carries **no poster**. `publishArtifact` takes an
optional `posterDataUrl` thunk, called lazily and only when this revision has no
poster in Storage yet; the mandala adapter supplies one that renders a 512px
WebP from the payload's own geometry, stepping quality 0.85 → 0.70 → 0.55 until
it fits the 200KB Storage rule. The result lives only in Storage, referenced by
the envelope's `posterUrl`.

Consequence, visible in the shipped surface: the Explore **list** shows the
derived poster (cheap, cacheable, unfurlable) and the Explore **detail** shows
the live `SequenceMandala` render with its real undulation. Not a resized
thumbnail — the actual artwork.

### The public payload drops `sourceSequenceId`

Same rule Phase 3 applied to tunnels: an unpublished library identifier never
enters a guest projection. `sourceWord` survives because it is a label and is
already simplified. Provenance back to the exact private revision lives in the
ledger's `sourceRevision`, which only the owner and admins can read.

The private mandala revision digest keeps `source`, `sourceWord`, and
`sourceSequenceId`, so a mandala with lineage content-addresses differently in
private and public space. The unit suite asserts that divergence directly.

### Legacy mandalas baseline instead of failing

47 mandalas predate revisions. `load()` baselines any entry missing revision
metadata and re-saves it, exactly as the tunnel repository does. `publishMandala`
additionally baselines **in memory** via `sourceRevisionFor()`, so publishing a
stale in-flight entry cannot fail. The digest is a pure function of the payload,
so the in-memory stamp agrees with whatever the repository later writes.

### Curated defaults never show sharing controls

`MandalaModule` renders both persisted entries and curated defaults through one
render-shaped selection. The publication controls key off a `selectedCollected`
derived from the persisted collection, so a default resolves to `null` and no
sharing UI appears. Publication content-addresses a _saved_ payload, and a
default has nothing to address.

### Scenes are not in this phase

`ExploreVisualsPanel`'s type switcher lists only the types with a shipped
publication adapter (`PublishedVisualType`). Scenes (5B) stay unscheduled
pending 3D Studio schema stability, per the charter.

## Ledger

- [x] `CollectedMandala` carries revision metadata (`currentRevisionId`,
      `currentContentDigest`, `currentRevisionCreatedAt`,
      `revisionDigestAlgorithm`, `revisionDigestVersion`) plus schema
- [x] `mandala-revision.ts` — private revision payload, digest, prepare/reuse,
      `currentMandalaRevisionRef`
- [x] `mandala-public-revision.ts` — sanitized public payload + content address
- [x] `mandala-collection-repository.ts` — batched work doc + immutable
      revision, load-time baselining, digest/metadata agreement check
- [x] `mandala-collection-state` routed through the new repository
- [x] `renderMandalaPosterDataUrl` in `mandala-export.ts` (512px WebP, ≤200KB)
- [x] Generic `artifact-publication-service.ts` extracted; tunnel service reduced
      to an adapter with identical public API and behavior
- [x] `mandala-publication-service.ts` — publish / withdraw / status
- [x] `firestore.rules` — private `users/{uid}/mandala-collection/{id}/revisions`
      subcollection: content-addressed, immutable, admin-delete-only
- [x] `MandalaPublicationControls.svelte` in the mandala detail rail
- [x] `ExploreVisualsPanel` visual-type aware, Tunnels | Mandalas switcher
- [x] `MandalaDetailPreview.svelte` — live redraw, WCAG 2.2.2 pause control,
      reduced motion honored
- [x] Unit suite (16 tests) — digest determinism, private/public divergence,
      reuse-on-unchanged, sanitizer key set
- [x] Rules suite extended to 31 tests — mandala publish/read/withdraw, unknown
      artifact type denied, private revisions subcollection
- [x] `npm run check` — 0 errors, 0 warnings
- [x] `firestore.rules` deployed to `the-kinetic-alphabet`
- [x] Live verification: publish → Explore list → detail → withdraw → republish →
      admin feed, across 7 viewports
- [ ] Promotion of `exploreVisualsVisible()` past DEV — **Austen's decision**,
      deliberately untouched (charter Phase 0B supply gate)

## Verification evidence

| Check                            | Result                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `vitest` mandala revision suite  | 16/16 pass                                                                                                         |
| `npm run test:rules:artifacts`   | 31/31 pass (25 before this phase)                                                                                  |
| `npm run check`                  | 0 errors, 0 warnings                                                                                               |
| Rules deploy                     | released `firestore.rules` to `cloud.firestore`                                                                    |
| Publish round trip               | mandala ΩORZ live, poster served from Firebase Storage, 0 console errors                                            |
| Withdraw → republish             | status chip Public → Private → Public, clean both ways                                                             |
| Admin `/admin/publications`      | 3 live: 1 Mandala + 2 Tunnels, typed correctly                                                                     |
| Phase 3 regression               | Tunnels tab still lists both published tunnels; tunnel detail still mounts its canvas                              |
| Viewports                        | 1920 (4 col), 2560 (5), 3840 (5), 1440 (3), 820 (2), 960×412, 375 (1). No horizontal overflow at any width.        |

## Known finding, deliberately out of scope

At 4K@100% (3840 CSS px) the Explore Visuals chrome does not scale: the type
switcher stays 148px and card titles stay 14px in a 4267px client viewport, and
the content sits in a small island. This is **not** introduced by this phase.
Explore > Sequences next door shows the same fixed-size switcher and the same
fixed-size cards in the same dead space at the same viewport — verified by direct
comparison. The Browse app shell is not on the root ramp that
`4k-native-layout.md` governs for public pages. Fixing it is a Browse-wide
app-shell change, and fixing it only in this panel would make it inconsistent
with every sibling surface. Flagged for a Browse-wide 4K pass, not patched here.

## Rollback

The mandala side is additive. To back it out: revert the mandala feature files
and the `ExploreVisualsPanel` / `MandalaDetailPreview` pair, then drop the
`mandala-collection/{id}/revisions` block from `firestore.rules`. The generic
`artifact-publication-service.ts` extraction is behavior-preserving for tunnels
and can stay — the tunnel adapter's public API is unchanged (`publishTunnel`,
`withdrawTunnelPublication`, `getTunnelPublicationStatus`, `PublishTunnelResult`,
`TunnelPublicationStatus`, `PublicationOwner`). Already published mandalas remain
readable; `removed` is terminal and no rules change is needed to leave them
alone.
