<!--
  MultiGridLabModule.svelte - Multi-Grid Topology Lab

  An experimental module where users can explore N-grid arrangements:
  - Select from preset topologies (2-in-a-row, 3-in-a-row, 2x2, skewed, mixed)
  - See grids rendered with auto-detected junctions
  - Blue and red props placed at hand points across all grids
  - Auto-cycle through all valid position pair combinations
  - Click hand points to manually place props
  - Support for diamond, box, and skewed grid modes

  Layout: controls panel on the left, canvas on the right (stacks on mobile).
-->
<script lang="ts">
  import type { GridTopology, PointRef } from "$lib/shared/multi-grid/domain/models/GridTopology";
  import type { TopologyPropRenderData } from "$lib/shared/multi-grid/services/contracts/ITopologyPropLoader";
  import type { BetaOffset } from "$lib/shared/multi-grid/services/contracts/ITopologyBetaSeparator";
  import { TOPOLOGY_PRESETS } from "$lib/shared/multi-grid/domain/constants/TopologyPresets";
  import { TopologyPositionEnumerator } from "$lib/shared/multi-grid/services/implementations/TopologyPositionEnumerator";
  import { TopologyPropLoader } from "$lib/shared/multi-grid/services/implementations/TopologyPropLoader";
  import { TopologyBetaSeparator } from "$lib/shared/multi-grid/services/implementations/TopologyBetaSeparator";
  import TopologyCanvas from "$lib/shared/multi-grid/components/TopologyCanvas.svelte";
  import TopologyControls from "$lib/shared/multi-grid/components/TopologyControls.svelte";

  // Services (lightweight, no DI needed for lab usage)
  const enumerator = new TopologyPositionEnumerator();
  const propLoader = new TopologyPropLoader();
  const betaSeparator = new TopologyBetaSeparator();

  // ============================================================================
  // TOPOLOGY STATE
  // ============================================================================

  const defaultPreset = TOPOLOGY_PRESETS[0]!;
  let selectedPresetId = $state(defaultPreset.id);
  let darkMode = $state(true);

  const currentPreset = $derived(
    TOPOLOGY_PRESETS.find((p) => p.id === selectedPresetId) ?? defaultPreset,
  );

  const topology = $derived<GridTopology>(currentPreset.build());

  // ============================================================================
  // POSITION ENUMERATION
  // ============================================================================

  const allPairs = $derived(enumerator.enumeratePositionPairs(topology));
  const totalPairs = $derived(allPairs.length);

  // ============================================================================
  // PLAYBACK STATE
  // ============================================================================

  let currentPairIndex = $state(0);
  let isPlaying = $state(false);
  let playbackSpeed = $state(800); // ms between advances

  // Current pair from either auto-cycle or manual placement
  let manualBlueRef = $state<PointRef | null>(null);
  let manualRedRef = $state<PointRef | null>(null);
  let useManualPlacement = $state(false);

  const currentPair = $derived(
    allPairs.length > 0
      ? allPairs[currentPairIndex % allPairs.length]
      : null,
  );

  const blueRef = $derived<PointRef | null>(
    useManualPlacement && manualBlueRef ? manualBlueRef : (currentPair?.blue ?? null),
  );
  const redRef = $derived<PointRef | null>(
    useManualPlacement && manualRedRef ? manualRedRef : (currentPair?.red ?? null),
  );

  // Reset pair index when topology changes
  $effect(() => {
    // Subscribe to topology changes by reading allPairs
    void allPairs.length;
    currentPairIndex = 0;
    useManualPlacement = false;
  });

  // Auto-advance playback
  $effect(() => {
    if (!isPlaying || totalPairs === 0) return;

    const interval = setInterval(() => {
      currentPairIndex = (currentPairIndex + 1) % totalPairs;
      useManualPlacement = false;
    }, playbackSpeed);

    return () => clearInterval(interval);
  });

  // ============================================================================
  // PROP LOADING
  // ============================================================================

  let bluePropData = $state<TopologyPropRenderData | null>(null);
  let redPropData = $state<TopologyPropRenderData | null>(null);

  // Load prop data when blue/red refs or topology change
  $effect(() => {
    const bRef = blueRef;
    if (!bRef) {
      bluePropData = null;
      return;
    }

    const grid = topology.grids.find((g) => g.id === bRef.gridId);
    if (!grid) {
      bluePropData = null;
      return;
    }

    propLoader
      .loadProp(bRef.location, grid.mode, "blue", "staff", darkMode)
      .then((data) => { bluePropData = data; });
  });

  $effect(() => {
    const rRef = redRef;
    if (!rRef) {
      redPropData = null;
      return;
    }

    const grid = topology.grids.find((g) => g.id === rRef.gridId);
    if (!grid) {
      redPropData = null;
      return;
    }

    propLoader
      .loadProp(rRef.location, grid.mode, "red", "staff", darkMode)
      .then((data) => { redPropData = data; });
  });

  // ============================================================================
  // BETA SEPARATION
  // ============================================================================

  const betaOffset = $derived.by<BetaOffset | null>(() => {
    const bRef = blueRef;
    const rRef = redRef;
    if (!bRef || !rRef) return null;

    return betaSeparator.calculateOffset(
      topology,
      bRef,
      rRef,
      "staff",
      topology.grids[0]?.mode ?? "diamond",
    );
  });

  // ============================================================================
  // PLACEMENT MODE
  // ============================================================================

  let placementMode = $state<"blue" | "red">("blue");
  let clickToPlaceEnabled = $state(false);

  function handlePointClick(ref: PointRef) {
    if (!clickToPlaceEnabled) return;

    isPlaying = false;
    useManualPlacement = true;

    if (placementMode === "blue") {
      manualBlueRef = ref;
    } else {
      manualRedRef = ref;
    }
  }

  // ============================================================================
  // CONTROL HANDLERS
  // ============================================================================

  function handlePresetChange(presetId: string) {
    selectedPresetId = presetId;
    isPlaying = false;
  }

  function handleDarkModeToggle() {
    darkMode = !darkMode;
  }

  function handleTogglePlay() {
    if (useManualPlacement) {
      // Exit manual mode, resume from current index
      useManualPlacement = false;
    }
    isPlaying = !isPlaying;
  }

  function handleStepForward() {
    isPlaying = false;
    useManualPlacement = false;
    currentPairIndex = (currentPairIndex + 1) % Math.max(1, totalPairs);
  }

  function handleStepBack() {
    isPlaying = false;
    useManualPlacement = false;
    currentPairIndex = (currentPairIndex - 1 + totalPairs) % Math.max(1, totalPairs);
  }

  function handleSpeedChange(speed: number) {
    playbackSpeed = speed;
  }

  function handlePairIndexChange(index: number) {
    currentPairIndex = index;
    useManualPlacement = false;
  }

  function handlePlacementModeChange(mode: "blue" | "red") {
    placementMode = mode;
  }

  function handleClickToPlaceToggle() {
    clickToPlaceEnabled = !clickToPlaceEnabled;
    if (clickToPlaceEnabled) {
      isPlaying = false;
    }
  }
</script>

<div class="multi-grid-lab">
  <div class="controls-panel">
    <div class="panel-header">
      <h2>Multi-Grid Topology</h2>
      <p class="panel-subtitle">Level 7: Conjoined grid arrangements</p>
    </div>
    <TopologyControls
      {selectedPresetId}
      {topology}
      {darkMode}
      onPresetChange={handlePresetChange}
      onDarkModeToggle={handleDarkModeToggle}
      {totalPairs}
      {currentPairIndex}
      {isPlaying}
      {playbackSpeed}
      onTogglePlay={handleTogglePlay}
      onStepForward={handleStepForward}
      onStepBack={handleStepBack}
      onSpeedChange={handleSpeedChange}
      onPairIndexChange={handlePairIndexChange}
      {placementMode}
      {clickToPlaceEnabled}
      onPlacementModeChange={handlePlacementModeChange}
      onClickToPlaceToggle={handleClickToPlaceToggle}
    />
  </div>

  <div class="canvas-panel">
    <TopologyCanvas
      {topology}
      {darkMode}
      showGrid={true}
      showLabels={true}
      showJunctions={true}
      showProps={true}
      {blueRef}
      {redRef}
      {bluePropData}
      {redPropData}
      {betaOffset}
      onPointClick={handlePointClick}
      clickTargetsEnabled={clickToPlaceEnabled}
    />
  </div>
</div>

<style>
  .multi-grid-lab {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .controls-panel {
    width: 280px;
    min-width: 240px;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) var(--scrollbar-track, transparent);
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-header h2 {
    font-size: 16px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .panel-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 4px 0 0;
  }

  .canvas-panel {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  /* Mobile: stack vertically */
  @media (max-width: 768px) {
    .multi-grid-lab {
      flex-direction: column;
    }

    .controls-panel {
      width: 100%;
      min-width: unset;
      max-height: 40vh;
      border-right: none;
      border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .canvas-panel {
      flex: 1;
    }
  }
</style>
