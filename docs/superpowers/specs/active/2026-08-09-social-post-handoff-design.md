# Social Post Handoff — Design

**Date:** 2026-08-09
**Status:** Approved, unimplemented
**Goal:** Collapse the distance between "I'm looking at this animation in the sequence viewer" and "it's posted on my Instagram/Facebook" to one tap on phone and roughly three clicks on desktop.

---

## The problem, measured

Today's desktop path to a Facebook post is ten steps and two waits:

open export drawer → pick settings → export → **wait for render** → file lands in
Downloads → new tab → facebook.com → Create Post → locate file → upload →
**wait for Meta transcode** → write caption → Post

The phone path looks like it should already work, and doesn't. `handleShare` in
`src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:1196`
calls:

```ts
navigator.share({ title, text, url })
```

That is a **link-only** share. Instagram does not accept a URL share as a feed
post, so the OS share sheet is a dead end for the exact case this design exists
to serve. The mechanism is 90% built and aimed at the wrong payload.
`navigator.share({ files: [videoFile] })` is the fix.

### The three real friction sources

1. **The render wait.** Video export is the longest blocking step, and today it
   only *starts* after you've decided to post.
2. **The desktop→phone gap.** Composition happens on a 4K monitor; Instagram
   lives on a phone. That transfer is manual.
3. **The blank caption box.** Every time.

Auto-posting through the Meta API removes only the last four of the ten steps.
It is worth doing, but it is not where the pain is, and it is gated behind Meta
app review. Hence the staging below.

---

## Platform constraints (non-negotiable, verified)

| Target | API publishing | Consequence |
|---|---|---|
| **Facebook personal profile** | **Impossible.** Meta removed `publish_actions` in 2018 and never restored it. | Assist-only, forever. Render + prefill + handoff is the theoretical floor. |
| **Instagram personal** | Not supported — Graph API publishing requires Business/Creator. | Assist-only. |
| **Instagram Business/Creator** | Supported (`instagram_content_publish`). Requires media at a fetchable URL. | True one-click, after app review. |
| **Facebook Page** | Supported (`pages_manage_posts`), text/photo/video. | True one-click, after app review. |

Austen has all four account types, so both assist and auto-post paths have a
real consumer.

### Why a hosted URL is needed, and when

| Path | Upload required |
|---|---|
| Phone → OS share sheet → IG/FB app | **No.** The file is local; `navigator.share` transfers the bytes directly. Nothing touches R2. |
| Desktop → phone handoff | **Yes.** The phone must fetch the bytes from somewhere. |
| Graph API auto-post (Phase 2) | **Yes, mandatory.** Meta does not accept an upload; it fetches from a URL you supply. |

**Decision:** use `r2-presigner.ts` — unguessable key, expiring signature. Not
listed, not indexed, dead after expiry. No user-facing privacy warning: the
artifacts are abstract sequence animations containing no people and no personal
data. Do not add a consent gate for this.

---

## Architecture

One new capability owner, in the module that already owns sharing:

```
src/lib/shared/share/
  components/PostShareSheet.svelte     ← new: the sheet
  services/post-handoff.ts             ← new: destination resolution + dispatch
  state/caption-presets.svelte.ts      ← new: preset store (persisted)
```

Rendered from `SequenceViewerShell.svelte`, never from a host. This is required
by `.claude/rules/sequence-viewer-shell.md`: all viewer chrome lives in the
shell so the drawer, `/q/[code]`, and `/sequence/[id]` are identical by
construction. Hosts get deltas through the prop seam only.

**Seam change:** `handleShare` stops calling `navigator.share({ url })` and
opens the sheet instead. The overflow menu's **Copy Link** action is unchanged.

### Reuse ledger (per `never-hand-roll.md`)

Everything below is **reuse** or **compose**. The only **create** is the sheet
itself and the caption-preset store — no existing owner covers either.

| Need | Owner | Relationship |
|---|---|---|
| Artifact selector (Card/Video, exactly one) | `SegmentedControl` | Reuse |
| Caption preset chips (tap to fill) | `FilterChipBase` `mode="action"` | Reuse |
| Video render | `sequence-modal-exporter.svelte.ts` | Reuse |
| Card image | `Sharer.getCardImageBlob` (already cached) | Reuse |
| Presigned upload | `r2-presigner.ts`, `r2-video-uploader.ts` | Reuse |
| Short link | existing `tka.run` short-code system | Reuse |
| QR render | existing branded QR renderer (`qr` skill path) | Reuse |
| Word for caption | `simplifyRepeatedWord` | Reuse — mandatory, see below |
| State swap without layout shift | `Crossfade` (`fill`) | Reuse |

---

## The sheet

### 1. Artifact — `SegmentedControl`: Card · Video

**Card is the default.** `getCardImageBlob` is already cached, so the card path
is instantly actionable with zero wait — it is the lowest-friction thing that
can ship.

Selecting **Video** starts the render immediately and **does not block the
sheet**. Destination buttons render disabled with live progress and enable when
the blob lands. The user is never staring at a spinner with nothing to do.

Rejected: pre-rendering video on viewer open (a GPU render every open, mostly
wasted) and blocking on the render (today's behavior).

### 2. Caption

An **editable textarea** seeded by **preset chips**. The textarea is the source
of truth; chips only fill it. Presets:

- `{word} — tka.run/{code}` — always correct, no authoring
- the above **plus the saved hashtag set** (edited once in settings, applies
  forever)
- any custom preset the user saves from the current text

The word **must** pass through `simplifyRepeatedWord`
(`.claude/rules/simplified-word-display.md`) — a LOOP caption must read `FΨ`,
never `FΨFΨFΨFΨ`.

**Explicitly excluded:** generated/humor-profile taglines. Generated voice
posting as Austen was rejected during the ghost-presenter work
(`project_ghost_presenter`), and that judgment carries here.

### 3. Destinations — resolved by device capability

**Phone** (`navigator.canShare({ files })` true):

- One **Share** button → `navigator.share({ files: [file], text: caption })` →
  the real OS sheet → Instagram / Facebook app. The caption rides along, so IG
  opens pre-filled. **This is the one-tap post.**

**Desktop:**

- **Copy image + open Facebook** — image to clipboard, caption to clipboard,
  composer opens in a new tab.
- **Send to phone** — QR of the presigned R2 URL. Scan → save to camera roll →
  post. This is what deletes the manual file transfer.

Every destination is a **button**, never a text link
(`.claude/rules/clickables-look-like-buttons.md`).

---

## Phases (do not lose these)

### Phase 1 — Handoff rail *(this spec, ships first)*

- Replace link-only `navigator.share` with the file-bearing sheet.
- Non-blocking video render with progress on the destination buttons.
- Caption composer + presets + persisted hashtag set.
- Phone: file share sheet. Desktop: clipboard+composer, and QR handoff.
- Presigned R2 upload **only** on the desktop-QR path (the phone path has the
  file locally and must not upload).
- Zero Meta dependency. Zero app review. No account connection required.

### Phase 2 — Auto-post to Business IG + Facebook Page

Additive: new buttons appear in the same destination row once the accounts are
connected. Phase 1's shape must not need rewriting for this.

- Connect flow reusing `instagram-auth.ts` + `instagram-auth-proxy.ts`.
- Firebase Function: create media container → poll → publish. Media source is
  the same presigned R2 URL Phase 1 already produces.
- **Meta app review** for `instagram_content_publish` and `pages_manage_posts`.
  This is the long pole — weeks of latency, and a permanent third-party
  dependency. Start the submission early; it does not block Phase 1.
- Personal FB and personal IG stay assist-only. There is no version of this
  phase that changes that.

### Phase 3 — Deferred, not scoped here

- Post history / "already posted" marker on a sequence.
- Scheduled posting.
- Multi-image carousel (`media-bundler.ts` already models this).

---

## Verification

Per `.claude/rules/visual-verification-mandatory.md`, the sheet is a new
surface: screenshot at **1920, 2560, 3840, 1440×900, 820×1180, 960×412, 375×667**
before it is called done. Watch specifically for the wide-control failure — a
`SegmentedControl` of two short labels must size to its labels, not span the
sheet.

Functional proof required before any "done" claim:

1. Phone: `navigator.share` with a real video `File` reaching the Instagram app.
2. Desktop: QR scanned on a real phone, video saved to camera roll.
3. Caption arriving pre-filled, with a LOOP word rendering simplified.
4. Sheet interactive within one frame of opening while a video render runs.

---

## Related

- `.claude/rules/sequence-viewer-shell.md` — why the sheet lives in the shell
- `.claude/rules/never-hand-roll.md`, `chip-primitives.md` — the reuse ledger
- `.claude/rules/simplified-word-display.md` — caption word handling
- `.claude/rules/clickables-look-like-buttons.md` — destination buttons
- `src/lib/shared/share/` — the module that owns this capability
