# Compositional Sequence Encoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** QR codes for LOOP sequences encode only the seed beats + a recipe tag, reducing QR density by ~65%. The decoder reconstructs the full sequence using existing LOOP executors, with round-trip verification at encode time and hash verification at decode time.

**Architecture:** Add a `CompositionalEncoder` that detects LOOP patterns, extracts the seed, round-trip verifies reconstruction, and produces a `r:{tag}:{hash}:{compressed seed}` string. Add a `CompositionalDecoder` that parses the recipe, reconstructs using `StrictRotatedExecutor` (and others), and verifies via hash. Wire both into `SequenceEncoder.encodeForQR()` / `decodeFromQR()` as an opportunistic optimization with flat encoding as fallback.

**Tech Stack:** TypeScript, Vitest, existing LOOPDetector + LOOP executors, LZString compression, Web Crypto API (SHA-256)

**Spec:** `docs/superpowers/specs/2026-03-19-compositional-sequence-encoding-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/shared/qr/services/implementations/CompositionalEncoder.ts` | Create | Detect LOOP, extract seed, round-trip verify, produce recipe string |
| `src/lib/shared/qr/services/implementations/CompositionalDecoder.ts` | Create | Parse recipe, reconstruct from seed via executor, verify hash |
| `src/lib/shared/qr/services/contracts/ICompositionalEncoder.ts` | Create | Interfaces for encoder + decoder |
| `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts` | Modify | Wire recipe encoding into `encodeForQR()` and `decodeFromQR()` |
| `tests/unit/services/CompositionalEncoding.test.ts` | Create | Round-trip tests for recipe encoding/decoding |

**Key dependencies (read-only, do NOT modify):**
- `src/lib/features/create/generate/circular/services/implementations/LOOPDetector.ts` — pattern detection
- `src/lib/features/create/generate/circular/services/implementations/StrictRotatedLOOPExecutor.ts` — quartered rotation reconstruction
- `src/lib/features/create/generate/circular/services/implementations/StrictMirroredLOOPExecutor.ts` — halved mirroring reconstruction
- (Other executors for other LOOP types — same pattern)

---

### Task 1: Create interfaces and loop type tag mapping

**Files:**
- Create: `src/lib/shared/qr/services/contracts/ICompositionalEncoder.ts`

- [ ] **Step 1: Create the interface file**

```typescript
// src/lib/shared/qr/services/contracts/ICompositionalEncoder.ts

/**
 * Compositional Sequence Encoding
 *
 * Instead of encoding all 16 beats of a rotated LOOP,
 * encodes just the seed (4 beats) + a recipe tag.
 * The decoder reconstructs the full sequence using existing LOOP executors.
 */

/** Compact tags for LOOP types in recipe encoding */
export const LOOP_TYPE_TAGS: Record<string, string> = {
  rotated: "sr",
  mirrored: "sm",
  flipped: "sf",
  swapped: "ss",
  inverted: "si",
  rewound: "rw",
} as const;

/** Reverse lookup: tag → loopType */
export const TAG_TO_LOOP_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(LOOP_TYPE_TAGS).map(([k, v]) => [v, k])
);

/** Recipe prefix that signals compositional encoding (after the s~ inline prefix) */
export const RECIPE_PREFIX = "r:";

export interface CompositionalEncodeResult {
  /** The recipe-encoded string (r:{tag}:{hash}:{compressed seed}) */
  encoded: string;
  /** Whether compositional encoding was used (false = fell back to flat) */
  isCompositional: boolean;
  /** The detected LOOP type tag (e.g., "sr" for rotated) */
  tag?: string;
  /** Size comparison */
  flatSize: number;
  recipeSize: number;
}

export interface ICompositionalEncoder {
  /**
   * Try to encode a sequence compositionally.
   * Returns the recipe string if the sequence qualifies, null if it doesn't.
   * Qualification: LOOP detected + round-trip verification passes.
   */
  tryEncode(flatEncoded: string, sequence: import("$lib/shared/foundation/domain/models/SequenceData").SequenceData): Promise<string | null>;
}

export interface ICompositionalDecoder {
  /**
   * Decode a recipe-encoded string back to flat encoded format.
   * Verifies hash after reconstruction.
   * Throws if hash verification fails.
   */
  decode(recipeEncoded: string): Promise<string>;

  /**
   * Check if a string uses recipe encoding.
   */
  isRecipeEncoded(encoded: string): boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/qr/services/contracts/ICompositionalEncoder.ts
git commit -m "feat: add compositional encoding interfaces and LOOP type tags"
```

---

### Task 2: Implement CompositionalEncoder (encode + round-trip verify)

**Files:**
- Create: `src/lib/shared/qr/services/implementations/CompositionalEncoder.ts`

- [ ] **Step 1: Write the encoder**

The encoder does:
1. Run LOOPDetector on the sequence
2. If strict single-transform LOOP found, extract seed beats
3. Reconstruct from seed using the appropriate executor
4. Compare reconstructed flat encoding to original flat encoding
5. If match, produce recipe string with hash
6. If mismatch, return null (caller falls back to flat)

```typescript
// src/lib/shared/qr/services/implementations/CompositionalEncoder.ts

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
import { SliceSize } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { LOOP_TYPE_TAGS, RECIPE_PREFIX } from "../contracts/ICompositionalEncoder";
import type { ICompositionalEncoder } from "../contracts/ICompositionalEncoder";

/**
 * Tries to encode a sequence as a recipe (seed + transformation tag).
 * Falls back to null if the sequence doesn't qualify or round-trip fails.
 */
export class CompositionalEncoder implements ICompositionalEncoder {
  constructor(
    private readonly flatEncoder: { encode(seq: SequenceData): string },
    private readonly flatDecoder: { decode(encoded: string): SequenceData },
    private readonly compressor: { compressString(s: string): string }
  ) {}

  async tryEncode(
    flatEncoded: string,
    sequence: SequenceData
  ): Promise<string | null> {
    if (!sequence.steps || sequence.steps.length < 4) return null;

    // Step 1: Detect LOOP pattern
    const detection = loopDetector.detectLOOPType(sequence);

    if (!detection.loopType || detection.confidence !== "strict") return null;
    if (!detection.sliceSize) return null;

    // Step 2: Get the tag for this LOOP type
    const loopTypeName = this.loopTypeToString(detection.loopType);
    const tag = LOOP_TYPE_TAGS[loopTypeName];
    if (!tag) return null; // Unsupported LOOP type

    // Step 3: Extract seed beats
    const seedSize = detection.sliceSize === SliceSize.QUARTERED
      ? Math.floor(sequence.steps.length / 4)
      : Math.floor(sequence.steps.length / 2);
    const seedSteps = sequence.steps.slice(0, seedSize);

    // Step 4: Create a seed-only sequence for encoding
    const seedSequence: SequenceData = {
      ...sequence,
      steps: seedSteps as StepData[],
      word: this.extractSeedWord(sequence.word || "", seedSize, sequence.steps.length),
    };
    const seedEncoded = this.flatEncoder.encode(seedSequence);

    // Step 5: Round-trip verify — reconstruct from seed and compare
    const reconstructed = await this.reconstruct(seedEncoded, tag, sequence);
    if (!reconstructed) return null;

    const reconstructedFlat = this.flatEncoder.encode(reconstructed);
    if (reconstructedFlat !== flatEncoded) {
      console.warn("[CompositionalEncoder] Round-trip mismatch — falling back to flat");
      return null;
    }

    // Step 6: Compute hash of the flat encoding
    const hash = await this.computeHash(flatEncoded);

    // Step 7: Compress the seed and build recipe string
    const compressedSeed = this.compressor.compressString(seedEncoded);
    return `${RECIPE_PREFIX}${tag}:${hash}:${compressedSeed}`;
  }

  /**
   * Reconstruct full sequence from seed encoding + LOOP type tag.
   * Uses the same executors as the generate module.
   */
  private async reconstruct(
    seedEncoded: string,
    tag: string,
    originalSequence: SequenceData
  ): Promise<SequenceData | null> {
    try {
      const seedSequence = this.flatDecoder.decode(seedEncoded);
      const executor = await this.getExecutor(tag);
      if (!executor) return null;

      const reconstructedSteps = executor.executeLOOP(
        [...seedSequence.steps as StepData[]],
        this.getSliceSize(tag)
      );

      return {
        ...originalSequence,
        steps: reconstructedSteps,
      };
    } catch {
      return null;
    }
  }

  private async getExecutor(tag: string): Promise<{ executeLOOP(steps: StepData[], slice: SliceSize): StepData[] } | null> {
    // Dynamic import to avoid loading all executors upfront
    switch (tag) {
      case "sr": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictRotatedLOOPExecutor");
        return new mod.StrictRotatedLOOPExecutor();
      }
      case "sm": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictMirroredLOOPExecutor");
        return new mod.StrictMirroredLOOPExecutor();
      }
      case "sf": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictFlippedLOOPExecutor");
        return new mod.StrictFlippedLOOPExecutor();
      }
      case "ss": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictSwappedLOOPExecutor");
        return new mod.StrictSwappedLOOPExecutor();
      }
      case "si": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictInvertedLOOPExecutor");
        return new mod.StrictInvertedLOOPExecutor();
      }
      case "rw": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/RewoundLOOPExecutor");
        return new mod.RewoundLOOPExecutor();
      }
      default:
        return null;
    }
  }

  private getSliceSize(tag: string): SliceSize {
    return tag === "sr" ? SliceSize.QUARTERED : SliceSize.HALVED;
  }

  private loopTypeToString(loopType: unknown): string {
    // The LOOPType enum values map to snake_case strings
    return String(loopType).toLowerCase();
  }

  private extractSeedWord(fullWord: string, seedSize: number, totalSteps: number): string {
    // For repeated words like "AAKEAAKEAAKEAAKE", extract "AAKE"
    const repeatCount = totalSteps / seedSize;
    const charPerBeat = fullWord.length / totalSteps;
    return fullWord.slice(0, Math.ceil(seedSize * charPerBeat));
  }

  private async computeHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(buffer));
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hexHash.slice(0, 8); // 8-char truncated hash
  }
}
```

**Important notes for the implementer:**
- Read the existing `StrictRotatedLOOPExecutor.ts` to understand the `executeLOOP()` signature. It takes `steps: StepData[]` and `sliceSize: SliceSize` and returns `StepData[]`.
- The `loopDetector` is imported as a singleton from `LOOPDetector.ts`.
- The `SliceSize` enum has `QUARTERED` and `HALVED` values.
- The `LOOPType` enum values are like `ROTATED`, `MIRRORED`, etc.
- The `flatEncoder.encode()` and `flatDecoder.decode()` are methods from `SequenceEncoder`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/qr/services/implementations/CompositionalEncoder.ts
git commit -m "feat: implement CompositionalEncoder with round-trip verification"
```

---

### Task 3: Implement CompositionalDecoder (decode + hash verify)

**Files:**
- Create: `src/lib/shared/qr/services/implementations/CompositionalDecoder.ts`

- [ ] **Step 1: Write the decoder**

```typescript
// src/lib/shared/qr/services/implementations/CompositionalDecoder.ts

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { SliceSize } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { RECIPE_PREFIX, TAG_TO_LOOP_TYPE } from "../contracts/ICompositionalEncoder";
import type { ICompositionalDecoder } from "../contracts/ICompositionalEncoder";

/**
 * Decodes recipe-encoded sequences by reconstructing from seed + LOOP executor.
 * Verifies integrity via SHA-256 hash comparison.
 */
export class CompositionalDecoder implements ICompositionalDecoder {
  constructor(
    private readonly flatEncoder: { encode(seq: SequenceData): string },
    private readonly flatDecoder: { decode(encoded: string): SequenceData },
    private readonly decompressor: { decompressString(s: string): string | null }
  ) {}

  isRecipeEncoded(encoded: string): boolean {
    return encoded.startsWith(RECIPE_PREFIX);
  }

  async decode(recipeEncoded: string): Promise<string> {
    if (!recipeEncoded.startsWith(RECIPE_PREFIX)) {
      throw new Error("Not a recipe-encoded string");
    }

    // Parse: r:{tag}:{hash}:{compressed seed}
    const withoutPrefix = recipeEncoded.slice(RECIPE_PREFIX.length);
    const firstColon = withoutPrefix.indexOf(":");
    const secondColon = withoutPrefix.indexOf(":", firstColon + 1);

    if (firstColon === -1 || secondColon === -1) {
      throw new Error("Invalid recipe format");
    }

    const tag = withoutPrefix.slice(0, firstColon);
    const expectedHash = withoutPrefix.slice(firstColon + 1, secondColon);
    const compressedSeed = withoutPrefix.slice(secondColon + 1);

    // Validate tag
    if (!TAG_TO_LOOP_TYPE[tag]) {
      throw new Error(`Unknown LOOP type tag: "${tag}"`);
    }

    // Decompress seed
    const seedEncoded = this.decompressor.decompressString(compressedSeed);
    if (!seedEncoded) {
      throw new Error("Failed to decompress seed data");
    }

    // Decode seed to SequenceData
    const seedSequence = this.flatDecoder.decode(seedEncoded);

    // Reconstruct full sequence using executor
    const executor = await this.getExecutor(tag);
    if (!executor) {
      throw new Error(`No executor available for tag "${tag}"`);
    }

    const sliceSize = tag === "sr" ? SliceSize.QUARTERED : SliceSize.HALVED;
    const reconstructedSteps = executor.executeLOOP(
      [...seedSequence.steps as StepData[]],
      sliceSize
    );

    // Build reconstructed sequence
    const fullSequence: SequenceData = {
      ...seedSequence,
      steps: reconstructedSteps,
      word: this.expandWord(seedSequence.word || "", sliceSize),
    };

    // Encode to flat format for hash verification
    const flatEncoded = this.flatEncoder.encode(fullSequence);
    const actualHash = await this.computeHash(flatEncoded);

    if (actualHash !== expectedHash) {
      throw new Error(
        `Hash mismatch: expected ${expectedHash}, got ${actualHash}. ` +
        `Sequence may be corrupted.`
      );
    }

    // Return the verified flat encoding (caller will decode normally)
    return flatEncoded;
  }

  private async getExecutor(tag: string): Promise<{ executeLOOP(steps: StepData[], slice: SliceSize): StepData[] } | null> {
    // Same dynamic imports as CompositionalEncoder
    switch (tag) {
      case "sr": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictRotatedLOOPExecutor");
        return new mod.StrictRotatedLOOPExecutor();
      }
      case "sm": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictMirroredLOOPExecutor");
        return new mod.StrictMirroredLOOPExecutor();
      }
      case "sf": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictFlippedLOOPExecutor");
        return new mod.StrictFlippedLOOPExecutor();
      }
      case "ss": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictSwappedLOOPExecutor");
        return new mod.StrictSwappedLOOPExecutor();
      }
      case "si": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/StrictInvertedLOOPExecutor");
        return new mod.StrictInvertedLOOPExecutor();
      }
      case "rw": {
        const mod = await import("$lib/features/create/generate/circular/services/implementations/RewoundLOOPExecutor");
        return new mod.RewoundLOOPExecutor();
      }
      default:
        return null;
    }
  }

  private expandWord(seedWord: string, sliceSize: SliceSize): string {
    const repeatCount = sliceSize === SliceSize.QUARTERED ? 4 : 2;
    return seedWord.repeat(repeatCount);
  }

  private async computeHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(buffer));
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hexHash.slice(0, 8);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/qr/services/implementations/CompositionalDecoder.ts
git commit -m "feat: implement CompositionalDecoder with hash verification"
```

---

### Task 4: Wire into SequenceEncoder

**Files:**
- Modify: `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts` (lines 528-552)

- [ ] **Step 1: Update `encodeForQR()` to try recipe encoding first**

In `SequenceEncoder.ts`, modify `encodeForQR()`:

```typescript
// BEFORE:
encodeForQR(sequence: SequenceData): string {
  const { encoded } = this.encodeWithCompression(sequence);
  return `${SequenceEncoder.INLINE_PREFIX}${encoded}`;
}

// AFTER:
async encodeForQR(sequence: SequenceData): Promise<string> {
  const { encoded: flatEncoded } = this.encodeWithCompression(sequence);

  // Try compositional encoding for LOOP sequences (smaller QR codes)
  try {
    const { CompositionalEncoder } = await import(
      "$lib/shared/qr/services/implementations/CompositionalEncoder"
    );
    const encoder = new CompositionalEncoder(
      { encode: (s) => this.encode(s) },
      { decode: (s) => this.decode(s) },
      { compressString: (s) => this.compressString(s) }
    );
    const recipe = await encoder.tryEncode(this.encode(sequence), sequence);
    if (recipe) {
      return `${SequenceEncoder.INLINE_PREFIX}${recipe}`;
    }
  } catch {
    // Compositional encoding failed — fall through to flat
  }

  return `${SequenceEncoder.INLINE_PREFIX}${flatEncoded}`;
}
```

**Important:** This changes `encodeForQR` from sync to async. Check all callers:
- `ShortCodeManager.createOfflineCode()` — calls `this.sequenceEncoder.encodeForQR(sequence)`. Need to await.
- `SequenceEncoder.estimateQRSize()` — calls `this.encodeForQR(sequence)`. Need to await.
- Any other callers found by TypeScript errors after the signature change.

- [ ] **Step 2: Update `decodeFromQR()` to handle recipe encoding**

```typescript
// BEFORE:
decodeFromQR(encoded: string): SequenceData {
  const data = encoded.startsWith(SequenceEncoder.INLINE_PREFIX)
    ? encoded.slice(SequenceEncoder.INLINE_PREFIX.length)
    : encoded;
  return this.decodeWithCompression(data);
}

// AFTER:
async decodeFromQR(encoded: string): Promise<SequenceData> {
  const data = encoded.startsWith(SequenceEncoder.INLINE_PREFIX)
    ? encoded.slice(SequenceEncoder.INLINE_PREFIX.length)
    : encoded;

  // Check for recipe encoding
  if (data.startsWith("r:")) {
    const { CompositionalDecoder } = await import(
      "$lib/shared/qr/services/implementations/CompositionalDecoder"
    );
    const decoder = new CompositionalDecoder(
      { encode: (s) => this.encode(s) },
      { decode: (s) => this.decode(s) },
      { decompressString: (s) => this.decompressString(s) }
    );
    const flatEncoded = await decoder.decode(data);
    return this.decode(flatEncoded);
  }

  return this.decodeWithCompression(data);
}
```

**Important:** This also changes `decodeFromQR` from sync to async. Check all callers:
- `ShortCodeManager.resolveShortCode()` — calls `this.sequenceEncoder.decodeFromQR(code)`. Need to await.
- Any other callers found by TypeScript errors.

- [ ] **Step 3: Update the interface**

In `src/lib/shared/navigation/services/contracts/ISequenceEncoder.ts`, update the method signatures:
```typescript
// Change:
encodeForQR(sequence: SequenceData): string;
decodeFromQR(encoded: string): SequenceData;

// To:
encodeForQR(sequence: SequenceData): Promise<string>;
decodeFromQR(encoded: string): Promise<SequenceData>;
```

- [ ] **Step 4: Fix all callers**

Run `npm run check` to find all type errors from the sync→async change. Fix each caller by adding `await`. The most likely files:
- `src/lib/shared/qr/services/implementations/ShortCodeManager.ts` — `createOfflineCode` and `resolveShortCode`
- Any test files that call these methods

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/
git add src/lib/shared/qr/
git commit -m "feat: wire compositional encoding into SequenceEncoder"
```

---

### Task 5: Write round-trip tests

**Files:**
- Create: `tests/unit/services/CompositionalEncoding.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/unit/services/CompositionalEncoding.test.ts

import { describe, expect, it } from "vitest";
import { SequenceEncoder } from "$lib/shared/navigation/services/implementations/SequenceEncoder";
import { RECIPE_PREFIX } from "$lib/shared/qr/services/contracts/ICompositionalEncoder";

// Use the same test helpers as SequenceEncoder.test.ts
// (makeStep, createMotionData, etc.)

describe("CompositionalEncoding", () => {
  const encoder = new SequenceEncoder();

  describe("round-trip: encode → decode produces identical sequence", () => {
    it("should use recipe encoding for a strict rotated 16-beat sequence", async () => {
      // TODO: Create a 16-beat strict rotated sequence programmatically
      // using StrictRotatedLOOPExecutor from a 4-beat seed.
      // Then encode it, verify the encoded string starts with "s~r:sr:",
      // decode it, and compare to the original.
    });

    it("should fall back to flat encoding for non-LOOP sequences", async () => {
      // Create a non-circular 8-beat sequence.
      // Encode it, verify it does NOT start with "s~r:",
      // decode it, compare to original.
    });

    it("should fall back to flat when round-trip verification fails", async () => {
      // This tests the safety net. Hard to trigger intentionally
      // since the executors should be deterministic.
      // Could test by mocking the executor to return wrong data.
    });
  });

  describe("recipe encoding is smaller than flat", () => {
    it("should produce a shorter encoded string for quartered rotation", async () => {
      // Encode a 16-beat rotated sequence both ways.
      // Recipe should be significantly shorter.
    });
  });

  describe("hash verification catches corruption", () => {
    it("should throw on tampered recipe data", async () => {
      // Encode a sequence, then modify one character in the compressed seed.
      // Decoding should throw a hash mismatch error.
    });
  });
});
```

**Note to implementer:** The tests need real sequence data with actual LOOP patterns. The easiest way to create this:
1. Create a 4-beat seed sequence with known motions
2. Run `StrictRotatedLOOPExecutor.executeLOOP(seed, SliceSize.QUARTERED)` to get 16 beats
3. Use the 16-beat result as test input for the encoder

Read `tests/unit/services/SequenceEncoder.test.ts` for the `makeStep()` helper pattern. Read `StrictRotatedLOOPExecutor.ts` to understand the executor's input requirements.

- [ ] **Step 2: Run tests**

```bash
npm test -- tests/unit/services/CompositionalEncoding.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/unit/services/CompositionalEncoding.test.ts
git commit -m "test: add round-trip tests for compositional sequence encoding"
```

---

### Task 6: End-to-end verification

No new code — this task verifies the full QR code flow works with compositional encoding.

- [ ] **Step 1: TypeScript check**

```bash
npm run check
```

Filter out pre-existing errors. Zero new errors expected.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Should complete without errors.

- [ ] **Step 3: Browser test — generate QR for a LOOP sequence**

Open the app at `http://localhost:5173`. Navigate to Browse Gallery. Find a sequence with a LOOP badge (rotated icon). Open it in the sequence viewer. Check if the QR code renders (it uses offline encoding which now tries recipe first).

Use Chrome DevTools to verify the QR URL is shorter:
```javascript
// In console, on a page with a LOOP sequence viewer open:
const qrImg = document.querySelector('.qr-code-image');
// The src is a data URL — can't read the encoded URL from it.
// Instead, generate manually:
const mod = await import('/src/lib/shared/di/index.ts');
const encoder = mod.container.items.sequenceEncoder;
const seq = /* get current sequence */;
const encoded = await encoder.encodeForQR(seq);
console.log('Encoded length:', encoded.length);
console.log('Starts with r:', encoded.includes('r:sr:'));
```

- [ ] **Step 4: Browser test — scan the QR code**

Navigate to the QR code URL in a fresh isolated browser context. Verify:
1. The sequence loads correctly
2. All beats render properly
3. No "Sequence Not Found" error

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: compositional sequence encoding for QR codes"
```
