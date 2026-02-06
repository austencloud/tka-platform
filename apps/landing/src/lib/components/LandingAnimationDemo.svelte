<!--
  LandingAnimationDemo.svelte

  Native canvas animation using @tka/animation-renderer.
  Renders sequences in an endless loop with a synced beat grid.
  Cross-fades between sequences for smooth transitions.
  Controlled externally via props (no self-loading, no controls UI).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    createAnimationPipeline,
    type AnimationPipeline,
  } from "@tka/animation-renderer";
  import { TrailMode, TrailEffect, TrackingMode } from "@tka/types";
  import type { SequenceData, StepData, TrailSettings } from "@tka/types";
  import LandingBeatGrid from "./LandingBeatGrid.svelte";

  let {
    sequences = [],
    darkMode = true,
    propType = "staff",
  } = $props<{
    sequences: SequenceData[];
    darkMode: boolean;
    propType: string;
  }>();

  let canvasContainer: HTMLDivElement | undefined = $state();
  let pipeline: AnimationPipeline | null = $state(null);
  let ready = $state(false);
  let error = $state(false);
  let switching = $state(false);

  // Beat grid state
  let currentSteps: StepData[] = $state([]);
  let currentStepIndex = $state(0);

  // Cross-fade state
  let fading = $state(false);
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;

  let currentSequenceIndex = 0;

  const CANVAS_SIZE = 500;
  const PLAYBACK_SPEED = 1.0;
  const FADE_DURATION = 400;

  const trailSettings: TrailSettings = {
    enabled: false,
    mode: TrailMode.OFF,
    effect: TrailEffect.NONE,
    fadeDurationMs: 2000,
    maxPoints: 500,
    lineWidth: 3,
    glowBlur: 8,
    blueColor: "#2E86F0",
    redColor: "#E04040",
    minOpacity: 0.1,
    maxOpacity: 0.8,
    trackingMode: TrackingMode.BOTH_ENDS,
    hideProps: false,
    usePathCache: false,
    previewMode: false,
  };

  const visibility = {
    gridVisible: true,
    propsVisible: true,
    trailsVisible: false,
    blueMotionVisible: true,
    redMotionVisible: true,
  };

  let timePosition = 0;

  function initializePipeline(): AnimationPipeline {
    return createAnimationPipeline({
      assetBasePath: "",
      getDarkMode: () => darkMode,
      defaultBluePropType: propType,
      defaultRedPropType: propType,
    });
  }

  function loadNextSequence(): boolean {
    if (!pipeline || sequences.length === 0) return false;

    const seq = sequences[currentSequenceIndex % sequences.length];
    if (!seq) return false;
    const success = pipeline.orchestrator.initializeWithDomainData(seq);
    if (!success) {
      console.warn("Failed to initialize sequence:", seq.word);
      currentSequenceIndex++;
      if (currentSequenceIndex < sequences.length * 2) {
        return loadNextSequence();
      }
      return false;
    }

    currentSteps = [...(seq.steps ?? [])];
    currentStepIndex = 0;
    currentSequenceIndex++;
    timePosition = 0;
    return true;
  }

  /** Fade out, swap sequence, fade back in */
  function transitionToNextSequence() {
    if (fading) return;
    fading = true;

    fadeTimer = setTimeout(() => {
      loadNextSequence();
      // Brief pause then fade in
      requestAnimationFrame(() => {
        fading = false;
      });
      fadeTimer = null;
    }, FADE_DURATION);
  }

  function startRenderLoop() {
    if (!pipeline) return;

    pipeline.animationLoop.start((deltaTimeMs: number) => {
      if (!pipeline) return;

      const timeDelta = deltaTimeMs / 1000;
      timePosition += timeDelta;

      const totalDuration =
        pipeline.orchestrator.getTotalDurationWithStartPosition();

      if (timePosition >= totalDuration) {
        if (!fading) {
          transitionToNextSequence();
        }
        // Clamp to end - keep rendering last frame during fade-out
        timePosition = totalDuration - 0.001;
      }

      pipeline.orchestrator.calculateStateDurationAware(timePosition);

      const stepIdx = pipeline.orchestrator.getCurrentStepIndex?.();
      if (stepIdx !== undefined && stepIdx !== currentStepIndex) {
        currentStepIndex = stepIdx;
      }

      const propStates = pipeline.orchestrator.getPropStates();
      const metadata = pipeline.orchestrator.getMetadata();
      const bluePropDimensions = pipeline.renderer.getBluePropDimensions();
      const redPropDimensions = pipeline.renderer.getRedPropDimensions();

      pipeline.renderer.renderScene({
        blueProp: propStates.blue,
        redProp: propStates.red,
        secondaryBlueProp: null,
        secondaryRedProp: null,

        gridVisible: visibility.gridVisible,
        gridMode: metadata.gridMode?.toString() ?? "diamond",
        letter: null,
        turnsTuple: null,

        bluePropDimensions,
        redPropDimensions,

        blueTrailPoints: [],
        redTrailPoints: [],
        secondaryBlueTrailPoints: [],
        secondaryRedTrailPoints: [],
        trailSettings,

        currentTime: performance.now(),

        visibility,

        bluePropFlipped: false,
        redPropFlipped: false,
        bluePropType: propType,
        redPropType: propType,
      });
    }, PLAYBACK_SPEED);
  }

  // React to darkMode changes
  $effect(() => {
    if (pipeline && ready) {
      pipeline.renderer.setDarkMode(darkMode, true);
    }
  });

  // React to propType changes
  $effect(() => {
    if (!pipeline || !ready || switching) return;
    const pt = propType;

    switching = true;
    pipeline.renderer
      .loadPropTextures(pt)
      .catch((e: unknown) => console.error("Failed to swap prop textures:", e))
      .finally(() => {
        switching = false;
      });
  });

  // React to sequences changing (level switch, etc.)
  let lastSequenceKey = "";
  $effect(() => {
    const key = sequences.map((s: SequenceData) => s.id).join(",");
    if (key === lastSequenceKey || !pipeline || !ready) return;
    lastSequenceKey = key;

    // Fade out, then shuffle and restart
    fading = true;
    if (fadeTimer) clearTimeout(fadeTimer);

    fadeTimer = setTimeout(() => {
      const shuffled = [...sequences];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      sequences = shuffled;
      currentSequenceIndex = 0;
      loadNextSequence();
      requestAnimationFrame(() => {
        fading = false;
      });
      fadeTimer = null;
    }, FADE_DURATION);
  });

  onMount(() => {
    let mounted = true;

    (async () => {
      try {
        if (!mounted || sequences.length === 0) return;

        // Shuffle sequences for variety
        const shuffled = [...sequences];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
        }
        sequences = shuffled;
        lastSequenceKey = sequences.map((s: SequenceData) => s.id).join(",");

        const p = initializePipeline();
        pipeline = p;

        if (!canvasContainer || !mounted) return;

        await p.renderer.initialize(canvasContainer, CANVAS_SIZE);
        await p.renderer.loadPropTextures(propType);
        await p.renderer.loadGridTexture("diamond");
        p.renderer.setDarkMode(darkMode, false);

        if (!mounted) return;

        if (loadNextSequence()) {
          startRenderLoop();
          ready = true;
        } else {
          error = true;
        }
      } catch (e) {
        console.error("Animation demo failed to initialize:", e);
        if (mounted) error = true;
      }
    })();

    return () => {
      mounted = false;
      if (fadeTimer) clearTimeout(fadeTimer);
      pipeline?.animationLoop.stop();
      pipeline?.renderer.destroy();
    };
  });
</script>

<div class="animation-demo" class:fading>
  <div class="canvas-area">
    <div
      class="canvas-wrapper"
      class:visible={ready}
      bind:this={canvasContainer}
    ></div>

    {#if !ready && !error}
      <div class="loading">
        <div class="spinner"></div>
      </div>
    {/if}

    {#if error}
      <div class="error-state">
        <p>Animation unavailable</p>
      </div>
    {/if}
  </div>

  {#if ready && currentSteps.length > 0}
    <div class="beat-grid-area">
      <LandingBeatGrid
        steps={currentSteps}
        {currentStepIndex}
        {darkMode}
        {propType}
      />
    </div>
  {/if}
</div>

<style>
  .animation-demo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    transition: opacity 0.4s ease;
  }

  .animation-demo.fading {
    opacity: 0;
  }

  .canvas-area {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  .beat-grid-area {
    width: 100%;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .canvas-wrapper {
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  .canvas-wrapper.visible {
    opacity: 1;
  }

  .canvas-wrapper :global(canvas) {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-state p {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.875rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .animation-demo {
      transition: none;
    }

    .canvas-wrapper {
      transition: none;
    }

    .spinner {
      animation: none;
    }
  }
</style>
