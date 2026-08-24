# Browse Program Decommissioning

**Date:** 2026-08-21  
**Status:** Deferred irreversible gate  
**Parent:** `2026-08-21-browse-explore-you-public-contributions-design.md`

## Purpose

Remove compatibility infrastructure only after replacement behavior is proven
in production. This is the only workstream allowed to delete legacy Browse or
media paths.

## Prerequisites

- Route telemetry shows no unexplained dependency on retired UI vocabulary.
- Canonical media, landing placement, and curator-source parity are proven.
- No production reader depends on a retired collection or schema.
- Dry-run migration reports are clean and archived.
- A recoverable backup exists and the rollback window is documented.

## Permanent compatibility

Printed QR, `tka.run`, scanner/native handoff, shared collection, and external
deep-link tests remain even after old UI code is removed. Permanent resolvers
are not considered dead code merely because the current interface no longer
emits their paths.

## Irreversible approval gate

Feature flags and dual reads may be rolled back before this phase. Data and
route deletion cannot. Each destructive target therefore requires:

- an exact inventory;
- telemetry and parity evidence;
- backup and restore proof;
- an elapsed rollback window;
- explicit approval naming the collection, schema, resolver, or code path.

## Close-out

Update architecture docs, canonical capability ownership, analytics taxonomy,
screenshot targets, operator runbooks, and migration ledgers. Keep a final
machine-readable record of removed resources and preserved compatibility
routes.
