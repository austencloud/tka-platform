# Browse IA and Route Migration

**Date:** 2026-08-21  
**Status:** Proposed child specification  
**Parent:** `2026-08-21-browse-explore-you-public-contributions-design.md`

## Decision

Browse has two primary jobs:

```text
Browse
├─ Explore
│  ├─ Sequences (default)
│  ├─ Collections
│  └─ Visuals
└─ You
   ├─ Sequences
   ├─ Visuals
   ├─ Videos
   └─ Collections
```

Explore opens directly to Sequences. Collections remain first-class routed
objects, not merely filters. Visuals may initially contain only private work in
You; public subtypes appear only through the artifact-publication program.
Performances and Following are not approved destinations in this specification.

Creator profiles are public portfolios for every viewer, including the owner.
Private work, invitations, collaboration management, and publication controls
live only under You.

## Phase 0A: Tunnel editing relief

- Add or verify a stable saved-tunnel detail route.
- Put the existing Edit choreography handoff on the tunnel card or first detail
  surface.
- Reuse the canonical tunnel-to-viewer handoff.
- Verify no more than three deliberate interactions from another module on
  phone and desktop.

This phase is independent of the navigation migration.

## Phase 0B: Evidence manifest

Check in fixtures for:

- `/browse` and every existing Browse child;
- viewer return paths and query state;
- `/q/{code}` and `tka.run` printed QR entry;
- native and app scanner handoffs;
- `/browse/library/{collectionId}?scan=1`;
- public, shared, and owned collection details, including owner identity;
- URL-parameter policy;
- pending navigation intents;
- persisted Browse history and old schema values;
- signed-out and malformed-route behavior.

Production analytics establish existing destination use and tunnel-edit entry
friction. No route names change in this phase.

## Phase 1: One navigation owner

Consolidate Browse route parsing, canonicalization, history restoration, and
legacy migration under one owner. Remove competing authority from local
`BrowseModule` tab state and the current split between Browse state and the
global navigation coordinator.

Persisted state gains an explicit schema version. Migrations run once from known
prior versions and consider both route shape and stored schema version. A bare
string replacement is forbidden.

## Phase 2: Explore and You

- Replace Gallery, Library, and Collections as peer tabs with Explore and You.
- Compose current sequence discovery and public collection discovery beneath
  Explore.
- Compose existing personal stores beneath domain sections in You.
- Do not add a cross-type recent-work stream or mega-index.
- Preserve global module and prop controls.
- Preserve Hall of Shame behind its specialized age and moderation boundary.
- Make self-profile behavior public-only and move private management to You.

Guests keep on-device saved sequences and anonymous public discovery. Each
signed-in-only section presents a clear sign-in state.

## Canonical routes

```text
/browse                                  -> Explore > Sequences
/browse/explore                          -> Explore > Sequences
/browse/explore/sequences
/browse/explore/collections
/browse/explore/collections/{ownerId}/{collectionId}
/browse/explore/visuals/{type}
/browse/explore/visuals/{type}/{publicationId}
/browse/you
/browse/you/sequences
/browse/you/visuals/{type}
/browse/you/videos
/browse/you/collections
```

Legacy Gallery, Library, Collections, Watch, QR, scanner, and native entry
points remain explicit compatibility cases. Printed and external paths are not
removed during ordinary cleanup.

## Exit gate

- Every current Browse capability has exactly one documented destination.
- One owner parses and restores Browse navigation.
- All manifest routes pass direct-load, reload, back/forward, and signed-out
  tests.
- Self-profile and You no longer duplicate private-library behavior.
- The two-job shell works at 320, 360, 375, 412, tablet, 1440, 1920, 2560, and
  3840 widths with keyboard, screen reader, reduced motion, and touch targets.

## Rollback

The new presentation can be disabled while the versioned resolver continues to
accept old and new vocabulary. Compatibility removals require the separate
decommissioning specification.
