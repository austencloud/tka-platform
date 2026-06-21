# Art Settings Panel + Tunnel Export — Design

**Date:** 2026-06-21
**Status:** Approved (verbal, 2026-06-21)
**Related:** `2026-06-20-tunnel-view-design.md` (+ Art-mode addendum), tunnel feature under `src/lib/shared/sequence-viewer/tunnel/`.

## Goal

Give the **Art** viewer mode (Mandala + Tunnel) a right-edge settings panel that matches the 2D-animation / choreo-card pattern, so every effect, effort, playback, and visual control is reachable and drives the same **global** state — and so the Art output can be exported to video the same way the 2D animation is. The Mandala/Tunnel type toggle moves off the canvas into this panel. Add the one genuinely-new piece this requires: **tunnel video export**.

## Background (verified)

- The 2D-animation right-edge panel is `SettingsTogglePanel` (Playback | Visual tabs) hosted in `HorizontalSidebar`, rendered by `AnimationPlayer.svelte` (`SequenceViewer.svelte:465`). The reusable card chrome is `.horizontal-sidebar`.
- All settings panes write **global singletons** (`effects-config-state`, `animation-visibility-state`, `animation-settings-state`). Mounting the same panes in Art mode makes effects/efforts/playback behave identically, with no per-mode state.
- Standalone, reusable panes verified:
  - `EffectSelector.svelte` — props `{activeEffect: string, onSelect: (effect: string) => void}`; full effect roster.
  - `EffortPanel.svelte` — props `{columns?: 2|4, showSubtitles?: boolean}`; reads/writes the global visibility manager itself.
  - `PlaybackPane.svelte`, `VisualPane.svelte` — used today inside `SettingsTogglePanel`.
  - `SegmentedControl.svelte` — the Mandala/Tunnel toggle (renders icon OR label; use labels).
- Export drives a deterministic **offscreen engine** frame-by-frame: `video-export-orchestrator.executeExport` → `offscreen.renderFrame(beat, virtualTimeMs)` → `OffscreenExportRenderer.renderSubStep` builds props via `assembleExportEngineProps(panelState, frameCtx)` then `engine.renderFrame(props, …)`. The compositor (`export-frame-compositor`) bakes the engine canvas + all sibling overlay canvases, so effects/trails are captured.
- **Mandala export already works** via the compositor's `frameOverlayDraw` static-overlay hook. Only **tunnel export** is new.
- `RenderFrameParams.props.additionalLayers` already exists; the WebGL2 trail overlay now reads it per layer (trail-on-all-layers fix, commit `3af18dbf7e`). So feeding `props.additionalLayers` during export yields layer trails for free.
- Tunnel layers are a pure function of beat: `TunnelViewController.additionalLayersAt(beat)` / `basePropsAt(beat)`. The on-screen self-clock speed does NOT enter export math — the export's own frame→beat mapping governs.

## Components

### `ArtSettingsPanel.svelte` (new)
Right-edge card using the `.horizontal-sidebar` chrome. Top → bottom:

1. **Art section** — `SegmentedControl` Mandala | Tunnel (labels, no icons). When Tunnel active: Fold (2/4/8) buttons, Mirror toggle, preset row (save input + apply/delete chips). All bound to the shared `TunnelViewController`.
2. `EffectSelector` — `activeEffect` from `effectsConfigState.activeEffect`; `onSelect` → `effectsConfigState.setActiveEffect`.
3. `EffortPanel` — dropped in (self-wires to global manager).
4. `PlaybackPane` + `VisualPane` — same props/wiring as `SettingsTogglePanel`/`HorizontalSidebar` use today.
5. **Export** — button calling the export orchestrator. Mandala → existing static-overlay path. Tunnel → new layer-injection path (below). Honors the same loop-count control as 2D export (decision: exported tunnel honors loop count, not forced single-pass).

Props: `{ sequence, playback, controller, artType, onArtTypeChange, bluePropType?, redPropType? }`. The panel owns no animation state; it binds the shared controller + global singletons.

### `ArtPane.svelte` (modify)
Layout becomes `[art-body | ArtSettingsPanel]` (canvas + right rail, mirroring `AnimationPlayer`'s `[canvas | HorizontalSidebar]`). The floating top-center picker is removed; `artType` lifts to ArtPane state and passes to both the body and the panel. The `TunnelViewController` is constructed once in ArtPane and shared with `TunnelArtView` (rendering) and `ArtSettingsPanel` (controls).

### `TunnelArtView.svelte` (modify)
Drop its in-view controls (`.controls` block: fold/mirror/presets/warn) — they move to the panel. It keeps only the self-clocked `AnimatorCanvas`. Accept the shared `controller` as a prop instead of constructing its own.

### `tunnel-view-controller.svelte.ts` (modify)
Already exposes `fold`, `mirror`, `presets`, `setFold`, `mirror` setter, `saveCurrentAs`, `applyPreset`, `deletePreset`, `additionalLayersAt`, `basePropsAt`, `heavyLoad`. Confirm all are public for the panel. No new state needed; the `effect` field stays driven by the shared effects-config (panel's EffectSelector), not the controller.

## Tunnel export (new)

### `OffscreenExportRenderer` (modify)
`renderFrame(beatPos, virtualTimeMs, layerProvider?)` → thread `layerProvider` through `renderAt` → `renderSubStep(beat, clock, dt, layerProvider)`. In `renderSubStep`, after `assembleExportEngineProps`, set `props.additionalLayers = layerProvider?.(beat) ?? []` before `engine.renderFrame`. Per-sub-step beat → smooth layer interpolation, matching the base pair.

### `video-export-orchestrator.executeExport` (modify)
- New option `additionalLayersForBeat?: (beat: number) => AdditionalLayerProps[]`. Passed to both the warm-up `offscreen.renderFrame(warmBeat, vt, opt)` and the capture-loop `offscreen.renderFrame(playbackPosition, vt, opt)`.
- New option `overlayOverrides?: Partial<{ tkaGlyph, stepNumbers, wordHeader, progressBar, bluePathLines, redPathLines, grid: boolean }>` merged OVER the `visibilityManager` reads (does NOT mutate global state). Tunnel export passes all false (kaleidoscope is pure visual). Defaulting to the manager value keeps every existing caller unchanged.

### `video-export-types.ts` (modify)
Add the two option fields to `VideoExportOrchestratorOptions`.

### Art panel Export wiring
Mandala export: pass `frameOverlayDraw` (existing mandala path). Tunnel export: pass `additionalLayersForBeat: (beat) => controller.additionalLayersAt(beat)` + `overlayOverrides` all-false + the existing effect/loop options. Reuses encoder, compositor, frame→beat mapping untouched.

## Data flow

Global singletons remain the single source of truth for effects/efforts/visual/playback. The panel is a thin controller surface. The `TunnelViewController` owns only tunnel topology (fold/mirror/presets) + derives layers. Export reads the same global effect state (so the exported tunnel uses whatever effect is active), plus the per-beat layer provider.

## Files

**New:** `src/lib/shared/sequence-viewer/components/ArtSettingsPanel.svelte`.

**Modify:**
- `src/lib/shared/sequence-viewer/components/ArtPane.svelte` (layout + rail mount + lift artType + share controller; remove floating picker)
- `src/lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte` (remove in-view controls; accept shared controller)
- `src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts` (confirm public surface; no behavior change expected)
- `src/lib/shared/video-export/services/offscreen-export-renderer.ts` (layerProvider param)
- `src/lib/features/compose/services/video-export-orchestrator.ts` (additionalLayersForBeat + overlayOverrides)
- `src/lib/shared/compose/domain/video-export-types.ts` (option fields)

**Reuse as-is:** `EffectSelector`, `EffortPanel`, `PlaybackPane`, `VisualPane`, `SegmentedControl`, `export-frame-compositor`, `background-video-encoder`.

## Testing

- Unit: existing fold-math + presets tests stay green. Add a test that `executeExport` with `additionalLayersForBeat` threads layers into `OffscreenExportRenderer.renderFrame` (spy on renderFrame args), and that `overlayOverrides` wins over the visibility manager in the compositor config.
- Type: `npm run check` clean.
- Visual (user): Art mode shows the right rail; Mandala/Tunnel toggle works; effect/effort/playback/visual changes apply and persist; both Mandala and Tunnel export to MP4 with every layer + its effect, no hand-path/grid/glyph chrome in the tunnel export.

## Out of scope

- Restyling the existing panes.
- Per-mode (non-global) effect state — explicitly rejected; global is the decision.
- 3D-mode export changes.
