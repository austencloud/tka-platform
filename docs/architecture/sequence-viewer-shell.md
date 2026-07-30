# ADR: SequenceViewerShell — One Chrome, Many Hosts

**Date:** 2026-07-02 (extraction), 2026-07-05 (guardrails)
**Status:** Shipped (`fcd3a516d8`, `5d3adfb542`)

## Context

The sequence viewer renders on multiple surfaces: the in-app bottom drawer and
the standalone /q/[code] scan page. For days the two were built as parallel
implementations — a "mirror" header and layout on /q that kept diverging from
the drawer (different header, hardcoded palette, different breakpoint, export
tabs on different layout rules). Every parity fix decayed because the surfaces
shared no code.

## Decision

Extract the entire viewer chrome into one component and render it from every
host. Parity by construction, not by discipline.

```
SequenceViewerDrawerHost          /q/[code]/+page.svelte
  (Drawer, overlay state,           (route shell, data resolve,
   ?v= bootstrap, dismiss)           scan logging, gated export)
        │                                 │
        └────── SequenceViewerOrchestrator (state ctx) ──────┘
                          │
               SequenceViewerShell.svelte
     header · title/overflow menus · rail · split pane
     export panels (video/card) · practice workstation
     delete dialog · breakpoint + export-narrow math · all chrome CSS
```

### Host contract

Hosts stay thin: wrapper, data, routing, host-specific funnels. All deltas flow
through shell props:

- `onClose` — dismiss routing
- `onRemix` — /q hands off to composer instead of in-app edit
- `openAppHref` — "Open TKA" escape hatch for standalone hosts
- `onAccountSignIn` — /q opens the shared account sign-in flow from its header
- `startInSplit` — /q boots into split view
- `exportOverrides` — /q's gated download funnel (sign-in gate for guests)
  replaces `ctx.handleExport`; omitted in-app

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

- `.claude/rules/sequence-viewer-shell.md` — always-loaded agent rule
- `tests/unit/sequence-viewer-shell-contract.test.ts` — static contract test in
  CI: shell rendered by both hosts, no chrome-internal imports in hosts, no
  host theme-var declarations, shared breakpoint, no shell-owned markup markers

## Known gap

`src/routes/sequence/[id]/+page.svelte` predates the shell and still composes
chrome from internals (ViewerHeader, ViewerSplitPane, export panels, practice
bars) plus route-only features (fullscreen controls, LAN sync, handoff). It is
grandfathered: no new chrome features there; the next substantial viewer change
on that route migrates it to the shell, adding props for its deltas. Migration
also retires `ViewerHeader.svelte` (the shell has its own header).

## Rejected

- **Screenshot-diff parity CI** — flaky and redundant once the markup is
  shared; would test the toolchain, not the contract.
- **Per-host chrome with a shared style layer** — styles were never the whole
  problem; structure and behavior forked too.
