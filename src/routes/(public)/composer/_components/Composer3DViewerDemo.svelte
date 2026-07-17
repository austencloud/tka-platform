<!--
  Composer3DViewerDemo

  The real 3D sequence viewer, live and interactive, embedded standalone on the
  prerendered marketing page. Drag to orbit; it autoplays the CΨΩX fixture and
  lets you swap the environment it performs in.

  Standalone recipe (no app shell): provide the mandatory viewer-3d context
  ourselves, plus non-persisting effects + scene-render contexts, then
  enter3D(sequence) — which spins up one performer and loads the sequence onto
  it. Viewer3DCanvas owns its own Threlte Canvas, orbit camera, and scene-
  feature context. This whole stack is heavy WebGL, so the page mounts it
  through LazyMount only when the section nears the viewport.

  Scene switching drives settingsService.backgroundType, which is a GLOBAL,
  persisted setting shared with the real app — so we snapshot it on mount and
  restore it on destroy (the same hygiene ComposerTunnelDemo uses for its
  localStorage view state).
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Viewer3DCanvas from "$lib/shared/3d/components/Viewer3DCanvas.svelte";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";

  // ── contexts (must be set during component init, not onMount) ────────────
  const viewer = createViewer3DState();
  setViewer3DContext(viewer);
  setEffectsConfigContext(createEffectsConfigState(undefined, { persist: false }));
  setScene3DRenderContext(createScene3DRenderState());

  const sequence = createSequenceData({
    id: "composer-3d-demo",
    name: "CΨΩX",
    word: (demoJson as { word: string }).word,
    steps: (demoJson as { steps: unknown[] }).steps as StepData[],
    gridMode: (demoJson as { gridMode?: string }).gridMode as never,
  });

  // ── scene switcher ────────────────────────────────────────────────────────
  const DEMO_SCENE = BackgroundType.COSMIC;
  const SCENES = [
    { value: BackgroundType.COSMIC, label: "Cosmic" },
    { value: BackgroundType.OCEAN, label: "Ocean" },
    { value: BackgroundType.FOREST, label: "Forest" },
    { value: BackgroundType.EMBER, label: "Ember" },
  ];
  let scene = $state<BackgroundType>(DEMO_SCENE);
  let prevBackground: BackgroundType | null = null;

  function pickScene(v: string) {
    scene = v as BackgroundType;
    void settingsService.updateSetting("backgroundType", scene);
  }

  // ── performer count (solo → ring) ─────────────────────────────────────────
  const COUNTS = [
    { value: "1", label: "Solo" },
    { value: "4", label: "Quartet" },
    { value: "8", label: "Ring of 8" },
  ];
  let count = $state("1");

  function setCount(v: string) {
    count = v;
    const n = Number(v);
    const pm = viewer.performerManager;
    // Grow with spawnPerformerFromUI (it loads the active sequence onto each
    // new performer), shrink with removePerformer — no enter3D re-entry, so the
    // camera and scene stay put. Then arrange: ring for a group, line for solo.
    while (pm.performers.length < n) viewer.spawnPerformerFromUI();
    while (pm.performers.length > n) pm.removePerformer();
    pm.applyFormationPreset(n > 1 ? "circle" : "line");
  }

  // ── playback clock ────────────────────────────────────────────────────────
  // The scene's puppet loop positions every performer to `currentStep` (a
  // continuous float: integer = beat, fraction = sub-beat) each frame and wraps
  // past the sequence length — so autoplay means advancing this float. 60 BPM =
  // one beat per second.
  let currentStep = $state(0);
  let isPlaying = $state(true);
  const BPM = 60;
  let raf = 0;

  let ready = $state(false);

  onMount(() => {
    // Snapshot the visitor's global background so scene-switching never leaks
    // into their real app, then boot the demo into its own default scene.
    prevBackground = settingsService.settings?.backgroundType ?? null;
    void settingsService.updateSetting("backgroundType", DEMO_SCENE);
    viewer.enter3D(sequence);
    ready = true;

    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      if (isPlaying) currentStep += dt * (BPM / 60);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
    if (prevBackground != null) {
      void settingsService.updateSetting("backgroundType", prevBackground);
    }
  });
</script>

<div class="viewer-demo">
  <div class="stage">
    {#if ready}
      <Viewer3DCanvas
        sequenceData={sequence}
        {currentStep}
        {isPlaying}
        bpm={BPM}
        bluePropType="staff"
        redPropType="staff"
        hideOverlays
      />
    {:else}
      <div class="stage-curtain" aria-hidden="true"></div>
    {/if}
  </div>

  <div class="control-rows">
    <div class="control-row">
      <span class="control-label">Scene</span>
      <SegmentedControl options={SCENES} value={scene} onchange={pickScene} color="accent" size="sm" />
    </div>
    <div class="control-row">
      <span class="control-label">Performers</span>
      <SegmentedControl options={COUNTS} value={count} onchange={setCount} color="accent" size="sm" />
    </div>
  </div>
</div>

<style>
  .viewer-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 16px;
    overflow: hidden;
    background: oklch(0.12 0.02 270);
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
  }

  .stage-curtain {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 50% 42%,
      oklch(0.22 0.04 270) 0%,
      oklch(0.11 0.02 270) 70%
    );
    animation: curtain-pulse 1.6s ease-in-out infinite;
  }

  /* Deterministic footprint: the two rows always stack (never a wrap-dependent
     one-or-two-row layout), each exactly one 52px control tall — the page's
     viewer skeleton reserves this exact height (no-layout-shift). */
  .control-rows {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    margin-top: 1rem;
    width: 100%;
  }
  .control-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: min(100%, 30rem);
  }
  .control-label {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: oklch(0.6 0.02 270);
  }

  @keyframes curtain-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage-curtain {
      animation: none;
    }
  }
</style>
