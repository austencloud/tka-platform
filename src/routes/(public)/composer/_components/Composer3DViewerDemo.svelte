<!--
  Composer3DViewerDemo

  The real 3D sequence viewer, live and interactive, embedded standalone on the
  prerendered marketing page. Drag to orbit; it autoplays the sequence carried
  through the page and lets you swap the environment it performs in.

  Standalone recipe (no app shell): provide the mandatory viewer-3d context
  ourselves, plus non-persisting effects + scene-render contexts, then
  enter3D(sequence) — which spins up one performer and loads the sequence onto
  it. Viewer3DCanvas owns its own Threlte Canvas, orbit camera, and scene-
  feature context. This whole stack is heavy WebGL, so the page mounts it
  through LazyMount only when the section nears the viewport.

  The viewer is constructed from a complete, non-persisting demonstration seed.
  Scene choices address its own environment state, so this surface never reads
  or writes the visitor's 2D background or saved 3D setup.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import Viewer3DCanvas from "$lib/shared/3d/components/Viewer3DCanvas.svelte";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import {
    createSequenceData,
    type SequenceData,
  } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    SceneEnvironmentId,
    type SceneEnvironmentId as SceneEnvironmentIdValue,
  } from "$lib/shared/3d/environments/domain/scene-environment";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    COMPOSER_3D_DEMO_SEED,
    COMPOSER_3D_SCENES,
    normalizeComposer3DDemoState,
  } from "./composer-3d-demo-state";

  /** The per-visit demo sequence, provided by the page (no baked canon). */
  let { sequence: sourceSequence }: { sequence: SequenceData } = $props();

  // ── contexts (must be set during component init, not onMount) ────────────
  const viewer = createViewer3DState(COMPOSER_3D_DEMO_SEED);
  setViewer3DContext(viewer);
  setEffectsConfigContext(
    createEffectsConfigState(undefined, { persist: false })
  );
  setScene3DRenderContext(createScene3DRenderState());

  const sequence = createSequenceData({
    id: "composer-3d-demo",
    name: sourceSequence.word,
    word: sourceSequence.word,
    steps: sourceSequence.steps,
    gridMode: sourceSequence.gridMode,
  });

  // ── scene switcher ────────────────────────────────────────────────────────
  let scene = $state<SceneEnvironmentIdValue>(SceneEnvironmentId.COSMIC);

  function pickScene(v: string) {
    scene = v as SceneEnvironmentIdValue;
    viewer.setEnvironmentId(scene);
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
    viewer.applyFormationFromUI(n > 1 ? "circle" : "line");
  }

  const PROPS = [
    { value: PropType.STAFF, label: "Staffs" },
    { value: PropType.CLUB, label: "Clubs" },
  ];
  let prop = $state<PropType>(PropType.STAFF);
  const sceneLabel = $derived(
    COMPOSER_3D_SCENES.find((option) => option.value === scene)?.label ??
      "selected"
  );
  const stageLabel = $derived(
    `Live 3D performance of ${simplifyRepeatedWord(sequence.word)} with ${count === "1" ? "one performer" : `${count} performers`} using ${prop === PropType.STAFF ? "staffs" : "clubs"} in the ${sceneLabel} scene`
  );

  // ── playback clock ────────────────────────────────────────────────────────
  // The scene's puppet loop positions every performer to `currentStep` (a
  // continuous float: integer = beat, fraction = sub-beat) each frame and wraps
  // past the sequence length — so autoplay means advancing this float. 60 BPM =
  // one beat per second.
  const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  let currentStep = $state(0);
  let isPlaying = $state(!reduceMotion.current);
  const BPM = 60;
  let raf = 0;

  $effect(() => {
    if (reduceMotion.current) isPlaying = false;
  });

  let ready = $state(false);

  onMount(() => {
    viewer.enter3D(sequence);
    normalizeComposer3DDemoState(viewer, scene);
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
    viewer.dispose();
  });
</script>

<div class="viewer-demo">
  <div class="stage">
    <div class="art" role="img" aria-label={stageLabel}>
      {#if ready}
        <Viewer3DCanvas
          sequenceData={sequence}
          {currentStep}
          {isPlaying}
          bpm={BPM}
          bluePropType={prop}
          redPropType={prop}
          hideOverlays
        />
      {:else}
        <div class="stage-curtain" aria-hidden="true"></div>
      {/if}
    </div>
    <button
      type="button"
      class="pause-toggle"
      aria-label={isPlaying ? "Pause 3D preview" : "Play 3D preview"}
      onclick={() => (isPlaying = !isPlaying)}
    >
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
      ></i>
    </button>
  </div>

  <div class="control-rows">
    <div class="control-row">
      <span class="control-label">Scene</span>
      <SegmentedControl
        options={COMPOSER_3D_SCENES}
        value={scene}
        onchange={pickScene}
        ariaLabel="3D scene"
        color="accent"
        size="sm"
      />
    </div>
    <div class="control-row">
      <span class="control-label">Performers</span>
      <SegmentedControl
        options={COUNTS}
        value={count}
        onchange={setCount}
        ariaLabel="3D performers"
        color="accent"
        size="sm"
      />
    </div>
    <div class="control-row">
      <span class="control-label">Props</span>
      <SegmentedControl
        options={PROPS}
        value={prop}
        onchange={(value) => (prop = value as PropType)}
        ariaLabel="3D props"
        color="accent"
        size="sm"
      />
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
  .art {
    position: absolute;
    inset: 0;
  }
  /* Ultrawide: height-capped so the cinema band fills the screen without
     outgrowing it. Mirrors the page's .sk-stage-wide placeholder. */
  @media (min-width: 1680px) {
    .stage {
      max-width: min(100%, calc(78vh * 16 / 9));
      margin-inline: auto;
    }
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

  .pause-toggle {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    width: max(var(--min-touch-target, 48px), 48px);
    height: max(var(--min-touch-target, 48px), 48px);
    display: grid;
    place-items: center;
    border: 1px solid oklch(0.86 0.02 270 / 0.24);
    border-radius: 50%;
    background: oklch(0.08 0.02 270 / 0.72);
    color: oklch(0.95 0.02 270);
    cursor: pointer;
  }
  .pause-toggle:hover {
    background: oklch(0.12 0.03 270 / 0.9);
  }
  .pause-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #8b8cff);
    outline-offset: 3px;
  }

  /* Deterministic footprint: all three rows stack instead of wrapping. The
     page skeleton reserves the same three control rows, so activation does not
     move the sections below it. */
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
  .control-row :global(.segmented-control) {
    flex: 1 1 auto;
    min-width: 0;
  }
  .control-row :global(.segment) {
    min-height: max(var(--min-touch-target, 48px), 48px);
  }
  .control-label {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: oklch(0.74 0.018 270);
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
    .pause-toggle {
      transition: none;
    }
  }
</style>
