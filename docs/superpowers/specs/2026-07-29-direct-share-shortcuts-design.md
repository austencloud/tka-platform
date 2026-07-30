# Direct Share — Android Sharing Shortcuts

**Status:** design, awaiting review
**Builds on:** `2026-07-28-share-target-intake-design.md` (shipped 2026-07-28/29)

## Goal

Put specific people in the Android system share sheet. Austen shares a photo,
the sheet itself shows **Paul** with his avatar above the app list, he taps it,
and TKA opens on the send sheet with Paul already selected and the photo staged.
One more tap sends.

Today the sheet shows a single generic "Flow Arts Composer" row and every share
goes through the in-app conversation picker.

## Why this and not the boot time

The share-target retro named two follow-ups. The other one — "kill the ~8s dead
time between share tap and the pipeline running" — is **not** designed here,
because the 8s was mismeasured.

Re-reading the 2026-07-29 device logs: JS registered its share listener 1.07s
after launch. The remaining ~7s sat between the listener registering and the
pipeline reporting, and that window contains a `resolveForImport("AB12")`
Firestore read for a code that does not exist. Most of the delay is likely a
network miss on a deliberately invalid code, not app boot.

Designing a boot-path change against that number would be building for a
problem we have not observed. Task 1 below measures it properly instead.

**MEASURED 2026-07-30 on device (SM_F956U), and the answer is no.** Cold share,
plain text, app force-stopped first: first native delivery at 0ms, the
cold-launch twin at +65ms, JS listener registered at +663ms, pipeline routing at
**+829ms**. The share path is sub-second. The original ~8s was the
`resolveForImport` Firestore miss on a made-up code and nothing else. **Do not
reopen boot-path work on the strength of that number.**

## Decisions taken

| Question | Decision |
|---|---|
| What appears in the sheet | Up to 4 recent 1:1 conversations, by last activity |
| Tap behavior | Open TKA with the conversation pre-selected, one tap to send |
| Groups | Excluded from v1 |
| Recipients per share | **Many** (revised 2026-07-30, see below) |
| Native strategy | Thin new plugin beside `@capgo/capacitor-share-target` |
| Avatars | Fetched in TS, passed to Java as bytes |

Rejected: send-immediately-with-undo (a mis-tap sends a personal photo to the
wrong person, and undo after upload means deleting a message they may have
already read); forking the capgo plugin (a permanent dependency fork to save one
`getStringExtra`); publishing action shortcuts instead of people (forfeits the
only real win, which is skipping the picker).

## The obstacle this design exists to route around

`@capgo/capacitor-share-target`'s event is `{ title, texts, files }`. When the
user taps a Sharing Shortcut, Android puts the target's identity in
`Intent.EXTRA_SHORTCUT_ID` — and that plugin never reads it. So the bytes arrive
with no indication of **who** was chosen.

Rather than fork it, a second plugin reads the same intent for identity only.
Both reads are read-only and order-independent, so the two cannot conflict. The
capgo plugin keeps owning the payload; ours answers one question.

## Components

### New: `TkaSharingShortcutsPlugin` (Java)

| Method | Job |
|---|---|
| `publish({ targets })` | Push ≤4 dynamic shortcuts via `ShortcutManagerCompat`, each carrying a `Person`, an `IconCompat` built from raw bytes, and the share-target category |
| `clear()` | `removeAllDynamicShortcuts` — called on sign-out |
| `consumeLaunchShortcutId()` | Return `Intent.EXTRA_SHORTCUT_ID` **once**, then clear it |

`consumeLaunchShortcutId` is consume-once on purpose. The launch intent persists
on the activity; without clearing, a warm resume or a second share would
re-attach a stale target and silently send to the wrong person.

### New: `android/app/src/main/res/xml/shortcuts.xml`

One `<share-target>` declaring the same MIME types already in
`AndroidManifest.xml` (`image/jpeg`, `image/png`, `image/webp`) plus the
category the pushed shortcuts are tagged with. Android matches an incoming share
against this element to decide which shortcuts to surface.

**This is the feature's silent-failure point.** The category string must be
identical in three places — `shortcuts.xml`, the Java constant, and the pushed
shortcut. A mismatch in any one of them means targets simply never appear, with
no error anywhere. A contract test pins all three (see Testing).

### New: `sharing-shortcuts-publisher.ts`

Observes the existing conversation subscription. Filters to 1:1, sorts by last
activity, takes 4, resolves each avatar through the existing thumbnail cache,
and calls `publish`. Debounced, and diffed against the last published set so an
unchanged list is not re-pushed.

### Modified: two seam extensions, one line each

- `SharedIntake` gains `targetConversationId?: string`
- `openSendAttachmentSheet`'s options bag gains `conversationId?: string`

The bridge, store, classifier, router core, runner, and host are otherwise
untouched. The shortcut id rides the record exactly as `receiptId` already does.

## Data flow

### Publishing

1. Inbox conversation subscription emits.
2. Publisher filters to 1:1, sorts by last activity, takes the top 4.
3. Avatars resolved via the thumbnail cache (already authed; re-implementing
   that fetch in Java would duplicate auth logic for nothing).
4. Debounce, then diff against the last published set. Unchanged → no call.
5. `publish({ targets })`.
6. On sign-out → `clear()`.

### Tapping

1. User taps Paul in the system share sheet.
2. Android launches `MainActivity` with `ACTION_SEND` **and**
   `EXTRA_SHORTCUT_ID = <conversationId>`.
3. The capgo plugin fires `shareReceived` — twice, as always on cold launch. The
   existing synchronous in-flight dedup collapses it to one intake.
4. The adapter calls `consumeLaunchShortcutId()` and stamps
   `targetConversationId` on the record.
5. Runner → router. For an image item with a `targetConversationId`, the router
   calls `openSendAttachmentSheet(attachment, { receiptId, conversationId })`.
6. The send sheet opens with that conversation pre-selected. The user taps Send.
7. Existing `completeShareIntake` deletes the record. Unchanged.

## Amendment 2026-07-30: several recipients per share

Originally out of scope. Austen: *"I think we should have a way to send it to
multiple people at once I know that we said that was out of spec originally but
let's put it in the spec because it's a natural continuation."* It is: the sheet
already listed every recent conversation and made you pick exactly one, and the
photo you just shared is usually the kind of thing more than one person wants.

**Selection.** Tapping a conversation adds it; tapping it again removes it. Two
or more chosen destinations render as removable chips in the slot that
previously held the single selection, so who is on the list is always readable
without opening anything. The Send button carries the count — "Send image to 3"
— because "Send image" beside four selected people reads as sending to one.

**Delivery** is sequential, not parallel: each image recipient is a full upload
of the same bytes, and firing them at once on a phone uplink makes all of them
slower. A sequence share mints ONE short code for the whole send rather than one
per recipient.

**Partial failure is a first-class outcome.** Recipients that succeeded keep
their message; the ones that failed are named in a toast. Only a send where
NOBODY received it takes the existing whole-send error path, and it rethrows the
underlying error so the report keeps the real cause rather than a sentence we
wrote. The sheet stays open in that case so the share is not lost.

**After sending**, the drawer opens the thread only when there was exactly one
recipient. For several it returns to the conversation list — dropping the user
into an arbitrary one of four hides the other three.

**Direct Share interaction:** a tapped share-sheet target pre-selects that one
conversation and nothing else. The user can then add more before sending, which
is strictly better than the original design's dead end.

## Layout amendment 2026-07-30: the sheet at drawer widths

The send sheet was a single narrow column at every width. Measured on the real
device (`adb shell wm size` / `wm density`), the Z Fold inner display is
1856x2160 at 420dpi — a **707 x 823 CSS viewport**, below the 768px mobile seam,
so the drawer is already full width and was spending 707px on one column.

The sheet now splits into two columns once its own container passes **42rem**:
what you are sending on the left (preview, note, send), who it goes to on the
right (full height, list always visible). That threshold lands on the Fold
unfolded (44.2rem), a 2560 desktop drawer (44.8rem) and a 3840 one (64rem), and
deliberately NOT on a 1920 desktop drawer (33.6rem), which stays single-column.

Two traps worth recording, both found by measuring rather than by reading:

1. **`container-type` belonged on a wrapper, not on the sheet.** An element is
   never matched by the container query of the container it establishes. With
   the property on the sheet, every `@container` rule targeting the sheet itself
   was silently dropped and the two columns appeared only as *implicit*,
   auto-sized grid tracks created by the descendant `grid-column: 2` rules. It
   looked correct and could not be sized.
2. **A `rem` threshold can collide with the test width.** 420px is exactly 42rem
   whenever the root font size is 10px, so the "narrow" component tests were
   quietly exercising the wide layout.

## Edge cases

**An explicit shortcut target beats cards-win.** Today a share carrying both a
resolvable card and a photo opens the viewer and queues the images. But if the
user tapped *Paul*, they stated a destination, and that is a stronger signal
than a QR code we found in the pixels. When `targetConversationId` is present,
the image path wins and any card is queued instead. This inverts a documented
decision from the previous spec, deliberately and only for this case.

**Stale or dead conversation id.** The user left the group, the conversation was
deleted, or the shortcut outlived its target. Fall back to the normal picker
with the photo staged. Never dead-end, never error — the photo is the thing the
user cares about.

**Avatar fetch fails.** Publish the target without an icon rather than dropping
it. Android falls back to the app icon; a nameless gap in the sheet is worse
than a generic one.

**Shortcut tapped while signed out.** Should be impossible since sign-out
clears, but if a stale shortcut survives: the existing `needs-auth` path takes
over and the pre-selection is dropped. The photo is still parked and survives
the sign-in round trip.

**Shortcut push rate limiting.** `ShortcutManagerCompat` rate-limits pushes while
the app is backgrounded. Treat a refusal as normal and skip that cycle; never
throw into the inbox subscription.

## Testing

**Unit (TS):** publisher selection, ordering, 4-cap, dedup-vs-last-published, and
debounce. Adapter stamps `targetConversationId`. Router honors it, prefers it
over cards-win, and falls back to the picker when the conversation is gone.

**Contract (static, the shape of `share-intake-host-contract.test.ts`):** the
category string is identical in `shortcuts.xml`, the Java constant, and the
publisher; and `shortcuts.xml`'s MIME list matches `AndroidManifest.xml`. This
is the only guard against the silent-never-appears failure, since no runtime
test can see it.

**Device (required — unit tests structurally cannot confirm this feature):**
targets appear in the real sheet with correct names and avatars; tapping one
pre-selects that conversation; sign-out empties the sheet; a stale id falls back
to the picker.

## Task order

1. **Measure the real cold-share timing** on device with a valid code and with a
   photo. Cheap, and it either kills or justifies the boot-time work.
2. Java plugin + `shortcuts.xml` + contract test.
3. Publisher, with unit tests.
4. Seam extensions and router precedence, with unit tests.
5. Device verification.

## Open

- Whether `EXTRA_SHORTCUT_ID` survives Capacitor's `BridgeActivity` intent
  handling unmodified. Documented Android behavior, unverified here. Task 2
  confirms it on device before anything is built on top.
- The share sheet ranks targets by its own signals, so "top 4 by last activity"
  is a hint, not a guarantee of what is displayed.
