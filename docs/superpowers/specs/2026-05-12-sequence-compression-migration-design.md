# Sequence Compression Migration: lz-string → fflate + base64url/base45

**Date:** 2026-05-12
**Status:** Approved
**Scope:** Replace lz-string (unmaintained since 2017) with standards-based compression pipeline

## Context

TKA encodes choreography sequences into URL query params and QR codes. The current pipeline uses `lz-string`'s proprietary LZW compression with a custom URI alphabet. Before any URLs or QR codes ship to users, we're migrating to a standards-based pipeline that will remain decodable on any platform for decades.

No URLs or QR codes are in the wild. No backward compatibility required.

## Format Specification

### Prefixes (self-describing, versioned)

```
d1:{payload}     URL encoding (deflate-raw v1 + base64url)
q1:{payload}     QR encoding (deflate-raw v1 + base45)
r1:{tag}:{hash}:{seed}   LOOP recipe v1 (seed is q1-encoded)
raw:{data}       Uncompressed fallback (when deflate enlarges input)
```

Version numbers (`1`) allow future format evolution without ambiguity.

### Encode Pipeline

```
URL:  compact text → TextEncoder → deflateSync → base64url → "d1:" prefix
QR:   compact text → TextEncoder → deflateSync → base45   → "q1:" prefix
```

### Decode Pipeline

```
"d1:" → strip prefix → base64url decode → inflateSync → TextDecoder → flat text
"q1:" → strip prefix → base45 decode   → inflateSync → TextDecoder → flat text
"r1:" → parse recipe → decode seed via q1 path → expand LOOP
"raw:" → strip prefix → flat text (no decompression)
```

### Compression-only-when-smaller

If `deflated.length >= original.length`, use `raw:` prefix with uncompressed data. Tiny sequences (1-2 beats) may not benefit from compression.

## Standards

| Component | Standard | Age | Implementations |
|-----------|----------|-----|----------------|
| deflate-raw | RFC 1951 (1996) | 30 years | Every language |
| base64url | RFC 4648 §5 (2006) | 20 years | Every language |
| base45 | RFC 9285 (2022) | 4 years | EU COVID certs (billions of QR codes) |

## Dependencies

### Added

- `fflate` — deflate compression. 40M weekly npm downloads, 8KB gzipped, pure JS, synchronous API, actively maintained.

### Removed

- `lz-string` — proprietary LZW, unmaintained since 2017, no cross-platform decoders.

### Not added (hand-rolled instead)

- base64url — 15 lines using built-in `btoa`/`atob` with URL-safe alphabet swap
- base45 — ~60 lines implementing RFC 9285 directly. Zero-dependency for 20-year longevity.

## Files Changed

### New

- `src/lib/shared/navigation/services/sequence-codec.ts` — compression/encoding layer (compressForURL, decompressFromURL, compressForQR, decompressFromQR, base64url helpers, base45 helpers)

### Modified

- `src/lib/shared/navigation/services/sequence-encoder.ts`
  - Delete `import LZString` (line 1)
  - Replace `compressString`/`decompressString` wrappers with imports from sequence-codec
  - `encodeSequenceWithCompression()` — use `compressForURL()`, prefix `d1:` instead of `z:`
  - `decodeSequenceWithCompression()` — route on `d1:` prefix
  - `encodeSequenceForQR()` — pass `compressForQR` to CompositionalEncoder
  - `decodeSequenceFromQR()` — pass `decompressFromQR` to CompositionalDecoder
  - Recipe prefix becomes `r1:` instead of `r:`

- `src/lib/shared/qr/services/implementations/CompositionalEncoder.ts`
  - Update RECIPE_PREFIX constant from `r:` to `r1:`

- `src/lib/shared/qr/services/implementations/CompositionalDecoder.ts`
  - Update prefix check from `r:` to `r1:`

- `scripts/backfill-shortcode-encoded-targeted.js` — switch from lz-string to new codec

- `package.json` — remove `lz-string`, add `fflate`

### Deleted

- Type declaration for lz-string (if exists)

## QR Density Improvement

base45 triggers QR alphanumeric mode (5.5 bits/char) instead of byte mode (8 bits/char). For the same compressed payload, QR codes are ~30% smaller (fewer modules, easier to scan).

## Testing

1. **Round-trip**: URL encode → decode, QR encode → decode, verify identical
2. **Known vectors**: Pin exact outputs for a reference sequence to prevent format drift
3. **Size comparison**: New pipeline ≤ old pipeline output size
4. **Compositional round-trip**: LOOP sequences through full QR encode/decode
5. **Edge cases**: empty, 1-beat, 50+ beats, incompressible data (verify `raw:` fallback)
6. **Cross-path**: Verify URL-encoded and QR-encoded versions decode to identical SequenceData

## Not In Scope

- Changing the compact text encoding format (the `noeak1pS:soeatupS|...` layer)
- Custom binary encoding (pre-compression optimization — future work if needed)
- Base45 for URL path (URLs use base64url; QR uses base45)
