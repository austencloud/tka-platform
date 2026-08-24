# Versioned Visual-Artifact Publication

**Date:** 2026-08-21  
**Status:** Proposed child specification  
**Parent:** `2026-08-21-browse-explore-you-public-contributions-design.md`

## Purpose

Let people publish tunnels, mandalas, and scenes without exposing private saved
collections or rewriting the historical subject of attached real-world media.

This work extends the existing public-sequence projection and save-path sync
conventions. It does not create a parallel generic publication system.

## Resource boundary

Each type has four distinct resources:

1. Private mutable working artifact.
2. Immutable revision with digest algorithm and version.
3. Owner/moderator-readable publication request and audit ledger.
4. Approved-only guest-readable public projection.

Pending, rejected, removed, disputed, and appealed records never appear in a
guest-readable projection. Public projection writers are server-controlled.

The shared envelope owns work identity, owner attribution, public title,
preview reference, current approved revision, schema version, and timestamps.
Each feature owns its payload builder, canonical serialization, digest policy,
preview creation, migration, and reconstruction.

## Phase 1: Revision foundation

- Retain a stable work ID and immutable revision IDs.
- Define canonical serialization, digest algorithm, and digest version.
- Record migration provenance and creation authority.
- Dual-write safely while old clients still update mutable documents.
- Resolve legacy tunnel-video subjects exactly or mark them ambiguous. Never
  infer an exact revision from a mutable latest document.

## Phase 2: Publication and withdrawal state machine

- Request publication from an owned private artifact.
- Review and approve through a private ledger.
- Project approved data to the guest-readable surface.
- Publish a new revision without mutating older revisions.
- Unpublish or remove discovery while preserving private authoring data.
- Define withdrawal cascades for previews and attached public media.

## Phase 3: Tunnel beta

Tunnels are the first adapter because real-world realizations need exact
revision identity now. The tunnel adapter owns steps, tunnel snapshot,
composition, lineage, and poster handling.

Phase 0B of the parent charter calibrates supply, creator diversity,
concentration, preview quality, report/takedown, and editorial-capacity gates.
The infrastructure may run behind a flag before a public Tunnels destination is
promoted.

## Phase 4: Mandala adapter

Mandala publication has its own canonical payload, including steps, hand
variant, prop types, path shape, and deterministic public preview. It ships and
passes its calibrated promotion gate independently.

## Phase 5: Scene adapter

Scene publication begins only after the 3D Studio schema is stable enough to
govern. Its adapter separately audits and versions camera, environment,
performers, effects, poster, optional choreography, lineage, and asset
references. Scene readiness is not inferred from tunnel or mandala readiness.

## Security invariants

- Saving is never publishing.
- Anonymous clients never traverse another user's private subcollections.
- A public media record does not publish its private subject.
- A public artifact does not publish attached private media.
- Clients cannot write approved projections or moderation outcomes.
- Public previews contain no private storage paths, collaborator data, or
  unpublished identifiers.

## Verification and exit gates

Each adapter requires:

- deterministic digest and reconstruction tests;
- migration dry-run, idempotence, ambiguity, and dual-write tests;
- Firestore emulator coverage for guest, owner, unrelated user, moderator, and
  server;
- document-size and preview-storage evidence;
- publish, revise, withdraw, remove, and rollback runtime proof;
- accessibility and the full viewport sweep before public promotion.
