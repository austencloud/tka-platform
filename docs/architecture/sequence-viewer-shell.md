# ADR: SequenceViewerShell — One Chrome, Many Hosts

**Date:** 2026-07-02 (extraction), 2026-07-05 (guardrails), 2026-08-08 (route integration), 2026-08-28 (route consolidation)
**Status:** Shipped

## Context

The sequence viewer renders on two surfaces: the in-app bottom drawer and the
standalone `/sequence/[id]` route. `/q/[code]` historically rendered a third
full viewer. The original drawer and scan implementations were built as
parallel implementations — a "mirror" header and layout on /q that kept diverging from
the drawer (different header, hardcoded palette, different breakpoint, export
tabs on different layout rules). Every parity fix decayed because the surfaces
shared no code.

## Decision

Extract the entire viewer chrome into one component and render it from every
host. Parity by construction, not by discipline.

```
physical QR -> /q/[code] -> attribution + cached handoff -> /sequence/[id]

SequenceViewerDrawerHost                         /sequence/[id]
  (Drawer + dismiss)                (standalone, share, scan-origin options)
          │                                            │
          └────────── SequenceViewerOrchestrator (state ctx) ─┘
                          │
               SequenceViewerShell.svelte
     header · word/overflow menus · rail · split pane
     export panels (video/card) · practice workstation
     delete dialog · breakpoint + export-narrow math · all chrome CSS
```

### Host contract

Hosts stay thin: wrapper, data, routing, host-specific funnels. All deltas flow
through shell props:

- `onClose` — dismiss routing
- `onRemix` — optional host-specific edit routing
- `openAppHref` — "Open TKA" escape hatch for standalone hosts
- `onAccountSignIn` — scan-origin standalone viewers expose account sign-in
- `startInCardThenSplit` — scan-origin viewers reveal the card before split view
- `exportOverrides` — scan-origin download gating replaces `ctx.handleExport`
  replaces `ctx.handleExport`; omitted in-app
- `navigation` — standalone-route back action in the shared header
- `contextContent` — route-owned context placed below the shared header
- `showFullscreenControls` — enables the route's fullscreen affordances

### Theme parity

Chrome colors come from the theme pipeline
(`applyThemeForBackground(backgroundType)` sets `--theme-*`/`--semantic-*` on
`:root`). Standalone hosts call the pipeline on mount. Hosts must never
re-declare those vars locally — CSS custom-property shadowing overrides the
pipeline for the whole subtree (this was the /q color-mismatch bug).

### Breakpoint parity

`isMobile = width < 768` — computed per host, passed as a prop, interpreted
only by the shell (including export-narrow fallbacks at desktop widths).

## Enforcement

- `.claude/rules/sequence-viewer-shell.md` — enforced agent rule
- `tests/unit/sequence-viewer-shell-contract.test.ts` — static contract test in
  CI: shell rendered by both hosts, no chrome-internal imports in hosts, no
  host theme-var declarations, shared breakpoint, no shell-owned markup markers,
  and no viewer shell on `/q`

## Rejected

- **Screenshot-diff parity CI** — flaky and redundant once the markup is
  shared; would test the toolchain, not the contract.
- **Per-host chrome with a shared style layer** — styles were never the whole
  problem; structure and behavior forked too.
