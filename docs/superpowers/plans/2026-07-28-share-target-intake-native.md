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

| File | Responsibility |
|---|---|
| `src/lib/shared/share-intake/domain/share-intake-models.ts` | Types: `SharedIntake`, `ShareIntakeStatus`, `IntakeClassification` |
| `src/lib/shared/share-intake/domain/derive-receipt-id.ts` | Content-derived dedup key |
| `src/lib/shared/share-intake/services/intake-validator.ts` | Pre-decode/pre-upload gate |
| `src/lib/shared/share-intake/services/shared-file-bridge.ts` | `SharedFile` URI → `File` (**highest-risk unit**) |
| `src/lib/shared/share-intake/services/intake-store.ts` | IndexedDB durable record + TTL reaping |
| `src/lib/shared/share-intake/services/intake-classifier.ts` | Per-item routing via `extractScanCode` |
| `src/lib/shared/share-intake/services/native-share-adapter.ts` | Plugin listener → normalized payload |
| `src/lib/shared/share-intake/get-share-intake.ts` | Module-level singleton getter |
| `android/app/src/main/AndroidManifest.xml` | `ACTION_SEND` / `ACTION_SEND_MULTIPLE` filters |
| `src/lib/shared/platform/services/native-initializer.ts` | Boot barrier so a share doesn't race `/create` |
| `src/lib/shared/inbox/state/inbox-state.svelte.ts` | `send-sequence` → `send-attachment` |

---

### Task 0: Fix the pre-existing `clients.claim()` bug

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

### Task 1: Install the plugin and declare the intent filters

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

### Task 2: Domain types and `deriveReceiptId`

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

### Task 3: The validation gate

The share sheet accepts input from **any app on the device** and declared MIME
types are attacker-controlled. This gate mirrors
`MessageAttachmentPicker.svelte:9` (`MAX_IMAGE_BYTES = 10 * 1024 * 1024`,
JPEG/PNG/WebP only).

It runs before IndexedDB write, QR decode, and upload. It does **not** prevent
the plugin's native copy, which already happened — see the spec's Spike results.

**Files:**
- Create: `src/lib/shared/share-intake/services/intake-validator.ts`
- Test: `tests/unit/share-intake/intake-validator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  validateIntake,
  MAX_INTAKE_BYTES,
  MAX_INTAKE_FILES,
} from "$lib/shared/share-intake/services/intake-validator";

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateIntake", () => {
  it("accepts a normal png", () => {
    const r = validateIntake({ files: [fileOf("a.png", "image/png", 100)], text: undefined });
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });

  it("rejects an unsupported type with a named reason", () => {
    const r = validateIntake({ files: [fileOf("a.heic", "image/heic", 100)], text: undefined });
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reason).toBe("unsupported-type");
  });

  it("rejects a file over the byte cap", () => {
    const r = validateIntake({ files: [fileOf("big.png", "image/png", MAX_INTAKE_BYTES + 1)], text: undefined });
    expect(r.rejected[0].reason).toBe("too-large");
  });

  it("rejects a zero-byte file", () => {
    const r = validateIntake({ files: [fileOf("empty.png", "image/png", 0)], text: undefined });
    expect(r.rejected[0].reason).toBe("empty");
  });

  it("caps the file count and reports the overflow", () => {
    const files = Array.from({ length: MAX_INTAKE_FILES + 3 }, (_, i) =>
      fileOf(`f${i}.png`, "image/png", 10)
    );
    const r = validateIntake({ files, text: undefined });
    expect(r.accepted).toHaveLength(MAX_INTAKE_FILES);
    expect(r.rejected).toHaveLength(3);
    expect(r.rejected[0].reason).toBe("too-many");
  });

  it("sanitizes a path-traversing filename", () => {
    const r = validateIntake({ files: [fileOf("../../evil.png", "image/png", 10)], text: undefined });
    expect(r.accepted[0].name).toBe("evil.png");
  });

  it("truncates text past the cap", () => {
    const r = validateIntake({ files: [], text: "x".repeat(5000) });
    expect(r.text?.length).toBe(2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-validator.test.ts`
Expected: FAIL — cannot resolve module `intake-validator`.

- [ ] **Step 3: Write the validator**

Create `src/lib/shared/share-intake/services/intake-validator.ts`:

```ts
/**
 * Boundary checks for content arriving from ANY app on the device.
 *
 * Mirrors MessageAttachmentPicker's limits (10 MB, JPEG/PNG/WebP) because
 * share intake bypasses that picker entirely.
 *
 * Scope limit: on native the plugin has already copied the bytes to
 * cacheDir/shared_files before we are notified, with no size or count limit.
 * This gate protects IndexedDB, the QR decoder, and the uploader. It cannot
 * protect the disk. That is an accepted cost of using the plugin unmodified.
 */

export const MAX_INTAKE_BYTES = 10 * 1024 * 1024;
export const MAX_INTAKE_FILES = 20;
export const MAX_INTAKE_TEXT = 2000;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type RejectionReason =
  | "unsupported-type"
  | "too-large"
  | "empty"
  | "too-many";

export interface RejectedFile {
  name: string;
  reason: RejectionReason;
}

export interface ValidationResult {
  accepted: File[];
  rejected: RejectedFile[];
  text: string | null;
}

/**
 * Strip any directory component. The plugin writes the sender's filename
 * verbatim into its cache dir with no sanitization, so a name containing
 * "../" is possible. We never reuse the raw name for a filesystem write, but
 * it does reach the message attachment, so normalize it here.
 */
function safeName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();
  return cleaned.length > 0 ? cleaned : "shared-image";
}

export function validateIntake(input: {
  files: File[];
  text: string | undefined;
}): ValidationResult {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of input.files) {
    if (accepted.length >= MAX_INTAKE_FILES) {
      rejected.push({ name: file.name, reason: "too-many" });
      continue;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      rejected.push({ name: file.name, reason: "unsupported-type" });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ name: file.name, reason: "empty" });
      continue;
    }
    if (file.size > MAX_INTAKE_BYTES) {
      rejected.push({ name: file.name, reason: "too-large" });
      continue;
    }

    const clean = safeName(file.name);
    accepted.push(
      clean === file.name ? file : new File([file], clean, { type: file.type })
    );
  }

  const text = input.text ? input.text.slice(0, MAX_INTAKE_TEXT) : null;
  return { accepted, rejected, text };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-validator.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(share-intake): validation gate for untrusted shared input" -- src/lib/shared/share-intake/services/intake-validator.ts tests/unit/share-intake/intake-validator.test.ts
```

---

### Task 4: The `SharedFile` → `File` bridge

**This is the highest-risk unit in the design.** The plugin returns
`getAbsolutePath()` — a raw filesystem path, not a `file://` URI and not
fetchable from the WebView. Its README gives no guidance for reading it on
native. Everything downstream (`PendingMessageAttachment`,
`IMessageImageSender`, the QR decoder) assumes a real `File`.

**Files:**
- Create: `src/lib/shared/share-intake/services/shared-file-bridge.ts`
- Test: `tests/unit/share-intake/shared-file-bridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => "android"),
    convertFileSrc: vi.fn((p: string) => `https://localhost/_capacitor_file_${p}`),
  },
}));

import { sharedFileToFile } from "$lib/shared/share-intake/services/shared-file-bridge";
import { Capacitor } from "@capacitor/core";

describe("sharedFileToFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(Capacitor.convertFileSrc).mockImplementation(
      (p: string) => `https://localhost/_capacitor_file_${p}`
    );
  });

  it("converts the native path before fetching", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetchMock);

    await sharedFileToFile({
      uri: "/data/cache/shared_files/a.png",
      name: "a.png",
      mimeType: "image/png",
    });

    expect(Capacitor.convertFileSrc).toHaveBeenCalledWith("/data/cache/shared_files/a.png");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://localhost/_capacitor_file_/data/cache/shared_files/a.png"
    );
  });

  it("returns a File carrying the descriptor's name and mime type", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));

    const file = await sharedFileToFile({
      uri: "/data/cache/shared_files/a.png",
      name: "a.png",
      mimeType: "image/png",
    });

    expect(file).toBeInstanceOf(File);
    expect(file!.name).toBe("a.png");
    expect(file!.type).toBe("image/png");
    expect(file!.size).toBe(3);
  });

  it("returns null when the fetch fails rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOENT"); }));

    const file = await sharedFileToFile({
      uri: "/gone.png",
      name: "gone.png",
      mimeType: "image/png",
    });

    expect(file).toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const file = await sharedFileToFile({
      uri: "/missing.png",
      name: "missing.png",
      mimeType: "image/png",
    });

    expect(file).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/shared-file-bridge.test.ts`
Expected: FAIL — cannot resolve module `shared-file-bridge`.

- [ ] **Step 3: Write the bridge**

Create `src/lib/shared/share-intake/services/shared-file-bridge.ts`:

```ts
import { Capacitor } from "@capacitor/core";
import type { SharedFileDescriptor } from "../domain/share-intake-models";

/**
 * Turn a plugin file descriptor into a real File.
 *
 * @capgo/capacitor-share-target returns getAbsolutePath() - a raw native
 * filesystem path. The WebView cannot fetch that directly; convertFileSrc
 * rewrites it to the local bridge scheme the WebView can reach.
 *
 * Isolated behind this one function on purpose: if convertFileSrc proves
 * unreliable across Android versions, the fallback is
 * Filesystem.readFile -> base64 -> Blob, and only this file changes.
 *
 * Returns null instead of throwing. A share can reference a file that the
 * sending app has already revoked or deleted, and one bad file in a batch
 * must not take down the whole intake.
 */
export async function sharedFileToFile(
  descriptor: SharedFileDescriptor
): Promise<File | null> {
  try {
    const src = Capacitor.convertFileSrc(descriptor.uri);
    const response = await fetch(src);
    if (!response.ok) return null;

    const blob = await response.blob();
    // Trust the descriptor's mimeType over the blob's: the local bridge
    // scheme frequently reports application/octet-stream.
    return new File([blob], descriptor.name, { type: descriptor.mimeType });
  } catch {
    return null;
  }
}

/** Bridge a batch, dropping any file that could not be read. */
export async function sharedFilesToFiles(
  descriptors: SharedFileDescriptor[]
): Promise<File[]> {
  const results = await Promise.all(descriptors.map(sharedFileToFile));
  return results.filter((f): f is File => f !== null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/shared-file-bridge.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(share-intake): bridge plugin URI descriptors to File objects" -- src/lib/shared/share-intake/services/shared-file-bridge.ts tests/unit/share-intake/shared-file-bridge.test.ts
```

---

### Task 5: Durable intake store

Replaces read-and-delete, which contradicted "survives an auth redirect". A
reload, crash, or rejected route must not lose the only copy.

**Files:**
- Create: `src/lib/shared/share-intake/services/intake-store.ts`
- Test: `tests/unit/share-intake/intake-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  putIntake,
  getIntake,
  listIntakes,
  updateStatus,
  deleteIntake,
  reapExpired,
  INTAKE_TTL_MS,
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
    ...overrides,
  };
}

describe("intake-store", () => {
  beforeEach(async () => {
    for (const r of await listIntakes()) await deleteIntake(r.receiptId);
  });

  it("round-trips a record including its File bytes", async () => {
    await putIntake(intake());
    const got = await getIntake("si_abc");
    expect(got?.files[0]).toBeInstanceOf(File);
    expect(got?.files[0].name).toBe("a.png");
    expect(got?.files[0].size).toBe(2);
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

  it("reaps records older than the TTL and keeps fresh ones", async () => {
    await putIntake(intake({ receiptId: "si_old", receivedAt: Date.now() - INTAKE_TTL_MS - 1 }));
    await putIntake(intake({ receiptId: "si_new" }));

    const reaped = await reapExpired();

    expect(reaped).toBe(1);
    expect(await getIntake("si_old")).toBeNull();
    expect(await getIntake("si_new")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Install the IndexedDB test shim**

Run: `npm install -D fake-indexeddb`
Expected: added to `devDependencies`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-store.test.ts`
Expected: FAIL — cannot resolve module `intake-store`.

- [ ] **Step 4: Write the store**

Create `src/lib/shared/share-intake/services/intake-store.ts`:

```ts
import type {
  SharedIntake,
  ShareIntakeStatus,
} from "../domain/share-intake-models";

/**
 * Durable record for a received share.
 *
 * Persisted BEFORE any auth check so a share that cold-starts the app while
 * signed out survives the sign-in round trip. Reads never delete - a reload or
 * crash mid-flow must be recoverable.
 *
 * IndexedDB because it structured-clones File directly. Honest limitation:
 * IndexedDB is best-effort and quota writes can fail, so this makes loss rare
 * and visible rather than impossible.
 */

const DB_NAME = "tka-share-intake";
const DB_VERSION = 1;
const STORE = "intakes";

export const INTAKE_TTL_MS = 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "receiptId" });
        store.createIndex("receivedAt", "receivedAt");
      }
    };
    req.onsuccess = () => {
      // Close on versionchange so a later upgrade in another tab is never
      // blocked by this connection.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function putIntake(record: SharedIntake): Promise<void> {
  await tx("readwrite", (s) => s.put(record));
}

export async function getIntake(receiptId: string): Promise<SharedIntake | null> {
  const r = await tx<SharedIntake | undefined>("readonly", (s) => s.get(receiptId));
  return r ?? null;
}

export async function listIntakes(): Promise<SharedIntake[]> {
  return await tx<SharedIntake[]>("readonly", (s) => s.getAll());
}

export async function updateStatus(
  receiptId: string,
  status: ShareIntakeStatus
): Promise<void> {
  const existing = await getIntake(receiptId);
  if (!existing) return;
  await putIntake({ ...existing, status });
}

export async function deleteIntake(receiptId: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(receiptId));
}

/**
 * Sweep abandoned records. Called on intake write AND at app boot - write-only
 * sweeping would leave records forever if no later share ever arrives.
 * Returns how many were removed.
 */
export async function reapExpired(now = Date.now()): Promise<number> {
  const all = await listIntakes();
  const stale = all.filter((r) => now - r.receivedAt > INTAKE_TTL_MS);
  for (const r of stale) await deleteIntake(r.receiptId);
  return stale.length;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-store.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(share-intake): durable IndexedDB record with TTL reaping" -- src/lib/shared/share-intake/services/intake-store.ts tests/unit/share-intake/intake-store.test.ts package.json package-lock.json
```

---

### Task 6: Per-item classification

Routes through the **existing** scan path — `extractScanCode`
(`src/lib/shared/qr/services/extract-scan-code.ts:16`), which is what
`ScanCardSheet.svelte:151` uses. It returns `null` for any QR that is not a TKA
card, so a random QR is not a failure; it falls through to the image path.

Classification is **per item, never per batch**.

**Files:**
- Create: `src/lib/shared/share-intake/services/intake-classifier.ts`
- Test: `tests/unit/share-intake/intake-classifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";

const detectMock = vi.fn();
vi.mock("$lib/shared/qr/services/tka-qr-detector", () => ({
  createTkaQrDetector: () => ({ detect: detectMock }),
}));

import { classifyIntake } from "$lib/shared/share-intake/services/intake-classifier";

function png(name: string): File {
  return new File([new Uint8Array([1])], name, { type: "image/png" });
}

// The classifier is handed a decoder so tests never need a canvas.
const decodeTo = (values: Record<string, string[]>) => async (file: File) =>
  values[file.name] ?? [];

describe("classifyIntake", () => {
  it("classifies an image carrying a TKA card url as a card", async () => {
    const r = await classifyIntake(
      { files: [png("card.png")], text: undefined },
      decodeTo({ "card.png": ["https://TKA.RUN/AB12"] })
    );
    expect(r.items[0]).toEqual({ kind: "card", code: "AB12", file: expect.any(File) });
  });

  it("treats a non-TKA QR as an ordinary image, not a failure", async () => {
    const r = await classifyIntake(
      { files: [png("other.png")], text: undefined },
      decodeTo({ "other.png": ["https://example.com/hello"] })
    );
    expect(r.items[0].kind).toBe("image");
  });

  it("classifies an image with no QR as an image", async () => {
    const r = await classifyIntake({ files: [png("photo.png")], text: undefined }, decodeTo({}));
    expect(r.items[0].kind).toBe("image");
  });

  it("classifies a mixed batch per item, not per batch", async () => {
    const r = await classifyIntake(
      { files: [png("card.png"), png("photo.png")], text: undefined },
      decodeTo({ "card.png": ["https://tka.run/q/XY99"] })
    );
    expect(r.items.map((i) => i.kind)).toEqual(["card", "image"]);
  });

  it("deduplicates repeated codes across a batch", async () => {
    const r = await classifyIntake(
      { files: [png("a.png"), png("b.png")], text: undefined },
      decodeTo({ "a.png": ["https://tka.run/AB12"], "b.png": ["https://tka.run/AB12"] })
    );
    expect(r.items.filter((i) => i.kind === "card")).toHaveLength(1);
    expect(r.items.filter((i) => i.kind === "image")).toHaveLength(1);
  });

  it("extracts a TKA code from shared text", async () => {
    const r = await classifyIntake({ files: [], text: "https://tka.run/AB12" }, decodeTo({}));
    expect(r.textCode).toBe("AB12");
    expect(r.residualText).toBeNull();
  });

  it("keeps non-code text as residual message text", async () => {
    const r = await classifyIntake({ files: [], text: "check this out" }, decodeTo({}));
    expect(r.textCode).toBeNull();
    expect(r.residualText).toBe("check this out");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-classifier.test.ts`
Expected: FAIL — cannot resolve module `intake-classifier`.

- [ ] **Step 3: Write the classifier**

Create `src/lib/shared/share-intake/services/intake-classifier.ts`:

```ts
import { extractScanCode } from "$lib/shared/qr/services/extract-scan-code";
import { createTkaQrDetector } from "$lib/shared/qr/services/tka-qr-detector";
import type { IntakeClassification, IntakeItem } from "../domain/share-intake-models";

/** Decodes every QR payload found in an image. Injected so tests need no canvas. */
export type QrDecoder = (file: File) => Promise<string[]>;

/**
 * Default decoder: draw the image to a canvas and run the shared detector.
 * Same detector ScanCardSheet uses, just fed a still instead of a camera frame.
 */
export const canvasQrDecoder: QrDecoder = async (file) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();

  const detections = await createTkaQrDetector().detect(frame);
  return detections.map((d) => d.rawValue);
};

/**
 * Decide, per item, whether each shared file is a TKA card or an ordinary image.
 *
 * extractScanCode returns null for anything that is not a TKA card - a random
 * QR in a photo is NOT an error, it just means the photo is a photo. Codes are
 * deduplicated across the batch using the same seen-set idea as ScanCardSheet,
 * so two shots of the same card file once and the duplicate rides along as an
 * image.
 */
export async function classifyIntake(
  input: { files: File[]; text: string | undefined },
  decode: QrDecoder = canvasQrDecoder
): Promise<IntakeClassification> {
  const items: IntakeItem[] = [];
  const seen = new Set<string>();

  for (const file of input.files) {
    let code: string | null = null;
    try {
      for (const raw of await decode(file)) {
        const candidate = extractScanCode(raw);
        if (candidate) {
          code = candidate;
          break;
        }
      }
    } catch {
      // Decode noise on a given image is not fatal - treat it as an image.
      code = null;
    }

    if (code && !seen.has(code)) {
      seen.add(code);
      items.push({ kind: "card", code, file });
    } else {
      items.push({ kind: "image", file });
    }
  }

  const textCode = input.text ? extractScanCode(input.text) : null;
  const residualText = input.text && !textCode ? input.text : null;

  return { items, textCode, residualText };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-classifier.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(share-intake): per-item classification via extractScanCode" -- src/lib/shared/share-intake/services/intake-classifier.ts tests/unit/share-intake/intake-classifier.test.ts
```

---

### Task 7: Generalize the inbox share view

`PendingMessageAttachment` is already an `image | sequence` union
(`src/lib/shared/inbox/domain/pending-message-attachment.ts`). Only the inbox
*view* is sequence-specific. Rename the view, widen the payload, keep
`openSequenceShare` as a wrapper so existing call sites do not churn.

**Files:**
- Modify: `src/lib/shared/inbox/state/inbox-state.svelte.ts:19-25` (`InboxView`), `:63`, `:210`
- Modify: `src/lib/shared/inbox/components/InboxDrawer.svelte:264,530,555,594-597`
- Test: `tests/unit/share-intake/inbox-attachment-share.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";

describe("inbox attachment share", () => {
  beforeEach(() => {
    inboxState.close();
  });

  it("opens the send-attachment view with an image payload", () => {
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    inboxState.openAttachmentShare({
      type: "image",
      file,
      messageId: "m1",
      attachmentId: "a1",
    });

    expect(inboxState.isOpen).toBe(true);
    expect(inboxState.currentView).toBe("send-attachment");
    expect(inboxState.shareAttachment?.type).toBe("image");
  });

  it("keeps openSequenceShare working through the same view", () => {
    inboxState.openSequenceShare({ sequenceWord: "ABC" } as never);
    expect(inboxState.currentView).toBe("send-attachment");
    expect(inboxState.shareAttachment?.type).toBe("sequence");
  });

  it("clears the attachment when the share is cancelled", () => {
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    inboxState.openAttachmentShare({ type: "image", file, messageId: "m1", attachmentId: "a1" });
    inboxState.cancelSequenceShare();
    expect(inboxState.shareAttachment).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/inbox-attachment-share.test.ts`
Expected: FAIL — `inboxState.openAttachmentShare is not a function`.

- [ ] **Step 3: Widen the view union and payload**

In `src/lib/shared/inbox/state/inbox-state.svelte.ts`, change the `InboxView`
union member `"send-sequence"` to `"send-attachment"`:

```ts
export type InboxView =
  | "list"
  | "thread"
  | "compose"
  | "group-settings"
  | "send-attachment";
```

Add the import and replace the `shareSequencePayload` declaration at line 63:

```ts
import type { PendingMessageAttachment } from "../domain/pending-message-attachment";

// ...

/**
 * What the share sheet is about to send. The domain already models
 * image | sequence; only this view was sequence-only.
 */
shareAttachment = $state<PendingMessageAttachment | null>(null);
```

Replace every remaining `this.shareSequencePayload = null;` with
`this.shareAttachment = null;` (11 sites: lines 95, 106, 122, 126, 138, 151,
165, 178, 188, 196, 228).

- [ ] **Step 4: Replace the open method with the generalized pair**

Replace `openSequenceShare` (line 210) with:

```ts
/** Open the picker for any attachment the domain models. */
openAttachmentShare(attachment: PendingMessageAttachment) {
  this.isOpen = true;
  this.activeTab = "messages";
  this.currentView = "send-attachment";
  this.shareAttachment = attachment;
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

/** Existing call sites keep working unchanged. */
openSequenceShare(payload: SequenceSharePayload) {
  this.openAttachmentShare({ type: "sequence", sequence: payload as never });
}
```

- [ ] **Step 5: Update the drawer's view checks**

In `src/lib/shared/inbox/components/InboxDrawer.svelte`, replace every
`"send-sequence"` with `"send-attachment"` (lines 264, 530, 555, 594) and swap
the payload reference at 595-597:

```svelte
{#if inboxState.shareAttachment}
  <SendAttachmentSheet
    attachment={inboxState.shareAttachment}
```

- [ ] **Step 6: Rename the sheet and branch on the union**

```bash
git mv src/lib/shared/inbox/components/messages/SendSequenceSheet.svelte src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte
git mv src/lib/shared/inbox/components/messages/SendSequenceSheet.svelte.test.ts src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte.test.ts
```

In `SendAttachmentSheet.svelte`, change the Props interface:

```ts
interface Props {
  attachment: PendingMessageAttachment;
  onSent: (conversationId: string) => void;
}

let { attachment, onSent }: Props = $props();

const payload = $derived(
  attachment.type === "sequence" ? attachment.sequence : null
);
```

Guard the sequence-only derivations so an image payload renders a preview
instead:

```ts
const displayWord = $derived(
  payload ? simplifyRepeatedWord(payload.sequenceWord || payload.sequenceCloudWord || "") : ""
);
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/inbox-attachment-share.test.ts`
Expected: PASS, 3 tests.

Run: `npx vitest run --config tests/config/vitest.components.config.ts src/lib/shared/inbox/components/messages/SendAttachmentSheet.svelte.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck the rename**

Run: `npm run check > /tmp/check.log 2>&1; grep -ciE "error" /tmp/check.log`
Expected: `0`. (Capture once, grep many — `.claude/rules/fast-iteration-loop.md`.)

- [ ] **Step 9: Commit**

```bash
git commit -m "refactor(inbox): generalize the share view to any pending attachment" -- src/lib/shared/inbox/ tests/unit/share-intake/inbox-attachment-share.test.ts
```

---

### Task 8: Native adapter and boot barrier

`native-initializer.ts:81` runs `bootIntoApp()` → `goto("/create")` when there
is no launch URL. An `ACTION_SEND` has no URL, so today it would take that path
and race the share listener — last `goto()` wins, nondeterministically. The
barrier gives the initial route exactly one owner.

**Files:**
- Create: `src/lib/shared/share-intake/services/native-share-adapter.ts`
- Create: `src/lib/shared/share-intake/get-share-intake.ts`
- Modify: `src/lib/shared/platform/services/native-initializer.ts:45-84`
- Test: `tests/unit/share-intake/native-share-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";

const listeners: Record<string, (e: unknown) => void> = {};
vi.mock("@capgo/capacitor-share-target", () => ({
  CapacitorShareTarget: {
    addListener: vi.fn((name: string, cb: (e: unknown) => void) => {
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

import { registerNativeShareTarget, hasPendingShare } from "$lib/shared/share-intake/services/native-share-adapter";
import { listIntakes, deleteIntake } from "$lib/shared/share-intake/services/intake-store";

const EVENT = {
  title: "Share",
  texts: [],
  files: [{ uri: "/cache/a.png", name: "a.png", mimeType: "image/png" }],
};

describe("native share adapter", () => {
  beforeEach(async () => {
    for (const r of await listIntakes()) await deleteIntake(r.receiptId);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
  });

  it("persists a received share", async () => {
    await registerNativeShareTarget();
    await listeners.shareReceived(EVENT);

    const all = await listIntakes();
    expect(all).toHaveLength(1);
    expect(all[0].files[0].name).toBe("a.png");
  });

  it("collapses the cold-launch double delivery into one record", async () => {
    await registerNativeShareTarget();
    await listeners.shareReceived(EVENT);
    await listeners.shareReceived({ ...EVENT });

    expect(await listIntakes()).toHaveLength(1);
  });

  it("reports a pending share so boot can yield to it", async () => {
    await registerNativeShareTarget();
    await listeners.shareReceived(EVENT);

    expect(await hasPendingShare()).toBe(true);
  });

  it("reports no pending share on a clean boot", async () => {
    expect(await hasPendingShare()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/native-share-adapter.test.ts`
Expected: FAIL — cannot resolve module `native-share-adapter`.

- [ ] **Step 3: Write the adapter**

Create `src/lib/shared/share-intake/services/native-share-adapter.ts`:

```ts
import { CapacitorShareTarget } from "@capgo/capacitor-share-target";
import { deriveReceiptId } from "../domain/derive-receipt-id";
import type { SharedFileDescriptor, SharedIntake } from "../domain/share-intake-models";
import { sharedFilesToFiles } from "./shared-file-bridge";
import { validateIntake } from "./intake-validator";
import { getIntake, putIntake, listIntakes, reapExpired } from "./intake-store";

interface ShareReceivedEvent {
  title: string;
  texts: string[];
  files: SharedFileDescriptor[];
}

/**
 * Bridge the plugin's events into a persisted, normalized intake.
 *
 * Dedup is load-bearing, not defensive: Capacitor's BridgeActivity calls
 * onNewIntent(getIntent()) right after load(), and the plugin handles the
 * intent in both, so every cold-launch share arrives twice.
 */
export async function registerNativeShareTarget(): Promise<void> {
  await CapacitorShareTarget.addListener("shareReceived", (event: ShareReceivedEvent) => {
    void handleShareReceived(event);
  });
}

async function handleShareReceived(event: ShareReceivedEvent): Promise<void> {
  const receiptId = deriveReceiptId({ files: event.files, texts: event.texts });

  // Second delivery of the same intent - drop it before doing any work.
  if (await getIntake(receiptId)) return;

  const bridged = await sharedFilesToFiles(event.files);
  const { accepted, text } = validateIntake({
    files: bridged,
    text: event.texts.length ? event.texts.join("\n") : undefined,
  });

  if (accepted.length === 0 && !text) return;

  const record: SharedIntake = {
    receiptId,
    source: "native",
    files: accepted,
    text: text ?? undefined,
    title: event.title || undefined,
    status: "received",
    receivedAt: Date.now(),
  };

  await putIntake(record);
  await reapExpired();
}

/**
 * Whether an unconsumed share is waiting. The native initializer asks this
 * before its default goto("/create") so the two never race for the first route.
 */
export async function hasPendingShare(): Promise<boolean> {
  const all = await listIntakes();
  return all.some((r) => r.status === "received" || r.status === "needs-auth");
}
```

- [ ] **Step 4: Add the singleton getter**

Create `src/lib/shared/share-intake/get-share-intake.ts`:

```ts
import { registerNativeShareTarget } from "./services/native-share-adapter";

let registered = false;

/** Idempotent registration - safe to call from more than one boot path. */
export async function ensureShareTargetRegistered(): Promise<void> {
  if (registered) return;
  registered = true;
  await registerNativeShareTarget();
}
```

- [ ] **Step 5: Wire the boot barrier**

In `src/lib/shared/platform/services/native-initializer.ts`, replace the block
at lines 58-75 inside `initAppLifecycle`:

```ts
// Register the share target BEFORE deciding the initial route: an
// ACTION_SEND intent carries no launch URL, so without this the default
// bootIntoApp() would race the share listener's own navigation.
const { ensureShareTargetRegistered } = await import(
  "$lib/shared/share-intake/get-share-intake"
);
const { hasPendingShare } = await import(
  "$lib/shared/share-intake/services/native-share-adapter"
);
await ensureShareTargetRegistered();

// Handle deep links from both cold start and warm resume.
const launchUrl = await App.getLaunchUrl();
const openedViaDeepLink = launchUrl?.url
  ? await this.handleDeepLink(launchUrl.url)
  : false;

// One owner for the initial route. A pending share routes itself.
if (!openedViaDeepLink && !(await hasPendingShare())) {
  await this.bootIntoApp();
}

await App.addListener("appUrlOpen", async ({ url }) => {
  await this.handleDeepLink(url);
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/native-share-adapter.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -ciE "error" /tmp/check.log`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(share-intake): native adapter with dedup and boot barrier" -- src/lib/shared/share-intake/ src/lib/shared/platform/services/native-initializer.ts tests/unit/share-intake/native-share-adapter.test.ts
```

---

### Task 9: Route a consumed intake to its destination

The last wiring step: a persisted intake becomes either a filed sequence or a
composer with the image attached.

**Files:**
- Create: `src/lib/shared/share-intake/services/intake-router.ts`
- Test: `tests/unit/share-intake/intake-router.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const openAttachmentShare = vi.fn();
vi.mock("$lib/shared/inbox/state/inbox-state.svelte", () => ({
  inboxState: { openAttachmentShare },
}));

const resolveForImport = vi.fn();
vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => ({ resolveForImport }),
}));

import { routeIntake } from "$lib/shared/share-intake/services/intake-router";

function png(name: string): File {
  return new File([new Uint8Array([1])], name, { type: "image/png" });
}

describe("routeIntake", () => {
  beforeEach(() => {
    openAttachmentShare.mockClear();
    resolveForImport.mockReset();
  });

  it("opens the conversation picker for a plain image", async () => {
    const result = await routeIntake(
      { items: [{ kind: "image", file: png("a.png") }], textCode: null, residualText: null },
      null
    );

    expect(openAttachmentShare).toHaveBeenCalledTimes(1);
    expect(openAttachmentShare.mock.calls[0][0].type).toBe("image");
    expect(result.cards).toHaveLength(0);
  });

  it("resolves a card code through resolveForImport", async () => {
    resolveForImport.mockResolvedValue({ sequence: { id: "s1", word: "ABC" }, docBacked: true });

    const result = await routeIntake(
      { items: [{ kind: "card", code: "AB12", file: png("c.png") }], textCode: null, residualText: null },
      "user-1"
    );

    expect(resolveForImport).toHaveBeenCalledWith("AB12", "user-1");
    expect(result.cards[0].docBacked).toBe(true);
    expect(openAttachmentShare).not.toHaveBeenCalled();
  });

  it("reports an unresolvable code as retryable instead of throwing", async () => {
    resolveForImport.mockResolvedValue(null);

    const result = await routeIntake(
      { items: [{ kind: "card", code: "BAD1", file: png("c.png") }], textCode: null, residualText: null },
      null
    );

    expect(result.cards).toHaveLength(0);
    expect(result.unresolved).toEqual(["BAD1"]);
  });

  it("resolves a code found in shared text", async () => {
    resolveForImport.mockResolvedValue({ sequence: { id: "s2" }, docBacked: false });

    const result = await routeIntake(
      { items: [], textCode: "XY99", residualText: null },
      null
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].docBacked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-router.test.ts`
Expected: FAIL — cannot resolve module `intake-router`.

- [ ] **Step 3: Write the router**

Create `src/lib/shared/share-intake/services/intake-router.ts`:

```ts
import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
import type { IntakeClassification } from "../domain/share-intake-models";

export interface ResolvedCard {
  code: string;
  sequence: unknown;
  /**
   * False for printed deck cards with no referenceable doc. Those must be
   * saved to the library BEFORE being filed into a collection - the same
   * branch ScanCardSheet takes.
   */
  docBacked: boolean;
}

export interface RouteResult {
  cards: ResolvedCard[];
  /** Codes that did not resolve. Retryable read failures, not errors. */
  unresolved: string[];
}

/**
 * Send a classified intake to its destination.
 *
 * Cards resolve through the existing import path. Images open the inbox
 * conversation picker with the first image attached; a batch queues behind it.
 */
export async function routeIntake(
  classification: IntakeClassification,
  userId: string | null
): Promise<RouteResult> {
  const cards: ResolvedCard[] = [];
  const unresolved: string[] = [];

  const codes = [
    ...classification.items.filter((i) => i.kind === "card").map((i) => (i as { code: string }).code),
    ...(classification.textCode ? [classification.textCode] : []),
  ];

  for (const code of codes) {
    const resolution = await getShortCodeManager().resolveForImport(code, userId);
    if (!resolution) {
      unresolved.push(code);
      continue;
    }
    cards.push({ code, sequence: resolution.sequence, docBacked: resolution.docBacked });
  }

  const images = classification.items.filter((i) => i.kind === "image");
  if (images.length > 0) {
    const first = images[0] as { file: File };
    inboxState.openAttachmentShare({
      type: "image",
      file: first.file,
      messageId: crypto.randomUUID(),
      attachmentId: crypto.randomUUID(),
    });
  }

  return { cards, unresolved };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/intake-router.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(share-intake): route classified intakes to cards or the composer" -- src/lib/shared/share-intake/services/intake-router.ts tests/unit/share-intake/intake-router.test.ts
```

---

### Task 10: Full verification

- [ ] **Step 1: Run the whole share-intake suite**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/share-intake/`
Expected: PASS — 8 files, 39 tests (5 + 7 + 4 + 5 + 7 + 3 + 4 + 4).

- [ ] **Step 2: Full typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -ciE "error" /tmp/check.log`
Expected: `0`. If non-zero: `grep -iE "error" /tmp/check.log | head -20` and fix. Do not re-run `check` to re-filter.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 4: Sync the Android project**

Run: `npx cap sync android`
Expected: `@capgo/capacitor-share-target` listed.

- [ ] **Step 5: Commit any fixes**

```bash
git commit -m "fix(share-intake): resolve typecheck findings" -- <paths you actually changed>
```

---

## Device verification — REQUIRED before this ships

Unit tests cannot see any of these. `.claude/rules/verification-protocol.md`
requires evidence, and for this feature the evidence is a device.

- [ ] Build and install a debug APK on the Android device
- [ ] **Cold launch:** share one image from Photos with the app fully killed. Confirm **exactly one** sheet appears — this proves `receiptId` dedup suppresses the confirmed double fire
- [ ] **Warm launch:** share with the app already open in the background
- [ ] **Process death:** share, force-stop mid-flow, reopen — the record should still be there
- [ ] **Card scan:** share a screenshot of a printed choreo card; confirm it resolves and offers the sequence
- [ ] **Non-TKA QR:** share a photo containing an unrelated QR; confirm it is treated as an image, not an error
- [ ] **Batch:** share 3 images at once via `SEND_MULTIPLE`
- [ ] **Signed out:** sign out, share, confirm the sign-in prompt appears and the flow resumes with the file intact
- [ ] **`ClipData` hunt:** share from Chrome, Photos, and a messaging app. The plugin ignores `ClipData` and handles only `EXTRA_STREAM`, so a sender using `ClipData` presents as **"TKA opens but receives nothing."** Record which senders work
- [ ] **Cache growth:** after ~10 shares, measure `cacheDir/shared_files` via `adb shell run-as com.tkaflowarts.composer du -sh cache/shared_files`. **Nothing cleans this yet** (see limitations) — the point is to record the real growth rate so we know whether it needs a fix before or after launch

---

## Known accepted limitations

Recorded so nobody rediscovers them as bugs. Full detail in the spec's Spike results.

- The plugin copies shared bytes to cache with **no size, count, or time limit** before JS is notified. Not preventable from JS.
- No filename sanitization in its Java. We normalize on read; a `../` name still lands in its cache dir first.
- **`cacheDir/shared_files` is never cleaned.** The spec called for the adapter
  to sweep it, but deleting native files needs `@capacitor/filesystem`, which
  is **not a dependency of this repo**, so no task here implements it. The
  device check measures the growth rate instead. Fix this by adding
  `@capacitor/filesystem` and sweeping on intake completion + at boot — but do
  it as its own change, with the growth data in hand, rather than adding a
  Capacitor plugin on speculation. Android does reclaim `cacheDir` under
  storage pressure, so this is untidy rather than unbounded.
- **No `ClipData`.** Some share sources will deliver nothing.
- The PWA half is not built. Installed-PWA users get no share target yet.
- Batch send is one attachment opened plus a queue; full sequential-send orchestration with per-item retry is not in this plan.
