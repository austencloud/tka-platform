<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import ProgressBar from "$lib/shared/components/loading/ProgressBar.svelte";
  import "$lib/features/museum/components/museum-theme.css";
  import { buildLobbyFloorPlan } from "$lib/features/museum/data/lobby-floor-plan";
  import { MUSEUM_EXHIBIT_SEQUENCES } from "$lib/features/museum/data/museum-exhibit-sequences";
  import { renderFirstStepBitmap } from "$lib/features/personal-museum/services/plaque-pictograph";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import {
    releaseBackground,
    suppressBackground,
  } from "$lib/shared/background/shared/state/background-suppression.svelte";

  const plan = buildLobbyFloorPlan();
  const installation = MUSEUM_EXHIBIT_SEQUENCES["gallery-spiral-seq"];
  const installationSequence = {
    id: "museum-lobby-installation",
    word: installation.word,
    steps: installation.steps as readonly StepData[],
    isCircular: true,
  } as SequenceData;

  const stageInfo: Record<string, { fraction: number; label: string }> = {
    "Tile bucketing": { fraction: 0.15, label: "Mapping the floor plan" },
    "Building corridors": { fraction: 0.4, label: "Building the cave dogleg" },
    "Building lobby": { fraction: 0.72, label: "Raising the lobby" },
    "Mounting fixtures": { fraction: 0.9, label: "Placing the room program" },
  };

  let deferredReady = $state(false);
  let showOverlay = $state(true);
  let overlayFading = $state(false);
  let textureFraction = $state(0);
  let geometryFraction = $state(0);
  let displayedPercent = $state(3);
  let stageLabel = $state("Preparing the review model");
  let currentRoom = $state("Entrance Lobby");
  let plaquePictographs = $state<Map<string, ImageBitmap>>(new Map());
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let mountTimer: ReturnType<typeof setTimeout> | undefined;
  let mountFrame: number | undefined;

  $effect(() => {
    const blended = (geometryFraction * 0.68 + textureFraction * 0.32) * 100;
    if (blended > displayedPercent) displayedPercent = blended;
  });

  function handleLoadProgress(progress: number): void {
    if (progress > textureFraction) textureFraction = progress;
  }

  function handleBuildStage(stage: string): void {
    const next = stageInfo[stage];
    if (!next) return;
    stageLabel = next.label;
    if (next.fraction > geometryFraction) geometryFraction = next.fraction;
  }

  function handleAllLoaded(): void {
    if (!showOverlay) return;
    displayedPercent = 100;
    stageLabel = "Lobby ready";
    overlayFading = true;
    fadeTimer = setTimeout(() => {
      showOverlay = false;
    }, 550);
  }

  function handleWingChange(wingId: string | null): void {
    currentRoom =
      plan.grid.wings.find((wing) => wing.id === wingId)?.name ??
      "Between rooms";
  }

  onMount(() => {
    let cancelled = false;
    suppressBackground("museum-lobby-review");

    mountFrame = requestAnimationFrame(() => {
      mountTimer = setTimeout(async () => {
        try {
          const bitmap = await renderFirstStepBitmap(installationSequence);
          if (bitmap && !cancelled) {
            plaquePictographs = new Map([["lobby-first-pictograph", bitmap]]);
          } else {
            bitmap?.close();
          }
        } catch (error) {
          console.warn("[MuseumLobby3D] Pictograph preview unavailable:", error);
        }

        if (!cancelled) deferredReady = true;
      }, 0);
    });

    return () => {
      cancelled = true;
      if (mountFrame !== undefined) cancelAnimationFrame(mountFrame);
      if (mountTimer !== undefined) clearTimeout(mountTimer);
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
      for (const bitmap of plaquePictographs.values()) bitmap.close();
      releaseBackground("museum-lobby-review");
    };
  });
</script>

<svelte:head>
  <title>Walkable Entrance Lobby | The Kinetic Archive</title>
  <meta
    name="description"
    content="A walkable 3D spatial review of The Kinetic Archive entrance lobby."
  />
</svelte:head>

<main class="lobby-review museum-gold-scope">
  {#if deferredReady}
    {#await import("$lib/features/museum/components/game/DimensionFlipProof.svelte") then { default: DimensionFlipProof }}
      <DimensionFlipProof
        grid={plan.grid}
        edges={plan.edges}
        {plaquePictographs}
        startInFps
        initialCameraMode="first-person"
        cameraModePersistenceKey="museum-lobby-3d-camera-mode"
        persistenceKey="museum-lobby-3d-state-v3"
        onLoadProgress={handleLoadProgress}
        onBuildStage={handleBuildStage}
        onAllLoaded={handleAllLoaded}
        onWingChange={handleWingChange}
        onBack={() => goto("/test/museum-lobby-plan")}
        backAriaLabel="Back to the lobby floor plan"
      />
    {/await}
  {/if}

  {#if !showOverlay}
    <aside class="review-status" aria-label="Spatial review status">
      <span>Spatial review 01</span>
      <strong>{currentRoom}</strong>
      <small>Built from the approved 0.5 m planning grid</small>
    </aside>
  {/if}

  {#if showOverlay}
    <div
      class="loading-overlay"
      class:fading={overlayFading}
      role="status"
      aria-live="polite"
    >
      <div class="loading-mark" aria-hidden="true">
        <i class="fa-solid fa-landmark"></i>
      </div>
      <div class="loading-copy">
        <span>Entrance Lobby · Spatial Review 01</span>
        <h1>Turning the floor plan into a room</h1>
      </div>
      <div class="loading-progress">
        <ProgressBar
          percent={displayedPercent}
          label={stageLabel}
          showPercent
          color="rgba(200, 180, 140, 0.92)"
          height={4}
        />
      </div>
    </div>
  {/if}
</main>

<style>
  .lobby-review {
    --theme-accent: #c8b48c;
    --theme-card-bg: rgba(255, 255, 255, 0.08);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.12);
    --theme-stroke: rgba(200, 180, 140, 0.18);
    --theme-stroke-strong: rgba(200, 180, 140, 0.38);
    --theme-text: #f1ede3;
    --theme-text-dim: rgba(241, 237, 227, 0.58);
    --font-size-sm: 0.875rem;
    --font-size-compact: 0.75rem;
    --duration-fast: 150ms;
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #050505;
    color: var(--theme-text);
    color-scheme: dark;
    font-size: clamp(1rem, 0.75rem + 0.25vw, 1.5rem);
  }

  .review-status {
    position: absolute;
    top: calc(
      clamp(1rem, 0.5rem + 0.5vw, 2.25rem) +
        var(--museum-hud-top-offset, 0px)
    );
    right: clamp(1rem, 0.5rem + 0.5vw, 2.25rem);
    z-index: 80;
    display: grid;
    min-inline-size: min(17em, calc(100vw - 6.5em));
    gap: 0.18rem;
    padding: 0.65em 0.85em;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.55em;
    background: rgba(10, 10, 10, 0.72);
    backdrop-filter: blur(10px);
    pointer-events: none;
  }

  .review-status span,
  .loading-copy span {
    color: rgba(200, 180, 140, 0.72);
    font-size: 0.75em;
    font-weight: 760;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .review-status strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1em;
    font-weight: 500;
  }

  .review-status small {
    color: var(--theme-text-dim);
    font-size: 0.68em;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 200;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background:
      radial-gradient(circle at 50% 42%, rgba(93, 78, 50, 0.18), transparent 24rem),
      #050505;
    transition: opacity 550ms ease;
  }

  .loading-overlay.fading {
    opacity: 0;
    pointer-events: none;
  }

  .loading-mark {
    display: grid;
    inline-size: 3rem;
    block-size: 3rem;
    place-items: center;
    border: 1px solid rgba(200, 180, 140, 0.28);
    border-radius: 50%;
    color: rgba(200, 180, 140, 0.84);
    font-size: 1rem;
  }

  .loading-copy {
    display: grid;
    justify-items: center;
    gap: 0.45rem;
    text-align: center;
  }

  .loading-copy h1 {
    max-inline-size: 26rem;
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.35rem, 3vw, 2.15rem);
    font-weight: 400;
    line-height: 1.08;
  }

  .loading-progress {
    inline-size: min(22rem, calc(100vw - 3rem));
  }

  @media (max-width: 40rem) {
    .review-status {
      display: none;
    }
  }

  :global(html:has(.verification-banner)) .lobby-review {
    --museum-hud-top-offset: 4.5rem;
  }

  @media (max-width: 40rem) {
    :global(html:has(.verification-banner)) .lobby-review {
      --museum-hud-top-offset: 9rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-overlay {
      transition: none;
    }
  }
</style>
