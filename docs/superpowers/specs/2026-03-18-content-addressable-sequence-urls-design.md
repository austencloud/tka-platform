# Content-Addressable Sequence URLs

**Date:** 2026-03-18
**Status:** Draft
**Problem:** Shared sequence URLs use ambiguous word-based identifiers (`/sequence/LF?word=LF`). Multiple users can create different sequences with the same word, making these URLs non-deterministic. Additionally, when opening a shared URL, the viewer lacks the full library record needed for the "Creator's choice vs My settings" prop toggle.

---

## Solution

Two changes that work together:

1. **Self-contained encoded URLs only.** The copy-link button always produces a `z:` encoded URL containing the full motion data. No query params needed — the word is rederived from motion data via the existing `letterDeriver`, and creator metadata comes from the hash match.

2. **Content hash for library matching.** Compute a SHA-256 fingerprint of each sequence's canonical motion data. Store it on `publicSequences` documents. When someone opens an encoded URL, compute the same hash and query for a match. If found, hydrate the viewer with the full library record (owner, intended props, effort timeline, etc.), enabling the prop switcher.

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

## Content Hash Architecture

### Hash Computation

```
SequenceData → SequenceEncoder.encode() → pipe-delimited string → SHA-256 → hex string
```

- `SequenceEncoder.encode()` already produces a deterministic canonical form: `startPos|step1|step2|...` where each motion is encoded as `startLoc+endLoc+startOrient+endOrient+rotDir+turns+type+propType`.
- Prop type is intentionally included in the encoding. Two sequences with identical movements but different prop types are distinct sequences.
- SHA-256 via Web Crypto API. Zero dependencies. Native in all browsers.
- Output: 64-character hex string.

### Hash Versioning

Each `publicSequences` document stores:
- `contentHash: string` — the SHA-256 hex
- `hashVersion: number` — currently `1`

If the encoding format changes (new fields, different serialization), bump the version. Queries filter on both fields.

### Why Not Strip Prop Type From Hash?

The same motion data with staves vs fans represents different creative intent. If a user saves an LF sequence with fans and another saves LF with staves, those are distinct sequences that should each be findable via their own hash.

---

## Write Path

When a user publishes a sequence to the public index (via `PublicIndexSyncer` or equivalent):

1. Compute `contentHash` using the new `ContentHasher` service
2. Write `contentHash` and `hashVersion` to the `publicSequences` document
3. No change to the user's private library document

### Backfill

A migration script iterates existing `publicSequences` documents, computes their hash, and writes it back. Runs incrementally — skip documents that already have a `contentHash`.

---

## Read Path

When someone opens a `/sequence/z:...` URL:

1. **Decode and render immediately** — existing flow, no change. The viewer shows the sequence from URL data alone.
2. **Background hash match** — after render, compute `contentHash` from the decoded sequence. Query `publicSequences` where `contentHash == hash && hashVersion == 1`, limit 1.
3. **If match found** — load the full public record. Enrich the viewer's sequence with `ownerId`, `ownerDisplayName`, `intendedProp`, `effortTimeline`, `createdAt`, etc.
4. **Viewer reacts** — PropSwitcher detects `intendedProp` and shows the "Creator's choice" toggle. Attribution displays creator name.
5. **If no match** — viewer works exactly as today. Pure encoded sequence, no toggle, no attribution.

This is progressive enhancement. The URL always works standalone. The library match adds richness.

---

## New Service: `IContentHasher`

### Interface

```typescript
// services/contracts/IContentHasher.ts
export interface IContentHasher {
  computeHash(sequence: SequenceData): Promise<string>;
}
```

### Implementation

```typescript
// services/implementations/ContentHasher.ts
export class ContentHasher implements IContentHasher {
  constructor(private encoder: ISequenceEncoder) {}

  async computeHash(sequence: SequenceData): Promise<string> {
    const canonical = this.encoder.encode(sequence);
    const encoded = new TextEncoder().encode(canonical);
    const buffer = await crypto.subtle.digest("SHA-256", encoded);
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
}
```

Single responsibility. Depends only on `ISequenceEncoder` (already in DI). Uses native Web Crypto. No npm dependencies.

---

## New Service: `ISequenceMatcher`

Handles the background lookup and enrichment logic, keeping it out of the route component.

### Interface

```typescript
// services/contracts/ISequenceMatcher.ts
export interface SequenceMatchResult {
  matched: boolean;
  publicRecord: PublicSequenceRecord | null;
}

export interface ISequenceMatcher {
  findMatch(sequence: SequenceData): Promise<SequenceMatchResult>;
}
```

### Implementation

```typescript
// services/implementations/SequenceMatcher.ts
export class SequenceMatcher implements ISequenceMatcher {
  constructor(
    private contentHasher: IContentHasher,
    private firestore: Firestore
  ) {}

  async findMatch(sequence: SequenceData): Promise<SequenceMatchResult> {
    const hash = await this.contentHasher.computeHash(sequence);
    const snap = await getDocs(
      query(
        collection(this.firestore, "publicSequences"),
        where("contentHash", "==", hash),
        where("hashVersion", "==", CURRENT_HASH_VERSION),
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
}
```

---

## Link Generation Fix

### Current (`RouteViewerHeader.svelte`)

```typescript
function handleCopyLink() {
  const base = `${window.location.origin}/sequence/${sequenceId}`;
  // Copies whatever sequenceId is in the URL (often just the word)
}
```

### After

```typescript
function handleCopyLink() {
  if (!sequence) return;
  const encoder = container.items.sequenceEncoder;
  const { url } = encoder.generateViewerURL(sequence, { compress: true });
  navigator.clipboard.writeText(url);
}
```

The button now always produces a self-contained `z:` URL regardless of how the user arrived at the viewer. No metadata params — word is rederived, creator comes from hash match.

---

## Files Changed

| File | Change |
|------|--------|
| **New:** `shared/content-hash/services/contracts/IContentHasher.ts` | Interface |
| **New:** `shared/content-hash/services/implementations/ContentHasher.ts` | SHA-256 hash |
| **New:** `shared/content-hash/services/contracts/ISequenceMatcher.ts` | Interface |
| **New:** `shared/content-hash/services/implementations/SequenceMatcher.ts` | Firestore query |
| **New:** `di/containers/content-hash-container.ts` | DI registration |
| `di/container-types.ts` | Add container type |
| `di/index.ts` | Wire container |
| `routes/sequence/[id]/RouteViewerHeader.svelte` | Encode URL on copy |
| `routes/sequence/[id]/+page.svelte` | Background hash match after decode |
| `PublicIndexSyncer.ts` (or publish path) | Compute hash on publish |
| **New:** `scripts/backfill-content-hash.cjs` | Migration script |

---

## What Doesn't Change

- Drawer overlay flow (browse → viewer) — still uses handoff with full data
- QR codes — still work via short codes or `s~` inline encoding
- `/p/[code]` route — unchanged
- Private library storage — no hash needed
- `SequenceEncoder` — no changes, used as-is for canonical form

---

## Edge Cases

### Same motions, different sequence length
Not possible — different number of steps means different pipe-delimited encoding means different hash.

### Sequence edited after sharing
The shared URL preserves the original motions. If the creator edits and re-saves, the public record gets a new `contentHash`. Old URLs still decode and render correctly but won't match the updated public record. This is correct behavior — the shared link represents the version that was shared.

### Multiple public records with same hash
Shouldn't happen if sequences are truly identical. If it does (e.g., two users independently created the exact same sequence), `limit(1)` returns one. The viewer shows whichever matched. Both are valid — the motions are identical.

### Hash collision
SHA-256 collision probability is 2^-256. Not a real concern. The heat death of the universe comes first.

### Offline / no network
Hash match silently fails. Viewer still works from encoded data alone. No degraded experience.

---

## Migration Strategy

### Phase 1: Add hash on new publishes
Deploy the write path. All newly published sequences get `contentHash`.

### Phase 2: Backfill existing records
Run `scripts/backfill-content-hash.cjs`. Reads each `publicSequences` doc, computes hash, writes back. Skip docs already hashed. Idempotent.

### Phase 3: Deploy read path
Update the sequence route to do background matching. Works for any sequence with a hash — new or backfilled.

### Phase 4: Update link generation
Deploy the RouteViewerHeader change. New share links are all `z:` encoded.
