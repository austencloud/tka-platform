<!--
  LandingAnimationDemo.svelte

  Native canvas animation using @tka/animation-renderer at full capability.
  Loads pre-baked demo sequences from static JSON, renders them in an
  endless loop with interactive controls: change prop, try another, lights.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    createAnimationPipeline,
    type AnimationPipeline,
  } from "@tka/animation-renderer";
  import { TrailMode, TrailEffect, TrackingMode } from "@tka/types";
  import type { SequenceData, TrailSettings } from "@tka/types";
  import { DEMO_PROP_TYPES } from "$lib/landing-content";

  let canvasContainer: HTMLDivElement | undefined = $state();
  let pipeline: AnimationPipeline | null = $state(null);
  let ready = $state(false);
  let error = $state(false);
  let darkMode = $state(true);
  let currentPropIndex = $state(0);
  let switching = $state(false);

  let sequences: SequenceData[] = [];
  let currentSequenceIndex = 0;

  const CANVAS_SIZE = 500;
  const PLAYBACK_SPEED = 1.0;

  const currentPropType = $derived(DEMO_PROP_TYPES[currentPropIndex] ?? "staff");

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

  async function loadDemoSequences(): Promise<SequenceData[]> {
    const response = await fetch("/data/demo-sequences.json");
    if (!response.ok) throw new Error("Failed to load demo sequences");
    return response.json();
  }

  function initializePipeline(): AnimationPipeline {
    return createAnimationPipeline({
      assetBasePath: "",
      getDarkMode: () => darkMode,
      defaultBluePropType: currentPropType,
      defaultRedPropType: currentPropType,
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

    currentSequenceIndex++;
    timePosition = 0;
    return true;
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
        loadNextSequence();
        return;
      }

      pipeline.orchestrator.calculateStateDurationAware(timePosition);

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
        bluePropType: currentPropType,
        redPropType: currentPropType,
      });
    }, PLAYBACK_SPEED);
  }

  async function handleChangeProp() {
    if (!pipeline || !ready || switching) return;
    switching = true;

    // Cycle to next prop, avoiding the same one
    currentPropIndex = (currentPropIndex + 1) % DEMO_PROP_TYPES.length;

    try {
      await pipeline.renderer.loadPropTextures(currentPropType);
    } catch (e) {
      console.error("Failed to swap prop textures:", e);
    } finally {
      switching = false;
    }
  }

  async function handleTryAnother() {
    if (!pipeline || !ready || switching) return;
    switching = true;

    try {
      // Jump to a random sequence (not the current one if possible)
      if (sequences.length > 1) {
        let nextIndex: number;
        const current = (currentSequenceIndex - 1) % sequences.length;
        do {
          nextIndex = Math.floor(Math.random() * sequences.length);
        } while (nextIndex === current && sequences.length > 1);
        currentSequenceIndex = nextIndex;
      }

      loadNextSequence();
    } catch (e) {
      console.error("Failed to load new sequence:", e);
    } finally {
      switching = false;
    }
  }

  function handleToggleLights() {
    if (!pipeline || !ready) return;
    darkMode = !darkMode;
    pipeline.renderer.setDarkMode(darkMode, true);
  }

  onMount(() => {
    let mounted = true;

    (async () => {
      try {
        sequences = await loadDemoSequences();
        if (!mounted || sequences.length === 0) return;

        // Shuffle sequences for variety
        for (let i = sequences.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sequences[i], sequences[j]] = [sequences[j]!, sequences[i]!];
        }

        // Randomize starting prop
        currentPropIndex = Math.floor(Math.random() * DEMO_PROP_TYPES.length);

        const p = initializePipeline();
        pipeline = p;

        if (!canvasContainer || !mounted) return;

        await p.renderer.initialize(canvasContainer, CANVAS_SIZE);
        await p.renderer.loadPropTextures(currentPropType);
        await p.renderer.loadGridTexture("diamond");
        p.renderer.setDarkMode(true, false);

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
      pipeline?.animationLoop.stop();
      pipeline?.renderer.destroy();
    };
  });
</script>

<div class="animation-demo">
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

  {#if ready}
    <div class="controls">
      <button
        class="control-btn lights-btn"
        class:lights-on={!darkMode}
        onclick={handleToggleLights}
        aria-label={darkMode ? "Turn lights on" : "Turn lights off"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          {#if darkMode}
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          {:else}
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          {/if}
        </svg>
      </button>

      <button
        class="control-btn prop-btn"
        onclick={handleChangeProp}
        disabled={switching}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path
            d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            stroke-linecap="round"
          />
        </svg>
        <span>Change Prop</span>
      </button>

      <button
        class="control-btn shuffle-btn"
        onclick={handleTryAnother}
        disabled={switching}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>Try Another</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .animation-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
  }

  .canvas-area {
    position: relative;
    width: 100%;
    max-width: 500px;
    aspect-ratio: 1;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
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
    width: 40px;
    height: 40px;
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

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .control-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border: none;
    border-radius: 100px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .control-btn:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .control-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-btn svg {
    width: 18px;
    height: 18px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .lights-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    padding: 12px;
  }

  .lights-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .lights-btn.lights-on {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .prop-btn {
    background: linear-gradient(135deg, #0d9488, #14b8a6);
    box-shadow: 0 4px 16px rgba(13, 148, 136, 0.3);
  }

  .prop-btn:hover:not(:disabled) {
    box-shadow: 0 8px 24px rgba(13, 148, 136, 0.4);
  }

  .shuffle-btn {
    background: linear-gradient(135deg, #6366f1, #818cf8);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  }

  .shuffle-btn:hover:not(:disabled) {
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  }

  @media (max-width: 600px) {
    .control-btn {
      padding: 10px 18px;
      font-size: 0.875rem;
    }

    .control-btn svg {
      width: 16px;
      height: 16px;
    }

    .lights-btn {
      padding: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .canvas-wrapper {
      transition: none;
    }

    .spinner {
      animation: none;
    }

    .control-btn {
      transition: none;
    }
  }
</style>
