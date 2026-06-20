# Mandala Rosetta — Baked-Clip Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace 42 live engine instances on the Mandala Rosetta with 42 pre-baked, self-contained looping MP4s (grid + club + lit trail + dotted path + baked-in glowing mandala), played simultaneously at a synced rate, with the controls bar removed.

**Architecture:** Add one optional per-frame overlay hook to the existing export compositor so the static mandala can be composited into each exported frame. A Rosetta-specific bake harness drives `VideoExportOrchestrator.executeExport` over all 42 prepared single-club sequences (own offscreen engine per export) and writes the MP4s into `static/mandala-rosetta/` via the File System Access API. The display page becomes a pure `<video>` grid.

**Tech Stack:** Svelte 5 runes, existing `VideoExportOrchestrator` (WebCodecs + mediabunny → MP4/H.264), `renderMandalaToCanvas`, File System Access API.

Spec: `docs/superpowers/specs/2026-06-18-mandala-rosetta-baked-clips-design.md`

---

## Verification model

These are browser/canvas/Svelte units; the repo verifies test pages at runtime (parity harnesses), not via unit tests. Gate per task = `npm run check:fast` clean for the touched files. Final gate = the user runs the `?bake` mode (their GPU + FS Access picker) and the grid plays 42 synced clips.

---

### Task 1: Add per-frame overlay hook to the export compositor

**Files:**
- Modify: `src/lib/shared/compose/domain/video-export-types.ts`
- Modify: `src/lib/features/compose/services/export-frame-compositor.ts`
- Modify: `src/lib/features/compose/services/video-export-orchestrator.ts`

- [ ] **Step 1: Add the option to the export options type.**

In `video-export-types.ts`, inside `VideoExportOrchestratorOptions`, add:

```typescript
  /**
   * Optional per-frame overlay drawn on top of the composited animation frame
   * (after the black flatten + canvas layers + path lines), in the output-square
   * coordinate space. `sizePx` is the square animation area side in output pixels.
   * Used to bake a static overlay (e.g. the Mandala Rosetta's glowing mandala)
   * into the clip. Omitted by the normal viewer export.
   */
  frameOverlayDraw?: (ctx: CanvasRenderingContext2D, sizePx: number) => void;
```

- [ ] **Step 2: Thread it into the compositor config.**

In `export-frame-compositor.ts`, add to `FrameCompositorConfig`:

```typescript
  frameOverlayDraw?: (ctx: CanvasRenderingContext2D, sizePx: number) => void;
```

- [ ] **Step 3: Call it at the end of `renderOverlays`.**

In `export-frame-compositor.ts`, inside `renderOverlays`, immediately AFTER the path-lines block (line ~199, after `this.renderPathLines(...)`) and BEFORE the header-restore block, add:

```typescript
    // Bake an optional static overlay (mandala) into the square animation area,
    // on top of grid+prop+trail+path. Drawn in the same translated space as the
    // path lines so it shares the canvas-square origin.
    if (this.config.frameOverlayDraw) {
      this.config.frameOverlayDraw(offscreenCtx, actualCanvasSize);
    }
```

- [ ] **Step 4: Pass the option into the config in the orchestrator.**

In `video-export-orchestrator.ts`, in the `compositorConfig` object literal (~line 441), add a final field:

```typescript
        frameOverlayDraw: options.frameOverlayDraw,
```

- [ ] **Step 5: Check.**

Run: `npm run check:fast > /tmp/check.log 2>&1; grep -iE "export-frame-compositor|video-export-orchestrator|video-export-types" /tmp/check.log || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 6: Commit (scoped pathspec).**

```bash
git commit -m "feat(export): optional per-frame overlay hook for baked-in static layers" -- src/lib/shared/compose/domain/video-export-types.ts src/lib/features/compose/services/export-frame-compositor.ts src/lib/features/compose/services/video-export-orchestrator.ts
```

---

### Task 2: Extract shared single-prop sequence prep

**Files:**
- Create: `src/lib/features/lab/vtg-lab/services/prepare-mandala-club-sequence.ts`

- [ ] **Step 1: Write the helper** (lifted verbatim from `MandalaClubCell.prepare`, parameterized by `show`/`pathShape`).

```typescript
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export type MandalaPathShape = "arc" | "linear" | "concave";

/**
 * Produce a single-club, single-hand SequenceData: the non-shown hand is
 * STRIPPED from the start position and every step, and the shown hand's motion
 * is tagged with club + the path shape. The engine null-guards each hand
 * (prop-interpolator `if (redMotion)`), so the stripped hand has no prop, no
 * endpoints, and no path line — a genuine solo animation, not a hidden hand.
 */
export function prepareMandalaClubSequence(
  seq: SequenceData,
  opts: { show: "blue" | "red"; pathShape: MandalaPathShape },
): SequenceData {
  const { show, pathShape } = opts;
  const tag = (m: any) => (m ? { ...m, propType: PropType.CLUB, pathShape } : m);
  const soloMotions = (motions: any) => ({
    blue: show === "blue" ? tag(motions?.blue) : null,
    red: show === "red" ? tag(motions?.red) : null,
  });
  const apply = (d: any) => (d?.motions ? { ...d, motions: soloMotions(d.motions) } : d);
  return {
    ...seq,
    startPosition: seq.startPosition ? apply(seq.startPosition) : seq.startPosition,
    steps: (seq.steps ?? []).map(apply),
  } as SequenceData;
}
```

- [ ] **Step 2: Check + commit.**

Run: `npm run check:fast > /tmp/check.log 2>&1; grep -i "prepare-mandala-club" /tmp/check.log || echo CLEAN`
```bash
git commit -m "feat(vtg-lab): extract single-club sequence prep helper" -- src/lib/features/lab/vtg-lab/services/prepare-mandala-club-sequence.ts
```

---

### Task 3: Static mandala → output-square canvas painter

**Files:**
- Create: `src/lib/features/lab/vtg-lab/services/render-mandala-overlay-layer.ts`

Builds a function bound to one sequence that paints the static glowing mandala
into the export frame's square at the engine-alignment scale + opacity used by
the live overlay. The mandala is rasterized ONCE to a memoized `OffscreenCanvas`
and blitted each frame.

- [ ] **Step 1: Write the module.**

```typescript
import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { renderMandalaToCanvas } from "$lib/shared/mandala/services/mandala-renderer";
import { MANDALA_GRID_RADIUS, ENGINE_GRID_RADIUS } from "$lib/shared/mandala/domain/mandala-constants";
import { getTipPoints } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import type { MandalaPathOptions } from "$lib/shared/mandala/services/types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { MandalaPathShape } from "./prepare-mandala-club-sequence";

// Same engine-alignment factor MandalaClubCell uses: the mandala's hand circle
// is scaled to match the engine hand orbit (150/950), which lands the tip at
// grid-radius 150 + clubTipDx — identical to the baked trail. dx cancels.
function alignScale(clubTipDx: number): number {
  const GRID_HALFWAY = 150;
  const VIEWBOX = 950;
  const tipReach = (clubTipDx * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
  const maxExtent = MANDALA_GRID_RADIUS + tipReach;
  const mandalaHandFrac = MANDALA_GRID_RADIUS / (2 * maxExtent * 1.05);
  const engineHandFrac = GRID_HALFWAY / VIEWBOX;
  return engineHandFrac / mandalaHandFrac;
}

function pathOptionsFor(shape: MandalaPathShape): MandalaPathOptions {
  const base: MandalaPathOptions = { tipEnds: 1 };
  if (shape !== "arc") base.pathShape = shape;
  return base;
}

/**
 * Build a `frameOverlayDraw(ctx, sizePx)` that paints the static glowing mandala
 * for `sequence` (shown hand) into the export square. `opacity`/`scale` mirror
 * the live overlay (0.55 / 1.0). Memoizes the rasterized mandala per sizePx.
 */
export function buildMandalaOverlayDraw(
  sequence: SequenceData,
  opts: { show: "blue" | "red"; pathShape: MandalaPathShape; opacity?: number; scale?: number },
): (ctx: CanvasRenderingContext2D, sizePx: number) => void {
  const { show, pathShape, opacity = 0.55, scale = 1 } = opts;
  const clubTipDx = getTipPoints("club").points[0]?.dx ?? 130;
  const tip = { dx: clubTipDx, dy: 0 };
  const paths = calculateMandalaGeometry(
    sequence.steps,
    undefined,
    undefined,
    pathOptionsFor(pathShape),
    tip,
  );
  const totalAlign = alignScale(clubTipDx) * scale;

  let cache: { sizePx: number; canvas: OffscreenCanvas } | null = null;

  return (ctx: CanvasRenderingContext2D, sizePx: number) => {
    if (!cache || cache.sizePx !== sizePx) {
      const oc = new OffscreenCanvas(sizePx, sizePx);
      const octx = oc.getContext("2d")!;
      // renderMandalaToCanvas centers at (offset + size/2) and fits maxExtent*1.05
      // to the box. Pre-scale the context about the box center by totalAlign so the
      // mandala's hand circle matches the engine hand orbit at this resolution.
      octx.save();
      octx.translate(sizePx / 2, sizePx / 2);
      octx.scale(totalAlign, totalAlign);
      octx.translate(-sizePx / 2, -sizePx / 2);
      renderMandalaToCanvas(octx as unknown as CanvasRenderingContext2D, paths, {
        size: sizePx,
        style: "stroke",
        show,
        tipDx: clubTipDx,
        offsetX: 0,
        offsetY: 0,
        glow: { blur: Math.max(2, sizePx * 0.012) },
      });
      octx.restore();
      cache = { sizePx, canvas: oc };
    }
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(cache.canvas, 0, 0);
    ctx.restore();
  };
}
```

> Note during execution: confirm the exact `renderMandalaToCanvas` options type
> (`MandalaRenderOptions & {offsetX,offsetY}` plus optional `glow`,`palette`).
> The call above uses `style`, `show`, `tipDx`, `offsetX`, `offsetY`, `glow`. If
> the dark palette is needed for color parity, pass `palette` from the dark
> motion palette (see `SequenceMandala`'s `DARK_MOTION_PALETTE`). Resolve from
> the real signature, do not guess.

- [ ] **Step 2: Check + commit.**

Run: `npm run check:fast > /tmp/check.log 2>&1; grep -i "render-mandala-overlay-layer" /tmp/check.log || echo CLEAN`
```bash
git commit -m "feat(vtg-lab): static mandala overlay painter for baked clips" -- src/lib/features/lab/vtg-lab/services/render-mandala-overlay-layer.ts
```

---

### Task 4: Bake harness

**Files:**
- Create: `src/lib/features/lab/vtg-lab/services/bake-mandala-clips.ts`

Loops over the 42 (spin × turns × shape) combinations, exports each to MP4, and
writes into a chosen directory via the File System Access API.

- [ ] **Step 1: Write the harness.**

```typescript
import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import { createAnimationPlaybackController } from "$lib/features/compose/services/animation-playback-controller-factory";
import { getVideoExportOrchestrator } from "$lib/shared/animation-engine/get-video-export-orchestrator";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { prepareMandalaClubSequence, type MandalaPathShape } from "./prepare-mandala-club-sequence";
import { buildMandalaOverlayDraw } from "./render-mandala-overlay-layer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export interface BakeJob {
  filename: string;          // e.g. "iso-0_5-arc.mp4"
  sequence: SequenceData;    // RAW (two-hand) sequence; prep happens here
  pathShape: MandalaPathShape;
}

export interface BakeOptions {
  resolution?: 720 | 1080;
  fps?: number;
  mandalaOpacity?: number;
  mandalaScale?: number;
  onProgress?: (done: number, total: number, label: string) => void;
}

// One-time global visibility setup matching the frozen Rosetta look. The export
// orchestrator reads the GLOBAL visibility manager (getAnimationVisibilityManager)
// for trails + path-line + glyph visibility, so set it here.
function configureGlobalVisibility(): void {
  const vm = getAnimationVisibilityManager();
  const effects = createEffectsConfigState();
  effects.setActiveEffect("trails");
  vm.effectsConfigState = effects;
  vm.setActiveEffect("trails");
  vm.setDarkMode(true);
  vm.setVisibility("wordHeader", false);
  vm.setVisibility("progressBar", false);
  vm.setVisibility("tkaGlyph", false);
  vm.setVisibility("stepNumbers", false);
  vm.setVisibility("bluePathLines", true); // dotted hand-path line, blue only
  vm.setVisibility("redPathLines", false);
}

export async function bakeMandalaClips(
  jobs: BakeJob[],
  dir: FileSystemDirectoryHandle,
  options: BakeOptions = {},
): Promise<void> {
  const { resolution = 720, fps = 30, mandalaOpacity = 0.55, mandalaScale = 1, onProgress } = options;
  configureGlobalVisibility();

  const panelState = createAnimationPanelState();
  const controller = createAnimationPlaybackController();
  const orchestrator = getVideoExportOrchestrator();

  // Layout source canvas (square; only its width feeds the layout math in
  // non-composite mode — the offscreen engine renders the real frames).
  const layoutCanvas = document.createElement("canvas");
  layoutCanvas.width = 600;
  layoutCanvas.height = 600;

  try {
    let done = 0;
    for (const job of jobs) {
      const prepared = prepareMandalaClubSequence(job.sequence, { show: "blue", pathShape: job.pathShape });
      panelState.setSequenceData(prepared);
      panelState.setShouldLoop(true);
      if (!controller.initialize(prepared, panelState)) {
        throw new Error(`Playback init failed for ${job.filename}`);
      }

      const overlayDraw = buildMandalaOverlayDraw(prepared, {
        show: "blue",
        pathShape: job.pathShape,
        opacity: mandalaOpacity,
        scale: mandalaScale,
      });

      const blob = await orchestrator.executeExport(
        layoutCanvas,
        controller,
        panelState,
        () => {},
        {
          format: "mp4",
          codec: "h264",
          resolution,
          fps,
          loopCount: 1,
          effectOverrides: { trails: true },
          includeAnimationStartPosition: false,
          includeEndHold: false,
          bluePropType: "club",
          redPropType: null,
          previewDarkMode: true,
          frameOverlayDraw: overlayDraw,
        },
      );

      const fileHandle = await dir.getFileHandle(job.filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      done++;
      onProgress?.(done, jobs.length, job.filename);
    }
  } finally {
    controller.dispose();
    panelState.dispose();
  }
}
```

> Note during execution: confirm `panelState.setSequenceData` exists (parity page
> uses `playbackController.initialize(seq, panelState)`; check whether a separate
> `setSequenceData` call is needed or `initialize` sets it). Also confirm the FS
> Access types (`FileSystemDirectoryHandle`) resolve under the project's TS lib;
> if not, narrow with a minimal local type. Resolve from real signatures.

- [ ] **Step 2: Check + commit.**

```bash
git commit -m "feat(vtg-lab): batch bake harness for mandala clips" -- src/lib/features/lab/vtg-lab/services/bake-mandala-clips.ts
```

---

### Task 5: Rewrite the page — `?bake` mode + `<video>` grid, controls removed

**Files:**
- Modify: `src/routes/test/vtg-base-rotation/+page.svelte`

- [ ] **Step 1: Script changes.**
  - Remove the `trail`, `mandalaOpacity`, `mandalaScale`, `set()`, `MODES`,
    `SLIDERS` state and the `MandalaClubCell` import.
  - Keep `iso`/`anti` loading, `seq()`, `petals()`, `PATH_SHAPES`, `SPINS`, `fmt`,
    `keyOf`, `TURN_VALUES`, `TND_TURNS_RATIO_MAP`, `zoom`/`open`.
  - Add a slug + clip-path helper:

```typescript
  const turnsSlug = (t: number) => fmt(t).replace(".", "_");
  const clipSrc = (style: Style, t: number, ps: PathShape) =>
    `/mandala-rosetta/${style}-${turnsSlug(t)}-${ps}.mp4`;
```

  - Add `?bake` detection + a "Bake all" action that assembles the 42 `BakeJob`s
    from the loaded matrices and calls `bakeMandalaClips` after the user picks a
    directory:

```typescript
  import { bakeMandalaClips, type BakeJob } from "$lib/features/lab/vtg-lab/services/bake-mandala-clips";
  import { page } from "$app/stores";

  let bakeMode = $derived($page.url.searchParams.has("bake"));
  let baking = $state(false);
  let bakeStatus = $state("");

  async function runBake() {
    const dir = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    const jobs: BakeJob[] = [];
    for (const spin of SPINS) {
      for (const t of TURN_VALUES) {
        const base = seq(spin.id, t);
        if (!base) continue;
        for (const ps of PATH_SHAPES) {
          jobs.push({ filename: `${spin.id}-${turnsSlug(t)}-${ps}.mp4`, sequence: base, pathShape: ps });
        }
      }
    }
    baking = true;
    try {
      await bakeMandalaClips(jobs, dir, {
        resolution: 720,
        fps: 30,
        onProgress: (d, total, label) => (bakeStatus = `baking ${d} / ${total} — ${label}`),
      });
      bakeStatus = `done — ${jobs.length} clips written`;
    } catch (e: any) {
      bakeStatus = `error: ${e?.message ?? e}`;
    } finally {
      baking = false;
    }
  }
```

- [ ] **Step 2: Template — replace the controls block** with a bake panel shown
  only in `?bake` mode (button + status), and DELETE the whole `.controls` block
  for normal mode:

```svelte
  {#if bakeMode}
    <div class="controls">
      <button class="modebtn on" onclick={runBake} disabled={baking}>Bake all 42 clips</button>
      <span class="ctl-label">{bakeStatus}</span>
    </div>
  {/if}
```

- [ ] **Step 3: Template — swap grid cell content** from `MandalaClubCell` to a
  `<video>`:

```svelte
            <button class="cell" onclick={() => open(spin.id, t, ps)} aria-label="enlarge">
              {#if seq(spin.id, t)}
                <video
                  class="clip"
                  src={clipSrc(spin.id, t, ps)}
                  autoplay
                  loop
                  muted
                  playsinline
                  preload="auto"
                ></video>
              {/if}
            </button>
```

- [ ] **Step 4: Template — zoom overlay** uses a `<video>` too:

```svelte
      <div class="player">
        <video class="clip" src={clipSrc(/* from zoom */)} autoplay loop muted playsinline></video>
      </div>
```

  Store `style`/`turns`/`ps` on the `zoom` object so `clipSrc` can be rebuilt; or
  store the resolved `src` string directly on `zoom`.

- [ ] **Step 5: CSS — add `.clip`, drop dead control styles only if unused.**

```css
  .clip { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 10px; background: #0a1015; }
```

  Keep `.controls`/`.modebtn`/`.ctl-label` styles (reused by bake panel). Remove
  `.sliders`, `.slider`, `.val`, `.numin` styles (no longer used).

- [ ] **Step 6: Sync controller — start all videos together.**

Add an `onMount` that waits for every `<video.clip>` to reach `canplay`, then
sets `currentTime = 0` and calls `play()` on all at once:

```typescript
  import { onMount } from "svelte";
  onMount(() => {
    if (bakeMode) return;
    const vids = Array.from(document.querySelectorAll<HTMLVideoElement>("video.clip"));
    if (vids.length === 0) return;
    let ready = 0;
    const startAll = () => { for (const v of vids) { v.currentTime = 0; v.play().catch(() => {}); } };
    for (const v of vids) {
      if (v.readyState >= 3) { if (++ready === vids.length) startAll(); }
      else v.addEventListener("canplay", () => { if (++ready === vids.length) startAll(); }, { once: true });
    }
  });
```

  (`autoplay muted` already starts them; this re-syncs to a common start once all
  are buffered.)

- [ ] **Step 7: Check.**

Run: `npm run check:fast > /tmp/check.log 2>&1; grep -i "vtg-base-rotation" /tmp/check.log || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 8: Commit.**

```bash
git commit -m "feat(vtg-lab): Mandala Rosetta baked-clip video grid + bake mode" -- src/routes/test/vtg-base-rotation/+page.svelte
```

---

### Task 6: Retire `MandalaClubCell`

**Files:**
- Delete: `src/lib/features/lab/vtg-lab/components/MandalaClubCell.svelte`

- [ ] **Step 1: Confirm no other importers.**

Run: `rg -l "MandalaClubCell" src` — expect only the (now-updated) page, which no
longer imports it. If any other importer exists, STOP and reassess.

- [ ] **Step 2: Delete + check + commit.**

```bash
git rm src/lib/features/lab/vtg-lab/components/MandalaClubCell.svelte
npm run check:fast > /tmp/check.log 2>&1; grep -i "MandalaClubCell" /tmp/check.log || echo CLEAN
git commit -m "chore(vtg-lab): retire MandalaClubCell (replaced by baked clips)" -- src/lib/features/lab/vtg-lab/components/MandalaClubCell.svelte
```

---

### Task 7: Bake + ship the clips (user-run step)

- [ ] **Step 1:** Full gate: `npm run check` clean.
- [ ] **Step 2:** User opens `http://localhost:5173/test/vtg-base-rotation?bake`, clicks "Bake all", picks `E:\tka-platform\static\mandala-rosetta\` (create the folder first). Harness writes 42 MP4s.
- [ ] **Step 3:** Verify clip count + total size; if too heavy, drop resolution/fps and re-bake.
- [ ] **Step 4:** Reload `http://localhost:5173/test/vtg-base-rotation` (no `?bake`) — 42 synced looping clips, no scroll on 4K.
- [ ] **Step 5:** Commit the clips: `git add static/mandala-rosetta && git commit -m "assets(vtg-lab): 42 baked mandala rosetta clips" -- static/mandala-rosetta`.

---

## Self-review

- **Spec coverage:** baked contents (Task 1 hook + Task 3 mandala + existing trail/path) ✓; frozen settings (Task 4 options + Task 2 prep) ✓; sync model (Task 5 step 6) ✓; FS-Access generation (Task 4 + Task 5 bake mode) ✓; controls removed + `<video>` grid (Task 5) ✓; MandalaClubCell retired (Task 6) ✓; clip storage/naming (`{spin}-{turnsSlug}-{shape}.mp4`, Task 4/5) ✓.
- **Type consistency:** `MandalaPathShape` defined in Task 2, reused in Tasks 3–5; `BakeJob`/`BakeOptions` defined in Task 4, used in Task 5; `frameOverlayDraw` signature `(ctx, sizePx)` identical across Tasks 1, 3, 4.
- **Open confirmations flagged inline** (real signatures to verify at execution): `renderMandalaToCanvas` options, `panelState.setSequenceData` vs `initialize`, FS Access TS types. These are "verify the real signature," not placeholders.
