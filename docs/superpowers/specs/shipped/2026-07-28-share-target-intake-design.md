---
status: active
value: 4
effort: L
remaining: "Unimplemented. Plugin spiked and verified 2026-07-28 (v8.0.44). Highest-risk unit is the URI->File bridge. Only a Play release puts TKA in the Android share sheet for the native app."
depends_on: ""
plan_path: ""
tags: [android, pwa, messaging, qr, share]
last_triaged: 2026-07-28
---

# Share Target Intake — Design

**Date:** 2026-07-28
**Status:** Approved in shape (design dialogue 2026-07-28), revised after
adversarial review (Codex, 2026-07-28) — see [Review corrections](#review-corrections).
**Owner:** Messaging / QR

## The idea

Austen shares an image from any Android app — Photos, Messages, a browser — and
**Flow Arts Composer appears in the native share sheet**. Picking it routes the
image to whichever destination makes sense: if the image carries a TKA card QR
it resolves to the sequence, and otherwise it lands in the inbox with a
conversation picker so it can be sent to someone.

Austen: *"if on my android device it could automatically give share on TKA
platform as one of the options ... I should be able to do that through the
native phone method."*

## Direction check: outbound already works

`Sharer.shareViaDevice` (`src/lib/shared/share/services/sharer.ts:148`) already
calls `navigator.share()` with the rendered PNG as a `File`. Sharing OUT of TKA
into WhatsApp/Messages is built. This spec is strictly the **inbound**
direction: TKA as a share *target*.

## Decisions locked during brainstorming

1. **Auto-detect, no chooser screen.** Scan for a TKA card code first. Found →
   sequence actions. Not found → conversation picker. A "what do you want to
   do?" screen on every share was explicitly rejected.
2. **Accepts images, text/links, and multi-image batches.** Video is out of
   scope.
3. **Hold the file, then sign in.** A share can cold-start the app while signed
   out or on the guest tier. The intake persists *before* any auth check and
   resumes after sign-in.
4. **One intake seam, two adapters.** Native and PWA normalize to the same
   payload; routing logic exists once.

## Review corrections

An adversarial review found six errors in the first draft. Each is corrected
below; they are listed here so the corrections are not silently absorbed.

| First draft said | Reality |
|---|---|
| Route QR results through `ShortCodeManager.resolveShortCode` | Wrong contract. The correct existing path is `extractScanCode()` → `resolveForImport()`, which `ScanCardSheet` already uses. The draft would have rejected valid URLs and lost prop overrides. |
| "Reuse `IMessageImageSender` untouched"; batches queue and send | It takes ONE `File`, uploads immediately, and clears staging in `finally`. Batch send is new orchestration, not a rendering refactor. |
| "PWA half reaches users immediately" | False twice over: the app leaves new service workers *waiting* for user approval, and the manifest `share_target` is **inert inside the Capacitor app** regardless. |
| Read-and-delete the IndexedDB record on GET | Contradicts "survives an auth redirect." A reload or a cross-browser magic link loses the only copy. |
| `accept` must carry MIME types AND extensions | Field-reported compatibility practice, not a W3C requirement. Keep the practice, drop the certainty. |
| `singleTask` is required | It is not required for `ACTION_SEND`. It is already set, and its real consequence is that a share **reuses the existing task** and can destroy unsaved work. |

## Spike results (2026-07-28) — plugin verified

The plugin spike is **done**. Everything below is read from the published
package and its actual source, not inferred.

`@capgo/capacitor-share-target` **v8.0.44**, MPL-2.0, peer
`@capacitor/core >=8.0.0` — compatible with this repo's Capacitor 8.4.2.
Capawesome's equivalent remains paywalled behind an Insiders sponsorship, and
Cap-go is already the incumbent vendor here (`@capgo/capacitor-updater`
^8.45.9), so the choice stands.

**The API is not what the first draft assumed:**

```ts
export interface CapacitorShareTargetPlugin { /* not "ShareTarget" */ }

export interface ShareReceivedEvent {
  title: string;
  texts: string[];        // array, not a single `text`
  files: SharedFile[];
}

export interface SharedFile {
  uri: string;            // NOT a browser File
  name: string;
  mimeType: string;
}
```

**Confirmed limitations in its Android source** (`CapacitorShareTargetPlugin.java`).
These are accepted, not fixed — decision 2026-07-28 is to use the plugin as-is
and compensate in JS where we can:

| Limitation | Consequence | Our response |
|---|---|---|
| Copies URIs into `cacheDir/shared_files` with no count, byte, or time limit | A huge or hostile share consumes disk before JS ever sees it | **Cannot be gated from JS.** Accepted risk. |
| No filename sanitization — `new File(cacheDir, fileName)` verbatim | A name containing `../` writes outside the cache dir | Accepted; would require forking the Java |
| No collision handling | Same-named files overwrite each other | Bridge renames per `receiptId` on read |
| No cache cleanup | `shared_files` grows forever | **Ours to do** — sweep on intake completion and at boot |
| No `ClipData` support (only `EXTRA_STREAM`) | Some Android share sources deliver nothing | Coverage gap — must be checked in device testing |
| Reads the intent in **both** `load()` and `handleOnNewIntent()` | Cold launch delivers the same share twice | `receiptId` dedup (see Idempotency) — mandatory, not optional |

**One prerequisite remains:** fix `clients.claim()`. `static/sw.js:112` calls
`self.clients.claim()` *outside* the `event.waitUntil()` block closing at line
111, so activation can finish before clients are claimed. Pre-existing bug,
found in passing, worth fixing on its own merits.

## What already exists (reuse, never hand-roll)

| Need | Existing primitive |
|---|---|
| QR decode from a still image | `createTkaQrDetector()` (`src/lib/shared/qr/services/tka-qr-detector.ts:31`) — `detect(frame: ImageData)`. Returns **every** QR payload, not just TKA ones. |
| QR payload → TKA code | `extractScanCode()` (`src/lib/shared/qr/services/extract-scan-code.ts:16`) — handles `tka.run/{code}`, `tka.run/q/{code}`, inline `s~` payloads, bare codes. Returns `null` for anything else. |
| Code → importable sequence | `ShortCodeManager.resolveForImport(code, userId)` (`short-code-manager.ts:1338`) → `{ sequence, docBacked } \| null` |
| The whole correct scan flow | `ScanCardSheet.svelte:151` — `seen` dedup set, `docBacked` branch, re-aim retry. **Copy this flow.** |
| Image message upload | `IMessageImageSender` (`src/lib/shared/messaging/services/contracts/IMessageImageSender.ts`) — single file, Storage upload, progress, cancel |
| Pending attachment model | `PendingMessageAttachment` (`src/lib/shared/inbox/domain/pending-message-attachment.ts`) — already an `image \| sequence` union |
| "Pick who gets this" flow | `inboxState.openSequenceShare` (`inbox-state.svelte.ts:210`) + `SendSequenceSheet.svelte` |
| Input validation limits | `MessageAttachmentPicker.svelte:9` — `MAX_IMAGE_BYTES = 10 * 1024 * 1024`, JPEG/PNG/WebP only |
| Server-side re-encode | `firebase-functions/src/messaging/messageImageNormalizer.ts` |

## Architecture

New module `src/lib/shared/share-intake/`, owning a normalized payload:

```ts
type ShareIntakeStatus =
  | "received" | "needs-auth" | "ready"
  | "partially-sent" | "failed" | "expired";

type SharedIntake = {
  /** Stable, derived from the source intent — NOT random. See Idempotency. */
  receiptId: string;
  source: "native" | "pwa";
  files: File[];
  text?: string;
  title?: string;
  status: ShareIntakeStatus;
  receivedAt: number;
};
```

### Idempotency (fixes cold-launch double delivery)

`BridgeActivity.java:51` calls `this.onNewIntent(getIntent())` immediately
after `load()`. A plugin that reads the intent in both places delivers the same
share **twice** on a cold launch. A random intake id would produce two sheets,
two uploads, or two collection entries.

`receiptId` is therefore derived from the source content — a hash over the URI
list, byte sizes, and shared text — not generated fresh. `receive()` is a
no-op when a record with that `receiptId` already exists in a non-terminal
state. This is the single most important correctness detail in the design.

### Boot barrier (fixes the routing race)

`native-initializer.ts:81` runs `bootIntoApp()` → `goto("/create")` when there
is no launch URL. An `ACTION_SEND` has no URL, so today it would take that path
and race the share listener's own navigation — last `goto()` wins,
nondeterministically.

The initializer gains a share-aware state: if a share intake is pending at boot,
`bootIntoApp()` yields to it rather than navigating to `/create`. One owner of
the initial route, always.

### Native adapter

The adapter's real job is the **URI→File bridge**, which the first draft
missed entirely. `SharedFile.uri` is a raw filesystem path from
`getAbsolutePath()` — not a `file://` URI, not fetchable as-is from the
WebView, and the plugin's README gives no guidance for reading it on native.

```ts
CapacitorShareTarget.addListener("shareReceived", async (event) => {
  const files = await Promise.all(
    event.files.map(async (f) => {
      // WebView can't fetch a bare native path; convertFileSrc makes it
      // reachable over the local bridge scheme.
      const res = await fetch(Capacitor.convertFileSrc(f.uri));
      const blob = await res.blob();
      // Rename per receipt: the plugin overwrites same-named cache files.
      return new File([blob], f.name, { type: f.mimeType });
    })
  );
  shareIntake.receive({ files, text: event.texts.join("\n"), title: event.title });
});
```

`Filesystem.readFile` → base64 → Blob is the fallback if `convertFileSrc`
proves unreliable across Android versions; the bridge is isolated behind one
function so swapping the mechanism doesn't touch routing. **This bridge is the
highest-risk unit in the design and needs its own tests** — it is where a
descriptor becomes the `File` that every downstream consumer assumes.

After a successful intake the adapter deletes the copies from
`cacheDir/shared_files`, since the plugin never does.

`AndroidManifest.xml` gains `ACTION_SEND` / `ACTION_SEND_MULTIPLE` filters on
`MainActivity`, which already has `android:exported="true"`.

**On `singleTask`:** already set, and not required for shares. Its real
consequence is that a share reuses the existing task. Intake therefore opens as
a **dismissible sheet over the current screen**, never a replacing navigation,
so unsaved work survives and cancel returns the user where they were.

**Declared MIME types:** narrow the filter to the formats the app can actually
process (`image/jpeg`, `image/png`, `image/webp`) rather than `image/*`.
Advertising `image/*` makes TKA appear for HEIC — Android's default camera
format — which the composer then rejects. Narrowing is preferable to promising
and failing. If HEIC support is wanted later it needs a real decode step, and
that is its own scope.

### PWA adapter

**Scope reality:** the manifest `share_target` is **inert inside the Capacitor
app**. Android builds the share sheet for an installed app from
`AndroidManifest.xml`. This adapter serves only users who installed the PWA
from Chrome. It is not a faster path to the same result.

`static/pwa/manifest.webmanifest` gains:

```json
"share_target": {
  "action": "/share-target",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url",
    "files": [{
      "name": "media",
      "accept": ["image/jpeg", ".jpg", ".jpeg", "image/png", ".png", "image/webp", ".webp"]
    }]
  }
}
```

Listing extensions alongside MIME types is **compatibility practice**, widely
reported to matter on Chrome for Android, not a spec requirement. All four
declared params (`title`, `text`, `url`, `media`) are read — the first draft
declared `title`/`url` and silently dropped them. Android delivers shared URLs
in `text`, not `url`, so both are parsed.

The service worker branch goes **above** the `method !== "GET"` early return at
`static/sw.js:123`, which would otherwise drop the POST.

**Two known lifecycle risks, both requiring device proof before this half
ships:**

- **Version skew.** `sw-update-manager.ts` leaves new workers *waiting* for user
  approval. Chrome may pick up the new manifest — exposing the share target —
  while the old worker is still active and returns immediately for non-GET
  requests. The POST then falls through to the network and fails. Mitigation:
  gate the manifest change behind the new worker being active, or make
  `/share-target` survive a server-side POST.
- **`launch_handler: "focus-existing"`.** The manifest sets it and the app has
  no `launchQueue.setConsumer()`. Focusing an existing client may not load the
  target URL, and `LaunchParams` does not carry a POST body — so an
  already-open PWA could swallow the share. Must be tested on a device, not
  reasoned about.

## Validation gate (runs before anything else)

The share sheet accepts input from **any app on the device**, and declared MIME
types are attacker-controlled. Intake bypasses `MessageAttachmentPicker`'s
checks, so it re-implements them at the boundary.

**Scope limit, stated honestly:** on native the plugin has already copied the
bytes to `cacheDir/shared_files` before JS is notified, with no size or count
limit. The gate below therefore runs before **IndexedDB write, QR decode, and
upload** — it does **not** and cannot prevent the native copy. Disk consumption
by a hostile or enormous share is an accepted risk of using this plugin
unmodified (see Spike results). The gate still protects everything downstream:

- File count cap, per-file cap (10 MB, matching `MAX_IMAGE_BYTES`), aggregate cap
- Magic-byte sniffing — never trust the declared type
- Pixel-dimension cap and a decode timeout, so a decompression bomb cannot hang the app
- Filename sanitization (no separators, collision-safe)
- Text length cap
- Short-code resolution restricted to the exact origins `extractScanCode` allows

Anything failing the gate is rejected with a named reason and never persisted.

## Routing

For each image passing the gate: draw to a canvas → `detect()` →
`extractScanCode()` on each payload.

- **A TKA code found** → `resolveForImport(code, userId)`. On
  `{ docBacked: false }` (printed deck cards) save to the library first, exactly
  as `ScanCardSheet` does, then offer View / Add to collection / Send. On
  `null`, a retryable read failure.
- **A QR that is not a TKA code** → `extractScanCode` returns `null`; this is
  **not** a failure. The image falls through to the image path.
- **No QR** → conversation picker with the image attached.
- **Text** → `extractScanCode` on the shared text; a code resolves as above,
  anything else becomes prefilled message text.
- **Mixed batch** (some images carry codes, some don't) → classify **per item**,
  never per batch. Codes file as sequences; the rest go to the image path. The
  first draft classified whole batches and discarded data.

Deduplicate codes within a batch using the `seen`-set pattern from
`ScanCardSheet`.

## The refactors (two, not one)

1. **Inbox view generalization.** `InboxView`'s `"send-sequence"` becomes
   `"send-attachment"`; `shareSequencePayload` becomes a
   `PendingMessageAttachment`. `SendSequenceSheet` → `SendAttachmentSheet`,
   rendering either union arm. `openSequenceShare` stays as a thin wrapper so
   existing call sites don't churn. This part is genuinely small.
2. **Batch send orchestration (new work, previously underestimated).**
   `IMessageImageSender` handles one file, uploads immediately, and clears
   staging in `finally` including on failed finalization. Sending N images
   needs: explicit ordering, per-item progress, cancellation, partial-success
   reporting, and restart recovery. Multi-image batches send as **separate
   sequential messages** with a single confirmation before the run — not a
   silent burst.

## Durable pending-share record

Replaces the first draft's read-and-delete, which contradicted the
survive-sign-in requirement.

- **Store:** IndexedDB, `tka-share-intake`, version 1, object store
  `intakes`, keyPath `receiptId`, index on `receivedAt`. `versionchange` closes
  the connection so an upgrading page is never blocked.
- **Lifecycle:** records are written by the SW or native adapter, transition
  through `ShareIntakeStatus`, and are deleted only on reaching a terminal
  state (`ready` and consumed, or explicitly discarded). A page load reads
  without deleting, so a reload or crash mid-flow recovers.
- **Auth:** persisted *before* any auth check. Signed out or guest →
  `needs-auth`; the flow resumes when `authState` reports a real user.
  `EmailLinkAuth.svelte` hardcodes a `/create` return and its own comments note
  that finishing in a different browser strands local state — so a
  cross-browser magic link is a **known unrecoverable case**, surfaced as
  `expired` rather than promised as working.
- **Reaping:** 1 hour TTL, swept on write *and* on app boot. Write-only sweeping
  would leave records forever if no later share arrives.
- **Honesty:** IndexedDB is best-effort and quota writes can fail. The record
  makes loss *rare and visible*, not impossible. A failed persist reports at
  intake rather than silently dropping.

## Error handling

| Case | Behavior |
|---|---|
| Fails the validation gate | Named rejection at the boundary. Never persisted, never uploaded. |
| Unsupported format (HEIC/AVIF) | Should not reach us — the intent filter is narrowed. If it does, a named "convert to JPEG or PNG" message. |
| QR present but not a TKA code | Not an error. Falls to the image path. |
| `resolveForImport` returns null | Retryable read failure, matching `ScanCardSheet`. |
| Duplicate intent (cold-launch double fire) | Absorbed by `receiptId` dedup. Silent by design. |
| `formData()` throws | Logged as the suspected malformed-`accept` / skew symptom, distinct from a generic fetch failure. |
| Offline at intake | Persists as `received`; resolution retries when back online. |
| Batch partially sent | `partially-sent` with per-item state; user can retry only the failures. |

## Testing

Unit and component tests cover what they can, but the review's sharpest point
stands: **most of the real failure modes here are lifecycle failures that unit
tests and manifest inspection cannot see.**

- **Unit:** the **URI→File bridge** (highest-risk unit — a `SharedFile`
  descriptor must become a `File` with correct bytes, name, and MIME type);
  adapter normalization; `receiptId` stability across a duplicated intent;
  per-item batch classification; validation-gate rejections; TTL reaping;
  IndexedDB upgrade and `versionchange`; cache sweep after intake.
- **Component** (vitest-browser-svelte, per `component-test-discipline.md`):
  `SendAttachmentSheet` renders both union arms.
- **Static contract test** (style of `sequence-viewer-shell-contract.test.ts`):
  the manifest `accept` array and the `AndroidManifest.xml` `ACTION_SEND`
  filter both exist and agree on MIME types. This proves declaration only — it
  **cannot** prove OS delivery.
- **Manual device matrix — required before shipping, not optional:** cold
  launch (proves `receiptId` dedup actually suppresses the confirmed double
  fire), warm launch, background, process death, offline, sign-in return,
  rapid consecutive shares, and an already-open PWA window. Across at least
  Photos, Chrome, and a messaging app as share sources — **specifically to
  find senders that use `ClipData`**, which the plugin ignores and which will
  present as "TKA opens but receives nothing."

## Rollout

Corrected. The first draft's ordering was unsafe in both directions: web code
first means `addListener()` runs against native shells that lack the plugin;
shell first means Android delivers shares to JS with no handler.

1. **Prerequisites** — plugin spike; `clients.claim()` fix.
2. **Native, as one Play release** — plugin, `AndroidManifest.xml` filters, and
   the web consumer ship **together**. The adapter feature-detects plugin
   availability so OTA web updates never assume a newer shell than is
   installed. **This is the only step that puts TKA in the share sheet on a
   Play-build device.**
3. **PWA half** — after the two lifecycle risks above are proven on a device.
   Serves Chrome-installed PWA users only.

## Out of scope

- Video → skel2tka. Separate design.
- iOS share extension.
- HEIC/AVIF decoding (the intent filter is narrowed instead).
- Android direct-share shortcuts (share straight into a named conversation).
- A mixed-content review screen — re-introduces the chooser screen that was
  explicitly rejected. Revisit only if per-item classification proves confusing
  in practice.
