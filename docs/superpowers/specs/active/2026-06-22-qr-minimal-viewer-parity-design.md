# QR Viewer — Minimal Parity with the Sequence Viewer

**Date:** 2026-06-22
**Status:** Approved (build now)
**Author:** Austen + Claude (Opus 4.8)

## Problem

On a phone, the QR scan page (`/q/[code]`) crushes the Side-by-Side view into
illegibility. Cause (verified in code): it pins **two** control surfaces on
screen at all times — the full `AnimationPanel` ControlDock (Effects / Props /
Effort / Playback / Display / Export pills + Remix / Open TKA / Download) **and**
the `ViewerModeBottomBar` — leaving almost no height for the panes.

The real sequence viewer (`SequenceViewerDrawerHost`) does not do this. On
mobile it shows the canvas/split at full height, tucks every secondary action
behind a single **"…" overflow menu in the header**, and keeps only the slim
`ViewerModeBottomBar` as persistent chrome. The full control panel appears only
when the user opens it.

Decision: keep Side-by-Side, make the QR mobile layout minimal **by matching the
viewer** — not by removing the mode.

## Change (mobile / portrait only; desktop sidebar untouched)

1. **Body = split/canvas at full height.** The Effects/Props/… panel is no longer
   always-on. Flip the gate:
   `{#if !isSidebarLayout || qrViewerMode === "animation"}` →
   `{#if qrViewerMode === "animation"}`. The panel now returns **only in
   Animation mode** — where "watch the animation while you change props/effects"
   was the point, and exactly what desktop already does.

2. **Funnel actions move to a floating "…" overflow menu** over the stage
   (top-right, zero layout height), holding **Remix · Download · Open TKA** —
   mirroring how the viewer puts remix/save/download in its header "…" menu on
   mobile. Reuses `ViewerOverflowMenu`.

3. **Persistent bottom chrome stays just `ViewerModeBottomBar`** (already present).
   Playback transport (scrub + tap-to-toggle) lives inside `ViewerSplitPane`, so
   dropping the panel does not remove playback in split/card/mandala/tunnel modes.

4. **Re-enable Side-by-Side on mobile.** Revert the interim step-1 removal: drop
   `allowSplit={false}` on the QR `ViewerModeBottomBar` and remove the
   split→animation coercion `$effect`. (The reusable `allowSplit` prop on
   `ViewerModeBottomBar` stays — harmless optional capability.)

5. **AnimationPanel `secondaryActions` become desktop-only.** On mobile the "…"
   menu owns Remix/Open TKA, so the dock's secondary row would be redundant in
   Animation mode. Pass them only when `isSidebarLayout`.

## Reuse (never-hand-roll)

- `ViewerModeBottomBar` — as-is.
- `ViewerOverflowMenu` — **extend** with two additive optional props:
  `onDownload` + `downloadBusy` (Download item, spinner while exporting) and
  `onOpenApp` + `openAppLabel` (Open TKA item). All other items stay opt-in, so
  the QR menu renders exactly Remix / Download / Open TKA.
- `ViewerPopover` — already powers the menu.
- No new components.

## Verify

`npm run check` green. iPhone-SE emulation of `/q/<code>`:
- Side-by-Side present in the mode bar and **legible** (panes fill the body).
- No always-on pill panel; "…" top-right opens Remix / Download / Open TKA.
- Switching to Animation mode reveals the full control dock; leaving it hides it.
- Card / Mandala / Tunnel each fill the body; playback scrub works in every mode.
- Desktop/landscape sidebar unchanged.
