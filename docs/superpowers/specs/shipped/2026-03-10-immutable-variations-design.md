# Immutable Variations via Content Hash

## Problem

When a user edits a saved sequence and re-saves, the current system overwrites the existing Firestore document. This is wrong — a sequence with different steps is a different variation and deserves its own document, ID, and birthday. The old variation should remain untouched in the user's library.

## Core Concept

A sequence's identity is its motion content. Two sequences with identical turn values, motion types, locations, positions, and orientations are the same variation — regardless of who created them or what they named them.

A **content hash** (SHA-256 of the motion-defining fields) serves as this identity. Same hash = same variation. Different hash = new document.

## Content Hash Inputs

### Sequence level
- `gridMode`
- `startPosition` (hand positions + orientations from start position motions)

### Per step
- `letter`, `blueReversal`, `redReversal`, `isBlank`, `duration`

### Per motion (blue/red)
- `motionType`, `rotationDirection`, `startLocation`, `endLocation`
- `turns`, `startOrientation`, `endOrientation`
- `handPath`, `gridMode`, `skewSteps`, `skewDir`

### Excluded (not part of identity)
- `id`, `name`, `displayName`, `author`, timestamps, thumbnails
- `tags`, `notes`, `visibility`, `isFavorite`, `isCircular`
- `propType`, `arrowLocation`, `arrowPlacementData`, `propPlacementData`
- `isSelected`, `isVisible`, render state

## Save-Time Behavior

In `LibraryRepository.saveSequence()`:

1. Compute `contentHash` of the incoming sequence
2. If existing doc found via `sequence.id`:
   - Existing hash matches → **metadata update** (visibility, notes, tags). Same document.
   - Existing hash differs → **new variation**:
     - Generate new ID (`crypto.randomUUID()`)
     - `birthday` = now, `_version` = 1
     - `forkAttribution` = `{ originalSequenceId, originalCreatorId, ... }` pointing to the parent
     - Save as new document. Old document untouched. User now has both in their library.
3. If no existing doc → new sequence (current behavior), compute and store hash.

## Model Changes

Add to `LibrarySequence`:
```typescript
readonly contentHash?: string;
```

Optional because legacy sequences won't have it. Computed on every save going forward.

## New Service

`SequenceContentHasher` — registered in DI.

```typescript
interface ISequenceContentHasher {
  computeHash(sequence: SequenceData): string;
}
```

Takes `SequenceData`, extracts only motion-defining fields in a deterministic order, serializes to a canonical JSON string, and returns a SHA-256 hex digest. The ordering is deterministic (steps by index, motions by color key sorted alphabetically).

## Lineage Tracking

Uses the existing `forkAttribution` field on `LibrarySequence`:
- `originalSequenceId` — the parent document ID
- `originalCreatorId` — the parent's owner
- `forkedAt` — when the variation was created

This creates a chain: if User B forks User A's sequence, then User C forks User B's variation, the `forkChain` array records the full lineage.

## What Doesn't Change

- `saveSequenceWithMetadata()` API — callers don't know about hashing
- `LibrarySaveService` orchestration — unchanged
- `createLibrarySequence()` — just gets a new optional `contentHash` field
- Public index sync — still handled by `LibraryRepository.saveSequence()`
- The "two save paths" unification from earlier today — this builds on it

## Edge Cases

- **User saves identical content twice**: Hash matches → metadata update, not a duplicate.
- **Legacy sequences without contentHash**: On first re-save, hash is computed and stored. If steps changed since original save, there's no old hash to compare — treat as new variation (safe default, since we can't know if content changed).
- **Start position changes only**: Hashed, so a different start position = different variation. Correct, because the same letters from a different start position produce different movement.
