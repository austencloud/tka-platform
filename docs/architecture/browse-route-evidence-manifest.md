# Browse Route Evidence Manifest

**Captured:** 2026-08-22  
**Purpose:** Phase 0B baseline for the `Explore | You` migration  
**Scope:** Current route, QR, scanner, pending-intent, URL-parameter, return-path,
and persisted-history behavior. This document records evidence; it changes no
route.

## Current owners

Browse navigation currently has three authorities:

1. `BrowseModule.svelte` owns a local `activeTab`, mirrors global navigation,
   consumes pending intents, and mirrors Browse history.
2. `browse-navigation-state.svelte.ts` owns a second history stack and its
   localStorage persistence.
3. `navigation-coordinator.svelte.ts` parses URLs, rewrites legacy routes, and
   writes browser history.

Phase 1 must consolidate parsing, canonicalization, and restoration under one
owner. Adding another resolver beside these three is prohibited.

## Route and handoff matrix

| Entry                                       | Current behavior                                                                                  | Current source                                                                             | Regression evidence                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `/browse`                                   | Opens Browse; the first configured Browse section supplies the effective default                  | `navigation-coordinator.svelte.ts`, `tab-definitions.ts`                                   | Must become an explicit Explore > Sequences case                     |
| `/browse/gallery`                           | Opens public sequence discovery                                                                   | `BrowseModule.svelte`, `navigation-coordinator.svelte.ts`                                  | `watch-retirement-contract.test.ts`, scan/native tests               |
| `/browse/library`                           | Opens the viewer-relative Library                                                                 | `BrowseModule.svelte`, `browse-navigation-state.svelte.ts`                                 | URL-state, inbox-sheet, and viewer-return tests                      |
| `/browse/collections`                       | Opens community collection discovery                                                              | `BrowseModule.svelte`, `navigation-coordinator.svelte.ts`                                  | Current tab definitions plus direct-load fixture required in Phase 1 |
| `/browse/discover`                          | Rewrites to `/browse/collections`                                                                 | `navigation-coordinator.svelte.ts`                                                         | Phase 1 compatibility test required                                  |
| `/browse/community`                         | Rewrites to `/browse/collections`                                                                 | `navigation-coordinator.svelte.ts`                                                         | Phase 1 compatibility test required                                  |
| `/browse/library/{collectionId}?scan=1`     | Preserves the long path, opens the owned collection, and queues its scanner once                  | `navigation-coordinator.svelte.ts`, `BrowseModule.svelte`, `pending-scan-intent.svelte.ts` | `collection-scan-target.test.ts`, `url-parameter-policy.test.ts`     |
| `/browse/collections/{collectionId}?scan=1` | Rewrites the printed legacy path to `/browse/library/{collectionId}?scan=1`                       | `navigation-coordinator.svelte.ts`, `browse-navigation-state.svelte.ts`                    | `collection-scan-target.test.ts`                                     |
| `/watch` and `/watch/*`                     | Permanent redirect to `/browse/gallery`                                                           | `src/routes/watch/[...path]/+page.ts`                                                      | `watch-retirement-contract.test.ts`                                  |
| `/q/{code}`                                 | Resolves a printed sequence code in the scan experience                                           | `src/routes/q/[code]`                                                                      | QR, scan-cloud, offline, and viewer-shell tests                      |
| `tka.run/q/{code}` Open TKA                 | Builds an app bridge to `/browse/gallery` while preserving prop, card, and attribution parameters | `scan-app-handoff.ts`                                                                      | `scan-app-handoff.test.ts`, native deep-link tests                   |
| Sequence viewer return from public Browse   | Returns to `/browse/gallery`                                                                      | `browse-event-handler.ts`, `SequenceViewerPage.svelte`                                     | Viewer destination and navigation tests                              |
| Sequence viewer return from Library         | Returns to `/browse/library`                                                                      | `AllLibraryView.svelte`, `SmartCollectionDetailView.svelte`                                | Viewer destination tests                                             |
| Creator portfolio Archive handoff           | Queues a creator-gallery or own-library pending intent before switching modules                   | `pending-browse-intent.svelte.ts`, `BrowseModule.svelte`                                   | Pending-intent tests and Phase 1 runtime fixture                     |
| Art shelf handoff                           | Queues `art_tunnels`, `art_scenes`, or `art_mandala` into the Library detail pane                 | `pending-browse-intent.svelte.ts`, `MyCollectionsPanel.svelte`                             | Phase 1 runtime fixture required                                     |
| Shared collection handoff                   | Carries `ownerId + collectionId`; foreign ownership is stored in the pending intent               | `pending-browse-intent.svelte.ts`, `MyCollectionsPanel.svelte`                             | `collection-message-access.test.ts`                                  |

## Query-parameter policy

- `scan` is valid only beneath `/browse/library`.
- `fresh`, `from`, `code`, and `section` are one-request parameters and are
  removed on ordinary navigation.
- Viewer parameters such as `v`, `bp`, `rp`, and physical-card identity are
  preserved by the scan app bridge and resolved at the viewer boundary.
- Inbox and animation sheet parameters currently coexist with Library return
  paths and must survive the vocabulary migration.

The owner is `src/lib/shared/navigation/services/url-parameter-policy.ts`.

## Persisted-state fixture

Current storage key: `tka-browse-nav-state`.

Current payload has no schema version:

```json
{
  "history": [
    { "tab": "gallery", "view": "list" },
    { "tab": "library", "view": "detail", "contextId": "collection-id" },
    { "tab": "collections", "view": "list" }
  ],
  "currentIndex": 2
}
```

The current restore migration rewrites every stored `collections` tab to
`library`. Because `collections` is also a valid current tab, this is ambiguous
and cannot be safely extended. Phase 1 must introduce an explicit schema
version and fixtures for each known historical vocabulary:

- old personal `collections` plus public `discover`;
- transient public `community`;
- current `library` plus public `collections`;
- future `explore` plus `you`.

## Phase 1 proof obligations

- Direct load, reload, browser back/forward, malformed route, and signed-out
  behavior for every row above.
- Permanent compatibility for printed QR, scanner/native handoff, Watch, and
  external return paths.
- Owner-qualified public collection routes; a collection ID alone is not a
  cross-owner identity.
- One canonical route owner with no circular mirroring between local tab state,
  Browse history, and global navigation.
- A migration matrix that starts from captured payloads and proves idempotence.
