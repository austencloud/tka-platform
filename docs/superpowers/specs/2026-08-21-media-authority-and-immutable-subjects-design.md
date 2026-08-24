# Media Authority and Immutable Subjects

**Date:** 2026-08-21  
**Status:** Proposed child specification  
**Parent:** `2026-08-21-browse-explore-you-public-contributions-design.md`

## Purpose

Reconcile the curator corpus into canonical media that can be attached to exact
sequence or visual-work revisions, viewed anonymously, and actually revoked.

This specification does not approve a public performance archive. Approved
media remains contextual on its subject, creator portfolio, landing placement,
and private You management until the archive gates pass.

## Phase 1: Immutable sequence subjects

`publicSequences/{sequenceId}` may remain the latest discovery projection.
Media uses `sequenceRevisions/{revisionId}` or an equivalent immutable subject
store containing:

- stable sequence ID and immutable revision ID;
- canonical sequence payload;
- deterministic content digest, algorithm, and version;
- source/provenance and creation time;
- publication state needed to validate a public association.

An idempotent migration creates an explicit baseline revision for existing
media-eligible public sequences. Historical video rows that cannot be tied to
an exact revision remain unresolved and cannot be advertised as exact
performances.

## Phase 2: Publication authority and consent

Media publication has a private audited state machine:

```text
draft -> identity review -> subject review -> consent review
      -> moderation approval -> published
      -> disputed | withdrawn | removed -> appeal/review
```

Each depicted person has a separate consent record containing identity,
authorized scope, evidence, recorder authority, recorded time, expiry where
applicable, decision state, and audit history. Credit is never treated as
consent. Uploader ownership is never treated as consent for another performer.
Minors require a separately approved policy before publication.

Subject authority validates that the associated revision exists and was public
at approval. The policy explicitly defines what happens when its subject is
later unpublished.

## Phase 3: Revocable delivery

Canonical media stores its delivery asset identity privately. The
guest-readable projection exposes an opaque `deliveryAssetId`, not a permanent
R2 origin URL.

Playback resolves through a revocable endpoint or short-lived signed URL only
while the approved projection remains active. The delivery contract defines:

- maximum grant and cache duration;
- withdrawal and takedown timing;
- derivative and thumbnail invalidation;
- embed behavior;
- the difference between delisting and access revocation;
- retention of private canonical metadata and bytes.

## Phase 4: Public projection

Only a server process can create approved `publicMedia`. It validates immutable
subject revision, allowed relationship, publication authority, per-performer
consent, moderation state, public association keys, and revocable delivery.

Subjectless footage requires an explicitly approved editorial kind. Missing
subject information is never used as an implicit category.

## Phase 5: Curator reconciliation

- Inventory canonical videos, showcase records, landing entries, storage
  objects, associations, creators, performers, and recency.
- Match exact canonical records or create private staged records.
- Detect URL, storage-key, and semantic duplicates.
- Attach exact revisions only.
- Block unresolved identity, consent, subject, visibility, or duplicate state.
- Apply only a reviewed machine-readable manifest.
- Repeat the dry run after apply and require zero additional writes.
- Retire static landing references and `showcaseVideos` only after parity.

## Exit gate

- Anonymous users can read approved metadata and obtain bounded playback access.
- A client cannot forge approval, association, consent, delivery, or counts.
- Withdrawal disables delivery within the documented bound and removes public
  metadata, landing references, and subject counters.
- Every curator row is migrated, intentionally excluded, or blocked with a
  reason.
- Firestore/Functions emulator tests and production dry-run evidence cover all
  trust boundaries.
