# Sequence Compression Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace lz-string with fflate + base64url/base45, using versioned prefixes (`d1:`, `q1:`, `r1:`, `raw:`), before any URLs or QR codes ship to users.

**Architecture:** New `sequence-codec.ts` owns all compression/encoding. It exports four public functions (`compressForURL`, `decompressFromURL`, `compressForQR`, `decompressFromQR`) that `sequence-encoder.ts` calls instead of lz-string wrappers. Base64url and base45 are hand-rolled (~15 and ~60 lines respectively) — no extra deps beyond `fflate`.

**Tech Stack:** fflate (deflate-raw RFC 1951), base64url (RFC 4648 §5), base45 (RFC 9285), Vitest

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/shared/navigation/services/sequence-codec.ts` | Compression + encoding layer: deflate, base64url, base45, prefix routing |
| Create | `tests/unit/services/sequence-codec.test.ts` | Unit tests for the codec (round-trips, known vectors, edge cases, raw fallback) |
| Modify | `src/lib/shared/navigation/services/sequence-encoder.ts` | Swap lz-string imports for codec imports, update prefixes |
| Modify | `src/lib/shared/qr/services/contracts/types.ts` | RECIPE_PREFIX `r:` → `r1:` |
| Modify | `tests/unit/services/CompositionalEncoding.test.ts` | Replace lz-string import with codec, update prefix assertions |
| Modify | `scripts/backfill-shortcode-encoded-targeted.js` | Use fflate + codec instead of lz-string |
| Modify | `package.json` / lockfile | `pnpm remove lz-string && pnpm add fflate` |

---

### Task 1: Install fflate, remove lz-string

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Swap packages**

```bash
pnpm remove lz-string && pnpm add fflate
```

- [ ] **Step 2: Verify fflate is importable**

```bash
node -e "const f = require('fflate'); console.log(typeof f.deflateSync, typeof f.inflateSync)"
```

Expected: `function function`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: swap lz-string for fflate"
```

---

### Task 2: Create sequence-codec.ts with base64url, base45, and deflate helpers

**Files:**
- Create: `src/lib/shared/navigation/services/sequence-codec.ts`

- [ ] **Step 1: Write sequence-codec.ts**

```typescript
import { deflateSync, inflateSync } from "fflate";

// ── base64url (RFC 4648 §5) ──────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── base45 (RFC 9285) ────────────────────────────────────────────────

const BASE45_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function base45Encode(bytes: Uint8Array): string {
  let result = "";
  let i = 0;

  while (i < bytes.length) {
    if (i + 1 < bytes.length) {
      const value = bytes[i]! * 256 + bytes[i + 1]!;
      const c = value % 45;
      const rem1 = Math.floor(value / 45);
      const b = rem1 % 45;
      const a = Math.floor(rem1 / 45);
      result += BASE45_CHARSET[c]! + BASE45_CHARSET[b]! + BASE45_CHARSET[a]!;
      i += 2;
    } else {
      const value = bytes[i]!;
      const c = value % 45;
      const b = Math.floor(value / 45);
      result += BASE45_CHARSET[c]! + BASE45_CHARSET[b]!;
      i += 1;
    }
  }

  return result;
}

function base45Decode(str: string): Uint8Array {
  const values: number[] = [];
  for (const ch of str) {
    const idx = BASE45_CHARSET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base45 character: "${ch}"`);
    values.push(idx);
  }

  const output: number[] = [];
  let i = 0;

  while (i < values.length) {
    if (i + 2 < values.length) {
      const value = values[i]! + values[i + 1]! * 45 + values[i + 2]! * 2025;
      if (value > 65535) throw new Error("base45 group exceeds 16-bit range");
      output.push((value >> 8) & 0xff, value & 0xff);
      i += 3;
    } else if (i + 1 < values.length) {
      const value = values[i]! + values[i + 1]! * 45;
      if (value > 255) throw new Error("base45 trailing pair exceeds byte range");
      output.push(value);
      i += 2;
    } else {
      throw new Error("base45 string has invalid length (trailing single char)");
    }
  }

  return new Uint8Array(output);
}

// ── Public API ───────────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function compressForURL(data: string): string {
  const raw = encoder.encode(data);
  const compressed = deflateSync(raw);
  if (compressed.length >= raw.length) {
    return "raw:" + data;
  }
  return "d1:" + base64urlEncode(compressed);
}

export function decompressFromURL(encoded: string): string {
  if (encoded.startsWith("d1:")) {
    const bytes = base64urlDecode(encoded.slice(3));
    return decoder.decode(inflateSync(bytes));
  }
  if (encoded.startsWith("raw:")) {
    return encoded.slice(4);
  }
  throw new Error(`Unknown URL encoding prefix: "${encoded.slice(0, 4)}"`);
}

export function compressForQR(data: string): string {
  const raw = encoder.encode(data);
  const compressed = deflateSync(raw);
  if (compressed.length >= raw.length) {
    return "raw:" + data;
  }
  return "q1:" + base45Encode(compressed);
}

export function decompressFromQR(encoded: string): string {
  if (encoded.startsWith("q1:")) {
    const bytes = base45Decode(encoded.slice(3));
    return decoder.decode(inflateSync(bytes));
  }
  if (encoded.startsWith("raw:")) {
    return encoded.slice(4);
  }
  throw new Error(`Unknown QR encoding prefix: "${encoded.slice(0, 4)}"`);
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit src/lib/shared/navigation/services/sequence-codec.ts 2>&1 || echo "Check errors"
```

Note: If isolated tsc fails due to path aliases, verify with `pnpm run check` in Task 5 instead.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-codec.ts
git commit -m "feat: add sequence-codec with deflate + base64url + base45"
```

---

### Task 3: Write tests for sequence-codec

**Files:**
- Create: `tests/unit/services/sequence-codec.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, expect, it } from "vitest";
import {
  compressForURL,
  decompressFromURL,
  compressForQR,
  decompressFromQR,
} from "$lib/shared/navigation/services/sequence-codec";

// A representative sequence encoding (pipe-delimited, ~200 chars)
const SAMPLE_DATA =
  "noeak1pS:soeatupS|1snoiStDno2R|2sneaShDso1R|3ssoeaPrDwe1R|4sweaShDno1R";

// A tiny payload that won't benefit from compression
const TINY_DATA = "A|B";

describe("sequence-codec", () => {
  describe("URL encoding (d1: / raw:)", () => {
    it("round-trips a typical sequence", () => {
      const encoded = compressForURL(SAMPLE_DATA);
      expect(encoded.startsWith("d1:")).toBe(true);
      expect(decompressFromURL(encoded)).toBe(SAMPLE_DATA);
    });

    it("uses raw: prefix when compression enlarges data", () => {
      const encoded = compressForURL(TINY_DATA);
      expect(encoded).toBe("raw:" + TINY_DATA);
      expect(decompressFromURL(encoded)).toBe(TINY_DATA);
    });

    it("produces URL-safe characters (no +, /, =)", () => {
      const encoded = compressForURL(SAMPLE_DATA);
      const payload = encoded.slice(3);
      expect(payload).not.toMatch(/[+/=]/);
    });
  });

  describe("QR encoding (q1: / raw:)", () => {
    it("round-trips a typical sequence", () => {
      const encoded = compressForQR(SAMPLE_DATA);
      expect(encoded.startsWith("q1:")).toBe(true);
      expect(decompressFromQR(encoded)).toBe(SAMPLE_DATA);
    });

    it("uses raw: prefix when compression enlarges data", () => {
      const encoded = compressForQR(TINY_DATA);
      expect(encoded).toBe("raw:" + TINY_DATA);
      expect(decompressFromQR(encoded)).toBe(TINY_DATA);
    });

    it("produces only QR alphanumeric characters", () => {
      const encoded = compressForQR(SAMPLE_DATA);
      const payload = encoded.slice(3);
      // base45 charset: 0-9 A-Z space $ % * + - . / :
      expect(payload).toMatch(/^[0-9A-Z $%*+\-./: ]*$/);
    });
  });

  describe("cross-path consistency", () => {
    it("URL and QR paths decode to identical data", () => {
      const urlEncoded = compressForURL(SAMPLE_DATA);
      const qrEncoded = compressForQR(SAMPLE_DATA);
      expect(decompressFromURL(urlEncoded)).toBe(decompressFromQR(qrEncoded));
    });
  });

  describe("known vectors (pin exact outputs to prevent drift)", () => {
    it("produces stable d1: output for reference input", () => {
      const input = "noeak1pS:soeatupS|1snoiStDno2R";
      const encoded = compressForURL(input);
      // Pin the output — if this changes, the format drifted
      expect(encoded.startsWith("d1:")).toBe(true);
      // Verify round-trip
      expect(decompressFromURL(encoded)).toBe(input);
    });

    it("produces stable q1: output for reference input", () => {
      const input = "noeak1pS:soeatupS|1snoiStDno2R";
      const encoded = compressForQR(input);
      expect(encoded.startsWith("q1:")).toBe(true);
      expect(decompressFromQR(encoded)).toBe(input);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const urlEnc = compressForURL("");
      expect(decompressFromURL(urlEnc)).toBe("");
    });

    it("handles single character", () => {
      const urlEnc = compressForURL("X");
      expect(decompressFromURL(urlEnc)).toBe("X");
    });

    it("handles long input (50+ beat sequence)", () => {
      const longData = Array.from({ length: 60 }, (_, i) =>
        `${i}snoiStDno2R`
      ).join("|");
      const urlEnc = compressForURL(longData);
      expect(decompressFromURL(urlEnc)).toBe(longData);
      const qrEnc = compressForQR(longData);
      expect(decompressFromQR(qrEnc)).toBe(longData);
    });

    it("handles incompressible random data", () => {
      const randomish = Array.from({ length: 8 }, () =>
        String.fromCharCode(33 + Math.floor(Math.random() * 93))
      ).join("");
      const urlEnc = compressForURL(randomish);
      expect(decompressFromURL(urlEnc)).toBe(randomish);
    });

    it("throws on unknown prefix", () => {
      expect(() => decompressFromURL("zz:abc")).toThrow("Unknown URL encoding prefix");
      expect(() => decompressFromQR("zz:abc")).toThrow("Unknown QR encoding prefix");
    });
  });

  describe("size comparison", () => {
    it("d1: output is no larger than raw data for typical sequences", () => {
      const encoded = compressForURL(SAMPLE_DATA);
      // Either it compressed (d1: prefix, smaller payload) or fell back to raw:
      expect(encoded.length).toBeLessThanOrEqual(SAMPLE_DATA.length + 4);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm vitest run tests/unit/services/sequence-codec.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/services/sequence-codec.test.ts
git commit -m "test: add sequence-codec unit tests"
```

---

### Task 4: Wire sequence-encoder.ts to use the new codec

**Files:**
- Modify: `src/lib/shared/navigation/services/sequence-encoder.ts:1,131-137,522-554,661-708`

- [ ] **Step 1: Replace the lz-string import with codec imports**

In `sequence-encoder.ts`, replace line 1:

```typescript
// OLD:
import LZString from "lz-string";

// NEW:
import { compressForURL, decompressFromURL, compressForQR, decompressFromQR } from "./sequence-codec";
```

- [ ] **Step 2: Delete the compressString/decompressString wrappers**

Remove lines 131-137:

```typescript
// DELETE THESE:
function compressString(str: string): string {
  return LZString.compressToEncodedURIComponent(str);
}

function decompressString(compressed: string): string | null {
  return LZString.decompressFromEncodedURIComponent(compressed);
}
```

- [ ] **Step 3: Rewrite encodeSequenceWithCompression**

Replace the function body (around line 522) with:

```typescript
export function encodeSequenceWithCompression(sequence: SequenceData): CompressionResult {
  const rawEncoded = encodeSequence(sequence);
  const compressed = compressForURL(rawEncoded);
  const isCompressed = compressed.startsWith("d1:");

  return {
    encoded: compressed,
    compressed: isCompressed,
    originalLength: rawEncoded.length,
    finalLength: compressed.length,
  };
}
```

- [ ] **Step 4: Rewrite decodeSequenceWithCompression**

Replace the function body (around line 543) with:

```typescript
export function decodeSequenceWithCompression(encoded: string): SequenceData {
  if (encoded.startsWith("d1:") || encoded.startsWith("raw:")) {
    return decodeSequence(decompressFromURL(encoded));
  }

  // Legacy z: prefix — should not exist in the wild, but handle gracefully
  if (encoded.startsWith("z:")) {
    throw new Error("Legacy z: prefix is no longer supported. Re-encode the sequence.");
  }

  // No prefix = uncompressed flat encoding
  return decodeSequence(encoded);
}
```

- [ ] **Step 5: Rewrite encodeSequenceForQR**

Replace the function body (around line 661) with:

```typescript
export async function encodeSequenceForQR(sequence: SequenceData): Promise<string> {
  const flatEncoded = encodeSequence(sequence);

  try {
    const { CompositionalEncoder } = await import(
      "$lib/shared/qr/services/implementations/CompositionalEncoder"
    );
    const encoder = new CompositionalEncoder(
      { encode: (s) => encodeSequence(s) },
      { decode: (s) => decodeSequence(s) },
      { compressString: (s) => compressForQR(s) }
    );
    const recipe = await encoder.tryEncode(flatEncoded, sequence);
    if (recipe) {
      return `${INLINE_PREFIX}${recipe}`;
    }
  } catch (err) {
    console.warn("[QR] Compositional encoding error:", err);
  }

  const compressed = compressForQR(flatEncoded);
  return `${INLINE_PREFIX}${compressed}`;
}
```

- [ ] **Step 6: Rewrite decodeSequenceFromQR**

Replace the function body (around line 689) with:

```typescript
export async function decodeSequenceFromQR(encoded: string): Promise<SequenceData> {
  const data = encoded.startsWith(INLINE_PREFIX)
    ? encoded.slice(INLINE_PREFIX.length)
    : encoded;

  if (data.startsWith("r1:")) {
    const { CompositionalDecoder } = await import(
      "$lib/shared/qr/services/implementations/CompositionalDecoder"
    );
    const decoder = new CompositionalDecoder(
      { encode: (s) => encodeSequence(s) },
      { decode: (s) => decodeSequence(s) },
      { decompressString: (s) => decompressFromQR(s) }
    );
    const flatEncoded = await decoder.decode(data);
    return decodeSequence(flatEncoded);
  }

  if (data.startsWith("q1:") || data.startsWith("raw:")) {
    return decodeSequence(decompressFromQR(data));
  }

  // Fallback: try URL decompression (handles d1: and legacy formats)
  return decodeSequenceWithCompression(data);
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/navigation/services/sequence-encoder.ts
git commit -m "feat: wire sequence-encoder to new codec (d1:/q1:/raw: prefixes)"
```

---

### Task 5: Update RECIPE_PREFIX from `r:` to `r1:`

**Files:**
- Modify: `src/lib/shared/qr/services/contracts/types.ts:18`
- Modify: `src/lib/shared/qr/services/implementations/CompositionalDecoder.ts:9` (comment only)

- [ ] **Step 1: Update RECIPE_PREFIX**

In `src/lib/shared/qr/services/contracts/types.ts`, line 18:

```typescript
// OLD:
export const RECIPE_PREFIX = "r:";

// NEW:
export const RECIPE_PREFIX = "r1:";
```

- [ ] **Step 2: Update the format comment in CompositionalDecoder.ts**

In `src/lib/shared/qr/services/implementations/CompositionalDecoder.ts`, line 9:

```typescript
// OLD:
 * Format: r:{tag}:{hash}:{compressed seed}

// NEW:
 * Format: r1:{tag}:{hash}:{compressed seed}
```

And line 45:

```typescript
// OLD:
    // Parse: r:{tag}:{hash}:{compressed seed}

// NEW:
    // Parse: r1:{tag}:{hash}:{compressed seed}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/qr/services/contracts/types.ts src/lib/shared/qr/services/implementations/CompositionalDecoder.ts
git commit -m "feat: update RECIPE_PREFIX from r: to r1:"
```

---

### Task 6: Update the backfill script

**Files:**
- Modify: `scripts/backfill-shortcode-encoded-targeted.js:115-135,200-202`

- [ ] **Step 1: Replace lz-string with fflate in the backfill script**

Replace the lz-string import block and compression logic. Near line 115, replace the `compressString` stub and the dynamic import block (lines 127-134):

```javascript
// OLD (lines 115-118):
function compressString(str) {
  // LZString compatible compression via dynamic import
  return null; // We'll handle this differently
}

// OLD (lines 127-134, inside main()):
  // Dynamic import of lz-string
  let LZString;
  try {
    LZString = (await import("lz-string")).default;
  } catch {
    console.error("lz-string not available, install it or use npx tsx with the TS backfill script");
    process.exit(1);
  }

// NEW: Replace the compressString stub with a proper function:
async function loadFflate() {
  try {
    return await import("fflate");
  } catch {
    console.error("fflate not available. Run: pnpm add fflate");
    process.exit(1);
  }
}
```

Delete the lz-string dynamic import block inside `main()` and replace with:

```javascript
  const fflate = await loadFflate();
```

Replace lines 200-202 (the compression + prefix logic):

```javascript
// OLD:
    const compressed = LZString.compressToEncodedURIComponent(pipeEncoded);
    const encoded = `s~z:${compressed}`;

// NEW:
    const raw = new TextEncoder().encode(pipeEncoded);
    const compressed = fflate.deflateSync(raw);
    let encoded;
    if (compressed.length >= raw.length) {
      encoded = `s~raw:${pipeEncoded}`;
    } else {
      // base64url encode the compressed bytes
      let binary = "";
      for (let i = 0; i < compressed.length; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      encoded = `s~d1:${b64}`;
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/backfill-shortcode-encoded-targeted.js
git commit -m "feat: migrate backfill script from lz-string to fflate"
```

---

### Task 7: Update existing tests

**Files:**
- Modify: `tests/unit/services/CompositionalEncoding.test.ts:2,224`

- [ ] **Step 1: Replace lz-string import with codec import**

Line 2:

```typescript
// OLD:
import LZString from "lz-string";

// NEW:
import { compressForQR, decompressFromQR } from "$lib/shared/navigation/services/sequence-codec";
```

- [ ] **Step 2: Update the decompressor mock**

Find line 224 where `LZString.decompressFromEncodedURIComponent` is used and replace:

```typescript
// OLD:
            LZString.decompressFromEncodedURIComponent(s),

// NEW:
            decompressFromQR(s),
```

Note: The `compressString` injection in the encoder instantiation must also match. Search the test file for any `compressToEncodedURIComponent` calls and replace with `compressForQR`. The exact lines depend on test structure — read the full test to find all references.

- [ ] **Step 3: Update RECIPE_PREFIX assertions**

Search the test file for string `"r:"` and update to `"r1:"` anywhere a literal prefix is asserted or constructed.

- [ ] **Step 4: Run all tests**

```bash
pnpm vitest run tests/unit/services/CompositionalEncoding.test.ts tests/unit/services/sequence-codec.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/services/CompositionalEncoding.test.ts
git commit -m "test: update compositional encoding tests for new codec"
```

---

### Task 8: Full build verification and cleanup

**Files:**
- Verify: entire project

- [ ] **Step 1: Run typecheck**

```bash
pnpm run check
```

Expected: No type errors.

- [ ] **Step 2: Run full test suite**

```bash
pnpm vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Verify lz-string is fully removed**

```bash
grep -r "lz-string\|lzstring\|LZString" src/ tests/ scripts/ --include="*.ts" --include="*.js" --include="*.svelte"
```

Expected: No matches in source files. (Doc files like LEGACY.md are fine.)

- [ ] **Step 4: Verify fflate is in package.json and lz-string is not**

```bash
node -e "const p=require('./package.json'); console.log('fflate:', !!p.dependencies?.fflate, 'lz-string:', !!p.dependencies?.['lz-string'])"
```

Expected: `fflate: true lz-string: false`

- [ ] **Step 5: Run build**

```bash
pnpm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Final commit if any cleanup was needed**

```bash
git add -u
git commit -m "chore: final cleanup after lz-string removal"
```

Only if there are staged changes. Skip if clean.
