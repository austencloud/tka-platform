# Unify the Animation-Export Screen on `ExportTakeover`

**Date:** 2026-07-06
**Status:** Approved (brainstormed + approved 2026-07-06)
**Scope:** Small consolidation. Reuse an existing premium component; kill drift.

## Problem

During a standard in-app 2D **Download Animation** export, the gallery/drawer
viewer — `SequenceViewerShell` rendering `AnimationPanel` (settings) + the
`ViewerSplitPane` canvas — showed only `AnimationPanel`'s thin inline progress
bar at the bottom of the settings sidebar. No overlay, no ring. (Browser
verification, 2026-07-06, established this — an earlier assumption that the
legacy `AnimationPlayer.ExportProgressOverlay` was the surface was wrong;
`AnimationPlayer` backs other hosts — `SequenceViewer`/`SequenceDrawer`/inline
previews — not the shell.)

Meanwhile `/q` (QR scan viewer), the tunnel/Art pane, the mandala export, and
`AnimationShareDrawer` already use the polished `ExportTakeover.svelte`: a
dim-blur scrim over the canvas with a brand blue→red **conic progress ring**
(%), phase label, cancel/retry, error state, reduced-motion + focus +
`beforeunload` guards, and optional word title / hero centerpiece.
`AnimationPanel` even documents the seam (`showInlineExportProgress` —
"hosts with their own takeover pass false"), but the shell never rendered one.

So the "lovely export screen" already exists — the standard animation export
just didn't use it. Same class of drift the chip / crossfade / viewer-shell
consolidations fixed.

Additionally, the `VideoExportProgress → { phase, label }` mapping the ring needs
is **duplicated inline** across the hosts and the wording has already drifted
(all hardcoded English, not i18n):
- `/q` (`src/routes/q/[code]/+page.svelte`): `takeoverPhase` / `takeoverLabel`.
- `ArtPane` (`src/lib/shared/sequence-viewer/components/ArtPane.svelte`):
  `tunnelExportPhase` / `tunnelPhaseLabel`.
- `AnimationShareDrawer` (`src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte`):
  `takeoverPhase` / `takeoverLabel`.

Adding a copy in `AnimationPlayer` would make it four.

## Goal

Every video-export surface shows the one `ExportTakeover` ring, driven by one
shared phase/label mapper. Delete the plain overlay.

## Design

### A. Shared mapper (new)

`src/lib/shared/video-export/services/export-takeover-phase.ts` — a pure
function, single source of truth for what the ring shows:

```ts
export function toExportTakeoverPhase(
  progress: VideoExportProgress | null,
  isExporting: boolean,
  opts?: { error?: string | null; active?: boolean },
): { phase: ExportPhase; label: string }
```

- `phase`: `"idle" | "capturing" | "encoding" | "complete" | "error"`.
  `error` (from `opts.error` or `progress.error`) → `"error"`; else while
  `isExporting`, `progress.stage ?? "capturing"`; else `"idle"`. `opts.active`
  (default true) lets a host force `"idle"` when its export kind is inactive
  (ArtPane gates on `artType === "tunnel"`).
- `labelKey`: an i18n KEY (`export_capturing_progress` / `export_encoding` /
  `export_done`, or `""` for idle/error), resolved by the consumer via `t()` so
  the mapper stays i18n-free and unit-testable. Wording is decided once by an
  exported `exportPhaseLabelKey(phase)` helper — which the controller-driven
  mandala takeover also uses, so the phase wording lives in exactly one place.

Pure → unit-testable.

### B0. `SequenceViewerShell.svelte` — the PRIMARY fix (gallery/drawer surface)

Render `<ExportTakeover>` over the viewer body (`.viewer-and-export`, already
`position: relative`) as a sibling of `Recording3DOverlay` (the established
full-viewer export overlay for 3D), gated to 2D:

```svelte
{#if ctx.renderMode !== '3d' && shellRendersTakeover && animTakeover.phase !== 'idle'}
  <ExportTakeover phase={animTakeover.phase} progress={videoProgress?.progress ?? 0}
    phaseLabel={animTakeover.labelKey ? t(animTakeover.labelKey) : ''}
    error={videoProgress?.error ?? null} onCancel={ctx.handleCancelExport}
    onRetry={handleVideoExport}>
    {#snippet title()}<TKAWordGlyph word={takeoverWord} height={28} darkMode />{/snippet}
  </ExportTakeover>
{/if}
```

- `animTakeover = toExportTakeoverPhase(videoProgress, videoBusy)`.
- `shellRendersTakeover = showInlineProgress` — the existing host signal already
  means "host has NO takeover of its own" (drawer=true, /q=false), so the shell
  renders one only for the drawer; `/q` keeps its own, no double, zero /q change.
- Retire the inline bar: pass `showInlineExportProgress={false}` to
  `AnimationPanel` (the takeover replaces it for every host).

### B. `AnimationPlayer.svelte` — swap in the ring (legacy/other hosts)

Replace both `<ExportProgressOverlay progress onCancel>` render sites
(the two layout branches) with:

```svelte
{#if takeover.phase !== "idle"}
  <ExportTakeover
    phase={takeover.phase}
    progress={exportProgress?.progress ?? 0}
    phaseLabel={takeover.label}
    error={exportProgress?.error ?? null}
    onCancel={cancelExport}
    onRetry={retryExport}
  >
    {#snippet title()}<TKAWordGlyph word={sequenceWord} height={28} darkMode />{/snippet}
  </ExportTakeover>
{/if}
```

- `takeover = $derived(toExportTakeoverPhase(exportProgress, isExporting))`.
- `sequenceWord` + `retryExport` come from the viewer context (`ctx`). If the
  context does not already expose a retry passthrough, add one that calls
  `exportCoord.handleRetryExport(...)` (already exists in
  `export-coordinator.svelte.ts`). If retry genuinely can't be wired cleanly,
  omit `onRetry` — `ExportTakeover` renders the Retry button only when it's
  passed, so this degrades gracefully.
- Default scrim (`opaque={false}`): dim-blur over the paused live canvas,
  matching the other hosts.

### C. Migrate `/q` + `ArtPane` + `AnimationShareDrawer` onto the mapper

Delete their inline `takeoverPhase`/`takeoverLabel` and
`tunnelExportPhase`/`tunnelPhaseLabel` derivations; compute from
`toExportTakeoverPhase(...)`. `/q` + `AnimationShareDrawer` pass plain state;
`ArtPane` passes `{ active: artType === "tunnel" }`. Their `ExportTakeover`
markup is unchanged otherwise. Unifies wording (hardcoded English → i18n) and
leaves the mapper the single source of truth — no host re-derives phase/label.

### D. Delete `ExportProgressOverlay.svelte`

Sole consumer is `AnimationPlayer` (verified). Remove the file + its import.

## Files

| File | Change |
|---|---|
| `src/lib/shared/video-export/services/export-takeover-phase.ts` | NEW — pure mapper |
| `src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte` | **PRIMARY** — overlay ExportTakeover on viewer body; retire AnimationPanel inline bar |
| `src/lib/shared/sequence-viewer/components/AnimationPlayer.svelte` | swap overlay → ExportTakeover (2 sites), wire word + retry |
| `src/routes/q/[code]/+page.svelte` | use shared mapper |
| `src/lib/shared/sequence-viewer/components/ArtPane.svelte` | use shared mapper |
| `src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte` | use shared mapper |
| `src/lib/shared/sequence-viewer/components/MandalaExportTakeover.svelte` | label via shared `exportPhaseLabelKey` (controller-driven; phase unchanged) |
| `src/lib/shared/sequence-viewer/components/ExportProgressOverlay.svelte` | DELETE |
| `src/lib/shared/video-export/services/__tests__/export-takeover-phase.test.ts` | NEW — mapper unit test |

## Verification

- `npm run check` → 0 errors / 0 warnings.
- Unit test: mapper covers idle / capturing / encoding / complete / error /
  inactive-host cases.
- Browser (DevTools, 2026-07-06): ran a real Fire Download Animation in the
  gallery/drawer viewer → ring takeover appeared over the dim-blurred viewer
  ("A·B" word glyph, blue→red ring at 28%, "Capturing...", Cancel), then cleared
  at completion to the "Export complete" preview (Replay / Save Again / Done).
  Props animate with fire (earlier prop-fix intact). Screenshots captured.
- `sequence-viewer-shell-contract.test.ts` → 11/11 pass (shell change keeps the
  host contract).
- Grep the diff: no remaining `ExportProgressOverlay` references; no new inline
  phase/label duplication.

## Out of scope

Ring visual redesign; live frame-preview thumbnail; the 3D `Recording3DOverlay`
(different pipeline). `MandalaExportTakeover` keeps its own PHASE derivation (it
reads `ctrl.exportPhase`, not `VideoExportProgress`) — only its label wording is
folded onto the shared `exportPhaseLabelKey` helper.

## Wording note

The three hosts that previously showed hardcoded English ("Rendering" / "Done")
now show the existing localized strings the standard path already used:
`Capturing...` / `Encoding...` / `Done!`. One-line i18n value edit if different
wording is wanted.

## Related

`never-hand-roll.md`, `sequence-viewer-shell.md`, `chip-primitives.md`,
`crossfade-primitive.md` (same anti-drift playbook), `no-layout-shift.md`
(ExportTakeover already reserves the phase-label width).
