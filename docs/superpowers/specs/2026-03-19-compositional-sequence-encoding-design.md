# Compositional Sequence Encoding

**Date:** 2026-03-19
**Status:** Draft

## Problem

QR codes on choreo cards encode the full sequence data (all 16 beats for a quartered rotation). This produces dense QR codes that may be difficult to scan, especially when printed small on physical cards. But most sequences are compositional — they're a short seed pattern with a transformation applied repeatedly. The program already knows how to apply these transformations. The QR code should encode the recipe, not the dish.

## Insight

A 16-beat quartered rotated sequence like ΩNZI is really 4 beats + "apply 90-degree rotation 3 more times." The `StrictRotatedExecutor.executeLOOP()` already reconstructs the full sequence from a seed deterministically. The `LOOPDetector` already identifies which transformation was used. All the infrastructure exists — we just need to connect it to the encoding pipeline.

## Design

### Encoding Format

```
Flat (current):   s~z:{all beats compressed}           ~200 chars
Recipe (new):     s~r:{loopType}:{hash}:{seed compressed}  ~60-80 chars
```

- `s~` prefix: inline-encoded sequence (existing convention, handled by ShortCodeManager)
- `r:` prefix (after `s~`): signals "recipe" encoding — decoder must reconstruct
- `{loopType}`: compact tag identifying the transformation (e.g., `sr` = rotated, `sm` = mirrored)
- `{hash}`: 8-character truncated SHA-256 of the full flat encoding. Verifies reconstruction correctness at decode time.
- `{seed compressed}`: only the seed beats (e.g., 4 beats for quartered, 8 for halved), LZString compressed

### Loop Type Tags

| Tag | LOOPType | Slice | Seed Size (16-beat) |
|-----|----------|-------|---------------------|
| `sr` | ROTATED | quartered | 4 beats |
| `sm` | MIRRORED | halved | 8 beats |
| `sf` | FLIPPED | halved | 8 beats |
| `ss` | SWAPPED | halved | 8 beats |
| `si` | INVERTED | halved | 8 beats |
| `rw` | REWOUND | halved | 8 beats |

Compound patterns (rotated_inverted, mirrored_swapped, etc.) are future work. For now, only single-transform LOOPs qualify for recipe encoding.

### Encode Flow

```
1. Receive sequence for QR generation
2. Run LOOPDetector.detectLOOPType(steps)
3. If no pattern detected or confidence < "strict" → fall back to flat encoding
4. Extract seed beats (first N steps based on sliceSize)
5. Reconstruct from seed using the appropriate executor
6. Compare reconstructed steps to original (field-by-field)
7. If mismatch → fall back to flat encoding (round-trip failed)
8. Compute SHA-256 hash of flat encoding (the full sequence encoded normally)
9. Truncate hash to 8 characters
10. Encode: "s~r:{tag}:{hash}:{seed compressed}"
```

Step 6 is the critical safety net. If the executor can't perfectly reproduce the original from the seed, the recipe is wrong and we don't use it. The user gets a slightly denser QR code (flat encoding) but never a wrong sequence.

### Decode Flow

```
1. Receive encoded string starting with "s~r:"
2. Parse tag, hash, and compressed seed
3. Decompress seed beats
4. Look up executor for the tag (sr → StrictRotatedExecutor with QUARTERED)
5. Reconstruct full sequence from seed
6. Compute SHA-256 hash of the reconstructed flat encoding
7. Compare to stored hash
8. If match → return reconstructed sequence
9. If mismatch → return error (corrupted recipe)
```

Step 7 catches corruption that happened after encoding — URL truncation, character encoding bugs, bit rot on printed cards scanned years later.

### Size Impact

For a 16-beat quartered rotated sequence (the most common LOOP):

| Encoding | Uncompressed | Compressed | QR Modules |
|----------|-------------|------------|------------|
| Flat (current) | ~1000 chars | ~200 chars | ~150 |
| Recipe | ~280 chars | ~70 chars | ~60 |
| **Savings** | **72%** | **65%** | **~60%** |

Fewer QR modules = larger dots = easier to scan and print.

### What Qualifies for Recipe Encoding

A sequence qualifies when ALL of these are true:
1. `LOOPDetector` returns a single-transform pattern with `confidence: "strict"`
2. The slice size is deterministic (QUARTERED or HALVED)
3. The round-trip test passes (reconstruct from seed matches original exactly)

Sequences that DON'T qualify (fall back to flat):
- No LOOP pattern detected
- Compound patterns (rotated + inverted) — future work
- Freeform circular sequences
- Non-circular sequences
- Round-trip reconstruction doesn't match (edge case, safety net)

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/shared/qr/services/implementations/CompositionalEncoder.ts` | Create | Encode seed + recipe tag |
| `src/lib/shared/qr/services/implementations/CompositionalDecoder.ts` | Create | Decode recipe, reconstruct, verify hash |
| `src/lib/shared/qr/services/contracts/ICompositionalEncoder.ts` | Create | Interface |
| `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts` | Modify | Add recipe encoding path in `encodeForQR()` |
| `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts` | Modify | Add recipe decoding path in `decodeFromQR()` |

### What This Does NOT Change

- Firestore storage format (sequences still stored as full beats)
- The sequence viewer (receives full SequenceData either way)
- The animation engine (same input regardless of how it was encoded)
- The flat encoding (still used as fallback and for non-LOOP sequences)
- Short code URLs (still work, unrelated to encoding format)

### Edge Cases

**Sequence modified after QR was printed:** The QR encodes a snapshot. If the user re-saves with different beats, the old QR still shows the old version. Same as current behavior — this doesn't change.

**Decoder doesn't have the executor:** If a future version removes or changes the executor, the hash check will fail and the decoder returns an error. The hash is the safety net.

**New LOOP types added later:** New tags can be added without breaking old QR codes. Old decoders that don't recognize a tag should fall back to flat decoding or show an error.

**Orientation propagation differences:** The reconstruction must produce identical orientations. The round-trip test at encode time catches any discrepancies. If the executor's orientation propagation logic changes in the future, old recipe QR codes might fail the hash check — but this is the correct behavior (don't show a wrong sequence).

## Future Extensions

1. **Compound patterns** — Encode rotated+inverted, mirrored+swapped, etc. Requires composing executors.
2. **Firestore storage** — Store sequences as recipes in the database, reconstruct on load. Smaller documents, cheaper reads.
3. **Sequence diff** — Compare two recipes structurally ("same seed, different transform") instead of beat-by-beat.
4. **Algebraic operations** — "Take this rotated LOOP and make it mirrored instead" becomes a tag swap, not a regeneration.
