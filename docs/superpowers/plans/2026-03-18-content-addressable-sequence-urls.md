# Content-Addressable Sequence URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ambiguous word-based sequence URLs with self-contained encoded URLs, and add background hash matching to connect shared URLs to their public library records for attribution and prop switching.

**Architecture:** Two independent changes: (1) the copy-link button generates `z:` encoded URLs via the existing `SequenceEncoder.generateViewerURL()`, and (2) a new `PublicSequenceHashMatcher` service computes SHA-256 of the encoder's pipe-delimited output, queries `publicSequences` by a new `encoderHash` field, and enriches the viewer with the matched record.

**Note:** The name `PublicSequenceHashMatcher` is already taken by `features/landing-preview/`. This plan uses `PublicSequenceHashMatcher` (DI key: `publicSequenceHashMatcher`) to avoid collision.

**Tech Stack:** Svelte 5, TypeScript, Firebase Firestore, Web Crypto API (SHA-256), ITI dependency injection

**Spec:** `docs/superpowers/specs/2026-03-18-content-addressable-sequence-urls-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/shared/sequence-viewer/services/contracts/IPublicSequenceHashMatcher.ts` | Create | Interface for hash-based public record matching |
| `src/lib/shared/sequence-viewer/services/implementations/PublicSequenceHashMatcher.ts` | Create | SHA-256 computation + Firestore query |
| `src/lib/shared/di/containers/navigation-container.ts` | Modify | Register `PublicSequenceHashMatcher` in DI |
| `src/lib/shared/di/container-types.ts` | Modify | Add type |
| `src/lib/features/library/domain/models/PublicSequenceIndex.ts` | Modify | Add `encoderHash` field |
| `src/lib/features/library/services/implementations/PublicIndexSyncer.ts` | Modify | Compute + write `encoderHash` on publish |
| `src/routes/sequence/[id]/RouteViewerHeader.svelte` | Modify | Generate encoded URL on copy-link |
| `src/routes/sequence/[id]/+page.svelte` | Modify | Background hash match, enrichment, pass sequence to header |
| `scripts/backfill-encoder-hash.cjs` | Create | One-time migration for existing public docs |

---

### Task 1: `IPublicSequenceHashMatcher` Interface

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/contracts/IPublicSequenceHashMatcher.ts`

- [ ] **Step 1: Create the interface**

```typescript
/**
 * IPublicSequenceHashMatcher - Matches decoded URL sequences against the public library
 *
 * Computes a SHA-256 fingerprint from the SequenceEncoder's pipe-delimited output
 * and queries publicSequences by encoderHash. Used for progressive enrichment:
 * if a shared URL matches a published sequence, the viewer gains attribution
 * and the "Creator's choice" prop toggle.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";

export interface SequenceMatchResult {
  readonly matched: boolean;
  readonly publicRecord: PublicSequenceIndex | null;
}

export interface IPublicSequenceHashMatcher {
  /**
   * Compute encoderHash for a sequence and look it up in publicSequences.
   * Returns the matched public record or null. Fire-and-forget safe —
   * callers should wrap in try/catch and treat failure as "no match".
   */
  findPublicMatch(sequence: SequenceData): Promise<SequenceMatchResult>;

  /**
   * Compute the SHA-256 encoder hash for a sequence.
   * Useful for the write path (PublicIndexSyncer stores this on publish).
   */
  computeEncoderHash(sequence: SequenceData): Promise<string>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/contracts/IPublicSequenceHashMatcher.ts
git commit -m "feat: add IPublicSequenceHashMatcher interface for URL-to-library matching"
```

---

### Task 2: `PublicSequenceHashMatcher` Implementation

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/implementations/PublicSequenceHashMatcher.ts`

- [ ] **Step 1: Implement the service**

```typescript
/**
 * PublicSequenceHashMatcher - Matches URL-decoded sequences to public library records
 *
 * Uses the SequenceEncoder's deterministic pipe-delimited output as the canonical
 * form for hashing. The same encoder output that creates the URL also creates the
 * hash, so roundtrip identity is guaranteed: encode(decode(str)) === str.
 *
 * The SHA-256 hash is computed via Web Crypto API (native, zero dependencies).
 */

import {
  collection,
  query,
  where,
  getDocs,
  limit,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencesPath } from "$lib/features/library/data/firestore-paths";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";
import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
import type {
  IPublicSequenceHashMatcher,
  SequenceMatchResult,
} from "../contracts/IPublicSequenceHashMatcher";

export class PublicSequenceHashMatcher implements IPublicSequenceHashMatcher {
  constructor(private readonly encoder: ISequenceEncoder) {}

  async findPublicMatch(
    sequence: SequenceData
  ): Promise<SequenceMatchResult> {
    const hash = await this.computeEncoderHash(sequence);
    const firestore = await getFirestoreInstance();

    const snap = await getDocs(
      query(
        collection(firestore, getPublicSequencesPath()),
        where("encoderHash", "==", hash),
        limit(1)
      )
    );

    if (snap.empty) {
      return { matched: false, publicRecord: null };
    }

    const doc = snap.docs[0]!;
    return {
      matched: true,
      publicRecord: { id: doc.id, ...doc.data() } as PublicSequenceIndex,
    };
  }

  async computeEncoderHash(sequence: SequenceData): Promise<string> {
    const pipeString = this.encoder.encode(sequence);
    return this.sha256(pipeString);
  }

  private async sha256(input: string): Promise<string> {
    const buffer = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/implementations/PublicSequenceHashMatcher.ts
git commit -m "feat: implement PublicSequenceHashMatcher with SHA-256 encoder hash"
```

---

### Task 3: Register `PublicSequenceHashMatcher` in DI

**Files:**
- Modify: `src/lib/shared/di/containers/navigation-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Add to navigation container**

In `navigation-container.ts`, add a new `.add()` layer that creates `PublicSequenceHashMatcher` using the existing `sequenceEncoder`:

```typescript
// After the existing .add() that creates urlSyncer and deepLinker:
.add((ctx) => ({
  publicSequenceHashMatcher: () => new PublicSequenceHashMatcher(ctx.sequenceEncoder),
}))
```

Add the import at the top:
```typescript
import { PublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/services/implementations/PublicSequenceHashMatcher";
```

- [ ] **Step 2: Add type to container-types.ts**

Find the navigation container type imports and the `IAppContainerItems` intersection. Add `publicSequenceHashMatcher` to the items exposed by the navigation container type. (The exact pattern follows the existing `sequenceEncoder` registration.)

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/navigation-container.ts src/lib/shared/di/container-types.ts
git commit -m "feat: register PublicSequenceHashMatcher in DI container"
```

---

### Task 4: Add `encoderHash` to `PublicSequenceIndex` Type

**Files:**
- Modify: `src/lib/features/library/domain/models/PublicSequenceIndex.ts`

- [ ] **Step 1: Add field to interface**

In the `PublicSequenceIndex` interface, in the "COMPOSITIONAL DATA" section (after `contentHash`), add:

```typescript
  /** SHA-256 of SequenceEncoder.encode() output — used for URL-to-library matching */
  readonly encoderHash?: string;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/library/domain/models/PublicSequenceIndex.ts
git commit -m "feat: add encoderHash field to PublicSequenceIndex type"
```

---

### Task 5: Compute `encoderHash` on Publish

**Files:**
- Modify: `src/lib/features/library/services/implementations/PublicIndexSyncer.ts`

- [ ] **Step 1: Add encoder hash computation to `syncToPublicIndex`**

The `PublicIndexSyncer` constructor currently takes `contentModerator`, `contentAppealManager`, and `browseLoader`. It needs access to `IPublicSequenceHashMatcher.computeEncoderHash()`. Rather than adding a constructor dependency (which would require changing the library container wiring), use the `container` import that `PublicIndexSyncer` already imports:

In the `syncToPublicIndex` method, after the `publicData` object is built (around line 148), compute the encoder hash:

```typescript
// Compute encoder hash for URL-to-library matching.
// The sequence needs full steps for encoding — which LibrarySequence has.
let encoderHash: string | undefined;
try {
  const matcher = container.items.publicSequenceHashMatcher;
  // LibrarySequence extends SequenceData, so no cast needed
  encoderHash = await matcher.computeEncoderHash(sequence);
} catch {
  // Non-critical — sequence will still publish, just won't be URL-matchable
}
```

Then add `encoderHash` to the `publicData` object:

```typescript
encoderHash,
```

Add it alongside the existing `contentHash: sequence.contentHash,` line.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No new TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/library/services/implementations/PublicIndexSyncer.ts
git commit -m "feat: compute and store encoderHash on public sequence publish"
```

---

### Task 6: Fix Copy-Link Button to Generate Encoded URLs

**Files:**
- Modify: `src/routes/sequence/[id]/RouteViewerHeader.svelte`
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Update RouteViewerHeader props**

In `RouteViewerHeader.svelte`, change the `Props` interface:

Replace:
```typescript
    /** Sequence ID for copy-link */
    sequenceId?: string;
    /** Sequence word for copy-link */
    sequenceWord?: string;
```

With:
```typescript
    /** Full sequence data for generating encoded share URL */
    sequence?: SequenceData | null;
```

Add the import:
```typescript
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
```

Update the destructure to match:
```typescript
    sequence,
```

Remove the old `sequenceId` and `sequenceWord` from the destructure.

- [ ] **Step 2: Update `handleCopyLink` to generate encoded URL**

Replace the existing `handleCopyLink` function:

```typescript
  function handleCopyLink() {
    if (!sequence) return;
    const encoder = container.items.sequenceEncoder;
    const { url } = encoder.generateViewerURL(sequence, { compress: true });
    navigator.clipboard.writeText(url).then(() => {
      copyLinkFeedback = true;
      setTimeout(() => { copyLinkFeedback = false; }, 1500);
    });
  }
```

Add the import:
```typescript
import { container } from "$lib/shared/di";
```

- [ ] **Step 3: Update `+page.svelte` to pass `sequence` prop**

In `+page.svelte`, find where `RouteViewerHeader` is rendered (around line 526-538). Change:

```svelte
          sequenceId={sequence?.id}
          sequenceWord={sequence?.word}
```

To:

```svelte
          sequence={sequence}
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No new TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/sequence/[id]/RouteViewerHeader.svelte src/routes/sequence/[id]/+page.svelte
git commit -m "feat: copy-link button generates self-contained encoded URLs"
```

---

### Task 7: Background Hash Match on URL Open

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Add background match after decode**

In `+page.svelte`, inside the `initializeRoute` function, after the encoded sequence is successfully decoded and assigned (around line 280, after `isLoading = false`), add a fire-and-forget background match:

```typescript
          // Background: try to match against public library for attribution
          void matchPublicRecord(sequence!);
```

- [ ] **Step 2: Add the `matchPublicRecord` function**

Add this function in the route-specific state section of `+page.svelte`:

```typescript
  /**
   * Fire-and-forget: compute encoderHash, query publicSequences, enrich viewer.
   * If it fails (offline, no match, error), the viewer works fine from URL data alone.
   */
  async function matchPublicRecord(seq: SequenceData) {
    try {
      const matcher = container.items.publicSequenceHashMatcher;
      const result = await matcher.findPublicMatch(seq);

      if (result.matched && result.publicRecord) {
        const pub = result.publicRecord;
        // Enrich the viewer's sequence with library metadata
        sequence = {
          ...seq,
          ownerId: pub.ownerId,
          ownerDisplayName: pub.ownerDisplayName,
          intendedProp: seq.intendedProp, // Keep decoded props
          creatorIntent: pub.creatorIntent ?? undefined,
          // Only overwrite word if the decoded sequence didn't already derive one
          word: seq.word || pub.word,
          name: seq.name === "Shared Sequence" ? pub.name : seq.name,
        } as SequenceData;
      }
    } catch {
      // Silent failure — progressive enhancement only
    }
  }
```

Add the import for `IPublicSequenceHashMatcher` type if needed for the container access.

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte
git commit -m "feat: background hash match enriches shared URL viewer with library data"
```

---

### Task 8: Backfill Migration Script

**Files:**
- Create: `scripts/backfill-encoder-hash.cjs`

- [ ] **Step 1: Write the migration script**

This script iterates `publicSequences` docs, fetches the source library doc via `sourceRef` (which has full steps), runs `SequenceEncoder.encode()`, SHA-256 hashes it, and writes `encoderHash` back. Skips docs that already have `encoderHash`.

```javascript
#!/usr/bin/env node
/**
 * Backfill encoderHash for existing publicSequences documents.
 *
 * publicSequences docs don't store steps — they store thumbnails, metrics,
 * and metadata. The encoder needs full motion data per step, so this script
 * fetches from sourceRef (the user's library doc) to get the steps.
 *
 * Usage: node scripts/backfill-encoder-hash.cjs [--dry-run] [--limit N]
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

// --- Minimal SequenceEncoder port (encode only) ---
// This is a standalone port of the encoding logic from
// src/lib/shared/navigation/services/implementations/SequenceEncoder.ts
// so the script can run without bundling the full app.

const LOCATION_ENCODE = {
  north: "no", east: "ea", south: "so", west: "we",
  northeast: "ne", southeast: "se", southwest: "sw", northwest: "nw",
  center: "c",
};

const ORIENTATION_ENCODE = {
  in: "i", out: "o", clock: "k", counter: "t",
  "clock-in": "I", "clock-out": "O", "counter-in": "N", "counter-out": "U",
  center_n: "1", center_ne: "2", center_e: "3", center_se: "4",
  center_s: "5", center_sw: "6", center_w: "7", center_nw: "8",
};

const ROTATION_ENCODE = {
  clockwise: "c", counter_clockwise: "u", no_rotation: "x",
};

const MOTION_TYPE_ENCODE = {
  pro: "p", anti: "a", float: "l", dash: "d", static: "s",
};

const PROP_TYPE_ENCODE = {
  staff: "S", simplestaff: "s", bigstaff: "1", staff2: "2",
  club: "C", bigclub: "c", fan: "F", bigfan: "f",
  triad: "T", bigtriad: "t", minihoop: "M", bighoop: "H",
  buugeng: "B", bigbuugeng: "b", fractalgeng: "R", trigeng: "J",
  hand: "X", triquetra: "Q", triquetra2: "q", sword: "W",
  chicken: "K", bigchicken: "k", guitar: "G", ukulele: "u",
  doublestar: "D", bigdoublestar: "d", eightrings: "E", bigeightrings: "e",
  contactball: "A", bigcontactball: "a", doublecontactball: "V",
  bigdoublecontactball: "v", quiad: "I", torch: "O", bigtorch: "L", poi: "P",
};

function encodeMotion(m) {
  if (!m) return "";
  const sl = LOCATION_ENCODE[m.startLocation];
  const el = LOCATION_ENCODE[m.endLocation];
  const so = ORIENTATION_ENCODE[m.startOrientation];
  const eo = ORIENTATION_ENCODE[m.endOrientation];
  const rd = ROTATION_ENCODE[m.rotationDirection];
  const t = m.turns === "fl" ? "f" : String(m.turns);
  const mt = MOTION_TYPE_ENCODE[m.motionType];
  const pt = PROP_TYPE_ENCODE[m.propType];
  if (!sl || !el || !so || !eo || !rd || !mt || !pt) return "";
  return `${sl}${el}${so}${eo}${rd}${t}${mt}${pt}`;
}

function encodeBeat(beat) {
  const motions = beat.motions || { blue: undefined, red: undefined };
  return `${encodeMotion(motions.blue)}:${encodeMotion(motions.red)}`;
}

function encodeSequence(seq) {
  const sp = seq.startPosition || seq.startingPosition;
  const startEnc = sp ? encodeBeat(sp) : ":";
  const steps = seq.steps || [];
  const stepEncs = steps
    .filter((s) => s.stepNumber !== 0)
    .map((s) => encodeBeat(s));
  return `${startEnc}|${stepEncs.join("|")}`;
}

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const batchLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  // Initialize Firebase Admin
  // Uses GOOGLE_APPLICATION_CREDENTIALS env var or default service account
  initializeApp();
  const db = getFirestore();

  const publicSeqRef = db.collection("publicSequences");
  const snapshot = await publicSeqRef.get();

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let updated = 0;

  for (const pubDoc of snapshot.docs) {
    if (updated >= batchLimit) break;

    const pubData = pubDoc.data();

    // Skip if already has encoderHash
    if (pubData.encoderHash) {
      skipped++;
      continue;
    }

    // Fetch source library doc (has full steps)
    const sourceRef = pubData.sourceRef;
    if (!sourceRef) {
      console.warn(`[SKIP] ${pubDoc.id}: no sourceRef`);
      failed++;
      continue;
    }

    try {
      const sourceDoc = await db.doc(sourceRef).get();
      if (!sourceDoc.exists) {
        console.warn(`[SKIP] ${pubDoc.id}: sourceRef ${sourceRef} not found`);
        failed++;
        continue;
      }

      const sourceData = sourceDoc.data();
      if (!sourceData.steps || sourceData.steps.length === 0) {
        console.warn(`[SKIP] ${pubDoc.id}: no steps in source`);
        failed++;
        continue;
      }

      const pipeString = encodeSequence(sourceData);
      const hash = sha256(pipeString);

      if (dryRun) {
        console.log(`[DRY] ${pubDoc.id} (${pubData.word}): ${hash.slice(0, 12)}...`);
      } else {
        await pubDoc.ref.update({ encoderHash: hash });
        console.log(`[OK]  ${pubDoc.id} (${pubData.word}): ${hash.slice(0, 12)}...`);
      }
      updated++;
    } catch (err) {
      console.error(`[ERR] ${pubDoc.id}: ${err.message}`);
      failed++;
    }

    processed++;
  }

  console.log(`\nDone. Processed: ${processed}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  if (dryRun) console.log("(dry run — no writes made)");
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/backfill-encoder-hash.cjs
git commit -m "feat: add backfill script for encoderHash on publicSequences"
```

---

### Task 9: Verify End-to-End

- [ ] **Step 1: Run TypeScript check**

Run: `npm run check`
Expected: Clean pass, no new errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 3: Manual verification checklist**

Using the running dev server at localhost:5173:
1. Open a sequence from browse gallery
2. Click the copy-link button
3. Verify the copied URL starts with `/sequence/z:` (not `/sequence/WORD`)
4. Open the copied URL in a new tab
5. Verify the sequence renders correctly
6. Verify the word is rederived (shown in viewer)

- [ ] **Step 4: Final commit with all changes**

If any fixups were needed during verification:
```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```
