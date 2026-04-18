# Short Code Snapshot Redesign — Design Spec

## Problem

The static snapshot failsafe in `ShortCodeManager` is designed to let printed QR codes keep resolving if Firebase is ever shut down. The infrastructure exists (`resolveFromStaticSnapshot()`, `scripts/export-static-snapshot.cjs`) but:

1. Snapshot files have never been generated or committed.
2. The first export run produces an 84 MB `shortcodes.json` for 4,966 codes (~17 KB/record) because each record inlines full `sequenceData`. That's repo-breaking and mobile-hostile.
3. Pointer-only snapshots (just `sequenceId`) would break transient sequences — ones created with `createOfflineCode()` or shared ad-hoc without ever being saved to a `sequences/` collection.

## The Insight

`SequenceEncoder.encodeForQR()` already produces self-contained, URL-safe strings that decode without Firebase:

- `s~r:<recipe>` — compositional encoding for LOOP sequences (16-beat rotated loop → ~4 beats + recipe, often under 200 chars)
- `s~z:<lz-compressed>` — flat LZString-compressed form for non-LOOP sequences

`ShortCodeManager.resolveShortCode()` at line 287 already detects the `s~` prefix and decodes locally. This is the mechanism we should exploit for the snapshot.

## The Design

### Record shape (new field)

Every `shortcodes/{code}` doc gains one field:

```ts
encoded: string  // "s~r:..." or "s~z:..." — pre-computed at write time
```

This field is the complete, decodable representation of the sequence. It captures everything needed for `decodeFromQR()` — no cross-collection references.

### Snapshot shape

The generated snapshot becomes lean:

```json
{
  "_meta": { "exportedAt": "...", "schemaVersion": 2, "documentCount": 4966 },
  "documents": [
    { "_id": "kGZ9Nj", "encoded": "s~r:sr:a3f2:..." },
    ...
  ]
}
```

Estimated size at 4,966 codes × ~250 bytes avg = **~1.2 MB** (compared to 84 MB).

### Resolver flow (in `ShortCodeManager.resolveShortCode`)

1. If code starts with `s~` → decode locally (unchanged).
2. Try Firestore — if hit, return.
3. If Firestore throws → load snapshot (cached once per session).
4. Look up `{code}` in the snapshot map.
5. If found, feed `record.encoded` to `sequenceEncoder.decodeFromQR()` and return.

The `hydrateFromRecord()` multi-strategy hydration (public index lookup, sequenceId fallback, inline `sequenceData`) remains the Firestore primary path but is bypassed entirely on the fallback. Snapshot records only need `encoded`.

### Schema version bump

The snapshot format changes (`schemaVersion: 1 → 2`). The resolver must tolerate both: detect v2 by the presence of `encoded` in the first document, fall back to inline `sequenceData` for v1. Once v2 is deployed and old snapshots are purged, v1 support can be removed.

## Implementation Phases

### Phase 1 — Write-time encoding (new codes get `encoded` for free)

Modify `ShortCodeManager.createShortCode()`:

- After building the record, call `await this.sequenceEncoder.encodeForQR(sequence)` and store the result as `encoded`.
- Every code created after this deploys is snapshot-ready.

**Files:** `ShortCodeManager.ts`, `IShortCodeManager.ts` (record type).

**Risk:** `encodeForQR` can fail for malformed sequences. Log and continue without `encoded` — the Firestore path still works.

### Phase 2 — Backfill script (existing 4,966 codes)

New script: `scripts/backfill-shortcode-encoded.cjs`

- Paginate `shortcodes` collection (cursor-based, 500/batch).
- For each doc lacking `encoded`: hydrate `sequenceData` → feed through encoder → `updateDoc` with `encoded` field.
- Idempotent (skip docs that already have the field).
- Progress logging: `[batch N] 500 processed, 12 skipped, 488 updated`.
- Uses `serviceAccountKey.json` like the export script.

**Edge cases:**
- Docs with `sequenceData` missing or malformed — log, skip, continue.
- Legacy docs with only `sequence` (word) and `sequenceId` but no `sequenceData` — must hydrate via `browseLoader.loadFullSequenceData()` first. May need to skip these in Phase 2 and handle in Phase 4.

### Phase 3 — Export script rewrite

Modify `scripts/export-static-snapshot.cjs`:

- Emit only `{_id, encoded}` pairs. Skip docs without `encoded` (log count).
- Bump `schemaVersion` to 2.
- `publicSequences.json` export stays unchanged — it's used for a different lookup (public gallery), not shortcode resolution.

**Output target:** `static/data/snapshots/shortcodes.json` (1-3 MB expected). Committable but bulky — see Phase 5 for R2 alternative.

### Phase 4 — Resolver update

Modify `ShortCodeManager.resolveFromStaticSnapshot()` + `hydrateFromRecord()`:

- Detect v2 by presence of `encoded`.
- New hydration path: if record has `encoded`, bypass multi-strategy hydration and call `sequenceEncoder.decodeFromQR(record.encoded)` directly.
- Keep v1 path for backward compatibility during rollout.

### Phase 5 — Scheduled Cloud Function

New file: `firebase-functions/src/snapshotShortCodes.ts`

- Trigger: `onSchedule("every sunday 03:00")` (pubsub v2).
- Reuses the export logic — extracted into a shared module so CLI and function share code.
- Writes output to **R2** (bucket: `tka-snapshots`, key: `shortcodes-v2.json`) — faster than committing to git and avoids repo bloat.
- Resolver fetches from the R2 public URL (`https://snapshots.tkaflowarts.com/shortcodes-v2.json` or a worker-routed URL).

**Durability ladder (from strongest to weakest):**

| Layer | Survives | Complexity |
|-------|----------|------------|
| Firestore | Normal operation | 0 |
| R2 snapshot | Firestore shutdown | Low |
| Git-committed snapshot | Firestore + R2 shutdown | High (auto-commit PR from function) |
| User's browser cache | All of above until cache clear | 0 (free) |

Default: R2. Austen can decide later whether to add a periodic git-commit tier for nuclear-grade durability.

## Open Questions

1. **R2 public URL**: does the project already have a public R2 bucket mapped to a domain? If not, we need to provision one, or use `firebase-hosted` static asset + manual upload.
2. **publicSequences**: should it get the same `encoded` treatment? Probably yes eventually — same pattern, same benefits. Not in scope for this spec.
3. **Cache invalidation**: client caches the snapshot in `staticSnapshotCache` for the session. That's fine for fallback use (rare) but if a user creates a new code and Firebase is simultaneously down, their brand-new code won't be in the cached snapshot. Acceptable edge case — the fallback is for catastrophic loss, not transient outages.

## Non-Goals

- Changing the short code alphabet, length, or generator.
- Changing the inline-encoded (`s~...`) URL format.
- Solving the collision window race condition (separate issue, see audit doc).

## Success Criteria

- [ ] `shortcodes.json` snapshot is < 5 MB for 5,000 codes.
- [ ] Every existing code has an `encoded` field.
- [ ] Every new code is written with `encoded` at creation time.
- [ ] Resolver successfully decodes a code from the snapshot when Firestore is blocked (verified via DevTools network throttle or temporary Firebase rules change).
- [ ] Scheduled function runs weekly and publishes an up-to-date snapshot to R2.

## Rollout Order

1. Phase 1 (write-time encoding) — safe to ship alone.
2. Phase 2 (backfill) — run once, manually.
3. Phase 3 + 4 (snapshot format + resolver) — ship together to avoid version skew.
4. Phase 5 (scheduled function) — last, once format is stable.
