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
  import { SOLID_TYPES } from "$lib/features/museum/services/museum-physics-provider";

  const plan = buildVulcanCaveFloorPlan();

  // ── Teleport ────────────────────────────────────────────────────────────────
  //
  // Walking the whole wing to review one chamber is a tax on every review. Both
  // entry points below seed the SAME sessionStorage key DimensionFlipProof
  // restores from, so neither needs a new prop on the walker:
  //
  //   /test/museum-cave-3d?room=cave-sun     — deep link straight into a room
  //   the chamber dots in the HUD            — click to jump while walking
  //
  // The walker validates that the restored tile is walkable and silently drops
  // the state if it is not, so a spawn in a wall would dump you at the cave
  // mouth with no explanation. Hence findWalkableTile: it uses the game's own
  // SOLID_TYPES predicate and searches outward from the room's centre.
  const CAVE_STATE_KEY = "museum-cave-3d-state-v1";
  /** Must match DimensionFlipProof's own TILE_SIZE, or the spawn lands in rock. */
  const TILE_SIZE = 0.5;

  function findWalkableTile(roomId: string): { x: number; y: number } | null {
    const wing = plan.grid.wings.find((w) => w.id === roomId);
    if (!wing) return null;
    const cx = Math.round(wing.bounds.x + wing.bounds.width / 2);
    const cy = Math.round(wing.bounds.y + wing.bounds.height / 2);
    const walkable = (x: number, y: number) => {
      const tile = plan.grid.tiles.get(`${x},${y}`);
      return !!tile && !SOLID_TYPES.has(tile.type);
    };
    if (walkable(cx, cy)) return { x: cx, y: cy };
    // Expanding ring search — the centre of a room can be a pillar, a pit or,
    // in the Sundial's case, the collapse ring the visitor cannot stand in.
    const limit = Math.max(wing.bounds.width, wing.bounds.height);
    for (let r = 1; r <= limit; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (walkable(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return null;
  }

  /** Seed the walker's restore key. Returns false if the room has no floor. */
  function seedSpawn(roomId: string): boolean {
    const tile = findWalkableTile(roomId);
    if (!tile) return false;
    try {
      sessionStorage.setItem(
        CAVE_STATE_KEY,
        JSON.stringify({
          playerWorldX: tile.x * TILE_SIZE,
          playerWorldZ: tile.y * TILE_SIZE,
          viewMode: "first-person",
          isInFPS: true,
          topDownHeight: 40,
          // yaw 0 faces +Z (south) — the direction of travel through the wing.
          playerYaw: 0,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  function teleportTo(roomId: string) {
    if (seedSpawn(roomId)) location.reload();
  }
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
  let deepLinkedRoom = $state<string | null>(null);
  let deepLinkFailed = $state<string | null>(null);
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

    // Seed before the walker mounts — it reads the key once, at init.
    const requested = new URL(location.href).searchParams.get("room");
    if (requested) {
      if (seedSpawn(requested)) {
        deepLinkedRoom = requested;
      } else {
        deepLinkFailed = requested;
      }
    }

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
      <ol class="mode-track" aria-label="Jump to a demonstration chamber">
        {#each CAVE_MODE_ROOMS as mode, index (mode.roomId)}
          <li>
            <button
              type="button"
              class="mode-dot"
              class:active={currentMode?.index === index}
              class:passed={(currentMode?.index ?? -1) > index ||
                currentRoomId === "egypt-threshold"}
              title={`Jump to ${index + 1}. ${mode.label} — ${mode.technicalMode}`}
              aria-label={`Jump to ${mode.label}, ${mode.technicalMode}`}
              aria-current={currentMode?.index === index ? "location" : undefined}
              onclick={() => teleportTo(mode.roomId)}
            >
              <span class="sr-only">{mode.label}</span>
            </button>
          </li>
        {/each}
      </ol>
      <small class="jump-hint">
        {#if deepLinkFailed}
          No walkable floor in “{deepLinkFailed}” — started at the cave mouth
        {:else if deepLinkedRoom}
          Jumped straight to {modeByRoom.get(deepLinkedRoom)?.label ?? deepLinkedRoom}
        {:else}
          Click a chamber to jump there
        {/if}
      </small>
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
    display: flex;
  }

  /* The dot IS the control now. A 0.22rem bar is far under the 44px touch
     floor, so the button keeps that visual height and reaches its real target
     with padding plus a transparent border-box. */
  .mode-dot {
    flex: 1;
    appearance: none;
    border: 0;
    padding-block: 0.6rem;
    padding-inline: 0;
    background: none;
    cursor: pointer;
    position: relative;
    min-block-size: 44px;
    display: flex;
    align-items: center;
  }

  .mode-dot::before {
    content: "";
    display: block;
    inline-size: 100%;
    block-size: 0.22rem;
    border-radius: 999px;
    background: rgba(241, 232, 220, 0.16);
    transition:
      background 180ms ease,
      box-shadow 180ms ease,
      transform 180ms ease;
  }

  .mode-dot.passed::before {
    background: rgba(210, 157, 98, 0.46);
  }

  .mode-dot.active::before {
    background: #d39d62;
    box-shadow: 0 0 0.7rem rgba(211, 157, 98, 0.52);
  }

  .mode-dot:hover::before,
  .mode-dot:focus-visible::before {
    background: #f1e8dc;
    transform: scaleY(2);
  }

  .mode-dot:focus-visible {
    outline: 2px solid #d39d62;
    outline-offset: 2px;
    border-radius: 4px;
  }

  .jump-hint {
    display: block;
    margin-block-start: 0.1rem;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(241, 232, 220, 0.38);
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
