<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import ProgressBar from "$lib/shared/components/loading/ProgressBar.svelte";
  import "$lib/features/museum/components/museum-theme.css";
  import {
    CAVE_MODE_ROOMS,
    buildVulcanCaveFloorPlan,
  } from "$lib/features/museum/data/vulcan-cave-floor-plan";
  import {
    releaseBackground,
    suppressBackground,
  } from "$lib/shared/background/shared/state/background-suppression.svelte";

  const plan = buildVulcanCaveFloorPlan();
  const modeByRoom = new Map<
    string,
    (typeof CAVE_MODE_ROOMS)[number] & { index: number }
  >(CAVE_MODE_ROOMS.map((mode, index) => [mode.roomId, { ...mode, index }]));

  const stageInfo: Record<string, { fraction: number; label: string }> = {
    "Tile bucketing": { fraction: 0.15, label: "Mapping the cave floor" },
    "Building corridors": {
      fraction: 0.4,
      label: "Carving the serpentine route",
    },
    "Building lobby": {
      fraction: 0.72,
      label: "Raising the cave chambers",
    },
    "Mounting fixtures": {
      fraction: 0.9,
      label: "Lighting six demonstrations",
    },
  };

  let deferredReady = $state(false);
  let showOverlay = $state(true);
  let overlayFading = $state(false);
  let textureFraction = $state(0);
  let geometryFraction = $state(0);
  let displayedPercent = $state(3);
  let stageLabel = $state("Preparing the walkthrough");
  let submerged = $state(false);
  let currentRoomId = $state<string | null>("cave-threshold");
  let currentRoomName = $state("Cave Threshold");
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let mountFrame: number | undefined;

  const currentMode = $derived(
    currentRoomId ? modeByRoom.get(currentRoomId) : undefined
  );
  const passageLabel = $derived.by(() => {
    if (currentMode) return currentMode.technicalMode;
    if (currentRoomId === "egypt-threshold")
      return "The route continues to Egypt";
    if (currentRoomId === "cave-threshold") return "Six demonstrations ahead";
    return "Approach passage";
  });

  $effect(() => {
    const blended = (geometryFraction * 0.72 + textureFraction * 0.28) * 100;
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
    stageLabel = "Cave ready";
    overlayFading = true;
    fadeTimer = setTimeout(() => {
      showOverlay = false;
    }, 550);
  }

  function handleWingChange(wingId: string | null): void {
    currentRoomId = wingId;
    currentRoomName =
      plan.grid.wings.find((wing) => wing.id === wingId)?.name ?? "Passage";
  }

  onMount(() => {
    suppressBackground("museum-cave-review");
    mountFrame = requestAnimationFrame(() => {
      deferredReady = true;
    });

    return () => {
      if (mountFrame !== undefined) cancelAnimationFrame(mountFrame);
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
      releaseBackground("museum-cave-review");
    };
  });
</script>

<svelte:head>
  <title>Walk the Vulcan Cave | The Kinetic Archive</title>
  <meta
    name="description"
    content="A walkable 3D spatial review of the six-chamber Vulcan Cave."
  />
</svelte:head>

<main class="cave-review museum-gold-scope">
  {#if deferredReady}
    {#await import("$lib/features/museum/components/game/DimensionFlipProof.svelte") then { default: DimensionFlipProof }}
      <DimensionFlipProof
        grid={plan.grid}
        edges={plan.edges}
        startInFps
        initialCameraMode="first-person"
        cameraModePersistenceKey="museum-cave-3d-camera-mode"
        persistenceKey="museum-cave-3d-state-v1"
        onLoadProgress={handleLoadProgress}
        onBuildStage={handleBuildStage}
        onAllLoaded={handleAllLoaded}
        onWingChange={handleWingChange}
        onSubmergedChange={(s) => (submerged = s)}
        onBack={() => goto("/test/museum-cave-plan")}
        backAriaLabel="Back to the Vulcan Cave floor plan"
      />
    {/await}
  {/if}

  {#if submerged}
    <div class="underwater-overlay" aria-hidden="true"></div>
  {/if}

  {#if !showOverlay}
    <aside class="route-status" aria-label="Cave route progress">
      <div class="status-copy">
        <span>
          {currentMode
            ? `Demonstration ${currentMode.index + 1} of ${CAVE_MODE_ROOMS.length}`
            : "Vulcan Cave walkthrough"}
        </span>
        <strong>{currentRoomName}</strong>
        <small>{passageLabel}</small>
      </div>
      <ol class="mode-track" aria-label="Six demonstration chambers">
        {#each CAVE_MODE_ROOMS as mode, index (mode.roomId)}
          <li
            class:active={currentMode?.index === index}
            class:passed={(currentMode?.index ?? -1) > index ||
              currentRoomId === "egypt-threshold"}
            title={`${index + 1}. ${mode.label}: ${mode.technicalMode}`}
          >
            <span class="sr-only">{mode.label}</span>
          </li>
        {/each}
      </ol>
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
        <i class="fa-solid fa-mountain"></i>
      </div>
      <div class="loading-copy">
        <span>Vulcan Cave · Spatial Review 02</span>
        <h1>Six chambers, tested at walking speed</h1>
        <p>One route. Six isolated demonstrations.</p>
      </div>
      <div class="loading-progress">
        <ProgressBar
          percent={displayedPercent}
          label={stageLabel}
          showPercent
          color="rgba(192, 137, 76, 0.92)"
          height={4}
        />
      </div>
    </div>
  {/if}
</main>

<style>
  .cave-review {
    --theme-accent: #c0894c;
    --theme-card-bg: rgba(28, 20, 14, 0.76);
    --theme-card-hover-bg: rgba(56, 39, 24, 0.82);
    --theme-stroke: rgba(210, 157, 98, 0.2);
    --theme-stroke-strong: rgba(210, 157, 98, 0.42);
    --theme-text: #f1e8dc;
    --theme-text-dim: rgba(241, 232, 220, 0.62);
    --font-size-sm: 0.875rem;
    --font-size-compact: 0.75rem;
    --duration-fast: 150ms;
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #030201;
    color: var(--theme-text);
    color-scheme: dark;
    font-size: clamp(1rem, 0.75rem + 0.25vw, 1.5rem);
  }

  .underwater-overlay {
    position: absolute;
    inset: 0;
    z-index: 60;
    pointer-events: none;
    background: radial-gradient(
      circle at 50% 55%,
      rgba(13, 58, 82, 0.18),
      rgba(6, 26, 38, 0.55) 78%
    );
    backdrop-filter: blur(1.5px) saturate(0.85);
  }

  .route-status {
    position: absolute;
    top: calc(
      clamp(1rem, 0.5rem + 0.5vw, 2.25rem) + var(--museum-hud-top-offset, 0px)
    );
    right: clamp(1rem, 0.5rem + 0.5vw, 2.25rem);
    z-index: 80;
    display: grid;
    min-inline-size: min(19em, calc(100vw - 6.5em));
    gap: 0.58rem;
    padding: 0.72em 0.9em 0.78em;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.55em;
    background: rgba(8, 5, 3, 0.76);
    backdrop-filter: blur(12px);
    pointer-events: none;
  }

  .status-copy {
    display: grid;
    gap: 0.16rem;
  }

  .status-copy > span,
  .loading-copy > span {
    color: rgba(210, 157, 98, 0.78);
    font-size: 0.75em;
    font-weight: 760;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .status-copy strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.05em;
    font-weight: 500;
  }

  .status-copy small {
    color: var(--theme-text-dim);
    font-size: 0.72em;
  }

  .mode-track {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.28rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .mode-track li {
    block-size: 0.22rem;
    border-radius: 999px;
    background: rgba(241, 232, 220, 0.16);
    transition:
      background 180ms ease,
      box-shadow 180ms ease;
  }

  .mode-track li.passed {
    background: rgba(210, 157, 98, 0.46);
  }

  .mode-track li.active {
    background: #d39d62;
    box-shadow: 0 0 0.7rem rgba(211, 157, 98, 0.52);
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
      radial-gradient(
        circle at 50% 42%,
        rgba(139, 84, 42, 0.2),
        transparent 25rem
      ),
      #030201;
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
    border: 1px solid rgba(210, 157, 98, 0.3);
    border-radius: 50%;
    color: rgba(210, 157, 98, 0.88);
    font-size: 1rem;
  }

  .loading-copy {
    display: grid;
    justify-items: center;
    gap: 0.42rem;
    text-align: center;
  }

  .loading-copy h1 {
    max-inline-size: 29rem;
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.4rem, 3vw, 2.25rem);
    font-weight: 400;
    line-height: 1.08;
  }

  .loading-copy p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.82em;
  }

  .loading-progress {
    inline-size: min(22rem, calc(100vw - 3rem));
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  :global(html:has(.verification-banner)) .cave-review {
    --museum-hud-top-offset: 4.5rem;
  }

  @media (max-width: 48rem) {
    .route-status {
      display: none;
    }

    :global(html:has(.verification-banner)) .cave-review {
      --museum-hud-top-offset: 9rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-overlay,
    .mode-track li {
      transition: none;
    }
  }
</style>
