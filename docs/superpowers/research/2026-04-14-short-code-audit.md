# TKA Short Code System — Audit

> Ground-truth audit of the current `/p/[code]` short code system. Input for a future governance design spec. Not a spec itself.

## Generator

**Service:** `ShortCodeManager.createShortCode()` at `src/lib/shared/qr/services/implementations/ShortCodeManager.ts:126-229`

**Called by:** `QRCodeGenerator.generateForSequence()` (line 187-188), which is invoked from `ChoreoCard.svelte` when a sequence card is rendered/exported. **On-demand generation**, not precomputed for decks.

**Firestore collection:** `shortcodes`, with the 6-char code as the document ID.

**Record shape** (`ShortCodeManager.ts:183-212`):
- `sequence` — word/identifier
- `sequenceName` — display name
- `sequenceId` — optional
- `ownerId` — optional, absent for deck sequences
- `encoderHash` — optional, content-based dedup
- `createdAt`, `createdBy` (`"system"`), `scanCount`
- `sequenceData` — embedded full data for deck sequences only (survives Firebase outages)

## Alphabet and Length

**Length:** 6 characters (`const CODE_LENGTH = 6`)

**Alphabet:** Full Base62 — `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` (62 chars, **no filtering**)

**Generator:** Custom — `Math.floor(Math.random() * ALPHABET.length)` per character. Not nanoid.

**Space:** 62^6 ≈ 56.8 billion codes.

## Collision Handling

Read-verify-write loop (`ShortCodeManager.ts:174-226`):
- Generate code → `getDoc(docRef)` → if exists, retry
- Max 10 attempts, then throws `"Failed to generate unique short code after max attempts"`
- **No Firestore transaction** — race condition window exists between `getDoc` and `setDoc`. In practice the second writer overwrites the first (identical data + deterministic code), so no hard failure, but scan count could briefly reset.

## Case Sensitivity

**Case-sensitive.** `/p/AbCdEf` ≠ `/p/abcdef`.

Neither generator (line 83-89) nor resolver (`src/routes/p/[code]/+page.svelte:78`) normalizes. Firestore document IDs are case-sensitive by design.

## Visually-Ambiguous Characters

**Not filtered.** All confusable pairs present in the alphabet:
- `0` (zero) and `O` (capital O)
- `1` (one), `l` (lowercase L), `I` (capital I)
- `8` and `B`

**Risk for printed cards:** If the human-readable code is shown alongside the QR, users typing it by hand will hit this. No plan in code comments to address it.

## Deletion / Tombstone Behavior

**No cleanup.** `LibraryRepository.deleteSequence()` (line 674-730) deletes the sequence document but never touches `shortcodes`.

**Resolver behavior** (`src/routes/p/[code]/+page.svelte:368-442`): four hydration strategies (public index by word → sequenceId-as-word fallback → direct Firestore load via ownerId+sequenceId → embedded sequence data). If all four fail, returns `null` and shows **"Sequence Not Found"** at line 459.

Scan count continues incrementing on dead codes.

## Namespace

**Single global flat pool.** All codes (user sequences, deck sequences, offline codes) share the `shortcodes` collection. No prefix, no partition, no per-deck isolation.

**Two dedup strategies:**
- Content-based (`encoderHash`) — reuse a code for identical motion content regardless of word/owner
- Word-based — fallback for legacy sequences without steps

## Existing Volume

**Unknown from code alone.** Export script `scripts/export-static-snapshot.cjs` dumps the whole collection to `data/snapshots/shortcodes.json`, batched at 500 docs. Committed to git as a fallback archive in case Firebase goes down. No counts logged in the script output visible in the codebase.

**No bulk generator found.** No script pre-generates codes for deck enumeration or card batch printing — all codes are generated on-demand when a sequence's QR is first rendered.

## Summary Table

| Aspect | Finding |
|--------|---------|
| Generator | Custom PRNG, 6 Base62 chars, Firestore `shortcodes` |
| Alphabet | `0-9A-Za-z` (62, no filtering) |
| Collision check | Read-verify, max 10 retries, no transaction |
| Case handling | Case-sensitive, no normalization |
| Ambiguous chars | Present (0/O, 1/l/I, 8/B) |
| Deletion | No cleanup, no tombstone — resolver returns "Not Found" |
| Namespace | Global flat pool, no per-deck prefix |
| Volume | Unknown |

## Design Gaps to Address in Future Governance Spec

1. **Confusable characters** present but cards may show human-readable codes — high risk for print.
2. **Case sensitivity** — a user hand-typing `tka.app/p/ABC123` vs `abc123` fails silently. Strong candidate for case-insensitive normalization.
3. **Tombstone / "sequence removed" page** — printed QR codes are forever; `"Not Found"` is the wrong UX for a card someone paid for.
4. **Race condition** in collision check — low-frequency but real; should use `runTransaction` or a unique index pattern.
5. **Per-deck namespaces** or prefixes could help identify deck-origin codes and allow targeted tombstoning (e.g., "this deck was retired").
6. **Bulk pre-generation** — if decks go to print, codes should be reserved up-front and written to cards, not lazily generated on first render.
7. **Volume observability** — add a counter or admin query so the code space isn't mystery data.
