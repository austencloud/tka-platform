# Share Target Intake (Native Path) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Flow Arts Composer appear in the Android share sheet so a shared image resolves its TKA card QR, or lands in the inbox with a conversation picker.

**Architecture:** One `share-intake` module owns a normalized payload and all routing. A thin native adapter converts `@capgo/capacitor-share-target`'s URI descriptors into `File` objects and hands them over. Records persist to IndexedDB before any auth check so a share survives sign-in. The PWA adapter is deliberately **out of scope** — see Scope.

**Tech Stack:** Capacitor 8.4.2, `@capgo/capacitor-share-target` v8.0.44, Svelte 5 runes, IndexedDB, vitest.

**Spec:** [`../specs/2026-07-28-share-target-intake-design.md`](../specs/2026-07-28-share-target-intake-design.md)

---

## Scope

This plan covers the **native path only**. The spec's PWA half (manifest
`share_target` + service-worker POST interception) is deferred because two of
its lifecycle risks are unproven on a device: service-worker version skew, and
whether `launch_handler: "focus-existing"` swallows the POST. Planning around
two unknowns produces a plan that dies on contact.

The native path is also the only one that reaches a Play-build device — the
manifest `share_target` is inert inside the Capacitor shell.

Everything here is real, verified API. The plugin was spiked on 2026-07-28
(v8.0.44); its event shape and limitations are recorded in the spec.

**Working directory:** `E:/tka-platform` on `main`. Do **not** create a branch
or worktree (`.claude/rules/worktree-workflow.md`).

**Commits:** always scoped — `git commit -m "..." -- <explicit paths>`. The
index is shared with other agent sessions
(`.claude/rules/commit-only-your-own-changes.md`).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/shared/share-intake/domain/share-intake-models.ts` | Types: `SharedIntake`, `IntakeItem`, `IntakeProblem` | 2, 3, 7 |
| `src/lib/shared/share-intake/domain/derive-receipt-id.ts` | Content-derived dedup key | 2 |
| `src/lib/shared/inbox/domain/image-attachment-limits.ts` | The single source of the 10 MB / JPEG-PNG-WebP limits | 3 |
| `src/lib/shared/share-intake/services/intake-validator.ts` | Pre-bridge descriptor screen + post-bridge file gate | 3 |
| `src/lib/shared/qr/services/tka-qr-detector.ts` | Widened to `ImageBitmapSource` so a `File` decodes directly | 4 |
| `src/lib/shared/share-intake/services/shared-file-bridge.ts` | `SharedFile` URI → `File` (**highest-risk unit**) | 5 |
| `src/lib/shared/share-intake/services/intake-store.ts` | IndexedDB durable record (bytes, not `File`) + reaping + quota | 6 |
| `src/lib/shared/share-intake/services/intake-classifier.ts` | Per-item card / image / duplicate classification | 7 |
| `src/lib/shared/inbox/domain/pending-message-attachment.ts` | Sequence arm widened to `SequenceSharePayload` | 8 |
| `src/lib/shared/inbox/state/inbox-state.svelte.ts` | `send-sequence` → `send-attachment` | 8 |
| `src/lib/shared/inbox/state/send-sequence-state.svelte.ts` | `openSendAttachmentSheet` alongside `openSendSequenceSheet` | 8 |
| `src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte` | Renamed sheet; sends an image OR a sequence | 8 |
| `src/lib/shared/share-intake/services/intake-router.ts` | Classification → cards filed / picker opened | 9 |
| `src/lib/shared/share-intake/services/share-intake-runner.ts` | **The consumer.** Loads, classifies, routes, advances, deletes | 10 |
| `src/lib/shared/share-intake/services/native-share-adapter.ts` | Plugin listener → persisted intake; registration barrier | 11 |
| `src/lib/shared/share-intake/get-share-intake.ts` | Idempotent registration getter | 11 |
| `android/app/src/main/AndroidManifest.xml` | `ACTION_SEND` / `ACTION_SEND_MULTIPLE` filters | 1 ✅ |
| `src/lib/shared/platform/services/native-initializer.ts` | Boot barrier so a share doesn't race `/create` | 11 |

**Tasks 0, 1 and 2 are DONE and committed** (`4c3924953e`, `134fa444f1`,
`61a8c52307`). Their steps below are no-ops kept for the record. Start at
Task 3.

---

### Task 0: Fix the pre-existing `clients.claim()` bug — DONE (`4c3924953e` lineage)

Independent of this feature — found while investigating. `self.clients.claim()`
sits outside the `event.waitUntil()` block, so activation can complete before
clients are claimed.

**Files:**
- Modify: `static/sw.js:99-113`

- [ ] **Step 1: Read the current activate handler**

Run: `sed -n '99,114p' static/sw.js`

Expected: `self.clients.claim();` appears AFTER the closing `);` of `event.waitUntil(`.

- [ ] **Step 2: Move the claim inside waitUntil**

Replace the whole `activate` listener with:

```js
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME && name !== ASSETS_3D_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});
```

- [ ] **Step 3: Verify the existing SW test still passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/sw-offline-behavior.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(sw): claim clients inside the activate waitUntil" -- static/sw.js
```

---

### Task 1: Install the plugin and declare the intent filters — DONE

No test — this is native config. Verified by Task 8's device check.

**Files:**
- Modify: `package.json`
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Install the plugin**

Run: `npm install @capgo/capacitor-share-target@8.0.44`
Expected: added to `dependencies`, no peer warnings (peer is `@capacitor/core >=8.0.0`; repo has 8.4.2).

- [ ] **Step 2: Add the intent filters**

In `android/app/src/main/AndroidManifest.xml`, inside the existing
`<activity android:name=".MainActivity">` block, after the App Links
`<intent-filter>`, add:

```xml
<!--
    Share target. MIME types are narrowed to what the message composer
    actually accepts (MessageAttachmentPicker: JPEG/PNG/WebP). Declaring
    image/* would advertise TKA for HEIC - Android's default camera format -
    which we would then have to reject after the user already chose us.
-->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/jpeg" />
    <data android:mimeType="image/png" />
    <data android:mimeType="image/webp" />
    <data android:mimeType="text/plain" />
</intent-filter>
<intent-filter>
    <action android:name="android.intent.action.SEND_MULTIPLE" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/jpeg" />
    <data android:mimeType="image/png" />
    <data android:mimeType="image/webp" />
</intent-filter>
```

- [ ] **Step 3: Verify the manifest parses**

Run: `npx cap sync android`
Expected: completes without error; `@capgo/capacitor-share-target` listed in the plugin output.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(share-intake): register the Android share target" -- package.json package-lock.json android/app/src/main/AndroidManifest.xml
```

---

### Task 2: Domain types and `deriveReceiptId` — DONE (`61a8c52307`)

`BridgeActivity.java:51` calls `onNewIntent(getIntent())` right after `load()`,
and the plugin handles the intent in **both**. A cold-launch share therefore
arrives twice. A random id would produce two sheets and two uploads, so the id
must be derived from content.

**Files:**
- Create: `src/lib/shared/share-intake/domain/share-intake-models.ts`
- Create: `src/lib/shared/share-intake/domain/derive-receipt-id.ts`
- Test: `tests/unit/share-intake/derive-receipt-id.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { deriveReceiptId } from "$lib/shared/share-intake/domain/derive-receipt-id";

// The delimiters an earlier revision of deriveReceiptId used. Named rather
// than inlined: raw control bytes are invisible in an editor and easy to
// mangle in a diff.
const NUL = String.fromCharCode(0);
const STX = String.fromCharCode(2);

describe("deriveReceiptId", () => {
  const shared = {
    files: [{ uri: "/cache/shared_files/a.png", name: "a.png", mimeType: "image/png", size: 1024 }],
    texts: ["hello"],
  };

  it("returns the same id for a duplicated intent", () => {
    expect(deriveReceiptId(shared)).toBe(deriveReceiptId({ ...shared }));
  });

  it("differs when the file name differs", () => {
    const other = { ...shared, files: [{ ...shared.files[0], name: "b.png" }] };
    expect(deriveReceiptId(other)).not.toBe(deriveReceiptId(shared));
  });

  it("differs when the text differs", () => {
    expect(deriveReceiptId({ ...shared, texts: ["goodbye"] })).not.toBe(deriveReceiptId(shared));
  });

  it("handles a text-only share with no files", () => {
    expect(deriveReceiptId({ files: [], texts: ["tka.run/ABC"] })).toMatch(/^si_[0-9A-Za-z]{22}$/);
  });

  it("is order-independent across files", () => {
    const a = { files: [{ uri: "/x", name: "x", mimeType: "image/png", size: 1 }, { uri: "/y", name: "y", mimeType: "image/png", size: 2 }], texts: [] };
    const b = { files: [a.files[1], a.files[0]], texts: [] };
    expect(deriveReceiptId(a)).toBe(deriveReceiptId(b));
  });

  // The headline invariant: the two cold-launch deliveries of ONE share can
  // carry different cache paths. If a future edit folds uri into the material,
  // dedup silently breaks and every cold-launch share doubles. Guard it.
  it("ignores the uri entirely", () => {
    const a = { files: [{ uri: "/cache/first/a.png", name: "a.png", mimeType: "image/png", size: 1024 }], texts: [] };
    const b = { files: [{ ...a.files[0], uri: "/cache/second/a.png" }], texts: [] };
    expect(deriveReceiptId(a)).toBe(deriveReceiptId(b));
  });

  it("differs when only the size differs", () => {
    const other = { ...shared, files: [{ ...shared.files[0], size: 2048 }] };
    expect(deriveReceiptId(other)).not.toBe(deriveReceiptId(shared));
  });

  it("distinguishes an absent size from a zero size", () => {
    const absent = { files: [{ uri: "/a", name: "a.png", mimeType: "image/png" }], texts: [] };
    const zero = { files: [{ ...absent.files[0], size: 0 }], texts: [] };
    expect(deriveReceiptId(absent)).not.toBe(deriveReceiptId(zero));
  });

  it("differs when only the mime type differs", () => {
    const other = { ...shared, files: [{ ...shared.files[0], mimeType: "image/jpeg" }] };
    expect(deriveReceiptId(other)).not.toBe(deriveReceiptId(shared));
  });

  // mimeType and text come from whichever app invoked the share, so they are
  // untrusted input. Length-prefixing is what stops a crafted value from
  // shifting a field boundary and forging a collision with a pending intake.
  it("resists delimiter injection in untrusted fields", () => {
    const split = { files: [], texts: ["a", "b"] };
    const joined = { files: [], texts: [`a${STX}b`] };
    expect(deriveReceiptId(split)).not.toBe(deriveReceiptId(joined));

    // The bytes below are the delimiters an earlier revision of this function
    // used. Under ANY delimiter scheme, embedding them in untrusted content
    // shifts a field boundary and forges a collision. Length-prefixing makes no
    // byte special, so these pairs must stay distinct. Both assertions below
    // FAIL against the delimiter-based implementation - that is the point.
    const injectedText = { files: [], texts: [`a${STX}b`] };
    const twoTexts = { files: [], texts: ["a", "b"] };
    expect(deriveReceiptId(injectedText)).not.toBe(deriveReceiptId(twoTexts));

    const nameCarries = { files: [{ uri: "/a", name: `a${NUL}b`, mimeType: "c", size: 1 }], texts: [] };
    const mimeCarries = { files: [{ uri: "/a", name: "a", mimeType: `b${NUL}c`, size: 1 }], texts: [] };
    expect(deriveReceiptId(nameCarries)).not.toBe(deriveReceiptId(mimeCarries));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/derive-receipt-id.test.ts`
Expected: FAIL — cannot resolve module `derive-receipt-id`.

- [ ] **Step 3: Write the models**

Create `src/lib/shared/share-intake/domain/share-intake-models.ts`:

```ts
/** Where an intake came from. Only "native" is implemented; "pwa" is reserved. */
export type ShareIntakeSource = "native" | "pwa";

export type ShareIntakeStatus =
  | "received"
  | "needs-auth"
  | "ready"
  | "partially-sent"
  | "failed"
  | "expired";

/** A file as the plugin hands it to us: a path, not bytes. */
export interface SharedFileDescriptor {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/** Normalized payload. Everything downstream is platform-blind. */
export interface SharedIntake {
  receiptId: string;
  source: ShareIntakeSource;
  files: File[];
  text?: string;
  title?: string;
  status: ShareIntakeStatus;
  receivedAt: number;
}

/**
 * What `deriveReceiptId` hashes. Deliberately NOT `SharedIntake`: the id has to
 * be computed from the plugin's raw descriptors, before any File exists.
 *
 * `texts` is plural while `SharedIntake.text` is a single optional string
 * because Android can deliver several EXTRA_TEXT values. The adapter maps
 * absence to an EMPTY ARRAY, never to `[""]` - the two hash differently, and
 * picking the wrong one desyncs the id between the two cold-launch deliveries.
 *
 * `title` (Android EXTRA_SUBJECT) is intentionally NOT hashed: it is decorative,
 * and some senders populate it inconsistently between deliveries.
 */
export interface ReceiptInput {
  files: SharedFileDescriptor[];
  texts: string[];
}

/** Per-item routing decision. Classification is per file, never per batch. */
export type IntakeItem =
  | { kind: "card"; code: string; file: File }
  | { kind: "image"; file: File };

export interface IntakeClassification {
  items: IntakeItem[];
  /** A TKA code found in the shared text, if any. */
  textCode: string | null;
  /** Shared text that was not a TKA code. Becomes prefilled message text. */
  residualText: string | null;
}
```

- [ ] **Step 4: Write `deriveReceiptId`**

Create `src/lib/shared/share-intake/domain/derive-receipt-id.ts`:

```ts
import { hashString } from "$lib/shared/foundation/services/content-hasher";
import type { ReceiptInput } from "./share-intake-models";

/**
 * Length-prefix a field so its content cannot shift a boundary in the hashed
 * material. `mimeType` and the shared text come from whichever app invoked the
 * share, so they are untrusted: with plain delimiters, a crafted value lets an
 * unrelated share forge the receipt id of a pending one and be swallowed as a
 * duplicate.
 */
function field(value: string): string {
  return `${value.length}:${value}`;
}

/**
 * A stable id derived from the share's CONTENT, not from a counter or clock.
 *
 * Why this matters: Capacitor's BridgeActivity calls onNewIntent(getIntent())
 * immediately after load(), and @capgo/capacitor-share-target handles the
 * intent in both. A cold-launch share fires twice. Deriving the id from content
 * makes the second delivery a no-op instead of a duplicate upload.
 *
 * Files are sorted so two deliveries that enumerate in a different order still
 * collapse to one id. The uri is deliberately EXCLUDED - the plugin can write
 * the same share to a different cache path on the second delivery.
 *
 * Consequence worth knowing: two genuinely different files that agree on
 * name + mimeType + size hash identically. That is the accepted cost of
 * excluding the uri without reading bytes, and it is bounded by the store's
 * one-hour TTL (Task 5).
 */
export function deriveReceiptId(input: ReceiptInput): string {
  const fileParts = input.files
    .map((f) =>
      [
        field(f.name),
        field(f.mimeType),
        // "-" and "0" must not collapse: if one delivery reports a size and the
        // other omits it, the ids MUST diverge visibly rather than silently
        // agreeing on a sentinel that hides the desync.
        field(f.size === undefined ? "-" : String(f.size)),
      ].join("")
    )
    .sort();

  // The file count is length-prefixed first, so the files/texts boundary is
  // positional and cannot be forged by any field value.
  const material = [
    field(String(fileParts.length)),
    ...fileParts,
    ...input.texts.map(field),
  ].join("");

  // hashString is the repo's 128-bit FNV-1a, emitting a fixed-width 22-char
  // base62 digest (content-hasher.ts:156). Fixed width matters: concatenating
  // two variable-length digests makes its own split point ambiguous.
  return `si_${hashString(material)}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/derive-receipt-id.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(share-intake): content-derived receipt id for cold-launch dedup" -- src/lib/shared/share-intake/domain/ tests/unit/share-intake/derive-receipt-id.test.ts
```

---

### Task 3: Shared image limits, the problem record, and the validation gate

Three things that have to land together:

1. The 10 MB / JPEG-PNG-WebP limits are currently **copy-duplicated** —
   `MessageAttachmentPicker.svelte:9-11` declares them inline and the first
   draft of this plan declared them again in the validator. Two copies of a
   security boundary drift. One module owns them; both import it.
2. `IntakeProblem` — the record that makes "nothing fails silently" possible.
   Every drop from here to Task 11 pushes one of these onto the intake.
3. The gate itself, in **two halves**: `screenDescriptors` runs on the plugin's
   raw descriptors **before** the bridge reads a single byte (mime type + count),
   and `validateIntake` runs on the bridged `File`s (size, emptiness, names,
   text, title).

The split matters: with a single post-bridge gate, a 200 MB HEIC is fully read
into WebView memory and only then rejected.

**Files:**
- Create: `src/lib/shared/inbox/domain/image-attachment-limits.ts`
- Modify: `src/lib/shared/inbox/components/messages/MessageAttachmentPicker.svelte:9-11`
- Modify: `src/lib/shared/share-intake/domain/share-intake-models.ts` (add `IntakeProblem`, `SharedIntake.problems`)
- Create: `src/lib/shared/share-intake/services/intake-validator.ts`
- Test: `tests/unit/share-intake/intake-validator.test.ts`

- [ ] **Step 1: Create the shared limits module**

Create `src/lib/shared/inbox/domain/image-attachment-limits.ts`:

```ts
/**
 * The one place the message-attachment image limits live.
 *
 * MessageAttachmentPicker declared these inline and share intake needs exactly
 * the same numbers - intake bypasses the picker entirely, so a second copy is
 * a security boundary that can drift. Both import from here.
 */

/** Matches the picker's original MAX_IMAGE_BYTES. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Deliberately not `image/*`. HEIC is Android's default camera format and the
 * composer cannot decode it, so advertising it would mean rejecting the user
 * AFTER they already picked TKA from the share sheet.
 */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageType = (typeof IMAGE_TYPES)[number];

/** `accept` attribute value for a file input. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");

const ALLOWED = new Set<string>(IMAGE_TYPES);

export function isAllowedImageType(
  mimeType: string
): mimeType is AllowedImageType {
  return ALLOWED.has(mimeType.trim().toLowerCase());
}
```

- [ ] **Step 2: Point the picker at it**

In `src/lib/shared/inbox/components/messages/MessageAttachmentPicker.svelte`,
delete these three lines (currently 9-11):

```ts
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
  const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
```

and add this import next to the other `../../domain/` import (line 6):

```ts
  import {
    MAX_IMAGE_BYTES,
    IMAGE_TYPES,
    IMAGE_ACCEPT,
  } from "../../domain/image-attachment-limits";
```

Nothing else in the file changes — the three identifiers keep their names.

- [ ] **Step 3: Add `IntakeProblem` to the domain model**

In `src/lib/shared/share-intake/domain/share-intake-models.ts`, insert after the
`SharedFileDescriptor` interface:

```ts
/**
 * Why one piece of a share did not make it. Every drop in the pipeline pushes
 * one of these onto the intake and logs it. A bare `return` that swallows a
 * file is the failure mode this type exists to make impossible.
 */
export type IntakeProblemReason =
  | "unsupported-type"
  | "too-large"
  | "empty"
  | "too-many"
  | "unreachable"
  | "not-found"
  | "text-truncated"
  | "title-truncated"
  | "decode-failed"
  | "resolve-failed"
  | "route-failed"
  | "send-dropped";

export interface IntakeProblem {
  /** The file (or code) this concerns. Empty string when it concerns the share itself. */
  name: string;
  reason: IntakeProblemReason;
  /** Technical detail for the console. Never rendered raw to the user. */
  detail?: string;
}
```

and add the field to `SharedIntake`, after `receivedAt`:

```ts
  /** Everything that was dropped, truncated, or failed. Never empty silently. */
  problems: IntakeProblem[];
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/share-intake/intake-validator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MAX_IMAGE_BYTES } from "$lib/shared/inbox/domain/image-attachment-limits";
import {
  validateIntake,
  screenDescriptors,
  safeName,
  MAX_INTAKE_BYTES,
  MAX_INTAKE_FILES,
  MAX_INTAKE_TEXT,
  MAX_INTAKE_TITLE,
  MAX_INTAKE_NAME,
} from "$lib/shared/share-intake/services/intake-validator";

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function descriptor(name: string, mimeType: string) {
  return { uri: `/cache/shared_files/${name}`, name, mimeType };
}

const reasons = (result: { problems: { reason: string }[] }) =>
  result.problems.map((p) => p.reason);

describe("intake limits", () => {
  it("uses the picker's byte cap rather than a second copy of it", () => {
    expect(MAX_INTAKE_BYTES).toBe(MAX_IMAGE_BYTES);
  });
});

describe("safeName", () => {
  it("strips any directory component", () => {
    expect(safeName("../../evil.png")).toBe("evil.png");
  });

  it("falls back for an all-dots basename", () => {
    expect(safeName("..")).toBe("shared-image");
    expect(safeName("...")).toBe("shared-image");
  });

  it("falls back for an empty or control-only name", () => {
    expect(safeName("")).toBe("shared-image");
    expect(safeName("\u0007\u0007")).toBe("shared-image");
  });

  it("caps a long name and keeps the extension", () => {
    const long = `${"a".repeat(400)}.png`;
    const result = safeName(long);
    expect(result.length).toBe(MAX_INTAKE_NAME);
    expect(result.endsWith(".png")).toBe(true);
  });
});

describe("screenDescriptors", () => {
  it("admits the allowed mime types", () => {
    const result = screenDescriptors([
      descriptor("a.png", "image/png"),
      descriptor("b.jpg", "image/jpeg"),
      descriptor("c.webp", "image/webp"),
    ]);
    expect(result.admitted).toHaveLength(3);
    expect(result.problems).toHaveLength(0);
  });

  it("rejects an unsupported type BEFORE anything reads its bytes", () => {
    const result = screenDescriptors([descriptor("a.heic", "image/heic")]);
    expect(result.admitted).toHaveLength(0);
    expect(reasons(result)).toEqual(["unsupported-type"]);
  });

  it("reports unsupported-type, not too-many, for an over-cap rejected type", () => {
    const files = [
      ...Array.from({ length: MAX_INTAKE_FILES }, (_, i) =>
        descriptor(`ok${i}.png`, "image/png")
      ),
      descriptor("late.heic", "image/heic"),
    ];
    const result = screenDescriptors(files);
    expect(result.admitted).toHaveLength(MAX_INTAKE_FILES);
    expect(reasons(result)).toEqual(["unsupported-type"]);
  });

  it("caps the count once the type check has passed", () => {
    const files = Array.from({ length: MAX_INTAKE_FILES + 3 }, (_, i) =>
      descriptor(`f${i}.png`, "image/png")
    );
    const result = screenDescriptors(files);
    expect(result.admitted).toHaveLength(MAX_INTAKE_FILES);
    expect(reasons(result)).toEqual(["too-many", "too-many", "too-many"]);
  });

  it("reports the sanitized name, not the raw one", () => {
    const result = screenDescriptors([descriptor("../../evil.heic", "image/heic")]);
    expect(result.problems[0].name).toBe("evil.heic");
  });
});

describe("validateIntake", () => {
  it("accepts a normal png", () => {
    const result = validateIntake({ files: [fileOf("a.png", "image/png", 100)] });
    expect(result.accepted).toHaveLength(1);
    expect(result.problems).toHaveLength(0);
  });

  it("rejects a zero-byte file", () => {
    const result = validateIntake({ files: [fileOf("empty.png", "image/png", 0)] });
    expect(reasons(result)).toEqual(["empty"]);
  });

  it("rejects a file over the byte cap", () => {
    const result = validateIntake({
      files: [fileOf("big.png", "image/png", MAX_INTAKE_BYTES + 1)],
    });
    expect(reasons(result)).toEqual(["too-large"]);
  });

  it("sanitizes the accepted file's name", () => {
    const result = validateIntake({
      files: [fileOf("../../evil.png", "image/png", 10)],
    });
    expect(result.accepted[0].name).toBe("evil.png");
    expect(result.accepted[0].type).toBe("image/png");
  });

  it("truncates text past the cap and says so", () => {
    const result = validateIntake({ files: [], text: "x".repeat(5000) });
    expect(result.text?.length).toBe(MAX_INTAKE_TEXT);
    expect(reasons(result)).toEqual(["text-truncated"]);
  });

  it("truncates the sender-controlled title past its own cap", () => {
    const result = validateIntake({ files: [], title: "t".repeat(5000) });
    expect(result.title?.length).toBe(MAX_INTAKE_TITLE);
    expect(reasons(result)).toEqual(["title-truncated"]);
  });

  it("leaves a short title alone and reports nothing", () => {
    const result = validateIntake({ files: [], title: "Pho\u0007tos" });
    expect(result.title).toBe("Photos");
    expect(result.problems).toHaveLength(0);
  });

  it("strips control characters out of the title", () => {
    const result = validateIntake({ files: [], title: "Pho\u0007tos" });
    expect(result.title).toBe("Photos");
  });
});
```

- [ ] **Step 5: Run the test and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-validator.test.ts`
Expected: FAIL — `Failed to resolve import ".../intake-validator"`.

- [ ] **Step 6: Write the validator**

Create `src/lib/shared/share-intake/services/intake-validator.ts`:

```ts
import {
  MAX_IMAGE_BYTES,
  isAllowedImageType,
} from "$lib/shared/inbox/domain/image-attachment-limits";
import type {
  IntakeProblem,
  SharedFileDescriptor,
} from "../domain/share-intake-models";

/**
 * Boundary checks for content arriving from ANY app on the device.
 *
 * Scope limit, stated honestly: on native the plugin has already copied the
 * bytes to cacheDir/shared_files before we are notified, with no size or count
 * limit. This gate protects IndexedDB, the QR decoder, and the uploader. It
 * cannot protect the disk. That is an accepted cost of using the plugin
 * unmodified (see the spec's Spike results).
 */

/** Same cap as the picker, imported rather than re-declared. */
export const MAX_INTAKE_BYTES = MAX_IMAGE_BYTES;
export const MAX_INTAKE_FILES = 20;
export const MAX_INTAKE_TEXT = 2000;
export const MAX_INTAKE_TITLE = 200;
export const MAX_INTAKE_NAME = 120;

const FALLBACK_NAME = "shared-image";
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/**
 * Normalize a sender-supplied filename.
 *
 * The plugin writes the sender's name verbatim into its cache dir with no
 * sanitization, so "../" and control bytes are both possible. We never reuse
 * the raw name for a filesystem write, but it DOES reach the message
 * attachment and the rejection list the user reads, so it is normalized on the
 * way in - including on the rejection path, which the first draft skipped.
 */
export function safeName(raw: string): string {
  const base = (raw.split(/[/\\]/).pop() ?? "")
    .replace(CONTROL_CHARS, "")
    .trim();

  // "." and ".." survive the split above and are not names.
  if (base.length === 0 || /^\.+$/.test(base)) return FALLBACK_NAME;
  if (base.length <= MAX_INTAKE_NAME) return base;

  // Keep a short trailing extension so the truncated name still reads as an
  // image rather than as a hash.
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 && base.length - dot <= 6 ? base.slice(dot) : "";
  return base.slice(0, MAX_INTAKE_NAME - ext.length) + ext;
}

function cleanText(raw: string, cap: number): { value: string; truncated: boolean } {
  const cleaned = raw.replace(CONTROL_CHARS, "").trim();
  return cleaned.length > cap
    ? { value: cleaned.slice(0, cap), truncated: true }
    : { value: cleaned, truncated: false };
}

export interface DescriptorScreen {
  admitted: SharedFileDescriptor[];
  problems: IntakeProblem[];
}

/**
 * Pre-bridge screen: mime type and count only, because those are the two
 * things knowable WITHOUT reading the file. Running this first is what stops a
 * 200 MB share from being pulled into WebView memory just to be rejected.
 *
 * Order is load-bearing: the type check runs before the count cap, so the 21st
 * HEIC is reported as unsupported-type rather than as too-many, which is what
 * the user actually needs to be told.
 */
export function screenDescriptors(
  descriptors: SharedFileDescriptor[]
): DescriptorScreen {
  const admitted: SharedFileDescriptor[] = [];
  const problems: IntakeProblem[] = [];

  for (const descriptor of descriptors) {
    const name = safeName(descriptor.name);

    if (!isAllowedImageType(descriptor.mimeType)) {
      problems.push({
        name,
        reason: "unsupported-type",
        detail: descriptor.mimeType,
      });
      continue;
    }
    if (admitted.length >= MAX_INTAKE_FILES) {
      problems.push({ name, reason: "too-many" });
      continue;
    }
    admitted.push({ ...descriptor, name });
  }

  return { admitted, problems };
}

export interface ValidationResult {
  accepted: File[];
  problems: IntakeProblem[];
  text: string | null;
  title: string | null;
}

/**
 * Post-bridge gate: everything that needs real bytes.
 *
 * `title` comes from Android's EXTRA_SUBJECT - unbounded, sender-controlled,
 * and persisted. The first draft validated the text and left the title
 * unchecked; both are capped here.
 */
export function validateIntake(input: {
  files: File[];
  text?: string;
  title?: string;
}): ValidationResult {
  const accepted: File[] = [];
  const problems: IntakeProblem[] = [];

  for (const file of input.files) {
    const name = safeName(file.name);

    if (!isAllowedImageType(file.type)) {
      problems.push({ name, reason: "unsupported-type", detail: file.type });
      continue;
    }
    if (file.size <= 0) {
      problems.push({ name, reason: "empty" });
      continue;
    }
    if (file.size > MAX_INTAKE_BYTES) {
      problems.push({ name, reason: "too-large", detail: `${file.size} bytes` });
      continue;
    }
    if (accepted.length >= MAX_INTAKE_FILES) {
      problems.push({ name, reason: "too-many" });
      continue;
    }

    accepted.push(
      name === file.name ? file : new File([file], name, { type: file.type })
    );
  }

  let text: string | null = null;
  if (input.text) {
    const cleaned = cleanText(input.text, MAX_INTAKE_TEXT);
    text = cleaned.value.length > 0 ? cleaned.value : null;
    // Truncation used to be silent. A share whose link sat at character 2100
    // simply stopped resolving with no trace of why.
    if (cleaned.truncated) problems.push({ name: "", reason: "text-truncated" });
  }

  let title: string | null = null;
  if (input.title) {
    const cleaned = cleanText(input.title, MAX_INTAKE_TITLE);
    title = cleaned.value.length > 0 ? cleaned.value : null;
    if (cleaned.truncated) problems.push({ name: "", reason: "title-truncated" });
  }

  return { accepted, problems, text, title };
}
```

- [ ] **Step 7: Run the test and watch it pass**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-validator.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 8: Confirm the picker still compiles against the shared module**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error --output human 2>&1 | grep -iE "MessageAttachmentPicker|image-attachment-limits" | head -20`
Expected: no output (no errors mentioning either file).

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(share-intake): shared image limits, problem records, two-stage validation gate" -- src/lib/shared/inbox/domain/image-attachment-limits.ts src/lib/shared/inbox/components/messages/MessageAttachmentPicker.svelte src/lib/shared/share-intake/domain/share-intake-models.ts src/lib/shared/share-intake/services/intake-validator.ts tests/unit/share-intake/intake-validator.test.ts
```

---

### Task 4: Widen the shared QR detector to `ImageBitmapSource`

`TkaQrDetector.detect` is typed `(frame: ImageData)` — narrower than what it
actually wraps. Verified in
`node_modules/barcode-detector/dist/es/core.d.ts`:

```ts
detect(image: ImageBitmapSourceWebCodecs): Promise<DetectedBarcode[]>;
```

and `dist/es/utils.d.ts` defines that as
`CanvasImageSourceWebCodecs | Blob | ImageData`. **The ponyfill already accepts
a `Blob`**, and a `File` *is* a `Blob`. The narrowed signature is the only
reason the first draft hand-rolled a
`createImageBitmap` → `<canvas>` → `drawImage` → `getImageData` dance to feed
it a still image. That is exactly what `.claude/rules/never-hand-roll.md`
forbids: 12 lines re-deriving a decode path the library performs internally.

Widening the shared type deletes that code before it is written. `ScanCardSheet`
keeps passing `ImageData` and is unaffected — `ImageData` is a member of the
widened union.

**Files:**
- Modify: `src/lib/shared/qr/services/tka-qr-detector.ts:26-29,45`

- [ ] **Step 1: Confirm the ponyfill's real signature**

Run: `grep -n "detect(image" node_modules/barcode-detector/dist/es/core.d.ts && grep -n "ImageBitmapSourceWebCodecs =" node_modules/barcode-detector/dist/es/utils.d.ts`

Expected:
```
21:    detect(image: ImageBitmapSourceWebCodecs): Promise<DetectedBarcode[]>;
4:export type ImageBitmapSourceWebCodecs = CanvasImageSourceWebCodecs | Blob | ImageData;
```

- [ ] **Step 2: Widen the interface**

In `src/lib/shared/qr/services/tka-qr-detector.ts`, replace the
`TkaQrDetector` interface:

```ts
export interface TkaQrDetector {
	/**
	 * Every QR found in the source, with its location.
	 *
	 * Accepts anything the underlying ponyfill accepts - an ImageData frame
	 * from the camera (ScanCardSheet), or a Blob/File straight off disk (share
	 * intake). Do NOT decode a File to ImageData by hand before calling this:
	 * zxing-wasm decodes a Blob internally and the canvas round trip is pure
	 * cost.
	 */
	detect(source: ImageBitmapSource): Promise<TkaQrDetection[]>;
}
```

and the implementation's `detect`:

```ts
		async detect(source: ImageBitmapSource): Promise<TkaQrDetection[]> {
			const results = await detector.detect(source);
```

Nothing else in the file changes.

- [ ] **Step 3: Prove the camera call site still typechecks**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error --output human 2>&1 | grep -iE "tka-qr-detector|ScanCardSheet" | head -20`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(qr): accept any ImageBitmapSource in the shared detector" -- src/lib/shared/qr/services/tka-qr-detector.ts
```

---

### Task 5: The `SharedFile` → `File` bridge

**This is the highest-risk unit in the design.** The plugin returns
`getAbsolutePath()` — a raw filesystem path, not a `file://` URI and not
fetchable from the WebView. Everything downstream (`PendingMessageAttachment`,
`IMessageImageSender`, the QR decoder) assumes a real `File`.

Four defects the first draft shipped, all fixed here:

- **The path was not percent-encoded.** `Capacitor.convertFileSrc` is a plain
  string concat onto the local bridge origin; it does not encode. The plugin
  writes the **sender's display name** verbatim into the cache path, so a file
  named `photo#2.png` truncates at the `#` and 404s.
- **Failures returned bare `null` and were `.filter()`ed away** with no record
  of what was lost.
- **The size check was downstream of the read**, so a 200 MB file was pulled
  fully into WebView memory before being rejected.
- **`Promise.all` fanned out every read at once** — 20 concurrent whole-file
  fetches.

**Files:**
- Create: `src/lib/shared/share-intake/services/shared-file-bridge.ts`
- Test: `tests/unit/share-intake/shared-file-bridge.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/share-intake/shared-file-bridge.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => "android"),
    // Capacitor's real implementation is a string concat with no encoding.
    // Modelling it faithfully is the whole point of this suite.
    convertFileSrc: vi.fn((p: string) => `https://localhost/_capacitor_file_${p}`),
  },
}));

import { Capacitor } from "@capacitor/core";
import {
  sharedFileToFile,
  sharedFilesToFiles,
  toFetchableUrl,
} from "$lib/shared/share-intake/services/shared-file-bridge";
import { MAX_INTAKE_BYTES } from "$lib/shared/share-intake/services/intake-validator";

function descriptor(name: string, uri = `/cache/shared_files/${name}`) {
  return { uri, name, mimeType: "image/png" };
}

/** A duck-typed Response so a test can assert the body was never read. */
function fakeResponse(options: {
  ok?: boolean;
  status?: number;
  contentLength?: string | null;
  bytes?: Uint8Array;
  arrayBufferSpy?: ReturnType<typeof vi.fn>;
}) {
  const bytes = options.bytes ?? new Uint8Array([1, 2, 3]);
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: { get: () => options.contentLength ?? null },
    arrayBuffer:
      options.arrayBufferSpy ??
      vi.fn(async () => bytes.buffer.slice(0) as ArrayBuffer),
  };
}

describe("toFetchableUrl", () => {
  beforeEach(() => {
    vi.mocked(Capacitor.convertFileSrc).mockImplementation(
      (p: string) => `https://localhost/_capacitor_file_${p}`
    );
  });

  it("percent-encodes each path segment before converting", () => {
    // Without this the URL truncates at the '#' and the fetch 404s.
    expect(toFetchableUrl("/cache/shared_files/photo#2.png")).toBe(
      "https://localhost/_capacitor_file_/cache/shared_files/photo%232.png"
    );
  });

  it("encodes spaces and question marks too", () => {
    expect(toFetchableUrl("/c/my photo?.png")).toBe(
      "https://localhost/_capacitor_file_/c/my%20photo%3F.png"
    );
  });

  it("passes an already-schemed uri through untouched", () => {
    // The plugin's own docs say the uri may be a data URL. Encoding one
    // destroys it, and it is already fetchable.
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    expect(toFetchableUrl(dataUrl)).toBe(dataUrl);
    expect(Capacitor.convertFileSrc).not.toHaveBeenCalled();
  });
});

describe("sharedFileToFile", () => {
  beforeEach(() => {
    vi.mocked(Capacitor.convertFileSrc).mockImplementation(
      (p: string) => `https://localhost/_capacitor_file_${p}`
    );
  });

  it("returns a File with the descriptor's name, type, and real bytes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({})));

    const outcome = await sharedFileToFile(descriptor("a.png"));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.file).toBeInstanceOf(File);
    expect(outcome.file.name).toBe("a.png");
    expect(outcome.file.type).toBe("image/png");
    expect(outcome.file.size).toBe(3);
    expect(new Uint8Array(await outcome.file.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  it("reports the real byte size back on the descriptor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({})));

    const outcome = await sharedFileToFile(descriptor("a.png"));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The durable receiptId is derived from this. The plugin's SharedFile has
    // no size field at all, so without it the id degrades to name+mimeType.
    expect(outcome.descriptor.size).toBe(3);
  });

  it("sanitizes a path-traversing name onto the File", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({})));

    const outcome = await sharedFileToFile(descriptor("../../evil.png", "/c/x.png"));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.file.name).toBe("evil.png");
  });

  it("records unreachable instead of throwing when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ENOENT");
    }));

    const outcome = await sharedFileToFile(descriptor("gone.png"));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem).toMatchObject({ name: "gone.png", reason: "unreachable" });
    expect(outcome.problem.detail).toContain("ENOENT");
  });

  it("records not-found on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({ ok: false, status: 404 })));

    const outcome = await sharedFileToFile(descriptor("missing.png"));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem).toMatchObject({ reason: "not-found", detail: "HTTP 404" });
  });

  it("rejects an oversized declared length WITHOUT reading the body", async () => {
    const arrayBufferSpy = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () =>
      fakeResponse({
        contentLength: String(MAX_INTAKE_BYTES + 1),
        arrayBufferSpy,
      })
    ));

    const outcome = await sharedFileToFile(descriptor("huge.png"));

    expect(outcome.ok).toBe(false);
    // The point of the header check: a 200 MB file must never reach memory.
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized body when no length was declared", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      fakeResponse({ bytes: new Uint8Array(MAX_INTAKE_BYTES + 1) })
    ));

    const outcome = await sharedFileToFile(descriptor("huge.png"));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem.reason).toBe("too-large");
  });

  it("records empty for a zero-byte body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({ bytes: new Uint8Array(0) })));

    const outcome = await sharedFileToFile(descriptor("empty.png"));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem.reason).toBe("empty");
  });
});

describe("sharedFilesToFiles", () => {
  beforeEach(() => {
    vi.mocked(Capacitor.convertFileSrc).mockImplementation(
      (p: string) => `https://localhost/_capacitor_file_${p}`
    );
  });

  it("keeps order, keeps failures as problems, and never drops silently", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("bad") ? fakeResponse({ ok: false, status: 404 }) : fakeResponse({})
    ));

    const result = await sharedFilesToFiles([
      descriptor("a.png"),
      descriptor("bad.png"),
      descriptor("c.png"),
    ]);

    expect(result.bridged.map((b) => b.file.name)).toEqual(["a.png", "c.png"]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].name).toBe("bad.png");
  });

  it("never runs more than four reads at once", async () => {
    let inFlight = 0;
    let peak = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return fakeResponse({});
    }));

    await sharedFilesToFiles(
      Array.from({ length: 20 }, (_, i) => descriptor(`f${i}.png`))
    );

    // Promise.all over 20 descriptors fanned out 20 whole-file reads at once.
    expect(peak).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/shared-file-bridge.test.ts`
Expected: FAIL — `Failed to resolve import ".../shared-file-bridge"`.

- [ ] **Step 3: Write the bridge**

Create `src/lib/shared/share-intake/services/shared-file-bridge.ts`:

```ts
import { Capacitor } from "@capacitor/core";
import type {
  IntakeProblem,
  SharedFileDescriptor,
} from "../domain/share-intake-models";
import { MAX_INTAKE_BYTES, safeName } from "./intake-validator";

/** Anything already carrying a scheme (data:, blob:, https:) is fetchable as-is. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Four at a time. Each read pulls a whole image into WebView memory; a
 * Promise.all over a 20-file SEND_MULTIPLE fans out 20 of them simultaneously,
 * which on a mid-range Android device is how the WebView gets killed.
 */
const MAX_CONCURRENT_READS = 4;

/**
 * Make a plugin URI reachable from the WebView.
 *
 * Capacitor.convertFileSrc is a plain string concat onto the local bridge
 * origin - it does NOT percent-encode. The plugin writes the SENDER'S display
 * name verbatim into the cache path, so "photo#2.png" would truncate at the
 * '#' and 404, and a name with a space or '?' fails the same way. Each path
 * segment is encoded first, leaving the separators intact.
 */
export function toFetchableUrl(uri: string): string {
  if (HAS_SCHEME.test(uri)) return uri;
  const encoded = uri.split("/").map(encodeURIComponent).join("/");
  return Capacitor.convertFileSrc(encoded);
}

export type BridgeOutcome =
  | { ok: true; file: File; descriptor: SharedFileDescriptor }
  | { ok: false; problem: IntakeProblem };

/**
 * Turn one plugin descriptor into a real File.
 *
 * Isolated behind this one function on purpose: if convertFileSrc proves
 * unreliable across Android versions, the fallback is Filesystem.readFile ->
 * base64 -> Blob, and only this file changes.
 *
 * Never throws and never returns a bare null. A share can reference a file the
 * sending app already revoked; that has to be RECORDED, because
 * "TKA opened and nothing happened" is the exact symptom the device matrix is
 * hunting for.
 */
export async function sharedFileToFile(
  descriptor: SharedFileDescriptor
): Promise<BridgeOutcome> {
  const name = safeName(descriptor.name);

  let response: Response;
  try {
    response = await fetch(toFetchableUrl(descriptor.uri));
  } catch (caught) {
    return {
      ok: false,
      problem: { name, reason: "unreachable", detail: String(caught) },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      problem: { name, reason: "not-found", detail: `HTTP ${response.status}` },
    };
  }

  // Check the DECLARED length before reading. Without this a 200 MB file is
  // pulled fully into WebView memory just to be rejected one line later.
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_INTAKE_BYTES) {
    return {
      ok: false,
      problem: { name, reason: "too-large", detail: `${declared} bytes declared` },
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (caught) {
    return {
      ok: false,
      problem: { name, reason: "unreachable", detail: String(caught) },
    };
  }

  if (bytes.byteLength === 0) {
    return { ok: false, problem: { name, reason: "empty" } };
  }
  // The header is advisory and often absent on the bridge scheme, so the real
  // length is checked too.
  if (bytes.byteLength > MAX_INTAKE_BYTES) {
    return {
      ok: false,
      problem: { name, reason: "too-large", detail: `${bytes.byteLength} bytes` },
    };
  }

  // new File([bytes]), NOT new File([blob]): jsdom's File constructor
  // stringifies a Node Blob into "[object Blob]", so a blob-built File is 15
  // bytes of garbage under vitest and correct in a browser - a test that can
  // never be trusted. A Uint8Array behaves identically in both.
  const file = new File([bytes], name, { type: descriptor.mimeType });

  // The plugin's SharedFile has no size field, so the descriptor's size is
  // undefined until right here. Task 11 derives the durable receiptId from
  // THIS descriptor, which is what stops two same-named screenshots colliding.
  return { ok: true, file, descriptor: { ...descriptor, name, size: file.size } };
}

export interface BridgeBatch {
  bridged: Array<{ file: File; descriptor: SharedFileDescriptor }>;
  problems: IntakeProblem[];
}

/**
 * Bridge a batch with bounded concurrency, preserving input order and keeping
 * a problem record for every file that did not make it.
 */
export async function sharedFilesToFiles(
  descriptors: SharedFileDescriptor[]
): Promise<BridgeBatch> {
  const slots: Array<{ file: File; descriptor: SharedFileDescriptor } | undefined> =
    new Array(descriptors.length);
  const problems: IntakeProblem[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < descriptors.length) {
      const index = cursor;
      cursor += 1;
      const outcome = await sharedFileToFile(descriptors[index]);
      if (outcome.ok) {
        slots[index] = { file: outcome.file, descriptor: outcome.descriptor };
      } else {
        problems.push(outcome.problem);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_READS, descriptors.length) },
      () => worker()
    )
  );

  return {
    bridged: slots.filter(
      (slot): slot is { file: File; descriptor: SharedFileDescriptor } =>
        slot !== undefined
    ),
    problems,
  };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/shared-file-bridge.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(share-intake): bridge plugin URIs to Files with encoding, size gating, and recorded failures" -- src/lib/shared/share-intake/services/shared-file-bridge.ts tests/unit/share-intake/shared-file-bridge.test.ts
```

---
### Task 6: Durable intake store

Replaces read-and-delete, which contradicted "survives an auth redirect". A
reload, crash, or rejected route must not lose the only copy.

Six defects the first draft shipped, all fixed here:

- **`File` was persisted directly.** jsdom's `structuredClone` of a `File`
  returns a plain object with no `name`, `size`, or bytes, so the round-trip
  test could never pass. Records store `{ bytes: ArrayBuffer, name, type }` and
  reconstruct the `File` on read — which is also the more portable shape.
- **`tx()` only closed the connection in `oncomplete`**, leaking one on every
  error. There is now a single cached connection, closed by nothing but
  `versionchange`.
- **`openDb()` had no `onblocked` and no timeout**, so an upgrade held open by
  another tab left the promise pending forever and hung the boot barrier.
- **A new connection per operation** — `reapExpired` opened N+1 of them. The
  repo's own pattern is a cached `dbPromise`
  (`thumbnail-local-cache.ts:47-53`); follow it.
- **`updateStatus` read and wrote in separate transactions** (lost update) and
  silently succeeded when the record was gone.
- **No aggregate quota.** Every comparable store in the repo caps
  (`DEFAULT_MAX_SIZE_BYTES`, `thumbnail-local-cache.ts:26`); twenty 10 MB
  images is 200 MB of IndexedDB.

Two behavioural decisions worth stating outright:

- **`needs-auth` is exempt from the one-hour TTL** and from quota eviction. That
  status exists precisely to survive a sign-in round trip; reaping it destroys
  the case the store was built for. It gets its own seven-day ceiling so it is
  bounded rather than immortal.
- **`if (!browser)` guard**, per repo convention. Note the consequence for
  tests: `tests/setup/stubs/app-environment.ts` exports `browser = false`, so
  the suite MUST mock it (`vi.mock("$app/environment", () => ({ browser: true }))`)
  — the same thing `tests/unit/last-auth-method.test.ts:8` does.

**Files:**
- Create: `src/lib/shared/share-intake/services/intake-store.ts`
- Test: `tests/unit/share-intake/intake-store.test.ts`
- Modify: `package.json` (dev dependency `fake-indexeddb`)

- [ ] **Step 1: Install the IndexedDB test shim**

Run: `npm install -D fake-indexeddb`
Expected: added to `devDependencies`.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/share-intake/intake-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";

// The repo's app-environment stub exports browser=false; the store no-ops
// under that, so every test here would trivially "pass" against nothing.
vi.mock("$app/environment", () => ({ browser: true }));

import {
  putIntake,
  getIntake,
  listIntakes,
  updateStatus,
  deleteIntake,
  reapExpired,
  INTAKE_TTL_MS,
  NEEDS_AUTH_TTL_MS,
  MAX_INTAKE_STORE_BYTES,
} from "$lib/shared/share-intake/services/intake-store";
import type { SharedIntake } from "$lib/shared/share-intake/domain/share-intake-models";

function intake(overrides: Partial<SharedIntake> = {}): SharedIntake {
  return {
    receiptId: "si_abc",
    source: "native",
    files: [new File([new Uint8Array([1, 2])], "a.png", { type: "image/png" })],
    text: undefined,
    title: undefined,
    status: "received",
    receivedAt: Date.now(),
    problems: [],
    ...overrides,
  };
}

function bigIntake(receiptId: string, bytes: number, overrides: Partial<SharedIntake> = {}) {
  return intake({
    receiptId,
    files: [new File([new Uint8Array(bytes)], `${receiptId}.png`, { type: "image/png" })],
    ...overrides,
  });
}

describe("intake-store", () => {
  beforeEach(async () => {
    for (const record of await listIntakes()) await deleteIntake(record.receiptId);
  });

  it("round-trips a record and rebuilds a real File from the stored bytes", async () => {
    await putIntake(intake());

    const got = await getIntake("si_abc");

    expect(got?.files[0]).toBeInstanceOf(File);
    expect(got?.files[0].name).toBe("a.png");
    expect(got?.files[0].type).toBe("image/png");
    expect(got?.files[0].size).toBe(2);
    expect(new Uint8Array(await got!.files[0].arrayBuffer())).toEqual(
      new Uint8Array([1, 2])
    );
  });

  it("round-trips the problem list", async () => {
    await putIntake(
      intake({ problems: [{ name: "b.heic", reason: "unsupported-type" }] })
    );

    const got = await getIntake("si_abc");

    expect(got?.problems).toEqual([{ name: "b.heic", reason: "unsupported-type" }]);
  });

  it("does not delete on read", async () => {
    await putIntake(intake());
    await getIntake("si_abc");
    expect(await getIntake("si_abc")).not.toBeNull();
  });

  it("is idempotent on a duplicate receiptId", async () => {
    await putIntake(intake());
    await putIntake(intake());
    expect(await listIntakes()).toHaveLength(1);
  });

  it("updates status in place", async () => {
    await putIntake(intake());
    await updateStatus("si_abc", "needs-auth");
    expect((await getIntake("si_abc"))?.status).toBe("needs-auth");
  });

  it("appends problems on a status update rather than replacing them", async () => {
    await putIntake(intake({ problems: [{ name: "a", reason: "too-large" }] }));

    await updateStatus("si_abc", "partially-sent", [
      { name: "b", reason: "send-dropped" },
    ]);

    expect((await getIntake("si_abc"))?.problems).toEqual([
      { name: "a", reason: "too-large" },
      { name: "b", reason: "send-dropped" },
    ]);
  });

  it("rejects a status update for a record that is gone", async () => {
    // Silently succeeding here hid a real bug: the runner would report an
    // intake advanced that no longer existed.
    await expect(updateStatus("si_missing", "ready")).rejects.toThrow(/si_missing/);
  });

  it("reaps records past the one-hour TTL and keeps fresh ones", async () => {
    await putIntake(intake({ receiptId: "si_old", receivedAt: Date.now() - INTAKE_TTL_MS - 1 }));
    await putIntake(intake({ receiptId: "si_new" }));

    expect(await reapExpired()).toBe(1);
    expect(await getIntake("si_old")).toBeNull();
    expect(await getIntake("si_new")).not.toBeNull();
  });

  it("does NOT reap a needs-auth record at the one-hour mark", async () => {
    // This is the whole reason the store exists: a share that must outlive a
    // sign-in round trip.
    await putIntake(
      intake({
        receiptId: "si_auth",
        status: "needs-auth",
        receivedAt: Date.now() - INTAKE_TTL_MS - 1,
      })
    );

    expect(await reapExpired()).toBe(0);
    expect(await getIntake("si_auth")).not.toBeNull();
  });

  it("does reap a needs-auth record past its own long ceiling", async () => {
    await putIntake(
      intake({
        receiptId: "si_auth",
        status: "needs-auth",
        receivedAt: Date.now() - NEEDS_AUTH_TTL_MS - 1,
      })
    );

    expect(await reapExpired()).toBe(1);
  });

  it("evicts the oldest record to make room for a new one", async () => {
    const half = Math.floor(MAX_INTAKE_STORE_BYTES / 2);
    await putIntake(bigIntake("si_old", half, { receivedAt: 1 }));
    await putIntake(bigIntake("si_mid", half, { receivedAt: 2 }));

    await putIntake(bigIntake("si_new", half, { receivedAt: 3 }));

    expect(await getIntake("si_old")).toBeNull();
    expect(await getIntake("si_new")).not.toBeNull();
  });

  it("refuses the write rather than evicting a needs-auth record", async () => {
    const most = MAX_INTAKE_STORE_BYTES - 1024;
    await putIntake(bigIntake("si_auth", most, { status: "needs-auth", receivedAt: 1 }));

    await expect(putIntake(bigIntake("si_new", most, { receivedAt: 2 }))).rejects.toThrow(
      /pending sign-in/
    );
    expect(await getIntake("si_auth")).not.toBeNull();
  });

  it("reuses one connection instead of opening per operation", async () => {
    const openSpy = vi.spyOn(indexedDB, "open");

    await putIntake(intake());
    await getIntake("si_abc");
    await listIntakes();
    await reapExpired();

    // The connection was cached by the tests above; reapExpired alone used to
    // open N+1 of them.
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-store.test.ts`
Expected: FAIL — `Failed to resolve import ".../intake-store"`.

- [ ] **Step 4: Write the store**

Create `src/lib/shared/share-intake/services/intake-store.ts`:

```ts
import { browser } from "$app/environment";
import type {
  IntakeProblem,
  ShareIntakeSource,
  ShareIntakeStatus,
  SharedIntake,
} from "../domain/share-intake-models";

/**
 * Durable record for a received share.
 *
 * Persisted BEFORE any auth check so a share that cold-starts the app while
 * signed out survives the sign-in round trip. Reads never delete - a reload or
 * crash mid-flow must be recoverable.
 *
 * Honest limitation: IndexedDB is best-effort and quota writes can fail. This
 * makes loss rare and VISIBLE (putIntake throws; the caller logs) rather than
 * impossible.
 */

const DB_NAME = "tka-share-intake";
const DB_VERSION = 1;
const STORE = "intakes";
const OPEN_TIMEOUT_MS = 5000;

export const INTAKE_TTL_MS = 60 * 60 * 1000;

/**
 * needs-auth outlives the ordinary TTL by a wide margin. Reaping it at one
 * hour would destroy the exact case this store exists for - a share held
 * across a sign-in. Seven days keeps it bounded rather than immortal.
 */
export const NEEDS_AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Aggregate ceiling, in the spirit of thumbnail-local-cache's own cap. */
export const MAX_INTAKE_STORE_BYTES = 64 * 1024 * 1024;

/**
 * What actually goes into IndexedDB.
 *
 * Bytes, not File. jsdom's structuredClone of a File returns a plain object
 * with no name, type, or content, so a File-valued record is untestable under
 * vitest and silently lossy anywhere structured clone is partial. An
 * ArrayBuffer clones identically everywhere.
 */
interface StoredFile {
  bytes: ArrayBuffer;
  name: string;
  type: string;
}

interface StoredIntake {
  receiptId: string;
  source: ShareIntakeSource;
  files: StoredFile[];
  text?: string;
  title?: string;
  status: ShareIntakeStatus;
  receivedAt: number;
  problems: IntakeProblem[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Both of these are load-bearing. An upgrade held open by another tab
    // fires neither onsuccess nor onerror, so without them every caller awaits
    // a promise that never settles - and the boot barrier in Task 11 awaits
    // exactly this, which would hang the app at the splash screen.
    const timer = setTimeout(
      () => reject(new Error("share-intake: IndexedDB open timed out")),
      OPEN_TIMEOUT_MS
    );
    request.onblocked = () => {
      clearTimeout(timer);
      reject(new Error("share-intake: IndexedDB open blocked by another connection"));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "receiptId" });
        store.createIndex("receivedAt", "receivedAt");
      }
    };

    request.onsuccess = () => {
      clearTimeout(timer);
      const db = request.result;
      // Close on versionchange so a later upgrade in another tab is never
      // blocked by this cached connection, and drop the cache so the next call
      // reopens rather than reusing a closed handle.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error ?? new Error("share-intake: IndexedDB open failed"));
    };
  }).catch((error: unknown) => {
    // Never cache a rejection: one transient failure would poison the store
    // for the rest of the session.
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

/**
 * Await one IDBRequest. Resolution happens inside the request's own success
 * callback, which keeps the surrounding transaction alive - awaiting a
 * macrotask between requests is what auto-commits a transaction out from under
 * you, and this deliberately does not do that.
 */
function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("share-intake: request failed"));
  });
}

/**
 * Run work inside one transaction. The connection is cached and is NOT closed
 * here; the first draft closed it in `oncomplete` only, which leaked a
 * connection on every error path.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    let outcome: T;
    let failed = false;

    transaction.oncomplete = () => {
      if (!failed) resolve(outcome);
    };
    transaction.onabort = () => {
      failed = true;
      reject(transaction.error ?? new Error("share-intake: transaction aborted"));
    };
    transaction.onerror = () => {
      failed = true;
      reject(transaction.error ?? new Error("share-intake: transaction failed"));
    };

    work(transaction.objectStore(STORE)).then(
      (value) => {
        outcome = value;
      },
      (error: unknown) => {
        failed = true;
        try {
          transaction.abort();
        } catch {
          // Already finished; the rejection below is still the real answer.
        }
        reject(error);
      }
    );
  });
}

async function toStored(record: SharedIntake): Promise<StoredIntake> {
  const files = await Promise.all(
    record.files.map(async (file) => ({
      bytes: await file.arrayBuffer(),
      name: file.name,
      type: file.type,
    }))
  );
  return { ...record, files };
}

function fromStored(stored: StoredIntake): SharedIntake {
  return {
    ...stored,
    files: stored.files.map(
      (file) => new File([file.bytes], file.name, { type: file.type })
    ),
  };
}

function storedBytes(stored: StoredIntake): number {
  return stored.files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
}

function ttlFor(status: ShareIntakeStatus): number {
  return status === "needs-auth" ? NEEDS_AUTH_TTL_MS : INTAKE_TTL_MS;
}

async function listStored(): Promise<StoredIntake[]> {
  return withStore("readonly", (store) =>
    awaitRequest<StoredIntake[]>(store.getAll())
  );
}

async function makeRoomFor(incoming: number, replacing: string): Promise<void> {
  const others = (await listStored()).filter((r) => r.receiptId !== replacing);
  let used = others.reduce((sum, record) => sum + storedBytes(record), 0);
  if (used + incoming <= MAX_INTAKE_STORE_BYTES) return;

  // Oldest first, and NEVER a needs-auth record.
  const evictable = others
    .filter((record) => record.status !== "needs-auth")
    .sort((a, b) => a.receivedAt - b.receivedAt);

  for (const victim of evictable) {
    if (used + incoming <= MAX_INTAKE_STORE_BYTES) break;
    await deleteIntake(victim.receiptId);
    used -= storedBytes(victim);
  }

  if (used + incoming > MAX_INTAKE_STORE_BYTES) {
    throw new Error(
      "share-intake: store is full of pending sign-in shares; refusing the write"
    );
  }
}

export async function putIntake(record: SharedIntake): Promise<void> {
  if (!browser) return;

  const stored = await toStored(record);
  const incoming = storedBytes(stored);

  if (incoming > MAX_INTAKE_STORE_BYTES) {
    throw new Error(
      `share-intake: record is ${incoming} bytes, over the ${MAX_INTAKE_STORE_BYTES} store cap`
    );
  }

  await makeRoomFor(incoming, record.receiptId);
  await withStore("readwrite", (store) => awaitRequest(store.put(stored)));
}

export async function getIntake(receiptId: string): Promise<SharedIntake | null> {
  if (!browser) return null;

  const stored = await withStore("readonly", (store) =>
    awaitRequest<StoredIntake | undefined>(store.get(receiptId))
  );
  return stored ? fromStored(stored) : null;
}

export async function listIntakes(): Promise<SharedIntake[]> {
  if (!browser) return [];
  return (await listStored()).map(fromStored);
}

/**
 * Read and write in ONE transaction. Two transactions is a lost-update race:
 * the runner advancing a record and a second delivery appending a problem
 * would each write a copy built from a stale read.
 */
export async function updateStatus(
  receiptId: string,
  status: ShareIntakeStatus,
  problems: IntakeProblem[] = []
): Promise<void> {
  if (!browser) return;

  await withStore("readwrite", async (store) => {
    const existing = await awaitRequest<StoredIntake | undefined>(
      store.get(receiptId)
    );
    if (!existing) {
      throw new Error(`share-intake: no record ${receiptId} to update`);
    }
    await awaitRequest(
      store.put({
        ...existing,
        status,
        problems:
          problems.length > 0
            ? [...existing.problems, ...problems]
            : existing.problems,
      })
    );
  });
}

export async function deleteIntake(receiptId: string): Promise<void> {
  if (!browser) return;
  await withStore("readwrite", (store) => awaitRequest(store.delete(receiptId)));
}

/**
 * Sweep abandoned records. Called on intake write AND at app boot -
 * write-only sweeping would leave records forever if no later share arrives.
 * Returns how many were removed.
 */
export async function reapExpired(now = Date.now()): Promise<number> {
  if (!browser) return 0;

  const stale = (await listStored()).filter(
    (record) => now - record.receivedAt > ttlFor(record.status)
  );
  for (const record of stale) await deleteIntake(record.receiptId);
  return stale.length;
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-store.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(share-intake): durable byte-backed IndexedDB store with quota and needs-auth TTL" -- src/lib/shared/share-intake/services/intake-store.ts tests/unit/share-intake/intake-store.test.ts package.json package-lock.json
```

---

### Task 7: Per-item classification

Routes through the **existing** scan path — `extractScanCode`
(`src/lib/shared/qr/services/extract-scan-code.ts:16`), which is what
`ScanCardSheet.svelte:151` uses. It returns `null` for any QR that is not a TKA
card, so a random QR is not a failure; it falls through to the image path.

Five defects the first draft shipped:

- **The "dedup" test asserted the wrong behaviour and passed.** A repeated code
  made the second file `kind: "image"` — so sharing two photos of the same card
  sent one of them as a **photo attachment to a conversation**. There is now a
  `kind: "duplicate"` arm that the router ignores.
- **`extractScanCode` requires the ENTIRE trimmed string to be a URL** (line 24:
  `new URL(raw)` inside a try). Real-world `EXTRA_TEXT` reads
  `"Check this out https://tka.run/AB12"` and yielded `null`. URL-shaped
  substrings are pulled out and tried individually.
- **A WASM load failure turned 100% of cards into photos, silently.** The
  `catch` swallowed it per image. A failure on the first image is now recorded
  once, logged loudly, and stops further attempts.
- **The detector was constructed per image.**
- **`residualText` was dropped whenever a code was found** — so "look at this
  one" alongside a card link vanished. It is kept.

`bitmap.close()` not being in a `finally` is fixed by deletion: after Task 4
there is no bitmap, no canvas, and no `getImageData`.

**Files:**
- Modify: `src/lib/shared/share-intake/domain/share-intake-models.ts` (`IntakeItem`, `IntakeClassification`)
- Create: `src/lib/shared/share-intake/services/intake-classifier.ts`
- Test: `tests/unit/share-intake/intake-classifier.test.ts`

- [ ] **Step 1: Widen the domain types**

In `src/lib/shared/share-intake/domain/share-intake-models.ts`, replace
`IntakeItem` and `IntakeClassification`:

```ts
/** Per-item routing decision. Classification is per file, never per batch. */
export type IntakeItem
  = { kind: "card"; code: string; file: File }
  | { kind: "image"; file: File }
  /**
   * A second photo of a card already seen in this batch. NOT an image: filing
   * it as one would send a picture of a card into a conversation, which is
   * what the first draft did and what its own test asserted.
   */
  | { kind: "duplicate"; code: string; file: File };

export interface IntakeClassification {
  items: IntakeItem[];
  /** A TKA code found in the shared text, if any. */
  textCode: string | null;
  /**
   * Shared text minus any code that was extracted from it. Becomes the
   * prefilled message note. Kept even when a code WAS found - "look at this
   * one" alongside a link is exactly the case that matters.
   */
  residualText: string | null;
  problems: IntakeProblem[];
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/share-intake/intake-classifier.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifyIntake,
  extractCodeFromText,
} from "$lib/shared/share-intake/services/intake-classifier";

function png(name: string): File {
  return new File([new Uint8Array([1])], name, { type: "image/png" });
}

/** The decoder is injected, so no test here needs a canvas or the WASM. */
const decodeTo =
  (values: Record<string, string[]>) => async (file: File) =>
    values[file.name] ?? [];

describe("extractCodeFromText", () => {
  it("finds a tka.run url embedded in a sentence", () => {
    // extractScanCode alone returns null here: it requires the WHOLE string to
    // parse as a URL.
    expect(extractCodeFromText("Check this out https://tka.run/AB12").code).toBe("AB12");
  });

  it("keeps the surrounding sentence as residual text", () => {
    const result = extractCodeFromText("Check this out https://tka.run/AB12 nice");
    expect(result.code).toBe("AB12");
    expect(result.residual).toBe("Check this out nice");
  });

  it("strips trailing punctuation off a matched url", () => {
    expect(extractCodeFromText("see https://tka.run/AB12.").code).toBe("AB12");
    expect(extractCodeFromText("see (https://tka.run/AB12)").code).toBe("AB12");
  });

  it("handles a scheme-less www. url", () => {
    expect(extractCodeFromText("try www.tka.run/q/XY99 later").code).toBe("XY99");
  });

  it("still handles a bare whole-string code", () => {
    expect(extractCodeFromText("AB12").code).toBe("AB12");
  });

  it("ignores a non-TKA url and keeps the whole text", () => {
    const result = extractCodeFromText("look https://example.com/hello");
    expect(result.code).toBeNull();
    expect(result.residual).toBe("look https://example.com/hello");
  });
});

describe("classifyIntake", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies an image carrying a TKA card url as a card", async () => {
    const result = await classifyIntake(
      { files: [png("card.png")] },
      decodeTo({ "card.png": ["https://TKA.RUN/AB12"] })
    );
    expect(result.items[0]).toEqual({
      kind: "card",
      code: "AB12",
      file: expect.any(File),
    });
  });

  it("treats a non-TKA QR as an ordinary image, not a failure", async () => {
    const result = await classifyIntake(
      { files: [png("other.png")] },
      decodeTo({ "other.png": ["https://example.com/hello"] })
    );
    expect(result.items[0].kind).toBe("image");
    expect(result.problems).toHaveLength(0);
  });

  it("classifies an image with no QR as an image", async () => {
    const result = await classifyIntake({ files: [png("photo.png")] }, decodeTo({}));
    expect(result.items[0].kind).toBe("image");
  });

  it("classifies a mixed batch per item, not per batch", async () => {
    const result = await classifyIntake(
      { files: [png("card.png"), png("photo.png")] },
      decodeTo({ "card.png": ["https://tka.run/q/XY99"] })
    );
    expect(result.items.map((i) => i.kind)).toEqual(["card", "image"]);
  });

  it("marks a repeated code as duplicate, never as an image", async () => {
    // The first draft made this second file kind:"image", which sent a PHOTO
    // OF A CARD to a conversation.
    const result = await classifyIntake(
      { files: [png("a.png"), png("b.png")] },
      decodeTo({
        "a.png": ["https://tka.run/AB12"],
        "b.png": ["https://tka.run/AB12"],
      })
    );
    expect(result.items.map((i) => i.kind)).toEqual(["card", "duplicate"]);
  });

  it("extracts a TKA code from shared text", async () => {
    const result = await classifyIntake(
      { files: [], text: "https://tka.run/AB12" },
      decodeTo({})
    );
    expect(result.textCode).toBe("AB12");
    expect(result.residualText).toBeNull();
  });

  it("keeps the note alongside a code found in the same text", async () => {
    const result = await classifyIntake(
      { files: [], text: "try this https://tka.run/AB12" },
      decodeTo({})
    );
    expect(result.textCode).toBe("AB12");
    expect(result.residualText).toBe("try this");
  });

  it("keeps non-code text as residual message text", async () => {
    const result = await classifyIntake({ files: [], text: "check this out" }, decodeTo({}));
    expect(result.textCode).toBeNull();
    expect(result.residualText).toBe("check this out");
  });

  it("records decode-failed once and stops decoding when the FIRST decode throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const decode = vi.fn(async () => {
      throw new Error("wasm 404");
    });

    const result = await classifyIntake(
      { files: [png("a.png"), png("b.png"), png("c.png")] },
      decode
    );

    // A decoder that fails on the first image is the ZXing WASM failing to
    // load, which turns every shared card into a photo. Retrying it 20 more
    // times helps nobody and hides the cause.
    expect(decode).toHaveBeenCalledTimes(1);
    expect(result.problems).toEqual([
      { name: "", reason: "decode-failed", detail: "wasm 404" },
    ]);
    expect(result.items.map((i) => i.kind)).toEqual(["image", "image", "image"]);
    expect(error).toHaveBeenCalled();
  });

  it("records a per-file decode-failed after an earlier decode succeeded", async () => {
    const decode = vi.fn(async (file: File) => {
      if (file.name === "b.png") throw new Error("corrupt");
      return [];
    });

    const result = await classifyIntake(
      { files: [png("a.png"), png("b.png"), png("c.png")] },
      decode
    );

    expect(decode).toHaveBeenCalledTimes(3);
    expect(result.problems).toEqual([
      { name: "b.png", reason: "decode-failed", detail: "corrupt" },
    ]);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-classifier.test.ts`
Expected: FAIL — `Failed to resolve import ".../intake-classifier"`.

- [ ] **Step 4: Write the classifier**

Create `src/lib/shared/share-intake/services/intake-classifier.ts`:

```ts
import { extractScanCode } from "$lib/shared/qr/services/extract-scan-code";
import {
  createTkaQrDetector,
  type TkaQrDetector,
} from "$lib/shared/qr/services/tka-qr-detector";
import type {
  IntakeClassification,
  IntakeItem,
  IntakeProblem,
} from "../domain/share-intake-models";

/** Decodes every QR payload found in an image. Injected so tests need no WASM. */
export type QrDecoder = (file: File) => Promise<string[]>;

let sharedDetector: TkaQrDetector | null = null;

/**
 * One detector for the whole app run. createTkaQrDetector() constructs a
 * BarcodeDetector and, on the first call, prepares the ZXing WASM module -
 * building one per image paid that cost N times for nothing.
 */
function getDetector(): TkaQrDetector {
  sharedDetector ??= createTkaQrDetector();
  return sharedDetector;
}

/**
 * Default decoder.
 *
 * The detector accepts an ImageBitmapSource (Task 4) and a File IS a Blob, so
 * the file goes straight in: no createImageBitmap, no canvas, no
 * getImageData. zxing-wasm does the decode internally, which is also why the
 * 10 MB validation cap is the resolution cap - there is no intermediate
 * bitmap for us to downscale, and inserting one to create the opportunity
 * would be the hand-rolled path this deleted.
 */
export const fileQrDecoder: QrDecoder = async (file) => {
  const detections = await getDetector().detect(file);
  return detections.map((detection) => detection.rawValue);
};

const URL_LIKE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"]+$/;

/**
 * Pull a TKA code out of free-form shared text.
 *
 * extractScanCode needs the WHOLE trimmed string to be a URL, an s~ payload,
 * or a bare code - it calls `new URL(raw)` directly. Android's EXTRA_TEXT is
 * almost never that: it reads "Check this out https://tka.run/AB12". So the
 * URL-shaped substrings are extracted and each is offered to extractScanCode,
 * with the whole string as a last resort for the bare-code case.
 *
 * The residual is what is left after removing the matched URL. It becomes the
 * prefilled message note; the first draft threw it away whenever a code was
 * found.
 */
export function extractCodeFromText(text: string): {
  code: string | null;
  residual: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { code: null, residual: "" };

  for (const match of trimmed.match(URL_LIKE) ?? []) {
    const candidate = match.replace(TRAILING_PUNCTUATION, "");
    const code = extractScanCode(
      candidate.toLowerCase().startsWith("www.") ? `https://${candidate}` : candidate
    );
    if (code) {
      const residual = trimmed.replace(match, " ").replace(/\s+/g, " ").trim();
      return { code, residual };
    }
  }

  const whole = extractScanCode(trimmed);
  return whole ? { code: whole, residual: "" } : { code: null, residual: trimmed };
}

/**
 * Decide, per item, whether each shared file is a TKA card, a duplicate of one
 * already in the batch, or an ordinary image.
 *
 * extractScanCode returns null for anything that is not a TKA card - a random
 * QR in a photo is NOT an error, it just means the photo is a photo.
 */
export async function classifyIntake(
  input: { files: File[]; text?: string },
  decode: QrDecoder = fileQrDecoder
): Promise<IntakeClassification> {
  const items: IntakeItem[] = [];
  const problems: IntakeProblem[] = [];
  const seen = new Set<string>();

  let decoderBroken = false;
  let anyDecodeSucceeded = false;

  for (const file of input.files) {
    let code: string | null = null;

    if (!decoderBroken) {
      try {
        const payloads = await decode(file);
        anyDecodeSucceeded = true;
        for (const raw of payloads) {
          const candidate = extractScanCode(raw);
          if (candidate) {
            code = candidate;
            break;
          }
        }
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : String(caught);
        if (anyDecodeSucceeded) {
          // One bad image among many. Noise, but recorded.
          problems.push({ name: file.name, reason: "decode-failed", detail });
        } else {
          // Nothing has EVER decoded in this run: the ZXing WASM is missing or
          // failed to instantiate, and every shared card in the app is about to
          // be treated as a photo. Say so once, loudly, and stop retrying.
          decoderBroken = true;
          problems.push({ name: "", reason: "decode-failed", detail });
          console.error(
            "[ShareIntake] QR decoding is unavailable - every shared card will be treated as a photo:",
            detail
          );
        }
      }
    }

    if (!code) {
      items.push({ kind: "image", file });
      continue;
    }
    if (seen.has(code)) {
      items.push({ kind: "duplicate", code, file });
      continue;
    }
    seen.add(code);
    items.push({ kind: "card", code, file });
  }

  const text = input.text
    ? extractCodeFromText(input.text)
    : { code: null, residual: "" };

  return {
    items,
    textCode: text.code,
    residualText: text.residual.length > 0 ? text.residual : null,
    problems,
  };
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-classifier.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 6: Prove no canvas dance came back**

Run: `grep -rn "getImageData\|createImageBitmap" src/lib/shared/share-intake/ | wc -l`
Expected: `0`. The detector takes the `File` directly (Task 4); any hit here
means the hand-rolled decode path was reintroduced.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(share-intake): per-item classification with duplicate detection and embedded-url text scan" -- src/lib/shared/share-intake/domain/share-intake-models.ts src/lib/shared/share-intake/services/intake-classifier.ts tests/unit/share-intake/intake-classifier.test.ts
```

---
### Task 8: Generalize the inbox share view so it can actually send an image

The first draft called this "genuinely small" and it was not. What it missed:

- **`SendSequenceSheet` has nine `payload.` references**, six of them in
  markup (verified: lines 51, 149, 152, 199, 201, 219, 220, 222, 223). The
  draft changed one.
- **The renamed `.test.ts` still imported `SendSequenceSheet.svelte`** and
  rendered with `payload:`, so its verification step failed on an unresolved
  import.
- **The real entry point is `openSendSequenceSheet`**
  (`send-sequence-state.svelte.ts:23`, four call sites: `ChoreoCardTab.svelte:88`,
  `ChoreoCardThumbnail.svelte:215`, `SequenceViewerShell.svelte:277`,
  `SequenceViewerPage.svelte:152`). The draft's file table omitted it.
- **The CSS class and its four selectors stayed `.send-sequence-sheet`** under a
  rename claiming to generalize.
- **`attachment.sequence as never`** — unsound, and `npm run check` rejects it.
  `PendingMessageAttachment`'s sequence arm is `SequenceData`; the sheet needs a
  `SequenceSharePayload` (`sequenceWord`, `sequenceThumbnail`, `sequenceAuthor`,
  `sequenceStepCount` — none of which exist on `SequenceData`).
- **The sheet never sent an image.** Whatever it rendered, `send()` only ever
  called `createShortCode` + `messagingService.sendMessage`, so the entire
  feature ended at a picker that could not deliver.

The arm is widened to `SequenceSharePayload` and its field is renamed
`sequence` → **`payload`**. Two reasons: `attachment.sequence.sequence` is a
trap, and with the field named `payload` a single `$derived` restores the
sheet's nine existing `payload.` references instead of rewriting them.

**Files:**
- Modify: `src/lib/shared/inbox/domain/pending-message-attachment.ts`
- Modify: `src/lib/shared/inbox/components/messages/MessageComposer.svelte:173-183,234`
- Modify: `src/lib/shared/inbox/components/messages/MessageAttachmentPicker.svelte:80-89`
- Modify: `src/lib/shared/inbox/state/inbox-state.svelte.ts`
- Modify: `src/lib/shared/inbox/state/send-sequence-state.svelte.ts`
- Modify: `src/lib/shared/inbox/components/InboxDrawer.svelte:21,274,536-537,561,600-604`
- Rename: `SendSequenceSheet.svelte` → `SendAttachmentSheet.svelte` (+ its `.svelte.test.ts`)
- Test: `tests/unit/share-intake/inbox-attachment-share.test.ts`

- [ ] **Step 1: Write the failing state test**

Create `tests/unit/share-intake/inbox-attachment-share.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
import { openSendAttachmentSheet } from "$lib/shared/inbox/state/send-sequence-state.svelte";
import type { SequenceSharePayload } from "$lib/shared/inbox/domain/models/sequence-share-payload";

function imageAttachment() {
  return {
    type: "image" as const,
    file: new File([new Uint8Array([1])], "a.png", { type: "image/png" }),
    messageId: "m1",
    attachmentId: "a1",
  };
}

function sequencePayload(): SequenceSharePayload {
  return {
    sequence: { id: "s1", word: "ABC" } as SequenceSharePayload["sequence"],
    sequenceId: "s1",
    sequenceWord: "ABC",
  };
}

describe("inbox attachment share", () => {
  beforeEach(() => {
    inboxState.close();
  });

  it("opens the send-attachment view with an image attachment", () => {
    inboxState.openAttachmentShare(imageAttachment());

    expect(inboxState.isOpen).toBe(true);
    expect(inboxState.currentView).toBe("send-attachment");
    expect(inboxState.shareAttachment?.type).toBe("image");
  });

  it("carries a prefilled note through to the sheet", () => {
    inboxState.openAttachmentShare(imageAttachment(), { note: "look at this" });
    expect(inboxState.shareAttachmentNote).toBe("look at this");
  });

  it("keeps openSequenceShare working through the same view", () => {
    inboxState.openSequenceShare(sequencePayload());

    expect(inboxState.currentView).toBe("send-attachment");
    expect(inboxState.shareAttachment?.type).toBe("sequence");
  });

  it("routes openSendAttachmentSheet through the same state", () => {
    openSendAttachmentSheet(imageAttachment(), { note: "hi" });

    expect(inboxState.currentView).toBe("send-attachment");
    expect(inboxState.shareAttachmentNote).toBe("hi");
  });

  it("clears the attachment and the note when the share is cancelled", () => {
    inboxState.openAttachmentShare(imageAttachment(), { note: "hi" });
    inboxState.cancelAttachmentShare();

    expect(inboxState.shareAttachment).toBeNull();
    expect(inboxState.shareAttachmentNote).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/inbox-attachment-share.test.ts`
Expected: FAIL — `inboxState.openAttachmentShare is not a function`.

- [ ] **Step 3: Widen the attachment union**

Replace `src/lib/shared/inbox/domain/pending-message-attachment.ts` entirely:

```ts
import type { SequenceSharePayload } from "./models/sequence-share-payload";

/**
 * What is staged to send with a message.
 *
 * The sequence arm carries the full SequenceSharePayload, not a bare
 * SequenceData: the share sheet renders sequenceWord / sequenceThumbnail /
 * sequenceAuthor / sequenceStepCount, none of which exist on SequenceData.
 * The field is named `payload` rather than `sequence` so consumers reach the
 * raw sequence as `attachment.payload.sequence` instead of the
 * `attachment.sequence.sequence` trap.
 */
export type PendingMessageAttachment =
  | {
      type: "image";
      file: File;
      messageId: string;
      attachmentId: string;
    }
  | {
      type: "sequence";
      payload: SequenceSharePayload;
    };
```

- [ ] **Step 4: Update the composer's two sequence sites**

In `src/lib/shared/inbox/components/messages/MessageComposer.svelte`:

Add the builder import beside the existing `../../domain/` imports:

```ts
  import { buildSequenceSharePayload } from "../../domain/build-sequence-share-payload";
```

In `sendMessage`'s sequence branch (currently lines 173-183), change the two
`attachment.sequence` reads to `attachment.payload.sequence`:

```ts
        const sequenceAttachment =
          attachment?.type === "sequence"
            ? buildSequenceMessageAttachment(
                attachment.payload.sequence,
                (
                  await getShortCodeManager().createShortCode(
                    attachment.payload.sequence,
                    { embedSequenceData: true }
                  )
                ).code
              )
            : undefined;
```

And in `selectSequence` (currently line 234):

```ts
  function selectSequence(sequence: SequenceData) {
    // The picker hands over a raw SequenceData; the payload is what every
    // sequence-rendering consumer downstream expects.
    pendingAttachment = { type: "sequence", payload: buildSequenceSharePayload(sequence) };
    attachmentProgress = null;
  }
```

- [ ] **Step 5: Update the picker's label derivation**

In `src/lib/shared/inbox/components/messages/MessageAttachmentPicker.svelte`,
replace `sequenceLabel` (currently lines 80-89):

```ts
  const sequenceLabel = $derived.by(() => {
    if (attachment?.type !== "sequence") return "";
    const { payload } = attachment;
    // buildSequenceSharePayload already ran displayName/intendedWord/word
    // through simplifyRepeatedWord, so this is the simplified form by
    // construction (.claude/rules/simplified-word-display.md).
    return payload.sequenceWord || payload.sequenceName || payload.sequence.word || "";
  });
```

- [ ] **Step 6: Generalize the inbox state**

In `src/lib/shared/inbox/state/inbox-state.svelte.ts`:

Add the import beside the existing `SequenceSharePayload` import (line 13):

```ts
import type { PendingMessageAttachment } from "../domain/pending-message-attachment";
```

Change the `InboxView` union member (line 24) `"send-sequence"` → `"send-attachment"`:

```ts
export type InboxView =
  | "list"
  | "thread"
  | "compose"
  | "group-settings"
  | "send-attachment";
```

Replace the `shareSequencePayload` declaration (line 63) with:

```ts
  /**
   * What the share sheet is about to send. The domain already modelled
   * image | sequence; only this view was sequence-only.
   */
  shareAttachment = $state<PendingMessageAttachment | null>(null);

  /** Prefilled note — shared text that was not a TKA code (Task 9). */
  shareAttachmentNote = $state<string | null>(null);
```

Replace every remaining `this.shareSequencePayload = null;` with **two** lines:

```ts
    this.shareAttachment = null;
    this.shareAttachmentNote = null;
```

There are eleven such sites: lines 95 (`open`), 106 (`close`), 122 (`setTab`),
126 (`selectConversation`), 138 (`openToConversation`), 151
(`openToConversationById`), 165 (`openToNotification`), 178 (`backToList`), 188
(`startCompose`), 196 (`startGroupCompose`), 228 (`completeSequenceShare`).

Replace `openSequenceShare` (lines 210-225) with the generalized trio:

```ts
  /** Open the picker for any attachment the domain models. */
  openAttachmentShare(
    attachment: PendingMessageAttachment,
    options: { note?: string } = {}
  ) {
    this.isOpen = true;
    this.activeTab = "messages";
    this.currentView = "send-attachment";
    this.shareAttachment = attachment;
    this.shareAttachmentNote = options.note ?? null;
    this.pendingConversationId = null;
    this.pendingNotificationId = null;
    this.selectedConversation = null;
    this.messages = [];
    this.composeRecipientId = null;
    this.composeRecipientName = null;
    this.composeGroupMode = false;
    this.replyToMessage = null;
    this.editingMessage = null;
    this.typingUsers = [];
  }

  /** Existing sequence call sites keep working unchanged. */
  openSequenceShare(payload: SequenceSharePayload) {
    this.openAttachmentShare({ type: "sequence", payload });
  }

  completeAttachmentShare(conversationId: string) {
    this.shareAttachment = null;
    this.shareAttachmentNote = null;
    this.openToConversationById(conversationId);
  }

  cancelAttachmentShare() {
    this.close();
  }
```

Then rewrite the two old completion methods (lines 227-234) as aliases so no
existing caller churns:

```ts
  completeSequenceShare(conversationId: string) {
    this.completeAttachmentShare(conversationId);
  }

  cancelSequenceShare() {
    this.cancelAttachmentShare();
  }
```

- [ ] **Step 7: Add the generalized entry point**

In `src/lib/shared/inbox/state/send-sequence-state.svelte.ts`, add beside the
existing `openSendSequenceSheet` (line 23):

```ts
import type { PendingMessageAttachment } from "../domain/pending-message-attachment";

/**
 * The share-intake entry point. openSendSequenceSheet stays as the
 * sequence-shaped convenience its four call sites already use.
 */
export function openSendAttachmentSheet(
  attachment: PendingMessageAttachment,
  options: { note?: string } = {}
): void {
  inboxState.openAttachmentShare(attachment, options);
}
```

- [ ] **Step 8: Rename the sheet and its test**

```bash
git mv src/lib/shared/inbox/components/messages/SendSequenceSheet.svelte src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte
git mv src/lib/shared/inbox/components/messages/SendSequenceSheet.svelte.test.ts src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte.test.ts
```

- [ ] **Step 9: Update the drawer**

In `src/lib/shared/inbox/components/InboxDrawer.svelte`:

Line 21 — the import:

```svelte
  import SendAttachmentSheet from "./messages/SendAttachmentSheet.svelte";
```

Line 274 — the back/escape branch:

```ts
      } else if (inboxState.currentView === "send-attachment") {
        inboxState.cancelAttachmentShare();
```

Lines 536-537 — the header branch and its title:

```svelte
      {:else if inboxState.currentView === "send-attachment"}
        <h2 id="inbox-title">
          {inboxState.shareAttachment?.type === "image"
            ? "Send image"
            : "Send sequence"}
        </h2>
```

Line 561 — the content class:

```svelte
      class:contained={inboxState.currentView === "send-attachment"}
```

Lines 600-604 — the render:

```svelte
      {:else if inboxState.currentView === "send-attachment"}
        {#if inboxState.shareAttachment}
          <SendAttachmentSheet
            attachment={inboxState.shareAttachment}
            initialNote={inboxState.shareAttachmentNote ?? ""}
            onSent={handleSequenceSent}
          />
        {/if}
```

- [ ] **Step 10: Rework the sheet's script**

In `src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte`:

Add the image sender import beside the messaging imports:

```ts
  import { getMessageImageSender } from "$lib/shared/messaging/get-message-image-sender";
  import type { PendingMessageAttachment } from "../../domain/pending-message-attachment";
```

Replace the `Props` interface and the `payload` binding (lines 22-33):

```ts
  interface Props {
    attachment: PendingMessageAttachment;
    /** Prefilled note. Share intake passes the shared text that was not a code. */
    initialNote?: string;
    onSent: (conversationId: string) => void;
  }

  type SelectedUser = {
    id: string;
    displayName: string;
    avatar?: string;
  };

  let { attachment, initialNote = "", onSent }: Props = $props();

  // Naming this `payload` is what keeps the nine existing payload.* references
  // in this file working across the generalization.
  const payload = $derived(
    attachment.type === "sequence" ? attachment.payload : null
  );
  const image = $derived(attachment.type === "image" ? attachment : null);
```

Change the message initializer (line 40) so a prefilled note lands in it:

```ts
  let message = $state(initialNote);
```

Add an object URL for the image preview, next to the other deriveds:

```ts
  const imagePreviewUrl = $derived(image ? URL.createObjectURL(image.file) : null);

  // Revoke on swap and on unmount; a leaked blob: URL pins the whole image in
  // memory for the life of the tab.
  $effect(() => {
    const url = imagePreviewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });
```

Replace `displayWord` (lines 49-53) and add the two labels:

```ts
  const displayWord = $derived(
    payload
      ? simplifyRepeatedWord(payload.sequenceWord || payload.sequenceCloudWord || "")
      : (image?.file.name ?? "")
  );
  const kicker = $derived(attachment.type === "image" ? "Sending" : "Sharing");
  const sendLabel = $derived(
    attachment.type === "image" ? "Send image" : "Send sequence"
  );
```

Replace `send()` (lines 138-189) with the branching version:

```ts
  async function resolveConversationId(
    conversation: ConversationPreview | null,
    user: SelectedUser | null
  ): Promise<string> {
    if (conversation) return conversation.id;
    const created = await conversationService.getOrCreateConversation(user!.id, {
      silent: true,
    });
    return created.conversation.id;
  }

  async function send(): Promise<void> {
    const conversation = selectedConversation;
    const user = selectedUser;
    if ((!conversation && !user) || phase !== "idle") return;

    phase = "sending";

    try {
      await ensureGuestIdentity();

      let conversationId: string;

      if (attachment.type === "sequence") {
        // Short code first, exactly as before: creating the conversation and
        // THEN failing would leave an empty conversation behind.
        const { code } = await getShortCodeManager().createShortCode(
          attachment.payload.sequence,
          { embedSequenceData: true }
        );
        const sequenceAttachment = buildSequenceMessageAttachment(
          attachment.payload.sequence,
          code
        );
        conversationId = await resolveConversationId(conversation, user);
        await messagingService.sendMessage({
          conversationId,
          content: message.trim(),
          attachments: [sequenceAttachment],
        });
      } else {
        // The image path is a Storage upload, not a message write:
        // IMessageImageSender owns finalization and clears staging itself, and
        // it needs the conversation id up front.
        conversationId = await resolveConversationId(conversation, user);
        await getMessageImageSender().send({
          conversationId,
          messageId: attachment.messageId,
          attachmentId: attachment.attachmentId,
          file: attachment.file,
          content: message.trim(),
        }).promise;
      }

      hapticService?.trigger("success");
      onSent(conversationId);
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught : new Error(String(caught));
      getErrorHandler().showUserError({
        message:
          getShortCodeShareMessage(caught) ??
          (attachment.type === "image"
            ? "The image wasn’t sent. Try again."
            : "The sequence wasn’t sent. Try again."),
        technicalDetails: failure.message,
        error: failure,
        severity: "warning",
        context: {
          module: "inbox",
          tab: "messages",
          action: attachment.type === "image" ? "sendImage" : "sendSequence",
        },
      });
      hapticService?.trigger("error");
      phase = "idle";
    }
  }
```

- [ ] **Step 11: Rework the sheet's markup and class name**

Replace the root class and the preview article (lines 192-227):

```svelte
<div
  class="send-attachment-sheet"
  class:destination-selected={hasDestination}
  aria-busy={phase === "sending"}
>
  <article class="sequence-preview" aria-label="Attachment being shared">
    <div class="preview-thumbnail">
      {#if payload && payload.sequenceThumbnail && !thumbnailFailed}
        <img
          src={payload.sequenceThumbnail}
          alt=""
          class="thumbnail-img"
          onerror={() => {
            thumbnailFailed = true;
          }}
        />
      {:else if imagePreviewUrl}
        <img src={imagePreviewUrl} alt="" class="thumbnail-img" />
      {:else}
        <div class="thumbnail-fallback" aria-hidden="true">
          <i class="fas {image ? 'fa-image' : 'fa-layer-group'}"></i>
        </div>
      {/if}
    </div>

    <div class="preview-info">
      <span class="preview-kicker">{kicker}</span>
      <strong class="preview-word">{displayWord || "Attachment"}</strong>
      <div class="preview-meta">
        {#if payload?.sequenceStepCount}
          <span>{payload.sequenceStepCount} steps</span>
        {/if}
        {#if payload?.sequenceAuthor}
          <span>by {payload.sequenceAuthor}</span>
        {/if}
      </div>
    </div>
  </article>
```

Change the send button's label (line 366):

```svelte
    <span>{phase === "sending" ? "Sending…" : sendLabel}</span>
```

Rename the CSS selector at **all four** remaining sites — lines 371, 747, 816
and 854 — from `.send-sequence-sheet` to `.send-attachment-sheet`. Nothing else
in the stylesheet changes.

Run: `grep -c "send-sequence-sheet" src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte`
Expected: `0`.

- [ ] **Step 12: Update the component test**

In `src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte.test.ts`:

Change the import (line 6):

```ts
import SendAttachmentSheet from "./SendAttachmentSheet.svelte";
```

Add the image-sender mock beside the other `vi.mock` calls:

```ts
vi.mock("$lib/shared/messaging/get-message-image-sender", () => ({
  getMessageImageSender: () => ({ send: mocks.sendImage }),
}));
```

Add `sendImage: vi.fn()` to the `vi.hoisted` block, and to `beforeEach`:

```ts
    mocks.sendImage.mockReset();
    mocks.sendImage.mockReturnValue({
      promise: Promise.resolve({
        messageId: "message-1",
        storagePath: "p",
        width: 1,
        height: 1,
      }),
      cancel: vi.fn(),
    });
```

Replace all three `render(SendSequenceSheet, { payload: createPayload(), onSent })`
calls with:

```ts
    render(SendAttachmentSheet, {
      attachment: { type: "sequence", payload: createPayload() },
      onSent,
    });
```

(the third one passes `onSent: vi.fn()` — keep that as it is).

Then append the test that proves the feature's actual point — that this sheet
can send an image at all:

```ts
  it("uploads an image attachment through the image sender", async () => {
    addGroupConversation();
    const onSent = vi.fn();

    render(SendAttachmentSheet, {
      attachment: {
        type: "image",
        file: new File([new Uint8Array([1, 2, 3])], "shared.png", {
          type: "image/png",
        }),
        messageId: "msg-1",
        attachmentId: "att-1",
      },
      initialNote: "from the share sheet",
      onSent,
    });

    await page.getByRole("button", { name: /Send to Tuesday Jam/ }).click();
    await page.getByRole("button", { name: "Send image" }).click();

    await vi.waitFor(() => {
      expect(mocks.sendImage).toHaveBeenCalledOnce();
    });

    expect(mocks.sendImage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "group-1",
        messageId: "msg-1",
        attachmentId: "att-1",
        content: "from the share sheet",
      })
    );
    // An image never goes through the message writer; the sender owns the write.
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(onSent).toHaveBeenCalledWith("group-1");
  });
```

- [ ] **Step 13: Run both suites**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/inbox-attachment-share.test.ts`
Expected: PASS, 5 tests.

Run: `npx vitest run --config tests/config/vitest.components.config.ts src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 14: Prove no stale reference survived the rename**

Run: `grep -rn "SendSequenceSheet\|shareSequencePayload\|\"send-sequence\"" src/ | wc -l`
Expected: `0`.

- [ ] **Step 15: Typecheck (capture once, grep many)**

Run: `npm run check > /tmp/check.log 2>&1; grep -ciE "^Error|: error" /tmp/check.log`
Expected: `0`. If non-zero, `grep -iE "error" /tmp/check.log | head -20` and fix.
Do **not** re-run `check` to re-filter (`.claude/rules/fast-iteration-loop.md`).

- [ ] **Step 16: Commit**

```bash
git commit -m "refactor(inbox): generalize the share sheet to send an image or a sequence" -- src/lib/shared/inbox/ tests/unit/share-intake/inbox-attachment-share.test.ts
```

---

### Task 9: Route a classified intake to its destination

Six defects in the first draft:

- **The comment promised a queue and the code took `images[0]`**, discarding the
  rest with no trace. Batch send is out of scope per the spec, so the truncation
  is now **surfaced** — the extras come back as `queued` with a `send-dropped`
  problem each, and the runner (Task 10) holds the record open instead of
  deleting it.
- **`resolveForImport` is a network read that can reject**, and one rejection
  killed routing for every other item. Each await is wrapped.
- **Nothing was actually filed.** `ScanCardSheet.svelte:172-200` shows that a
  card with `docBacked: false` (a printed deck card) has no referenceable doc
  and must be saved to My Library first. `ResolvedCard.sequence` was typed
  `unknown`, discarding the very type needed to do it.
- **`residualText` was documented as prefilled message text and never read.**
- **Codes were not deduped across the image/text merge** — the same card
  photographed *and* linked resolved twice.
- **`.filter()` does not narrow a union**, so the draft cast with
  `as { code: string }`. Type predicates instead.

`getShortCodeManager()` **throws** unless `configureShortCodeManager()` has run
(`get-short-code-manager.ts:20-22`). The runner is invoked from the native
initializer, which runs after DI; the throw is caught and recorded rather than
assumed away, and there is a test for it.

**Files:**
- Create: `src/lib/shared/share-intake/services/intake-router.ts`
- Test: `tests/unit/share-intake/intake-router.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/share-intake/intake-router.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const openAttachmentShare = vi.fn();
vi.mock("$lib/shared/inbox/state/inbox-state.svelte", () => ({
  inboxState: { openAttachmentShare },
}));

const resolveForImport = vi.fn();
const getShortCodeManager = vi.fn(() => ({ resolveForImport }));
vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => getShortCodeManager(),
}));

const saveSequence = vi.fn();
vi.mock("$lib/features/library/get-library-save-service", () => ({
  getLibrarySaveService: () => ({ saveSequence }),
}));

import { routeIntake } from "$lib/shared/share-intake/services/intake-router";
import type { IntakeClassification } from "$lib/shared/share-intake/domain/share-intake-models";

function png(name: string): File {
  return new File([new Uint8Array([1])], name, { type: "image/png" });
}

function classification(
  overrides: Partial<IntakeClassification> = {}
): IntakeClassification {
  return {
    items: [],
    textCode: null,
    residualText: null,
    problems: [],
    ...overrides,
  };
}

describe("routeIntake", () => {
  beforeEach(() => {
    openAttachmentShare.mockReset();
    resolveForImport.mockReset();
    saveSequence.mockReset();
    getShortCodeManager.mockReset();
    getShortCodeManager.mockReturnValue({ resolveForImport });
  });

  it("opens the conversation picker for a plain image", async () => {
    const result = await routeIntake(
      classification({ items: [{ kind: "image", file: png("a.png") }] }),
      null
    );

    expect(openAttachmentShare).toHaveBeenCalledTimes(1);
    expect(openAttachmentShare.mock.calls[0][0].type).toBe("image");
    expect(result.cards).toHaveLength(0);
  });

  it("passes residual text through as the prefilled note", async () => {
    await routeIntake(
      classification({
        items: [{ kind: "image", file: png("a.png") }],
        residualText: "look at this",
      }),
      null
    );

    expect(openAttachmentShare.mock.calls[0][1]).toEqual({ note: "look at this" });
  });

  it("resolves a doc-backed card without touching the library", async () => {
    resolveForImport.mockResolvedValue({
      sequence: { id: "s1", word: "ABC" },
      docBacked: true,
    });

    const result = await routeIntake(
      classification({ items: [{ kind: "card", code: "AB12", file: png("c.png") }] }),
      "user-1"
    );

    expect(resolveForImport).toHaveBeenCalledWith("AB12", "user-1");
    expect(result.cards[0]).toMatchObject({ code: "AB12", docBacked: true, targetId: "s1" });
    expect(saveSequence).not.toHaveBeenCalled();
    expect(openAttachmentShare).not.toHaveBeenCalled();
  });

  it("saves a printed (non-doc-backed) card to the library before filing it", async () => {
    // ScanCardSheet:172-200 does exactly this. Without it the "card" points at
    // nothing.
    resolveForImport.mockResolvedValue({
      sequence: { id: "inline", word: "ABC" },
      docBacked: false,
    });
    saveSequence.mockResolvedValue({ sequenceId: "lib-9", persisted: true });

    const result = await routeIntake(
      classification({ items: [{ kind: "card", code: "AB12", file: png("c.png") }] }),
      "user-1"
    );

    expect(saveSequence).toHaveBeenCalledWith(
      expect.objectContaining({ id: "inline" }),
      { name: "ABC", visibility: "public", tags: [], notes: "" }
    );
    expect(result.cards[0].targetId).toBe("lib-9");
  });

  it("reports an unresolvable code as retryable instead of throwing", async () => {
    resolveForImport.mockResolvedValue(null);

    const result = await routeIntake(
      classification({ items: [{ kind: "card", code: "BAD1", file: png("c.png") }] }),
      null
    );

    expect(result.cards).toHaveLength(0);
    expect(result.unresolved).toEqual(["BAD1"]);
  });

  it("keeps routing the other codes when one resolve rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resolveForImport
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ sequence: { id: "s2", word: "B" }, docBacked: true });

    const result = await routeIntake(
      classification({
        items: [
          { kind: "card", code: "AA11", file: png("a.png") },
          { kind: "card", code: "BB22", file: png("b.png") },
        ],
      }),
      null
    );

    expect(result.unresolved).toEqual(["AA11"]);
    expect(result.cards).toHaveLength(1);
    expect(result.problems).toContainEqual(
      expect.objectContaining({ name: "AA11", reason: "resolve-failed" })
    );
  });

  it("records resolve-failed when the manager itself is unconfigured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getShortCodeManager.mockImplementation(() => {
      throw new Error("getShortCodeManager(): call configureShortCodeManager() first");
    });

    const result = await routeIntake(
      classification({ items: [{ kind: "card", code: "AB12", file: png("c.png") }] }),
      null
    );

    expect(result.unresolved).toEqual(["AB12"]);
    expect(result.problems[0].reason).toBe("resolve-failed");
  });

  it("resolves a code found in shared text", async () => {
    resolveForImport.mockResolvedValue({ sequence: { id: "s2", word: "B" }, docBacked: true });

    const result = await routeIntake(classification({ textCode: "XY99" }), null);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].code).toBe("XY99");
  });

  it("dedupes a code that appears in both an image and the text", async () => {
    resolveForImport.mockResolvedValue({ sequence: { id: "s1", word: "A" }, docBacked: true });

    const result = await routeIntake(
      classification({
        items: [{ kind: "card", code: "AB12", file: png("c.png") }],
        textCode: "AB12",
      }),
      null
    );

    expect(resolveForImport).toHaveBeenCalledTimes(1);
    expect(result.cards).toHaveLength(1);
  });

  it("ignores a duplicate item entirely", async () => {
    const result = await routeIntake(
      classification({
        items: [{ kind: "duplicate", code: "AB12", file: png("b.png") }],
      }),
      null
    );

    expect(openAttachmentShare).not.toHaveBeenCalled();
    expect(result.cards).toHaveLength(0);
    expect(result.queued).toHaveLength(0);
  });

  it("queues images past the first and records them rather than dropping them", async () => {
    const result = await routeIntake(
      classification({
        items: [
          { kind: "image", file: png("a.png") },
          { kind: "image", file: png("b.png") },
          { kind: "image", file: png("c.png") },
        ],
      }),
      null
    );

    expect(openAttachmentShare).toHaveBeenCalledTimes(1);
    expect(result.queued.map((f) => f.name)).toEqual(["b.png", "c.png"]);
    expect(result.problems.map((p) => p.reason)).toEqual([
      "send-dropped",
      "send-dropped",
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-router.test.ts`
Expected: FAIL — `Failed to resolve import ".../intake-router"`.

- [ ] **Step 3: Write the router**

Create `src/lib/shared/share-intake/services/intake-router.ts`:

```ts
import { getLibrarySaveService } from "$lib/features/library/get-library-save-service";
import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type {
  IntakeClassification,
  IntakeItem,
  IntakeProblem,
} from "../domain/share-intake-models";

type CardItem = Extract<IntakeItem, { kind: "card" }>;
type ImageItem = Extract<IntakeItem, { kind: "image" }>;

// Array.filter does NOT narrow a union on its own; these predicates are what
// make `item.code` and `item.file` legal below without a cast.
const isCard = (item: IntakeItem): item is CardItem => item.kind === "card";
const isImage = (item: IntakeItem): item is ImageItem => item.kind === "image";

export interface FiledCard {
  code: string;
  sequence: SequenceData;
  /** False for printed deck cards with no referenceable doc. */
  docBacked: boolean;
  /**
   * The id a caller should open. Equals sequence.id when docBacked; otherwise
   * the id produced by saving the printed card into My Library.
   */
  targetId: string;
}

export interface RouteResult {
  cards: FiledCard[];
  /** Codes that did not resolve. Retryable read failures, not errors. */
  unresolved: string[];
  /**
   * Images the picker could not take in this pass. The picker sends one at a
   * time and sequential batch orchestration is out of scope (see the spec), so
   * these are REPORTED rather than discarded, and their intake stays in the
   * store as partially-sent.
   */
  queued: File[];
  problems: IntakeProblem[];
}

/**
 * Send a classified intake to its destination.
 *
 * Cards resolve through the existing import path and are filed the same way
 * ScanCardSheet files them. Images open the inbox conversation picker.
 * `duplicate` items are ignored entirely - they are second photos of a card
 * already handled, and sending one as an image would put a picture of a card
 * into a conversation.
 */
export async function routeIntake(
  classification: IntakeClassification,
  userId: string | null
): Promise<RouteResult> {
  const cards: FiledCard[] = [];
  const unresolved: string[] = [];
  const problems: IntakeProblem[] = [];

  // The same card can be photographed AND linked in the shared text. Resolving
  // it twice costs a second network read and files it twice.
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const code of [
    ...classification.items.filter(isCard).map((item) => item.code),
    ...(classification.textCode ? [classification.textCode] : []),
  ]) {
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }

  for (const code of codes) {
    // Each of these is a network read, and getShortCodeManager() itself throws
    // when DI has not run. One failure must not abandon the remaining codes.
    try {
      const resolution = await getShortCodeManager().resolveForImport(code, userId);
      if (!resolution) {
        unresolved.push(code);
        continue;
      }
      cards.push(await fileCard(code, resolution));
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      unresolved.push(code);
      problems.push({ name: code, reason: "resolve-failed", detail });
      console.error(`[ShareIntake] Could not resolve ${code}:`, detail);
    }
  }

  const images = classification.items.filter(isImage);
  const queued: File[] = [];

  if (images.length > 0) {
    const [first, ...rest] = images;
    inboxState.openAttachmentShare(
      {
        type: "image",
        file: first.file,
        messageId: crypto.randomUUID(),
        attachmentId: crypto.randomUUID(),
      },
      classification.residualText ? { note: classification.residualText } : {}
    );

    for (const item of rest) {
      queued.push(item.file);
      problems.push({ name: item.file.name, reason: "send-dropped" });
    }
  }

  return { cards, unresolved, queued, problems };
}

async function fileCard(
  code: string,
  resolution: { sequence: SequenceData; docBacked: boolean }
): Promise<FiledCard> {
  if (resolution.docBacked) {
    return {
      code,
      sequence: resolution.sequence,
      docBacked: true,
      targetId: resolution.sequence.id,
    };
  }

  // No referenceable doc behind this card (printed deck cards): save it to My
  // Library under the normal public default, then file it. Exactly the branch
  // ScanCardSheet.svelte:172-200 takes.
  const name = resolution.sequence.word || resolution.sequence.name || "Sequence";
  const saved = await getLibrarySaveService().saveSequence(resolution.sequence, {
    name,
    visibility: "public",
    tags: [],
    notes: "",
  });

  return {
    code,
    sequence: resolution.sequence,
    docBacked: false,
    targetId: saved.sequenceId,
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-router.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(share-intake): route classified intakes, filing printed cards to the library" -- src/lib/shared/share-intake/services/intake-router.ts tests/unit/share-intake/intake-router.test.ts
```

---

### Task 10: The consumer — `share-intake-runner`

**Everything built so far is unreachable.** `classifyIntake` and `routeIntake`
are called by nothing but their own tests; a persisted intake would sit in
IndexedDB forever. This task is the missing half of the feature.

The runner is also where `hasPendingShare` belongs, because the runner is what
defines "unconsumed": `received` and `needs-auth`. A `failed` or `expired`
record must NOT hold the boot barrier open.

Lifecycle, explicitly:

| Outcome | Status | Record |
|---|---|---|
| Everything routed | — | deleted |
| A code did not resolve, or images were queued | `partially-sent` | kept, problems appended |
| Routing threw | `failed` | kept until the TTL reaps it, problems appended, not retried |

Reads never delete, so a crash between classify and route leaves the bytes
recoverable — deletion happens only after every item reached a destination.

**Files:**
- Create: `src/lib/shared/share-intake/services/share-intake-runner.ts`
- Test: `tests/unit/share-intake/share-intake-runner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/share-intake/share-intake-runner.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";

vi.mock("$app/environment", () => ({ browser: true }));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { effectiveUserId: "user-1" },
}));

const classifyIntake = vi.fn();
vi.mock("$lib/shared/share-intake/services/intake-classifier", () => ({
  classifyIntake: (...args: unknown[]) => classifyIntake(...args),
}));

const routeIntake = vi.fn();
vi.mock("$lib/shared/share-intake/services/intake-router", () => ({
  routeIntake: (...args: unknown[]) => routeIntake(...args),
}));

import {
  hasPendingShare,
  runPendingIntakes,
  scheduleIntakeRun,
} from "$lib/shared/share-intake/services/share-intake-runner";
import {
  putIntake,
  getIntake,
  listIntakes,
  deleteIntake,
} from "$lib/shared/share-intake/services/intake-store";
import type { SharedIntake } from "$lib/shared/share-intake/domain/share-intake-models";

function intake(overrides: Partial<SharedIntake> = {}): SharedIntake {
  return {
    receiptId: "si_1",
    source: "native",
    files: [new File([new Uint8Array([1])], "a.png", { type: "image/png" })],
    status: "received",
    receivedAt: Date.now(),
    problems: [],
    ...overrides,
  };
}

const emptyClassification = {
  items: [],
  textCode: null,
  residualText: null,
  problems: [],
};

const cleanRoute = { cards: [], unresolved: [], queued: [], problems: [] };

describe("share-intake-runner", () => {
  beforeEach(async () => {
    for (const record of await listIntakes()) await deleteIntake(record.receiptId);
    classifyIntake.mockReset();
    classifyIntake.mockResolvedValue(emptyClassification);
    routeIntake.mockReset();
    routeIntake.mockResolvedValue(cleanRoute);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports no pending share on a clean store", async () => {
    expect(await hasPendingShare()).toBe(false);
  });

  it("reports a pending share for received and for needs-auth", async () => {
    await putIntake(intake({ receiptId: "si_a", status: "received" }));
    expect(await hasPendingShare()).toBe(true);

    await deleteIntake("si_a");
    await putIntake(intake({ receiptId: "si_b", status: "needs-auth" }));
    expect(await hasPendingShare()).toBe(true);
  });

  it("does not hold the boot barrier open for a failed record", async () => {
    await putIntake(intake({ receiptId: "si_dead", status: "failed" }));
    expect(await hasPendingShare()).toBe(false);
  });

  it("routes a pending intake and deletes it on completion", async () => {
    await putIntake(intake());

    await runPendingIntakes();

    expect(classifyIntake).toHaveBeenCalledTimes(1);
    expect(routeIntake).toHaveBeenCalledWith(emptyClassification, "user-1");
    expect(await getIntake("si_1")).toBeNull();
  });

  it("keeps a record as partially-sent when a code did not resolve", async () => {
    routeIntake.mockResolvedValue({ ...cleanRoute, unresolved: ["AB12"] });
    await putIntake(intake());

    await runPendingIntakes();

    const record = await getIntake("si_1");
    expect(record?.status).toBe("partially-sent");
    expect(record?.problems).toContainEqual(
      expect.objectContaining({ name: "AB12", reason: "resolve-failed" })
    );
  });

  it("keeps a record when images were queued", async () => {
    routeIntake.mockResolvedValue({
      ...cleanRoute,
      queued: [new File([new Uint8Array([1])], "b.png", { type: "image/png" })],
    });
    await putIntake(intake());

    await runPendingIntakes();

    expect((await getIntake("si_1"))?.status).toBe("partially-sent");
  });

  it("marks a record failed when routing throws, and does not retry it", async () => {
    routeIntake.mockRejectedValue(new Error("boom"));
    await putIntake(intake());

    await runPendingIntakes();
    const afterFirst = await getIntake("si_1");
    expect(afterFirst?.status).toBe("failed");
    expect(afterFirst?.problems).toContainEqual(
      expect.objectContaining({ reason: "route-failed", detail: "boom" })
    );

    await runPendingIntakes();
    expect(routeIntake).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent runs into one pass", async () => {
    await putIntake(intake());

    await Promise.all([scheduleIntakeRun(), scheduleIntakeRun(), scheduleIntakeRun()]);

    // Three callers, one record, one classify. The boot barrier and a warm
    // delivery both call this and must not race over the same rows.
    expect(classifyIntake).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/share-intake-runner.test.ts`
Expected: FAIL — `Failed to resolve import ".../share-intake-runner"`.

- [ ] **Step 3: Write the runner**

Create `src/lib/shared/share-intake/services/share-intake-runner.ts`:

```ts
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import type {
  IntakeProblem,
  ShareIntakeStatus,
} from "../domain/share-intake-models";
import { classifyIntake } from "./intake-classifier";
import { routeIntake } from "./intake-router";
import {
  deleteIntake,
  listIntakes,
  reapExpired,
  updateStatus,
} from "./intake-store";

/**
 * The consumer. Without this the whole pipeline is write-only: intakes land in
 * IndexedDB and nothing ever reads them back out.
 */

/**
 * A record in one of these states still has somewhere to go. `failed` and
 * `expired` deliberately do NOT count - a failed record must not hold the boot
 * barrier open forever; the TTL reaps it.
 */
const UNCONSUMED: readonly ShareIntakeStatus[] = ["received", "needs-auth"];

export async function hasPendingShare(): Promise<boolean> {
  return (await listIntakes()).some((record) => UNCONSUMED.includes(record.status));
}

let running: Promise<void> | null = null;
let rerunRequested = false;

/**
 * Coalesced entry point. Both the boot barrier and a warm-launch delivery call
 * this; the guard means a share arriving mid-run gets one extra pass instead of
 * a second concurrent run over the same rows.
 */
export function scheduleIntakeRun(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return running;
  }

  running = (async () => {
    try {
      do {
        rerunRequested = false;
        await runPendingIntakes();
      } while (rerunRequested);
    } finally {
      running = null;
    }
  })();

  return running;
}

export async function runPendingIntakes(): Promise<void> {
  await reapExpired();

  const pending = (await listIntakes())
    .filter((record) => UNCONSUMED.includes(record.status))
    .sort((a, b) => a.receivedAt - b.receivedAt);

  for (const record of pending) {
    try {
      const classification = await classifyIntake({
        files: record.files,
        text: record.text,
      });
      const result = await routeIntake(
        classification,
        authState.effectiveUserId ?? null
      );

      const problems: IntakeProblem[] = [
        ...classification.problems,
        ...result.problems,
        ...result.unresolved.map((code) => ({
          name: code,
          reason: "resolve-failed" as const,
        })),
      ];

      if (result.unresolved.length > 0 || result.queued.length > 0) {
        // Something this share carried has not reached a destination. Keeping
        // the record is the point: the bytes are still there to retry with.
        await updateStatus(record.receiptId, "partially-sent", problems);
        console.warn(
          `[ShareIntake] ${record.receiptId} kept: ${result.unresolved.length} unresolved, ${result.queued.length} queued`
        );
        continue;
      }

      if (problems.length > 0) {
        console.warn(`[ShareIntake] ${record.receiptId} completed with problems`, problems);
      }

      // Everything reached a destination. Only NOW is deleting safe - reads
      // never delete precisely so a crash mid-route leaves the bytes intact.
      await deleteIntake(record.receiptId);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      console.error(`[ShareIntake] Routing ${record.receiptId} failed:`, detail);
      // "failed" leaves the state UNCONSUMED set, so this is not retried in a
      // loop. It stays visible until the TTL reaps it.
      await updateStatus(record.receiptId, "failed", [
        { name: "", reason: "route-failed", detail },
      ]);
    }
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/share-intake-runner.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(share-intake): consume persisted intakes and advance their lifecycle" -- src/lib/shared/share-intake/services/share-intake-runner.ts tests/unit/share-intake/share-intake-runner.test.ts
```

---

### Task 11: Native adapter, dedup, and the boot barrier

Two races, one task.

**Race 1 — the cold-launch double fire.** `BridgeActivity.java:51` calls
`onNewIntent(getIntent())` right after `load()` and the plugin handles the
intent in both, so a cold-launch share arrives twice, milliseconds apart. The
first draft deduped by reading IndexedDB for the derived `receiptId` — an
`await` — so both deliveries passed the check before either wrote. Worse, the
plugin's `SharedFile` is `{ uri, name, mimeType }` with **no size** (verified in
`node_modules/@capgo/capacitor-share-target/dist/esm/definitions.d.ts`), so the
key degraded to name + mimeType and two different screenshots named
`Screenshot_20260728.png` collided — the second silently swallowed.

The fix is two keys from the same function:

- **In-flight key**, derived synchronously from the raw descriptors and held in
  a module-level `Set`. Nothing awaits between deriving it and adding it, so the
  second delivery cannot slip past.
- **Durable `receiptId`**, derived *after* bridging from descriptors that now
  carry the real `blob.size`. Same `deriveReceiptId` as committed in Task 2,
  called with a populated `size`.

**Race 2 — the initial route.** `native-initializer.ts:70` runs `bootIntoApp()`
→ `goto("/create")` when there is no launch URL, and an `ACTION_SEND` has none.
The first draft's barrier could not work: `ensureShareTargetRegistered()`
resolved as soon as `addListener` resolved, but the retained event arrives
asynchronously *after* that and the handler was fire-and-forget — so
`hasPendingShare()` read an empty store and `bootIntoApp()` navigated away
anyway. Registration now resolves on **first-event-handled OR a short grace**,
whichever comes first.

**Files:**
- Create: `src/lib/shared/share-intake/services/native-share-adapter.ts`
- Create: `src/lib/shared/share-intake/get-share-intake.ts`
- Modify: `src/lib/shared/platform/services/native-initializer.ts:57-75`
- Test: `tests/unit/share-intake/native-share-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/share-intake/native-share-adapter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";

vi.mock("$app/environment", () => ({ browser: true }));

const listeners: Record<string, (event: unknown) => void> = {};
vi.mock("@capgo/capacitor-share-target", () => ({
  CapacitorShareTarget: {
    addListener: vi.fn((name: string, cb: (event: unknown) => void) => {
      listeners[name] = cb;
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => "android"),
    convertFileSrc: vi.fn((p: string) => `https://localhost/f${p}`),
  },
}));

const scheduleIntakeRun = vi.fn(() => Promise.resolve());
vi.mock("$lib/shared/share-intake/services/share-intake-runner", () => ({
  scheduleIntakeRun: () => scheduleIntakeRun(),
}));

import { registerNativeShareTarget } from "$lib/shared/share-intake/services/native-share-adapter";
import {
  listIntakes,
  deleteIntake,
} from "$lib/shared/share-intake/services/intake-store";

const EVENT = {
  title: "Share",
  texts: [],
  files: [{ uri: "/cache/a.png", name: "a.png", mimeType: "image/png" }],
};

function bodyOf(bytes: number) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    arrayBuffer: async () => new ArrayBuffer(bytes),
  };
}

describe("native share adapter", () => {
  beforeEach(async () => {
    for (const record of await listIntakes()) await deleteIntake(record.receiptId);
    scheduleIntakeRun.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => bodyOf(3)));
  });

  it("persists a received share and kicks the runner", async () => {
    await registerNativeShareTarget({ graceMs: 5 });
    await listeners.shareReceived(EVENT);

    const all = await listIntakes();
    expect(all).toHaveLength(1);
    expect(all[0].files[0].name).toBe("a.png");
    expect(all[0].status).toBe("received");
    expect(scheduleIntakeRun).toHaveBeenCalled();
  });

  it("collapses the cold-launch double delivery into one record", async () => {
    await registerNativeShareTarget({ graceMs: 5 });
    await listeners.shareReceived(EVENT);
    await listeners.shareReceived({ ...EVENT });

    expect(await listIntakes()).toHaveLength(1);
  });

  it("collapses it even when both deliveries land before the first bridge resolves", async () => {
    // This is the real cold-launch shape: onNewIntent(getIntent()) fires
    // milliseconds after load(), long before any fetch settles. An
    // await-then-check dedup lets BOTH through.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      await gate;
      return bodyOf(3);
    }));

    await registerNativeShareTarget({ graceMs: 5 });
    listeners.shareReceived(EVENT);
    listeners.shareReceived({ ...EVENT });
    release();
    await vi.waitFor(async () => {
      expect(await listIntakes()).toHaveLength(1);
    });

    expect(await listIntakes()).toHaveLength(1);
  });

  it("keeps two same-named screenshots apart via the bridged byte size", async () => {
    // The plugin's SharedFile has no size field, so a descriptor-only key makes
    // these two identical and silently swallows the second.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(bodyOf(11))
      .mockResolvedValueOnce(bodyOf(22));
    vi.stubGlobal("fetch", fetchMock);

    await registerNativeShareTarget({ graceMs: 5 });
    const shot = {
      title: "",
      texts: [],
      files: [
        { uri: "/cache/1/Screenshot.png", name: "Screenshot.png", mimeType: "image/png" },
      ],
    };
    await listeners.shareReceived(shot);
    await listeners.shareReceived({
      ...shot,
      files: [{ ...shot.files[0], uri: "/cache/2/Screenshot.png" }],
    });

    expect(await listIntakes()).toHaveLength(2);
  });

  it("records a bridge failure on the intake instead of dropping the file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    })));

    await registerNativeShareTarget({ graceMs: 5 });
    await listeners.shareReceived(EVENT);

    const [record] = await listIntakes();
    expect(record.problems).toContainEqual(
      expect.objectContaining({ name: "a.png", reason: "not-found" })
    );
  });

  it("records a ClipData-style empty share as failed rather than returning silently", async () => {
    await registerNativeShareTarget({ graceMs: 5 });
    await listeners.shareReceived({ title: "Share", texts: [], files: [] });

    const [record] = await listIntakes();
    // "TKA opens but receives nothing" is the exact symptom the device matrix
    // is hunting. A bare return makes it invisible.
    expect(record.status).toBe("failed");
    expect(scheduleIntakeRun).not.toHaveBeenCalled();
  });

  it("does not resolve registration before the first delivery is handled", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      await gate;
      return bodyOf(3);
    }));

    let resolved = false;
    // A long grace: the ONLY thing that can settle this is the delivery.
    const registration = registerNativeShareTarget({ graceMs: 60_000 }).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    listeners.shareReceived(EVENT);
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    release();
    await registration;
    expect(resolved).toBe(true);
    expect(await listIntakes()).toHaveLength(1);
  });

  it("resolves after the grace period when no share arrives", async () => {
    const started = Date.now();
    await registerNativeShareTarget({ graceMs: 20 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
    expect(await listIntakes()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/native-share-adapter.test.ts`
Expected: FAIL — `Failed to resolve import ".../native-share-adapter"`.

- [ ] **Step 3: Write the adapter**

Create `src/lib/shared/share-intake/services/native-share-adapter.ts`:

```ts
import { CapacitorShareTarget } from "@capgo/capacitor-share-target";
import { deriveReceiptId } from "../domain/derive-receipt-id";
import type {
  SharedFileDescriptor,
  SharedIntake,
} from "../domain/share-intake-models";
import { getIntake, putIntake } from "./intake-store";
import { screenDescriptors, validateIntake } from "./intake-validator";
import { sharedFilesToFiles } from "./shared-file-bridge";
import { scheduleIntakeRun } from "./share-intake-runner";

/**
 * The plugin's event shape, read from
 * node_modules/@capgo/capacitor-share-target/dist/esm/definitions.d.ts.
 * SharedFile is { uri, name, mimeType } - there is NO size field, which is the
 * whole reason the durable receipt id is derived after bridging.
 */
export interface ShareReceivedEvent {
  title: string;
  texts: string[];
  files: SharedFileDescriptor[];
}

/**
 * How long registration waits for a retained cold-launch intent before
 * concluding this launch carried no share. Long enough for the bridge to
 * replay an intent it already holds, short enough to be invisible at boot.
 */
const FIRST_DELIVERY_GRACE_MS = 300;

/**
 * Deliveries currently being processed, keyed by their descriptor-derived id.
 * Held in memory rather than in IndexedDB because the check has to be
 * SYNCHRONOUS - see the comment in the listener.
 */
const inFlight = new Set<string>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bridge the plugin's events into a persisted, normalized intake.
 *
 * Resolves when the first retained event has been fully handled, or after a
 * short grace if none arrives. That is load-bearing: addListener resolving
 * proves only that the bridge registered the listener, while the cold-launch
 * intent is replayed asynchronously afterwards. Returning early let the boot
 * barrier read an empty store and navigate to /create anyway.
 */
export async function registerNativeShareTarget(
  options: { graceMs?: number } = {}
): Promise<void> {
  let settleFirstDelivery: () => void = () => {};
  const firstDelivery = new Promise<void>((resolve) => {
    settleFirstDelivery = resolve;
  });

  await CapacitorShareTarget.addListener(
    "shareReceived",
    (event: ShareReceivedEvent) => {
      // SYNCHRONOUS claim, before any await. BridgeActivity delivers a cold
      // launch twice milliseconds apart; an await-then-check against IndexedDB
      // lets both deliveries pass the check before either one writes. The
      // descriptor-derived key is computable right here with no I/O.
      const deliveryKey = deriveReceiptId({
        files: event.files ?? [],
        texts: event.texts ?? [],
      });
      if (inFlight.has(deliveryKey)) return;
      inFlight.add(deliveryKey);

      void handleShareReceived(event)
        .catch((caught: unknown) => {
          console.error("[ShareIntake] Handling a share failed:", caught);
        })
        .finally(() => {
          inFlight.delete(deliveryKey);
          settleFirstDelivery();
        });
    }
  );

  await Promise.race([
    firstDelivery,
    delay(options.graceMs ?? FIRST_DELIVERY_GRACE_MS),
  ]);
}

async function handleShareReceived(event: ShareReceivedEvent): Promise<void> {
  const texts = event.texts ?? [];

  // Type and count are screened BEFORE the bridge reads a byte.
  const screen = screenDescriptors(event.files ?? []);
  const { bridged, problems: bridgeProblems } = await sharedFilesToFiles(
    screen.admitted
  );

  const gate = validateIntake({
    files: bridged.map((entry) => entry.file),
    text: texts.length > 0 ? texts.join("\n") : undefined,
    title: event.title || undefined,
  });

  // Only NOW is the durable id derivable: the bridged descriptors carry a real
  // byte size, so two different screenshots that happen to share a name and
  // mime type no longer collide.
  const receiptId = deriveReceiptId({
    files: bridged.map((entry) => entry.descriptor),
    texts,
  });

  // Second delivery of a share already persisted in an earlier session.
  if (await getIntake(receiptId)) return;

  const problems = [...screen.problems, ...bridgeProblems, ...gate.problems];
  const empty = gate.accepted.length === 0 && !gate.text;

  const record: SharedIntake = {
    receiptId,
    source: "native",
    files: gate.accepted,
    text: gate.text ?? undefined,
    title: gate.title ?? undefined,
    // A share that produced nothing usable is RECORDED, not dropped. "TKA
    // opened and nothing happened" is the ClipData symptom the device matrix
    // is hunting for, and a bare return makes it invisible.
    status: empty ? "failed" : "received",
    receivedAt: Date.now(),
    problems,
  };

  if (problems.length > 0) {
    console.warn("[ShareIntake] Share arrived with problems:", problems);
  }

  try {
    await putIntake(record);
  } catch (caught) {
    // Quota or a blocked upgrade. Loud rather than silent, per the store's
    // own honesty note.
    console.error("[ShareIntake] Could not persist the share:", caught);
    return;
  }

  if (!empty) void scheduleIntakeRun();
}
```

- [ ] **Step 4: Add the idempotent registration getter**

Create `src/lib/shared/share-intake/get-share-intake.ts`:

```ts
import { registerNativeShareTarget } from "./services/native-share-adapter";

let registration: Promise<void> | null = null;

/**
 * Idempotent registration - safe to call from more than one boot path, and
 * every caller awaits the SAME promise so they all see the barrier satisfied.
 */
export function ensureShareTargetRegistered(options?: {
  graceMs?: number;
}): Promise<void> {
  registration ??= registerNativeShareTarget(options);
  return registration;
}
```

- [ ] **Step 5: Wire the boot barrier**

In `src/lib/shared/platform/services/native-initializer.ts`, replace lines
57-75 (from the `// Handle deep links` comment through the `appUrlOpen`
listener) inside `initAppLifecycle`:

```ts
		// Register the share target BEFORE deciding the initial route. An
		// ACTION_SEND intent carries no launch URL, so without this the
		// bootIntoApp() below would race the share listener's own navigation and
		// the last goto() would win, nondeterministically.
		//
		// ensureShareTargetRegistered() does not resolve until the first retained
		// event has been handled (or a 300 ms grace has elapsed with none), so the
		// hasPendingShare() read below sees a written store rather than an empty
		// one. That ordering is the entire point of the barrier.
		const { ensureShareTargetRegistered } = await import(
			"$lib/shared/share-intake/get-share-intake"
		);
		const { hasPendingShare, scheduleIntakeRun } = await import(
			"$lib/shared/share-intake/services/share-intake-runner"
		);
		await ensureShareTargetRegistered();

		// Handle deep links from both cold start and warm resume.
		// Cold start: getLaunchUrl() returns the URL that opened the app.
		// Warm resume: appUrlOpen fires when a new URL arrives while running.
		const launchUrl = await App.getLaunchUrl();
		const openedViaDeepLink = launchUrl?.url
			? await this.handleDeepLink(launchUrl.url)
			: false;

		// One owner for the initial route, always.
		if (!openedViaDeepLink) {
			if (await hasPendingShare()) {
				// The share routes itself; bootIntoApp() would fight it.
				void scheduleIntakeRun();
			} else {
				// Normal cold start (tapped the app icon): the native shell loads
				// "/", which is the marketing landing. This is a standalone app, so
				// boot straight into the Composer instead.
				await this.bootIntoApp();
			}
		}

		await App.addListener("appUrlOpen", async ({ url }) => {
			await this.handleDeepLink(url);
		});
```

- [ ] **Step 6: Run the adapter suite**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/native-share-adapter.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(share-intake): native adapter with synchronous dedup and a real boot barrier" -- src/lib/shared/share-intake/services/native-share-adapter.ts src/lib/shared/share-intake/get-share-intake.ts src/lib/shared/platform/services/native-initializer.ts tests/unit/share-intake/native-share-adapter.test.ts
```

---

### Task 12: Full verification

- [ ] **Step 1: Run the whole share-intake unit suite**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/`

Expected: PASS — **9 files, 101 tests**:

| File | Tests | Task |
|---|---|---|
| `derive-receipt-id.test.ts` | 10 | 2 (already green) |
| `intake-validator.test.ts` | 18 | 3 |
| `shared-file-bridge.test.ts` | 12 | 5 |
| `intake-store.test.ts` | 13 | 6 |
| `intake-classifier.test.ts` | 16 | 7 |
| `inbox-attachment-share.test.ts` | 5 | 8 |
| `intake-router.test.ts` | 11 | 9 |
| `share-intake-runner.test.ts` | 8 | 10 |
| `native-share-adapter.test.ts` | 8 | 11 |

(The first draft's "39 tests" predated the Task 2 rewrite, which alone ships 10.)

- [ ] **Step 2: Run the component test**

Run: `npx vitest run --config tests/config/vitest.components.config.ts src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 3: Full typecheck (one cold run, then grep the log)**

Run: `npm run check > /tmp/check.log 2>&1; grep -ciE "^Error|: error" /tmp/check.log`
Expected: `0`. If non-zero: `grep -iE "error" /tmp/check.log | head -20` and fix.
Do not re-run `check` to re-filter (`.claude/rules/fast-iteration-loop.md`).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 5: Prove the ZXing WASM reaches the Capacitor web assets**

Run: `ls -l .svelte-kit/cloudflare/zxing/zxing_reader.wasm`
Expected: the file exists.

Why this is a step and not an assumption: `capacitor.config.ts` sets
`webDir: '.svelte-kit/cloudflare'`, and the detector loads the binary from
`/zxing/` (`tka-qr-detector.ts:36-38`). If it is missing from the native
bundle the fetch 404s, `classifyIntake` records one `decode-failed`, and
**every shared card silently becomes a photo** — the exact failure Task 7's
logging exists to make visible, and one no unit test can see.

- [ ] **Step 6: Sync the Android project**

Run: `npx cap sync android`
Expected: completes; `@capgo/capacitor-share-target` listed in the plugin output.

- [ ] **Step 7: Commit any fixes**

```bash
git commit -m "fix(share-intake): resolve verification findings" -- <the paths you actually changed>
```

---

## Device verification — REQUIRED before this ships

Unit tests cannot see any of these. `.claude/rules/verification-protocol.md`
requires evidence, and for this feature the evidence is a device.

- [ ] Build and install a debug APK on the Android device
- [ ] **Cold launch:** share one image from Photos with the app fully killed. Confirm **exactly one** sheet appears — this proves the in-flight `Set` suppresses the confirmed double fire
- [ ] **Cold launch, two identical filenames:** share two different screenshots that Android named identically. Confirm **two** records — this proves the post-bridge `blob.size` in the receipt id
- [ ] **Boot barrier:** cold-launch share and confirm the app does **not** flash `/create` first
- [ ] **Warm launch:** share with the app already open in the background
- [ ] **Process death:** share, force-stop mid-flow, reopen — the record should still be there and the runner should pick it up
- [ ] **Card scan:** share a screenshot of a printed choreo card; confirm it resolves, saves to My Library (non-`docBacked`), and offers the sequence
- [ ] **Non-TKA QR:** share a photo containing an unrelated QR; confirm it is treated as an image, not an error
- [ ] **Two shots of the same card:** confirm one card and **no photo attachment** — this is the `duplicate` arm
- [ ] **Text with an embedded link:** share `"check this out https://tka.run/XXXX"` from a browser; confirm the code resolves AND `"check this out"` prefills the note
- [ ] **Batch:** share 3 images at once via `SEND_MULTIPLE`. Confirm one picker plus a visible report of the two queued — not a silent drop
- [ ] **Signed out:** sign out, share, confirm the flow resumes with the file intact after sign-in, and that the record survives past one hour as `needs-auth`
- [ ] **Odd filename:** share a file named `photo#2.png` (rename one first). It must arrive, not 404 — this is the URL-encoding fix
- [ ] **`ClipData` hunt:** share from Chrome, Photos, and a messaging app. The plugin ignores `ClipData` and handles only `EXTRA_STREAM`, so a sender using `ClipData` presents as "TKA opens but receives nothing." With this plan that now leaves a `failed` record and a console warning — check `chrome://inspect` for `[ShareIntake]` lines. Record which senders work
- [ ] **Cache growth:** after ~10 shares, measure `cacheDir/shared_files` via `adb shell run-as com.tkaflowarts.composer du -sh cache/shared_files`. **Nothing cleans this yet** (see limitations) — the point is to record the real growth rate

---

## Known accepted limitations

Recorded so nobody rediscovers them as bugs. Full detail in the spec's Spike results.

- The plugin copies shared bytes to cache with **no size, count, or time limit**
  before JS is notified. Not preventable from JS. The pre-bridge screen
  (Task 3) stops those bytes reaching memory, IndexedDB, and the network — it
  cannot stop them reaching disk.
- No filename sanitization in its Java. We normalize on read; a `../` name still
  lands in its cache dir first.
- **`cacheDir/shared_files` is never cleaned.** The spec called for the adapter
  to sweep it, but deleting native files needs `@capacitor/filesystem`, which is
  **not a dependency of this repo**, so no task here implements it. The device
  check measures the growth rate instead. Fix it as its own change, with the
  growth data in hand, rather than adding a Capacitor plugin on speculation.
  Android does reclaim `cacheDir` under storage pressure, so this is untidy
  rather than unbounded.
- **No `ClipData`.** Some share sources will deliver nothing. With this plan
  that is a `failed` record plus a console warning rather than silence.
- **Batch send is one attachment plus a reported queue.** The picker sends one
  image at a time; sequential orchestration with per-item progress, cancel, and
  partial-success retry is named out of scope in the spec. The extras are
  surfaced (`queued` + `send-dropped`) and the record is held open, so nothing
  is lost — but the user must re-open to send them.
- **Two genuinely different files that agree on name, mimeType AND byte size
  still hash to one receipt id.** That is the accepted cost of excluding the
  uri without hashing content, and it is bounded by the store's TTL.
- The PWA half is not built. Installed-PWA users get no share target yet.
