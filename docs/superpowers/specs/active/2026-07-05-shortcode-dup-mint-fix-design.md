# Shortcode Duplicate-Mint Fix — Design

**Date:** 2026-07-05
**Status:** Approved approach (C) — spec for implementation
**Problem owner:** Austen (reported: same sequence showed two different short codes in two browsers)

## Problem

One page view of the sequence viewer mints **two** shortcode docs for the same sequence.
Verified live for sequence `B5N5`: docs `WY1Q` (19:11:31.161Z) and `57C4` (19:11:31.162Z),
identical `encoderHash`, 1ms apart, shapes matching the two call sites.

Full-collection audit (2026-07-05, `scripts/tmp-dup-shortcode-audit.mjs`):

- 18,276 docs, 17,142 distinct hashes, **1,044 duplicate groups** (995 pairs, 16 triples, 33 quads)
- Spread: 974 groups ≤10ms, 56 ≤1s, 14 ≤1min, **0 >1h** → cross-session dedup works; the
  entire dup population is the intra-page race
- 41 groups have a scanned code; 3 groups have 2+ scanned codes

## Root cause (three layers, all `src/lib/shared/qr/services/short-code-manager.ts`)

1. **Single-flight defeated by its own key.** `inflightByKey` (commit `d0d906c016`,
   2026-04-19) was built to stop `SequenceViewerOverlayState` + `QRCodeGenerator` racing —
   but its key includes `embedScope` (`embed:` vs `lean:`). Those two callers use different
   embed flags, so they never share a promise. Both run `findExistingCodeByHash`
   concurrently, both see null, both allocate.
2. **Persistent cache fragmentied by options.** Cache key includes `bp`/`rp`/`vm`, which
   differ between the two callers, so the cache can't unify them either.
3. **No atomic invariant.** `runTransaction` only guards the random code's doc path.
   One-code-per-hash is enforced only by a pre-check query both racers pass before either
   writes. With duplicates present, `findExistingCodeByHash` returns `docs[0]` with no
   ordering → different clients converge on different codes (the two-browsers symptom).

## Design

Two invariants, made structural:

- **I1 (allocation):** at most one shortcode is ever minted per `encoderHash`.
- **I2 (display):** every client resolves the same code for the same hash, forever.

### 1. Same-tab: single-flight keyed by bare hash; URL built per caller

Split allocation from URL shaping:

- `createShortCode` computes hash (unchanged), then awaits a single-flighted
  `allocateCode(sequence, options, hash, fallbackId): Promise<{ code, isNew }>` keyed by
  **bare `hash` (or `w:{fallbackId}`)** — no `embedScope`, no options.
- Each caller builds its own URL from its own options after the shared promise resolves
  (`buildUrlWithOptions` already exists). The old "different embed flags must not share a
  promise" concern collapses: the shared result is the code, not the doc/url.
- **Doc record shape = winning caller's options.** If the embed caller wins, the doc lacks
  `bluePropType`/`redPropType` (URL still carries them); if the lean caller wins, the doc
  lacks embedded `sequenceData`. Accepted: the `encoded` blob is ALWAYS written when steps
  exist and is Strategy 0 of resolution — embedded `sequenceData` and prop fields are
  redundant fallbacks. This is identical to today's behavior on every cross-session
  dedup hit (existing code returned regardless of requested shape).

### 2. Cross-device: transactional hash→code index

New collection: **`shortcodeHashes/{encoderHash}`** with `{ code: string, createdAt: string }`.

Allocation transaction (inside the existing collision-retry loop):

```
tx.get(shortcodeHashes/{hash})
  → exists: return { code: indexDoc.code, isNew: false }   // another writer won
tx.get(shortcodes/{candidateCode})
  → exists: __CODE_COLLISION__ retry (unchanged)
tx.set(shortcodes/{candidateCode}, record)
tx.set(shortcodeHashes/{hash}, { code: candidateCode, createdAt })
```

Two clients racing: both read a nonexistent index doc, both try to write it → Firestore
serializable transactions force the loser to retry → re-read sees the winner → loser
returns the winner's code. **I1 holds with zero backfill required** — index docs appear
lazily; the legacy pre-check query remains as fallback for pre-index docs.

Word-fallback sequences (no steps → no hash) keep the existing word-query dedup and get
no index doc. Rare legacy path, unchanged.

### 3. Deterministic legacy pick + lazy healing

`findExistingCodeByHash`:

- fetch all matches (groups are ≤4), pick **oldest `createdAt`** client-side (no composite
  index needed)
- on hit, best-effort write the index doc pointing at that code (catch + warn on
  permission failure — healing must never block returning the code)

This makes I2 hold even for the 1,044 legacy dup groups before cleanup runs.

### 4. Cache: code-only values, hash-only keys, schema bump

`short-code-cache.ts`:

- `SHORT_CODE_CACHE_SCHEMA` `"v1"` → `"v2"` (old keys orphan, LRU-pruned; flushes every
  browser's divergent cached codes)
- `ShortCodeCacheValue` becomes `{ code: string }` — URL is derived per caller at read
  time. `buildCacheKey` drops the `bp`/`rp`/`vm` discriminants (key = schema + hash-or-word).
- `resolveCodesForDeck` updated to match: dedupe query results by oldest `createdAt` per
  hash (currently first-iteration-order wins), cache code only.

### 5. Security rules

`firestore.rules`:

```
// Content-addressed index: one shortcode per encoderHash (see 2026-07-05 dup-mint spec).
// Immutable after create — first writer wins; the allocation transaction depends on it.
match /shortcodeHashes/{hash} {
  allow read: if true;
  allow create: if isFullUser()
    && request.resource.data.keys().hasOnly(['code', 'createdAt'])
    && request.resource.data.code is string
    && request.resource.data.code.size() >= 4
    && request.resource.data.code.size() <= 6;
  allow update, delete: if isAdmin();
}
```

**Deploy ordering constraint:** rules MUST deploy before the app code ships. The index
write happens inside the allocation transaction — permission-denied fails the whole
transaction and breaks shortcode creation. Sequence: deploy rules → verify with
`firebase_validate_security_rules` → ship app. Note: deploying `firestore.rules` also
ships whatever else sits in the committed file (Library module rules deploy was pending
as of 2026-07-02) — diff against deployed rules before pushing.

### 6. Cleanup / backfill (admin script)

`scripts/backfill-shortcode-hash-index.mjs` (admin SDK, bypasses rules):

- group all shortcode docs by `encoderHash` (reuse audit-script logic)
- canonical per group = **oldest `createdAt`**
- write `shortcodeHashes/{hash} = { code, createdAt, backfilled: true }` in batches of 500
- idempotent: skip hashes whose index doc already exists
- **never deletes anything** — dup shortcode docs stay resolvable forever (printed cards
  may carry any of them; 41 groups already have scans)
- skip scan-count merging (3 groups affected, historical, not worth the complexity)

~17k writes, one-shot. After it runs, the legacy fallback query is cold-path only.

## What does NOT change

- `resolveShortCode` / `resolveForImport` / hydration strategies — every existing code,
  duplicate or not, resolves exactly as before
- Code alphabet, length tiers, collision-retry behavior
- Word-fallback (`findExistingCode`) dedup for step-less sequences
- `ShortCodeManager` constructor / composition root wiring

## Error handling

- Index-doc read/write failures inside the transaction → transaction throws → caller's
  existing error path (same as today's tx failures). No silent fallback that could mint
  a duplicate.
- Lazy-heal index writes (legacy path) and cache writes stay best-effort:
  catch + `console.warn`, never block returning the code.
- `resolveCodesForDeck` remains never-throw (deck render must not block).

## Testing

- **Unit (new), `__tests__/short-code-manager.test.ts`:** with mocked Firestore —
  1. two concurrent `createShortCode` calls, different options (`{embedSequenceData:true}`
     vs `{bluePropType,redPropType}`) → same code, exactly one doc write (the regression
     test for this bug)
  2. `findExistingCodeByHash` with multiple matches → oldest `createdAt` wins
  3. allocation when index doc already exists → returns indexed code, no new doc
- **Existing:** `short-code-cache.test.ts` updated for `{ code }` value shape;
  `resolve-for-import.test.ts` untouched (resolution unchanged).
- **Live verification:** after rules deploy + implementation — open a fresh sequence in
  the viewer (both call sites fire), then admin-query `shortcodes` by that hash: exactly
  one doc + one index doc. Open in second browser: same code displayed. Re-run
  `tmp-dup-shortcode-audit.mjs` after backfill: index coverage complete, dup-group count
  frozen at legacy baseline.

## Rollout order

1. Implement + unit tests green
2. Deploy `firestore.rules` (verify diff vs currently-deployed first)
3. Ship app code
4. Run backfill script
5. Re-run audit script → confirm no NEW dup groups form (createdAt after ship date)

## Files

| File | Change |
|---|---|
| `src/lib/shared/qr/services/short-code-manager.ts` | single-flight by bare hash; allocation tx with index doc; deterministic oldest pick + lazy heal; URL per caller |
| `src/lib/shared/qr/services/short-code-cache.ts` | schema v2; `{code}`-only values (`ShortCodeCacheValue` lives here; `types.ts` untouched) |
| `firestore.rules` | `shortcodeHashes/{hash}` block |
| `scripts/backfill-shortcode-hash-index.mjs` | new admin backfill (from audit script) |
| `src/lib/shared/qr/services/__tests__/short-code-manager.test.ts` | new race/determinism tests |
