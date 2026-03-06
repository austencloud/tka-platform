<script lang="ts">
  /**
   * DebugPanelTabs - Horizontal top bar debug panel for realm
   *
   * Spans full width at top of screen with icon tabs.
   * Seven tabs: Stats, Travel, Environment, Terrain, Vegetation, Physics, Camera
   * Touch targets: var(--min-touch-target) minimum for accessibility
   * Keyboard shortcuts: 1-7 for tabs, Escape to close, F for fog, G for fly
   */
  import StatsTab from "./StatsTab.svelte";
  import EnvironmentTab from "./EnvironmentTab.svelte";
  import TerrainTab from "./TerrainTab.svelte";
  import VegetationTab from "./VegetationTab.svelte";
  import PhysicsTab from "./PhysicsTab.svelte";
  import CameraTab from "./CameraTab.svelte";
  import TeleportTab from "./TeleportTab.svelte";

  interface ChunkStats {
    loaded: number;
    pending: number;
    loading: number;
  }

  interface VegetationStats {
    trees: number;
    rocks: number;
    bushes: number;
    grass: number;
  }

  interface AtmosphereState {
    fogEnabled: boolean;
    currentBiome: string;
    fogDensity: number;
    fogColor: string;
  }

  interface WaterState {
    visible: boolean;
    waterLevel: number;
    color: string;
    opacity: number;
  }

  interface Props {
    // Stats
    fps: number;
    chunkStats: ChunkStats;
    vegetationStats: VegetationStats;
    colliderCount: number;
    position: { x: number; y: number; z: number };
    biome: string;
    seed: string;
    // Environment
    fogEnabled: boolean;
    waterVisible: boolean;
    texturesEnabled: boolean;
    texturesLoaded: boolean;
    atmosphereState: AtmosphereState | null;
    waterState: WaterState | null;
    onToggleFog: () => void;
    onToggleWater: () => void;
    onToggleTextures: () => void;
    // Terrain
    viewDistance: number;
    chunkSize: number;
    onViewDistanceChange?: (distance: number) => void;
    // Vegetation
    treesEnabled: boolean;
    grassEnabled: boolean;
    rocksEnabled: boolean;
    bushesEnabled: boolean;
    onToggleTrees: () => void;
    onToggleGrass: () => void;
    onToggleRocks: () => void;
    onToggleBushes: () => void;
    // Physics
    noclipEnabled: boolean;
    isGrounded: boolean;
    walkSpeed: number;
    sprintSpeed: number;
    onToggleNoclip: () => void;
    // Camera
    cameraMode: "first-person" | "third-person" | "orbit";
    fov: number;
    sensitivity: number;
    onModeChange?: (mode: "first-person" | "third-person" | "orbit") => void;
    onFovChange?: (fov: number) => void;
    onSensitivityChange?: (sensitivity: number) => void;
    // Teleport
    onTeleport: (x: number, y: number, z: number) => void;
    // Panel
    onClose: () => void;
  }

  let {
    fps,
    chunkStats,
    vegetationStats,
    colliderCount,
    position,
    biome,
    seed,
    fogEnabled,
    waterVisible,
    texturesEnabled,
    texturesLoaded,
    atmosphereState,
    waterState,
    onToggleFog,
    onToggleWater,
    onToggleTextures,
    viewDistance,
    chunkSize,
    onViewDistanceChange,
    treesEnabled,
    grassEnabled,
    rocksEnabled,
    bushesEnabled,
    onToggleTrees,
    onToggleGrass,
    onToggleRocks,
    onToggleBushes,
    noclipEnabled,
    isGrounded,
    walkSpeed,
    sprintSpeed,
    onToggleNoclip,
    cameraMode,
    fov,
    sensitivity,
    onModeChange,
    onFovChange,
    onSensitivityChange,
    onTeleport,
    onClose,
  }: Props = $props();

  type TabId = "stats" | "environment" | "terrain" | "vegetation" | "physics" | "camera" | "teleport";

  const tabs: Array<{ id: TabId; label: string; icon: string; color: string; shortcut: string }> = [
    { id: "stats", label: "Stats", icon: "fa-chart-line", color: "#60a5fa", shortcut: "1" },
    { id: "teleport", label: "Travel", icon: "fa-location-crosshairs", color: "#f59e0b", shortcut: "2" },
    { id: "environment", label: "Env", icon: "fa-cloud-sun", color: "#0ea5e9", shortcut: "3" },
    { id: "terrain", label: "Terrain", icon: "fa-mountain", color: "#94a3b8", shortcut: "4" },
    { id: "vegetation", label: "Veg", icon: "fa-tree", color: "#22c55e", shortcut: "5" },
    { id: "physics", label: "Physics", icon: "fa-atom", color: "#f97316", shortcut: "6" },
    { id: "camera", label: "Camera", icon: "fa-video", color: "#a78bfa", shortcut: "7" },
  ];

  let activeTab = $state<TabId>("stats");
  let panelExpanded = $state(true);

  function handleKeydown(e: KeyboardEvent) {
    // Don't handle if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // Number keys 1-7 for tab switching
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= tabs.length) {
      const selectedTab = tabs[num - 1];
      if (selectedTab) {
        e.preventDefault();
        activeTab = selectedTab.id;
        panelExpanded = true;
      }
      return;
    }

    // Escape to close
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    // F to toggle fog
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      onToggleFog();
      return;
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function togglePanel() {
    panelExpanded = !panelExpanded;
  }

  function selectTab(id: TabId) {
    if (activeTab === id && panelExpanded) {
      panelExpanded = false;
    } else {
      activeTab = id;
      panelExpanded = true;
    }
  }
</script>

<div class="debug-panel" style="--active-color: {tabs.find(t => t.id === activeTab)?.color ?? '#60a5fa'}">
  <!-- Single unified panel -->
  <div class="panel-container">
    <!-- Header Row: FPS + Tabs + Close -->
    <div class="panel-header">
      <div class="fps-badge" class:good={fps >= 55} class:warning={fps >= 30 && fps < 55} class:bad={fps < 30}>
        <span class="fps-value">{fps}</span>
        <span class="fps-unit">FPS</span>
      </div>

      <div class="tab-buttons" role="tablist">
        {#each tabs as tab}
          <button
            class="tab-btn"
            class:active={activeTab === tab.id && panelExpanded}
            style="--tab-color: {tab.color}"
            onclick={() => selectTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id && panelExpanded}
            aria-controls="panel-{tab.id}"
            title="{tab.label} ({tab.shortcut})"
          >
            <i class="fas {tab.icon}" aria-hidden="true"></i>
            <span class="tab-label">{tab.label}</span>
          </button>
        {/each}
      </div>

      <button class="close-btn" onclick={onClose} aria-label="Close debug panel (press backtick to reopen)" title="Close (` to reopen)">
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Expanded Content Row - flows directly below header -->
    {#if panelExpanded}
      <div class="panel-content">
        {#if activeTab === "stats"}
          <div id="panel-stats" role="tabpanel">
            <StatsTab
              {fps}
              {chunkStats}
              {vegetationStats}
              {colliderCount}
              {position}
              {biome}
              {seed}
              {fogEnabled}
              {waterVisible}
            />
          </div>
        {:else if activeTab === "teleport"}
          <div id="panel-teleport" role="tabpanel">
            <TeleportTab currentBiome={biome} {position} {onTeleport} />
          </div>
        {:else if activeTab === "environment"}
          <div id="panel-environment" role="tabpanel">
            <EnvironmentTab
              {fogEnabled}
              {waterVisible}
              {texturesEnabled}
              {texturesLoaded}
              {atmosphereState}
              {waterState}
              {onToggleFog}
              {onToggleWater}
              {onToggleTextures}
            />
          </div>
        {:else if activeTab === "terrain"}
          <div id="panel-terrain" role="tabpanel">
            <TerrainTab {chunkStats} {viewDistance} {chunkSize} {onViewDistanceChange} />
          </div>
        {:else if activeTab === "vegetation"}
          <div id="panel-vegetation" role="tabpanel">
            <VegetationTab
              {vegetationStats}
              {treesEnabled}
              {grassEnabled}
              {rocksEnabled}
              {bushesEnabled}
              {onToggleTrees}
              {onToggleGrass}
              {onToggleRocks}
              {onToggleBushes}
            />
          </div>
        {:else if activeTab === "physics"}
          <div id="panel-physics" role="tabpanel">
            <PhysicsTab
              {noclipEnabled}
              {isGrounded}
              {colliderCount}
              {walkSpeed}
              {sprintSpeed}
              {onToggleNoclip}
            />
          </div>
        {:else if activeTab === "camera"}
          <div id="panel-camera" role="tabpanel">
            <CameraTab
              {cameraMode}
              {fov}
              {sensitivity}
              {position}
              {onModeChange}
              {onFovChange}
              {onSensitivityChange}
            />
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .debug-panel {
    position: fixed;
    top: 16px;
    /* Fill the 3D space area (to the right of the sidebar) */
    left: calc(var(--desktop-sidebar-width, 0px) + 16px);
    right: 16px;
    z-index: 1000;
  }

  /* Unified container for header + content */
  .panel-container {
    background: linear-gradient(135deg, rgba(30, 30, 45, 0.95) 0%, rgba(20, 20, 35, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    backdrop-filter: blur(20px);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    overflow: hidden;
  }

  /* Header Row */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
  }

  /* FPS Badge */
  .fps-badge {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.3);
    min-width: 70px;
  }

  .fps-value {
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 18px;
    font-weight: 700;
  }

  .fps-unit {
    font-size: 11px;
    font-weight: 600;
    opacity: 0.6;
  }

  .fps-badge.good {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(34, 197, 94, 0.1) 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .fps-badge.good .fps-value { color: #4ade80; }

  .fps-badge.warning {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0.1) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .fps-badge.warning .fps-value { color: #fbbf24; }

  .fps-badge.bad {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0.1) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .fps-badge.bad .fps-value { color: #f87171; }

  /* Tab Buttons */
  .tab-buttons {
    display: flex;
    gap: 6px;
    flex: 1;
    justify-content: center;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    min-height: var(--min-touch-target);
    background: transparent;
    border: 2px solid transparent;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .tab-btn i {
    font-size: 16px;
    transition: transform 0.2s ease;
  }

  .tab-label {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-2px);
  }

  .tab-btn:hover i {
    transform: scale(1.1);
  }

  .tab-btn.active {
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--tab-color) 30%, transparent) 0%,
      color-mix(in srgb, var(--tab-color) 15%, transparent) 100%);
    border-color: color-mix(in srgb, var(--tab-color) 50%, transparent);
    color: var(--tab-color);
    box-shadow: 0 0 20px color-mix(in srgb, var(--tab-color) 25%, transparent);
  }

  .tab-btn.active i {
    filter: drop-shadow(0 0 8px var(--tab-color));
  }

  /* Close Button */
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .close-btn i {
    font-size: 16px;
  }

  .close-btn:hover {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%);
    border-color: rgba(239, 68, 68, 0.5);
    color: #f87171;
    transform: translateY(-2px);
  }

  /* Panel Content - flows below header within the same container */
  .panel-content {
    padding: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    max-height: 400px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--active-color) transparent;
    /* Content area is fixed width but aligned to left of panel */
    max-width: 380px;
  }

  .panel-content::-webkit-scrollbar {
    width: 6px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--active-color) 50%, transparent);
    border-radius: 3px;
  }

  /* Tab Title - removed unused styles (no .tab-title element in markup) */

  /* Focus states */
  .tab-btn:focus-visible,
  .close-btn:focus-visible {
    outline: 2px solid var(--active-color, #60a5fa);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tab-btn,
    .close-btn,
    .tab-btn i {
      transition: none;
    }
    .tab-btn:hover,
    .close-btn:hover {
      transform: none;
    }
  }

  /* Tablet - hide labels, show only icons */
  @media (max-width: 900px) {
    .tab-label {
      display: none;
    }

    .tab-btn {
      padding: 8px 12px;
    }
  }

  /* Mobile adjustments - no sidebar on mobile */
  @media (max-width: 480px) {
    .debug-panel {
      top: 8px;
      left: 8px;
      right: 8px;
    }

    .panel-header {
      padding: 6px;
      gap: 6px;
    }

    .fps-badge {
      padding: 6px 10px;
      min-width: 60px;
    }

    .fps-value {
      font-size: 16px;
    }

    .tab-btn {
      padding: 6px 10px;
      min-height: 44px;
    }

    .tab-btn i {
      font-size: 14px;
    }

    .close-btn {
      width: 44px;
      height: 44px;
    }

    .panel-content {
      width: 100%;
    }
  }
</style>
