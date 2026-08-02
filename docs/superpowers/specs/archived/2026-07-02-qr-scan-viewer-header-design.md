# QR Scan Viewer Header — Design

**Date:** 2026-07-02
**Route:** `/q/[code]` (`src/routes/q/[code]/+page.svelte`)
**Status:** Approved, ready for plan

## Problem

The QR scan landing page diverged from the real sequence viewer. It was built
**chrome-free** on purpose (`+page.svelte:11` — breaks out of the root layout to
maximize the scan stage), so it never got the real viewer's header. The funnel
actions (Open in Composer, Open TKA) and Download got bolted on as **four
separate, drifting spawn points** instead:

| # | Spawn point | Where | Breakpoint |
|---|---|---|---|
| 1 | `.scan-cta-cluster` floating buttons | `+page.svelte:744` | sidebar |
| 2 | `.scan-overflow` floating `…` (`ViewerOverflowMenu`) | `+page.svelte:757` | portrait |
| 3 | `ViewerContentRail` `footerAction` "Open TKA" | `+page.svelte:699` | sidebar rail |
| 4 | `AnimationPanel` `secondaryActions` [Remix, Open TKA] | `+page.svelte:814` | sidebar, animation mode |

Symptoms the user observed at a landscape dimension: the floating Open in
Composer / Open TKA cluster reads as awkwardly placed, and "Open TKA" appears a
second time as a rail-footer side-panel option. Both are consequences of there
being no header to own these actions.

The real `/sequence/[id]` route uses **`RouteViewerHeader`**, whose centered
title literally reads **"Sequence Viewer"** (`RouteViewerHeader.svelte:148`) and
*is* the overflow-menu trigger (chevron). The scan page's body already matches
the real viewer (same `ViewerContentRail` + `ViewerModeBottomBar`). Only the
header/CTAs diverge.

## Goal

Give the scan page a real **"Sequence Viewer"** header, matching the app, with
the funnel actions (Open in Composer, Open TKA) + Download as its header actions.
Consolidate all four spawn points above into that one header.

## Approach

Considered:

- **A — Fork `RouteViewerHeader` with `variant="scan"`.** Rejected: couples the
  real `/sequence` route's header to QR-funnel props; a change for one route
  risks the other.
- **B — New `ScanViewerHeader.svelte`, follows RouteViewerHeader's grid pattern,
  reuses `ViewerOverflowMenu` for the title-menu.** **Chosen.** Real viewer
  untouched; funnel logic isolated; reuses the genuinely-shared interactive
  primitive. Per `never-hand-roll.md`: RouteViewerHeader does <60% of what a
  guest funnel header needs but establishes the pattern → follow the pattern.
- **C — Extract a shared `ViewerHeaderShell` both consume.** Cleanest long-term,
  but refactors the working real-viewer header now. Out of scope; noted as a
  future consolidation.

### never-hand-roll justification

- **New file `ScanViewerHeader.svelte`:** grep of `sequence-viewer/components/`
  found `RouteViewerHeader` (real-route header, auth/save/publish/practice
  coupled, always renders a back button) and `ViewerHeader` (floating overlay,
  VIEWER badge, different model). Neither fits a guest funnel entry point.
  Following the RouteViewerHeader grid pattern; reusing `ViewerOverflowMenu` for
  the menu rather than a new menu.
- **Menu:** reuse `ViewerOverflowMenu` as-is. It already exposes `trigger`
  (title-as-trigger snippet), `onRemix`, `onDownload` + `downloadBusy`, and
  `onOpenApp` with `openAppLabel` defaulting to `"Open TKA"` (`:90`).

## Component: `ScanViewerHeader.svelte`

`src/lib/shared/sequence-viewer/components/ScanViewerHeader.svelte`

Grid `1fr auto 1fr` + mobile swipe handle, same CSS pattern/tokens as
`RouteViewerHeader` (theme vars are already defined on the page's `.page`).

### Props

```ts
interface Props {
  isMobile: boolean;           // portrait phone vs sidebar/desktop
  onOpenInComposer: () => void;
  openTkaHref: string;         // /browse/gallery?from=scan&code=<code>
  onDownload: () => void;
  downloadBusy?: boolean;
}
```

### Region layout

| Region | Landscape / desktop (`!isMobile`) | Portrait phone (`isMobile`) |
|---|---|---|
| **Left** | empty | empty (swipe handle above) |
| **Center** | `ViewerOverflowMenu` title-trigger → **"Sequence Viewer ▾"**. Menu items: **Download** | same title. Menu items: **Open in Composer · Download · Open TKA** |
| **Right** | **[Open in Composer]** accent labeled button · **[Open TKA]** ghost labeled `<a href>` | empty |

- **Left empty is deliberate.** A cold scan is an entry point — no history to go
  "back" to — and the real header's back destination (`/browse/gallery`) is the
  *same* target as Open TKA. A back arrow would be a fifth duplicate of Open TKA.
- The center title is **always** the `ViewerOverflowMenu` trigger (parity with
  the app). Menu contents are breakpoint-gated: on desktop the two CTAs are
  labeled buttons in the right cluster, so the menu holds only Download; on
  portrait the right cluster is empty and all three fold into the menu.
- Right-cluster CTA styling: "Open in Composer" is the accent button (primary
  funnel action → `/create/construct?sheet=auth`); "Open TKA" is the ghost
  variant. Both meet the 44px touch-target floor.

### Menu wiring (via `ViewerOverflowMenu`)

Desktop:
```svelte
<ViewerOverflowMenu trigger={titleTrigger} dropDown align="center" variant="header"
  onDownload={onDownload} downloadBusy={downloadBusy} />
```
Portrait:
```svelte
<ViewerOverflowMenu trigger={titleTrigger} dropDown align="center" variant="header"
  onRemix={onOpenInComposer} remixLabel="Open in Composer"
  onDownload={onDownload} downloadBusy={downloadBusy}
  onOpenApp={() => (location.href = openTkaHref)} />
```

## Extension: `ViewerOverflowMenu`

Add one optional prop, mirroring the existing `openAppLabel` pattern:

```ts
/** Label for the onRemix item. Defaults to "Remix". */
remixLabel?: string;   // default "Remix"
```

Used at `ViewerOverflowMenu.svelte:160` in place of the hardcoded `"Remix"`
label. The scan header passes `"Open in Composer"`; every existing caller keeps
the "Remix" default (no behavior change). Icon stays `fa-pen-to-square`.

## Consolidation — removals in `+page.svelte`

1. Delete `.scan-cta-cluster` block (sidebar floating CTAs, `:744`) + its CSS.
2. Delete `.scan-overflow` block (portrait floating `…`, `:757`) + its CSS.
3. Remove `footerAction={...}` prop from `<ViewerContentRail>` (`:699`) — the
   rail-footer "Open TKA" duplicate.
4. Change `AnimationPanel` `secondaryActions` (`:814`) to `[]` (or drop the prop)
   — header carries Remix/Open TKA now.

## Layout integration

- `ScanViewerHeader` mounts inside the orchestrator `children(ctx)` snippet, as
  the first element of `.player-layout`, all breakpoints. It needs `ctx` for
  Download: `onDownload={() => handleExport(ctx)}`, `downloadBusy={isExporting}`.
  `onOpenInComposer={openInComposer}`,
  `openTkaHref={`/browse/gallery?from=scan&code=${shortCode}`}`.
- **Portrait** (`.player-layout`, flex-column): header is the first flex child;
  stage flows below. ~56px stage cost (accepted).
- **Sidebar** (`.player-layout.sidebar-mode`, grid): add a header row —
  `grid-template-rows: auto 1fr`; header spans `grid-column: 1 / -1; grid-row: 1`.
  The existing rail / canvas / controls move to `grid-row: 2`.
- `.with-panel` variant keeps its 3-column column template on the body row.
- Header uses the page's existing theme vars; no new tokens.

## Explicitly out of scope

- `ViewerHeaderShell` extraction (approach C).
- Any change to `RouteViewerHeader` or the `/sequence/[id]` route.
- TKA wordmark in the header-left (left stays empty; revisit if wanted).
- Animation-mode Download overlap: the `AnimationPanel`'s own rich export button
  and the header menu's Download both stay. Panel = mode-specific export with
  options; header = always-there quick Download. Intentional, not a duplicate to
  remove.

## Verification

- Landscape/desktop: header shows "Sequence Viewer ▾" + [Open in Composer]
  [Open TKA]; no floating cluster; rail has no footer "Open TKA"; menu → Download.
- Portrait: header shows "Sequence Viewer ▾"; menu → Open in Composer · Download ·
  Open TKA; no floating `…`.
- Open in Composer → stores pending edit → `/create/construct?sheet=auth`.
- Open TKA → `/browse/gallery?from=scan&code=<code>`.
- Download → `handleExport` runs, item shows "Preparing…" spinner while busy.
- `grep` the diff: no remaining `.scan-cta-cluster` / `.scan-overflow` /
  `footerAction` / animation `secondaryActions` funnel entries.
- `npm run check` clean.
