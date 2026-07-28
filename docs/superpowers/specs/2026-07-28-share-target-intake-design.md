---
status: active
value: 4
effort: M
remaining: "Unimplemented. PWA half ships on a normal deploy; native intent filter needs a Play release."
depends_on: ""
plan_path: ""
tags: [android, pwa, messaging, qr, share]
last_triaged: 2026-07-28
---

# Share Target Intake — Design

**Date:** 2026-07-28
**Status:** Approved (design dialogue 2026-07-28)
**Owner:** Messaging / QR

## The idea

Austen shares an image from any Android app — Photos, Messages, a browser — and
**Flow Arts Composer appears in the native share sheet**. Picking it routes the
image to whichever destination makes sense: if the image carries a TKA QR it
resolves to the sequence, and otherwise it lands in the inbox with a
conversation picker so it can be sent to someone.

Austen: *"if on my android device it could automatically give share on TKA
platform as one of the options ... I should be able to do that through the
native phone method."*

## Direction check: outbound already works

`Sharer.shareViaDevice` (`src/lib/shared/share/services/sharer.ts:148`) already
calls `navigator.share()` with the rendered PNG as a `File`, so sharing OUT of
TKA into WhatsApp/Messages is built. This spec is strictly the **inbound**
direction: TKA as a share *target*.

## Decisions locked during brainstorming

1. **Auto-detect, no chooser screen.** Run the QR detector first. Found →
   sequence actions. Not found → conversation picker. A "what do you want to
   do?" screen every time was explicitly rejected.
2. **Accepts images, text/links, and multi-image batches.** Video is out of
   scope — routing clips to skel2tka is a separate design.
3. **Hold the file, then sign in.** A share can cold-start the app while signed
   out or on the guest tier. The intake persists *before* any auth check and
   resumes after sign-in. Nothing is lost.
4. **One intake seam, two adapters.** Native and PWA normalize to the same
   payload; all routing logic exists once.
5. **Multi-image with no QR** attaches the first and queues the rest, sending
   sequentially into the chosen conversation — ordinary messaging-app behavior.

## What already exists (reuse, never hand-roll)

| Need | Existing primitive |
|---|---|
| QR decode from a still image | `createTkaQrDetector()` (`src/lib/shared/qr/services/tka-qr-detector.ts:31`) — `detect(frame: ImageData)`, zxing self-hosted at `static/zxing/` |
| Code → sequence | `ShortCodeManager.resolveShortCode` (`src/lib/shared/qr/services/short-code-manager.ts`) — handles every carrier form |
| Image message upload | `IMessageImageSender` (`src/lib/shared/messaging/services/contracts/IMessageImageSender.ts`) — Storage upload, progress, cancel |
| Pending attachment model | `PendingMessageAttachment` (`src/lib/shared/inbox/domain/pending-message-attachment.ts`) — already a `image \| sequence` union |
| "Pick who gets this" flow | `inboxState.openSequenceShare` (`src/lib/shared/inbox/state/inbox-state.svelte.ts:210`) + `SendSequenceSheet.svelte` |
| Add to collection | `collectionsState` + `addSequenceToCollection` (per the scan-card-to-collection design) |
| Service worker | `static/sw.js`, registered at `/sw.js` scope `/` from `src/hooks.client.ts:291` |

Nothing here is greenfield. The only new code is the intake seam and its two
adapters.

## Architecture

New module `src/lib/shared/share-intake/`, owning a normalized payload:

```ts
type SharedIntake = {
  id: string;
  files: File[];
  text?: string;
  receivedAt: number;
};
```

Two adapters produce it. Everything downstream is platform-blind.

### Native adapter (Capacitor)

`@capgo/capacitor-share-target` — MPL-2.0, tracks Capacitor 8, supports arrays
of files and text.

**Why this plugin:** Capawesome's `@capawesome/capacitor-share-target` is
gated behind a paid Insiders sponsorship and a private npm registry. Cap-go's
is free, and the project already ships `@capgo/capacitor-updater` ^8.45.9 with
a `capgo:upload` script — same vendor, same major version, no new licensing
surface.

Registration sits with the existing Capacitor plugin wiring at app boot:

```ts
ShareTarget.addListener("shareReceived", (event) => {
  shareIntake.receive({ files: event.files, text: event.text?.join("\n") });
});
```

`AndroidManifest.xml` gains an `ACTION_SEND` / `ACTION_SEND_MULTIPLE` filter on
`MainActivity`, which already has the `android:exported="true"` and
`android:launchMode="singleTask"` this requires:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
    <data android:mimeType="text/plain" />
</intent-filter>
<intent-filter>
    <action android:name="android.intent.action.SEND_MULTIPLE" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
</intent-filter>
```

### PWA adapter (manifest + service worker)

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

**`accept` must carry both MIME types AND file extensions.** With MIME types
alone, Chrome on Android shows the PWA in the share sheet but fails to deliver
the file, and `event.request.formData()` throws `TypeError: Failed to fetch`.
This is the single most common way this feature ships broken.

**Android puts shared URLs in `text`, not `url`.** A handler that reads only
`url` receives nothing from Android. Read `text` and parse it for a link.

The service worker branch goes **above** the `method !== "GET"` early return at
`static/sw.js:123`, which would otherwise drop the POST:

```js
if (event.request.method === "POST" && url.pathname === "/share-target") {
  event.respondWith((async () => {
    const formData = await event.request.formData();
    const id = await persistIntake({
      files: formData.getAll("media"),
      text: formData.get("text") ?? undefined,
    });
    return Response.redirect(`/share-target?id=${id}`, 303);
  })());
  return;
}
```

Persistence is **IndexedDB**, which structured-clones `File` directly. It
survives the 303 redirect, a cold start, and a sign-in redirect. The
`GET /share-target` route reads the record by id, hands it to the intake
module, and deletes it.

## Routing

`share-intake` draws each image to a canvas for `ImageData` and runs
`detect()`:

- **One QR resolves** → sequence surface with View / Add to collection / Send
  to someone. Resolution runs through `ShortCodeManager.resolveShortCode`, so
  every carrier form it already handles works unchanged.
- **Batch of QRs** → the continuous-filing path from the scan-card design:
  each adds to a chosen collection with a running count.
- **No QR** → `inboxState` conversation picker, image pre-attached; remaining
  images queue and send sequentially.
- **Text only** → parse for a `tka.run` / `tkaflowarts.com` short code and
  resolve it. Anything else becomes prefilled message text.

## The one refactor

`InboxView`'s `"send-sequence"` generalizes to `"send-attachment"`, and
`shareSequencePayload` becomes a `PendingMessageAttachment`. `SendSequenceSheet`
becomes `SendAttachmentSheet`, rendering a sequence card or an image preview
off the union the domain **already models**. `openSequenceShare` stays as a thin
wrapper so existing call sites don't churn.

Sending then reuses `IMessageImageSender` untouched.

## Auth hold-and-resume

The intake persists to IndexedDB *before* any auth check. Signed out or guest →
sign-in prompt; the record survives the redirect, and the flow resumes when
`authState` reports a real user.

A **1 hour TTL** reaps abandoned intakes, so a forgotten share doesn't ambush
the user days later. Reaping runs on intake write.

## Error handling

| Case | Behavior |
|---|---|
| Non-JPEG/PNG/WebP (HEIC is likely — Android cameras emit it) | Named failure: "Convert this to JPEG or PNG first." Never a silent drop. |
| QR detection finds nothing | Not an error. The no-QR branch. |
| Short code resolves to nothing | Retryable read failure, consistent with the scan-card design. |
| `formData()` throws | Logged distinctly as the malformed-`accept` symptom, not a generic fetch failure. |
| Intake arrives while offline | Persists; resolution retries when back online. Sending is already queued by the messaging layer. |

## Testing

- **Unit:** adapter normalization to `SharedIntake`; QR-vs-no-QR routing;
  short-code extraction from shared text; TTL reaping.
- **Component** (vitest-browser-svelte, per `component-test-discipline.md` —
  an interactive surface worth locking): `SendAttachmentSheet` renders both
  union arms.
- **Static contract test**, in the style of
  `tests/unit/sequence-viewer-shell-contract.test.ts`: asserts the manifest
  `accept` array carries both MIME types and extensions, and that the
  `AndroidManifest.xml` `ACTION_SEND` filter exists. These are the two silent
  breakages, so they get pinned rather than trusted.

## Rollout

1. **PWA half** — manifest + service worker + `/share-target` route. Ships on a
   normal Cloudflare deploy. Reaches installed-PWA users immediately.
2. **Native web layer** — intake module and adapters ride `CapacitorUpdater`
   OTA.
3. **Native shell** — `AndroidManifest.xml` intent filter and the plugin's
   native code require a **full Play Store release**. This is the long pole;
   nothing else waits on it.

## Out of scope

- Video shares → skel2tka. Separate design.
- iOS share extension. The Capacitor plugin supports iOS, but the iOS app is
  not a shipping target for this work.
- Sharing INTO a specific conversation directly from the Android sheet
  (Android "direct share" shortcuts). Possible follow-up once the base flow
  proves out.
