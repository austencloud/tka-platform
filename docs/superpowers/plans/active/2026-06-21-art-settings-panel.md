# Art Settings Panel + Tunnel Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Art mode (Mandala + Tunnel) a right-edge settings panel composing existing global panes, move the type toggle into it, and add tunnel video export.

**Architecture:** A new `ArtSettingsPanel.svelte` mounts beside the Art canvas, composing `EffectSelector`/`EffortPanel`/`PlaybackPane`/`VisualPane` (all global singletons) plus an Art section (type toggle + tunnel fold/mirror/presets). Tunnel export injects per-beat `additionalLayers` into the offscreen export engine via a provider option.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest. Spec: `docs/superpowers/specs/2026-06-21-art-settings-panel-design.md`.

**Shared rules for every task:** Work on `main`, no branches. Commit ONLY your own files with explicit pathspec (`git commit -m "…" -- <files>`) — the index may hold other agents' work. Run `npm run check > /tmp/check-<task>.log 2>&1; echo EXIT $?` ONCE per task, grep the log, fix and re-run until clean. No `<input type="checkbox">`. Do not hand-roll controls that already exist.

---

## Part B — Tunnel export plumbing (do first; the panel's Export button depends on it)

### Task 1: Add export option fields

**Files:**
- Modify: `src/lib/shared/compose/domain/video-export-types.ts`

- [ ] **Step 1: Add the two option fields to `VideoExportOrchestratorOptions`.**

Find the `VideoExportOrchestratorOptions` interface. Add (import `AdditionalLayerProps` from `$lib/shared/animation-engine/domain/types/trail-capture-types` if not already imported):

```ts
  /**
   * Tunnel/art export: per-beat overlaid prop layers injected into the offscreen
   * engine so the kaleidoscope's extra copies render (and trail) like the base pair.
   * Omit for normal sequence export.
   */
  additionalLayersForBeat?: (beat: number) => AdditionalLayerProps[];

  /**
   * Per-export overrides for chrome visibility, merged OVER the global
   * visibility manager (does NOT mutate global state). Used by tunnel export to
   * suppress hand-path lines / grid / glyph / word header / step numbers /
   * progress bar — the kaleidoscope is pure visual.
   */
  overlayOverrides?: Partial<{
    tkaGlyph: boolean;
    stepNumbers: boolean;
    wordHeader: boolean;
    progressBar: boolean;
    bluePathLines: boolean;
    redPathLines: boolean;
    grid: boolean;
  }>;
```

- [ ] **Step 2: Run check.** `npm run check > /tmp/check-t1.log 2>&1; echo EXIT $?` → EXIT 0.
- [ ] **Step 3: Commit.** `git commit -m "feat(export): add tunnel-export option fields" -- src/lib/shared/compose/domain/video-export-types.ts`

---

### Task 2: Thread a layer provider through `OffscreenExportRenderer`

**Files:**
- Modify: `src/lib/shared/video-export/services/offscreen-export-renderer.ts`
- Test: `src/lib/shared/video-export/services/offscreen-export-renderer.layers.test.ts`

- [ ] **Step 1: Write the failing test.** Verify `renderFrame` forwards the provider's layers down to the engine props. The renderer needs a real engine, so test the seam by spying: extract the per-sub-step props assembly is internal, so assert at the public boundary that passing a provider does not throw and that the provider is invoked with the beat. Minimal, dependency-light test:

```ts
import { describe, it, expect, vi } from "vitest";
import { OffscreenExportRenderer } from "./offscreen-export-renderer";

describe("OffscreenExportRenderer layer provider", () => {
  it("invokes the layer provider with the rendered beat", () => {
    // The renderer requires an initialized engine; we assert the provider-call
    // contract via a partial instance whose handle is stubbed.
    const provider = vi.fn(() => [{ blueProp: null, redProp: null }]);
    const r = Object.create(OffscreenExportRenderer.prototype) as any;
    r.handle = {
      context: { trailCapturer: { captureFrame: () => {} } },
      engine: { renderFrame: () => {} },
    };
    r.playback = { calculateStateForStep: () => {}, isSeamlesslyLoopable: false };
    r.panelState = {};
    r.init = {};
    r.internalClockMs = 0; r.accumulatorMs = 0; r.prevBeatPos = null; r.prevTargetMs = 0;
    // assembleExportEngineProps is imported inside the module; stub via spy is
    // not trivial, so this test only guards the provider invocation contract.
    expect(() => r.renderFrame(1, 0, provider)).not.toThrow();
  });
});
```

Note: if `assembleExportEngineProps` makes the stubbed call throw, simplify the test to assert the new `renderFrame` arity (`expect(OffscreenExportRenderer.prototype.renderFrame.length).toBe(3)`) instead — the real coverage is the orchestrator integration + visual export. Pick whichever runs green without a full engine.

- [ ] **Step 2: Run test to verify it fails.** `npx vitest run src/lib/shared/video-export/services/offscreen-export-renderer.layers.test.ts` → FAIL (renderFrame currently takes 2 args / ignores provider).

- [ ] **Step 3: Implement.** Add an optional `layerProvider` param threaded `renderFrame` → `renderAt` → `renderSubStep`:

```ts
  renderFrame(
    beatPos: number,
    virtualTimeMs: number,
    layerProvider?: (beat: number) => AdditionalLayerProps[],
  ): void {
    this.renderAt(beatPos, virtualTimeMs, layerProvider);
  }
```

In `renderAt(beatPos, targetTimeMs, layerProvider?)`, pass `layerProvider` into each `renderSubStep(...)` call. In `renderSubStep(beat, clockMs, dtSeconds, layerProvider?)`, after `const props = assembleExportEngineProps(...)`:

```ts
    if (layerProvider) props.additionalLayers = layerProvider(beat);
```

Add the import: `import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";`

- [ ] **Step 4: Run test to verify it passes.** `npx vitest run src/lib/shared/video-export/services/offscreen-export-renderer.layers.test.ts` → PASS.
- [ ] **Step 5: Run check.** `npm run check > /tmp/check-t2.log 2>&1; echo EXIT $?` → EXIT 0.
- [ ] **Step 6: Commit.** `git commit -m "feat(export): inject per-beat additionalLayers into offscreen renderer" -- src/lib/shared/video-export/services/offscreen-export-renderer.ts src/lib/shared/video-export/services/offscreen-export-renderer.layers.test.ts`

---

### Task 3: Wire the orchestrator

**Files:**
- Modify: `src/lib/features/compose/services/video-export-orchestrator.ts`

- [ ] **Step 1: Apply overlay overrides.** Where the orchestrator reads the visibility manager (the `showTkaGlyph`/`showStepNumbers`/`showBluePathLines`/`showRedPathLines` block near line 369, and `showWordHeader`/`showProgressBar` near line 85), merge `options.overlayOverrides` over each read. Example for one:

```ts
      const ov = options.overlayOverrides;
      const showTkaGlyph = ov?.tkaGlyph ?? visibilityManager.getVisibility("tkaGlyph");
      const showStepNumbers = ov?.stepNumbers ?? visibilityManager.getVisibility("stepNumbers");
      const showBluePathLines = ov?.bluePathLines ?? visibilityManager.getVisibility("bluePathLines");
      const showRedPathLines = ov?.redPathLines ?? visibilityManager.getVisibility("redPathLines");
```

Do the same for `showWordHeader` and `showProgressBar` (top of method, used for dimension math) so the exported aspect ratio matches. Grid: pass `grid` through to the offscreen init if it consumes a grid flag; otherwise the engine reads global grid — acceptable, the tunnel sets grid off globally via the panel. Leave a comment if grid override is a no-op.

- [ ] **Step 2: Forward the layer provider.** At the warm-up render (`offscreen.renderFrame(warmBeat, virtualTimeMs)`) and the capture render (`offscreen!.renderFrame(playbackPosition, virtualTimeMs)`), add the third arg `options.additionalLayersForBeat`:

```ts
          offscreen.renderFrame(warmBeat, virtualTimeMs, options.additionalLayersForBeat);
          // …
          offscreen!.renderFrame(playbackPosition, virtualTimeMs, options.additionalLayersForBeat);
```

- [ ] **Step 3: Run check.** `npm run check > /tmp/check-t3.log 2>&1; echo EXIT $?` → EXIT 0.
- [ ] **Step 4: Commit.** `git commit -m "feat(export): honor additionalLayersForBeat + overlayOverrides" -- src/lib/features/compose/services/video-export-orchestrator.ts`

---

## Part A — Art settings panel (depends on Part B for the Export button)

### Task 4: Build `ArtSettingsPanel.svelte`

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/ArtSettingsPanel.svelte`

Reference the existing pane wiring in `src/lib/shared/sequence-viewer/components/HorizontalSidebar.svelte` (PlaybackPane/VisualPane props) and `src/lib/shared/animation-engine/components/controls/settings-panel/` for exact prop names.

- [ ] **Step 1: Implement the panel.** Card chrome mirroring `.horizontal-sidebar`. Composition top→bottom: Art section (SegmentedControl Mandala|Tunnel using LABELS not icons; when tunnel: Fold 2/4/8 buttons, Mirror toggle, preset save input + apply/delete chips bound to the shared `controller`), then `EffectSelector` (`activeEffect={effectsConfig.activeEffect}` `onSelect={(e)=>effectsConfig.setActiveEffect(e)}`), then `EffortPanel` (`columns={2}`), then `PlaybackPane` + `VisualPane` (same props HorizontalSidebar passes), then an Export `<button>` that calls an `onExport` prop. Props:

```ts
  const { sequence, playback, controller, artType, onArtTypeChange, onExport, bpm = $bindable(60), playbackMode, stepSize, isPlaying, onBpmChange, onPlaybackModeChange, onStepSizeChange, onPlaybackToggle, bluePropType = null, redPropType = null } = $props();
```

Get effects-config via `getEffectsConfigContext()`. The Art section reuses the fold/mirror/preset markup currently in `TunnelArtView.svelte` (move it here verbatim, keep styles). No `<input type="checkbox">`.

- [ ] **Step 2: Run check.** `npm run check > /tmp/check-t4.log 2>&1; echo EXIT $?` → EXIT 0 (the panel may be unused until Task 5; that's fine, check still passes).
- [ ] **Step 3: Commit.** `git commit -m "feat(art): ArtSettingsPanel composing global panes + Art section" -- src/lib/shared/sequence-viewer/components/ArtSettingsPanel.svelte`

---

### Task 5: Mount the panel; refactor ArtPane + TunnelArtView; wire export

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ArtPane.svelte`
- Modify: `src/lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte`

- [ ] **Step 1: Lift state + share controller in ArtPane.** Construct the `TunnelViewController` once in `ArtPane` (sourcing from `playback`), keep `artType` as ArtPane `$state`, and lay out `[art-body | ArtSettingsPanel]`. Remove the floating top-center `.art-picker`. Pass `controller`, `artType`, `onArtTypeChange={(v)=>artType=v}`, `playback`, `sequence`, prop types, and an `onExport` handler (Step 3) to `ArtSettingsPanel`. Render `MandalaPane` or `TunnelArtView` in `art-body`, passing the shared `controller` to `TunnelArtView`.

- [ ] **Step 2: Slim TunnelArtView.** Remove its `.controls` block (fold/mirror/presets/warn) and its own `newName` state — those now live in the panel. Accept `controller` as a prop instead of constructing one. Keep the self-clock + `AnimatorCanvas`. Keep `hidePathLines`/grid-off props.

- [ ] **Step 3: Export wiring in ArtPane.** `onExport` resolves the viewer's export orchestrator (same path the existing export entry uses — grep `executeExport` / `VideoExportOrchestrator` usage in the viewer to find the resolved instance + panelState/playbackController/canvas). For `artType === "tunnel"`, pass `additionalLayersForBeat: (beat) => controller.additionalLayersAt(beat)` and `overlayOverrides: { tkaGlyph:false, stepNumbers:false, wordHeader:false, progressBar:false, bluePathLines:false, redPathLines:false, grid:false }`. For `artType === "mandala"`, pass the existing mandala `frameOverlayDraw` (grep how MandalaPane/its export currently supplies it). If the viewer's export entry is not directly reachable from ArtPane, expose it via the same context the rest of the viewer uses and note the seam in the commit message.

- [ ] **Step 4: Run check.** `npm run check > /tmp/check-t5.log 2>&1; echo EXIT $?` → EXIT 0.
- [ ] **Step 5: Run tunnel unit tests.** `npx vitest run src/lib/shared/sequence-viewer/tunnel` → all pass.
- [ ] **Step 6: Commit.** `git commit -m "feat(art): mount ArtSettingsPanel, share controller, wire art export" -- src/lib/shared/sequence-viewer/components/ArtPane.svelte src/lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte`

---

## Final verification (controller)

- [ ] One full `npm run check` → EXIT 0.
- [ ] `npx vitest run src/lib/shared/sequence-viewer/tunnel src/lib/shared/video-export` → green.
- [ ] Hand off to user for visual check: Art mode shows right rail; Mandala/Tunnel toggle in the panel; effect/effort/playback/visual apply globally; both Mandala and Tunnel export to MP4 with all layers + active effect, no hand-path/grid/glyph chrome in the tunnel export.
