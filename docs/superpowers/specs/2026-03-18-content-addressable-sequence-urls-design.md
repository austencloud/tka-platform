# Content-Addressable Sequence URLs

**Date:** 2026-03-18
**Status:** Approved (v2 — revised after spec review)
**Problem:** Shared sequence URLs use ambiguous word-based identifiers (`/sequence/LF?word=LF`). Multiple users can create different sequences with the same word, making these URLs non-deterministic. Additionally, when opening a shared URL, the viewer lacks the full library record needed for the "Creator's choice vs My settings" prop toggle.

---

## Solution

Two changes that work together:

1. **Self-contained encoded URLs only.** The copy-link button always produces a `z:` encoded URL containing the full motion data. No query params needed — the word is rederived from motion data via the existing `letterDeriver`, and creator metadata comes from the hash match.

2. **Encoder hash for library matching.** Compute a SHA-256 fingerprint of the URL encoder's deterministic pipe-delimited output. Store it on `publicSequences` documents as `encoderHash`. When someone opens an encoded URL, compute the same hash from the decompressed string and query for a match. If found, hydrate the viewer with the full library record (owner, intended props, effort timeline, etc.), enabling the prop switcher.

---

## URL Format

### Before

```
/sequence/LF?word=LF
```

Ambiguous. Word-based. Breaks when multiple sequences share the same word.

### After

```
/sequence/z:CoCkBEjA2oBh...
```

Self-contained. Deterministic. Every unique sequence of motions produces a unique URL. No query params.

### Backwards Compatibility

Old word-based URLs (`/sequence/LF`) still resolve via the existing `loadSequenceFromId` path. They are never generated going forward but continue to work for previously shared links.

---

## Why a New Hash Field (Not the Existing `contentHash`)

The codebase already has `SequenceContentHasher` (`features/library/services/implementations/SequenceContentHasher.ts`) which computes `contentHash` for deduplication during publish. It hashes a rich JSON structure including `handPath`, `letter`, `blueReversal`, `redReversal`, `duration`, `skewSteps`, `skewDir`, and `gridMode`.

**Problem:** The URL encoder (`SequenceEncoder.encode()`) doesn't preserve several of these fields — `handPath`, `letter`, reversals, skew data. A sequence decoded from a URL would produce a different `contentHash` than the saved version because the decoded data lacks these fields. Running the full derivation pipeline (letter deriver, reversal detector, hand path computation) on the decoded sequence is fragile and couples the read path to the entire creation pipeline.

**Solution:** A second hash field, `encoderHash`, computed from the URL encoder's pipe-delimited output. This format:
- Is already deterministic (fixed field order, fixed character mappings)
- Roundtrips perfectly: `encode(decode(str)) === str`
- Is available on both sides without additional derivation
- Captures all motion-defining fields the encoder preserves: locations, orientations, rotation direction, turns, motion type, prop type

The existing `contentHash` remains for deduplication (richer semantics, includes handPath/reversals). The new `encoderHash` is for URL-to-library matching (uses only URL-encodable fields).

### What About Prop Type?

The URL encoder includes prop type in its output. Two sequences with identical movements but different prop types produce different encoder hashes and different encoded URLs. This is correct — the prop type is part of the encoded data that the URL represents.

Note: `contentHash` intentionally excludes prop type (it's a viewer preference for dedup purposes). `encoderHash` includes it because it's part of the URL encoding. These serve different purposes.

---

## Encoder Hash Computation

```
SequenceData → SequenceEncoder.encode() → pipe-delimited string → SHA-256 → hex string
```

The pipe-delimited string looks like:
```
noeasioocx0paS:noeasioocx0paS|wesoiikc1pAS:eanoookc1pAS|...
```

SHA-256 via Web Crypto API. Zero dependencies. Native in all browsers. Output: 64-character hex string.

### On the Read Path (URL → Hash)

Even simpler — no need to decode and re-encode:

```
z:CoCkBEjA2oBh... → LZString decompress → pipe-delimited string → SHA-256 → hex string
```

The decompressed string IS the canonical form. Skip the decode/encode roundtrip entirely.

---

## Existing Infrastructure (Already Built)

The following already exists and this spec builds on top of it:

| Component | Location | Status |
|-----------|----------|--------|
| `SequenceContentHasher` | `features/library/services/implementations/` | Existing — computes `contentHash` for dedup |
| `contentHash` field on `publicSequences` | Firestore | Existing — written during publish |
| `PublicIndexSyncer` dedup query | `PublicIndexSyncer.ts:85-93` | Existing — queries by `contentHash` |
| `LibraryRepository` hash on save | `LibraryRepository.ts:264-266` | Existing — computes hash on every save |
| `SequenceEncoder.encode()` | `shared/navigation/services/implementations/` | Existing — deterministic pipe encoding |
| `SequenceEncoder.generateViewerURL()` | Same file | Existing — generates `/sequence/z:...` URLs |

**This spec adds only the read-path matching and the link generation fix.** The write path and hashing infrastructure are already in place.

---

## New Service: `ISequenceMatcher`

Handles background lookup and enrichment. Single new service for this feature.

### Interface

```typescript
// shared/sequence-viewer/services/contracts/ISequenceMatcher.ts
export interface SequenceMatchResult {
  matched: boolean;
  publicRecord: PublicSequenceIndex | null;
}

export interface ISequenceMatcher {
  findPublicMatch(sequence: SequenceData): Promise<SequenceMatchResult>;
}
```

### Implementation

```typescript
// shared/sequence-viewer/services/implementations/SequenceMatcher.ts
export class SequenceMatcher implements ISequenceMatcher {
  constructor(
    private encoder: ISequenceEncoder,
    private firestore: Firestore
  ) {}

  async findPublicMatch(sequence: SequenceData): Promise<SequenceMatchResult> {
    const pipeString = this.encoder.encode(sequence);
    const hash = await this.sha256(pipeString);

    const snap = await getDocs(
      query(
        collection(this.firestore, "publicSequences"),
        where("encoderHash", "==", hash),
        limit(1)
      )
    );

    if (snap.empty) {
      return { matched: false, publicRecord: null };
    }

    return {
      matched: true,
      publicRecord: snap.docs[0].data() as PublicSequenceRecord,
    };
  }

  private async sha256(input: string): Promise<string> {
    const buffer = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer), b =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }
}
```

### Error Handling

The background match is fire-and-forget. Wrapped in try/catch that silently fails. If Firestore is unreachable, offline, or the query errors, the viewer continues working from the decoded URL data alone. No degraded UX.

---

## Write Path Change

The write path already computes and stores `contentHash`. The only addition:

**When publishing to `publicSequences`, also compute and store `encoderHash`.**

In `PublicIndexSyncer.ts`, add alongside the existing `contentHash` write:

```typescript
const encoderHash = await this.computeEncoderHash(sequence);
// ... in the document write:
encoderHash: encoderHash,
```

The `computeEncoderHash` method uses `SequenceEncoder.encode()` → SHA-256, same as the read path.

---

## Read Path (Opening Shared URLs)

When someone opens a `/sequence/z:...` URL:

1. **Decode and render immediately** — existing flow, no change. The viewer shows the sequence from URL data alone.
2. **Background hash match** — fire-and-forget async. Compute `encoderHash` from the decoded sequence (or decompress the URL string directly). Query `publicSequences` where `encoderHash == hash`, limit 1.
3. **If match found** — enrich the viewer's sequence with `ownerId`, `ownerDisplayName`, `intendedProp`, `effortTimeline`, `createdAt`, etc.
4. **Viewer reacts** — PropSwitcher detects `intendedProp` and shows the "Creator's choice" toggle. Attribution displays creator name.
5. **If no match or error** — viewer works exactly as today. Pure encoded sequence, no toggle, no attribution. Silent failure.

This is progressive enhancement. The URL always works standalone. The library match adds richness when available.

---

## Link Generation Fix

### Current (`RouteViewerHeader.svelte`)

```typescript
// Takes sequenceId and sequenceWord as string props
function handleCopyLink() {
  const base = `${window.location.origin}/sequence/${sequenceId}`;
  // Copies whatever sequenceId is in the URL (often just the word)
}
```

### After

```typescript
// Takes full sequence: SequenceData prop (replacing sequenceId/sequenceWord)
function handleCopyLink() {
  if (!sequence) return;
  const encoder = container.items.sequenceEncoder;
  const { url } = encoder.generateViewerURL(sequence, { compress: true });
  navigator.clipboard.writeText(url);
}
```

**Props change:** `RouteViewerHeader` needs a `sequence: SequenceData` prop instead of `sequenceId: string` and `sequenceWord: string`. The parent `+page.svelte` already has the full sequence in scope.

---

## Files Changed

| File | Change |
|------|--------|
| **New:** `shared/sequence-viewer/services/contracts/ISequenceMatcher.ts` | Interface |
| **New:** `shared/sequence-viewer/services/implementations/SequenceMatcher.ts` | Firestore query + SHA-256 |
| `routes/sequence/[id]/RouteViewerHeader.svelte` | Props: `sequence` replaces `sequenceId`/`sequenceWord`. Copy-link generates encoded URL. |
| `routes/sequence/[id]/+page.svelte` | Pass `sequence` prop to header. Background hash match after decode. Enrich sequence on match. |
| `features/library/services/implementations/PublicIndexSyncer.ts` | Compute and store `encoderHash` alongside existing `contentHash` |
| `features/library/domain/models/PublicSequenceIndex.ts` | Add `encoderHash` field to type |
| DI container wiring | Register `SequenceMatcher` |
| **New:** `scripts/backfill-encoder-hash.cjs` | Migration: compute `encoderHash` for existing `publicSequences` docs |

---

## What Doesn't Change

- Drawer overlay flow (browse → viewer) — still uses handoff with full data
- QR codes — still work via short codes or `s~` inline encoding
- `/p/[code]` route — unchanged
- Private library storage — no new fields
- Existing `contentHash` — unchanged, still used for dedup
- `SequenceEncoder` — no changes, used as-is

---

## Edge Cases

### Same motions, different prop type
Different pipe-delimited encoding → different `encoderHash`. Correct — the URL distinguishes them.

### Same motions & prop type, different handPath/reversals
Same `encoderHash` (encoder doesn't capture those). Match found. The full public record is loaded which has the correct handPath/reversals. Correct — the URL matches the physical motion pattern.

### Sequence edited after sharing
The shared URL preserves the original motions. If the creator edits and re-saves, the public record gets a new `encoderHash`. Old URLs still decode and render correctly but won't match the updated public record. Correct — the shared link represents the version that was shared.

### Multiple public records with same encoderHash
Possible if two users independently created the exact same motion sequence with the same prop type. `limit(1)` returns one. Both are valid — the motions are identical. The viewer shows whichever matched first.

### Hash collision
SHA-256 collision probability: 2^-128 for birthday attack. Not a real concern.

### Offline / no network
Hash match silently fails. Viewer works from encoded data alone. No degraded experience.

### Sequences published before this change
No `encoderHash` field. The backfill migration script handles these. Until backfilled, old sequences won't be found via URL matching but everything else works.

---

## Migration Strategy

### Phase 1: Add `encoderHash` on new publishes
Update `PublicIndexSyncer` to compute and store `encoderHash`. All newly published sequences get both `contentHash` and `encoderHash`.

### Phase 2: Backfill existing records
Run `scripts/backfill-encoder-hash.cjs`. For each `publicSequences` doc without `encoderHash`:
1. Read the `sourceRef` field (points to the user's library doc, e.g., `users/{uid}/sequences/{id}`)
2. Fetch the source library document (which has full `steps` with motion data)
3. Run `SequenceEncoder.encode()` on the full sequence
4. SHA-256 the result
5. Write `encoderHash` back to the `publicSequences` document

Important: `publicSequences` docs do NOT store the `steps` array — they store thumbnails, metrics, and metadata. The encoder needs full motion data per step, so the backfill must resolve via `sourceRef` to the user's library doc.

Skip docs that already have `encoderHash`. Idempotent.

### Phase 3: Deploy read path + link generation
Update the sequence route with background matching and the new link generation. Works for any sequence with an `encoderHash` — new or backfilled.

---

## Firestore Index

The query `where("encoderHash", "==", hash)` uses a single-field equality filter. Firestore automatically indexes all top-level fields, so no composite index creation is needed.
