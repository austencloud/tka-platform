# /q Account Funnel — Download Gate + Sign-in Chip — Design

**Date:** 2026-07-05
**Status:** Active
**Author:** Claude (Fable 5) + Austen

## Problem

The /q scan page gives everything away with no path to an account:

- Download (video + card export) is wired unconditionally for guests
  (`viewer-actions.ts:72` — scan profile sets `onDownload` with no auth gate).
  A cold scanner downloads the MP4 and leaves. No conversion moment.
- The scan header's top-right is empty on mobile (`ViewerHeader.svelte:155` —
  the scan CTAs render only `!isMobile`), wasting the one obvious account
  affordance slot on a standalone page.

Austen's strategy pick: **gate download behind a free account** ("play with
everything, pay to take it home" — watching stays free, keeping it is the
conversion lever), plus an always-present sign-in chip → avatar indicator.

## Decisions (made with Austen)

1. Download gate → free account. Watch/play, Open-in-Composer, Open-TKA stay free.
2. Top-right chip: signed-out = "Sign in" button → auth sheet; signed-in =
   avatar (RobustAvatar), tap = Open TKA. No account menu on the scan page.

## Architecture — reuse the gated-action machinery already live on /q

`SequenceViewerOrchestrator` already renders `SignInSheet`, runs
`authQueue.bootstrapFromUrl()` on mount, and replays the pending action after
sign-in (`replayPendingAction` effect). Scan download currently bypasses it by
calling `handleExport` directly. The gate is an action-type addition, not new
infrastructure.

### Changes

| File | Change |
|---|---|
| `pending-action-queue.ts` | `PendingActionType` += `"download"`; add to `VALID_TYPES` (enables `?pending=download` webview handoff). |
| `gated-action-policy.ts` | `"download"` joins `FULL_ACCOUNT_ACTIONS`. Critical: outside this set, `invokeGatedAction` silently provisions an anonymous guest and runs the handler — no prompt, no funnel. Download must prompt. |
| `auth-action-queue.svelte.ts` | `AuthActionQueueCallbacks` += `handleDownload: () => void`; replay switch gains `case "download"`. New `SignInReason = PendingActionType \| "account"` for the chip's non-action sheet open; `openSignInSheet(reason: SignInReason)`; `onSignInSheetPrimary` maps `"account"` → `null` for the webview handoff. |
| `SignInSheet.svelte` | Copy records keyed by `SignInReason`. `download`: "Create a free account to download this sequence." `account`: "Sign in to save your scans and build your library." (+ webview variants). |
| `SequenceViewerOrchestrator.svelte` | New optional prop `onGatedDownload?: (ctx) => void`, wired as the replay `handleDownload`. `OrchestratorContext` += `openSignInPrompt()` → `authQueue.openSignInSheet("account")` (the chip's hook). |
| `ViewerHeader.svelte` | Scan profile `header-right`, all widths: signed-out (`!authState.isFullAccount`) → "Sign in" ghost CTA calling `ctx.openSignInPrompt()` (+ `qr_signin_from_chip` analytics); signed-in → `RobustAvatar` (sm) as a link to `openAppHref`, `aria-label="Open TKA"`. Reuses existing `.cta.ghost`; no new primitives. |
| `/q/[code]/+page.svelte` | Header Download, AnimationPanel export, and card export route through `ctx.invokeGatedAction("download", realHandler)`. Page-local `pendingExportKind: "video" \| "card"` set before each gate call so post-sign-in replay resumes the right export; `onGatedDownload` reads it. `qr_download_gated` analytics on guest gate hit. |

### Flow (guest taps Download)

1. `/q` sets `pendingExportKind`, calls `ctx.invokeGatedAction("download", run)`.
2. Not a full account → queue `?pending=download`, open `SignInSheet`
   ("Create a free account to download this sequence.", Google One-Tap-first).
3. Sign-in completes → existing replay effect fires → `handleDownload` →
   `onGatedDownload(ctx)` → `/q` resumes the requested export. No re-tap.
4. Signed-in scanner: handler runs immediately, zero friction.

Webview handoff (in-app browsers): URL carries `?pending=download` into Chrome;
`bootstrapFromUrl` re-opens the sheet; replay resumes the **video** export
(`pendingExportKind` is page state and doesn't survive the handoff — video is
the primary CTA; acceptable, documented).

## Scope guard

The full viewer (`/sequence`) is untouched: its download flows through the
export panels, not `buildHeaderActions`' scan branch, and it never calls
`invokeGatedAction("download", …)`. Only /q routes download through the gate.

## Non-goals

- Account menu / sign-out on the scan page.
- Gating Open-in-Composer (already funnels via `?sheet=auth`) or watch/play.
- Email-link auth on the sheet (SignInSheet is Google-first by design; the
  composer handoff offers the full AuthSheet).

## Verification (Chrome DevTools MCP, localhost — user is remote)

1. Signed-out: tap header Download → sheet opens with download copy,
   `?pending=download` in URL, no export starts.
2. Sign in (popup) → export starts automatically (ExportTakeover appears).
3. Signed-in: Download runs immediately, no sheet.
4. Chip: signed-out shows "Sign in" (44px target), opens sheet with account
   copy; signed-in shows avatar linking Open TKA. Mobile width: chip present
   (previously empty corner).
5. Card-mode export gates the same way and resumes the card export.
6. `npm run check` clean; screenshots mobile + desktop.
