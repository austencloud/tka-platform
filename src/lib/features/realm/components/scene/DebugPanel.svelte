<script lang="ts">
  /**
   * DebugPanel
   *
   * Modern debug/teleport GUI for exploring infinite worlds.
   * Shows current position, biome, and provides quick teleport to different biomes.
   */
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";

  interface Props {
    position: { x: number; y: number; z: number };
    biome: string;
    onTeleport: (x: number, y: number, z: number) => void;
    onToggleWater?: (visible: boolean) => void;
    onToggleFog?: (enabled: boolean) => void;
  }

  let {
    position,
    biome,
    onTeleport,
    onToggleWater,
    onToggleFog,
  }: Props = $props();

  let waterVisible = $state(true);
  let fogEnabled = $state(true);
  let isCollapsed = $state(false);

  // Biome teleport presets with icons
  const BIOME_PRESETS = [
    { name: "Forest", x: 0, y: 60, z: 0, color: "#22c55e", icon: "fa-tree" },
    { name: "Plains", x: 500, y: 60, z: 500, color: "#84cc16", icon: "fa-seedling" },
    { name: "Mountains", x: 0, y: 80, z: 1500, color: "#94a3b8", icon: "fa-mountain" },
    { name: "Desert", x: 2000, y: 60, z: 0, color: "#f59e0b", icon: "fa-sun" },
    { name: "Ocean", x: -800, y: 60, z: -800, color: "#0ea5e9", icon: "fa-water" },
  ];

  function handleTeleport(preset: (typeof BIOME_PRESETS)[0]) {
    onTeleport(preset.x, preset.y, preset.z);
  }

  function handleToggleWater() {
    waterVisible = !waterVisible;
    onToggleWater?.(waterVisible);
  }

  function handleToggleFog() {
    fogEnabled = !fogEnabled;
    onToggleFog?.(fogEnabled);
  }

  function formatCoord(val: number): string {
    return val.toFixed(1);
  }

  const currentBiomeColor = $derived(
    BIOME_PRESETS.find((p) => p.name.toLowerCase() === biome)?.color ?? "#64748b"
  );
</script>

<div class="debug-panel" class:collapsed={isCollapsed}>
  <button
    class="collapse-btn"
    onclick={() => (isCollapsed = !isCollapsed)}
    aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
  >
    <i class="fas {isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}" aria-hidden="true"></i>
  </button>

  {#if !isCollapsed}
    <!-- Position Section -->
    <div class="section">
      <div class="section-header">
        <i class="fas fa-location-dot" aria-hidden="true"></i>
        <span>Position</span>
      </div>
      <div class="coords-grid">
        <div class="coord-item">
          <span class="coord-label">X</span>
          <span class="coord-value">{formatCoord(position.x)}</span>
        </div>
        <div class="coord-item">
          <span class="coord-label">Y</span>
          <span class="coord-value">{formatCoord(position.y)}</span>
        </div>
        <div class="coord-item">
          <span class="coord-label">Z</span>
          <span class="coord-value">{formatCoord(position.z)}</span>
        </div>
      </div>
    </div>

    <!-- Biome Section -->
    <div class="section">
      <div class="section-header">
        <i class="fas fa-globe" aria-hidden="true"></i>
        <span>Current Biome</span>
      </div>
      <div class="biome-pill" style="--biome-color: {currentBiomeColor}">
        <span class="biome-dot"></span>
        <span class="biome-name">{biome || "Unknown"}</span>
      </div>
    </div>

    <!-- Teleport Section -->
    <div class="section">
      <div class="section-header">
        <i class="fas fa-bolt" aria-hidden="true"></i>
        <span>Quick Travel</span>
      </div>
      <div class="teleport-grid">
        {#each BIOME_PRESETS as preset}
          <button
            class="teleport-chip"
            class:active={biome === preset.name.toLowerCase()}
            style="--chip-color: {preset.color}"
            onclick={() => handleTeleport(preset)}
            aria-label="Teleport to {preset.name}"
          >
            <i class="fas {preset.icon}" aria-hidden="true"></i>
            <span>{preset.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Environment Toggles -->
    <div class="section">
      <div class="section-header">
        <i class="fas fa-sliders" aria-hidden="true"></i>
        <span>Environment</span>
      </div>
      <div class="toggle-chips">
        <ChipToggle
          label="Water"
          icon="fa-droplet"
          active={waterVisible}
          color="cyan"
          size="sm"
          onclick={handleToggleWater}
        />
        <ChipToggle
          label="Fog"
          icon="fa-cloud"
          active={fogEnabled}
          color="gray"
          size="sm"
          onclick={handleToggleFog}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(15, 15, 25, 0.95);
    padding: 16px;
    border-radius: 16px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: white;
    min-width: 200px;
    max-width: 240px;
    z-index: 100;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    backdrop-filter: blur(12px);
  }

  .debug-panel.collapsed {
    min-width: auto;
    padding: 12px;
  }

  .collapse-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: all var(--duration-fast) ease;
  }

  .collapse-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .collapse-btn:active {
    transform: scale(0.95);
  }

  /* Sections */
  .section {
    margin-bottom: 16px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }

  .section-header i {
    font-size: 10px;
    opacity: 0.7;
  }

  /* Position Coordinates */
  .coords-grid {
    display: flex;
    gap: 8px;
  }

  .coord-item {
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 8px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .coord-label {
    display: block;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
    margin-bottom: 2px;
  }

  .coord-value {
    display: block;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 13px;
    color: #60a5fa;
    font-weight: 500;
  }

  /* Biome Badge */
  .biome-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .biome-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--biome-color, #64748b);
    box-shadow: 0 0 8px var(--biome-color, #64748b);
  }

  .biome-name {
    font-weight: 600;
    text-transform: capitalize;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
  }

  /* Teleport Chips */
  .teleport-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .teleport-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all var(--duration-fast) ease;
    font-family: inherit;
  }

  .teleport-chip i {
    font-size: 11px;
    color: var(--chip-color, #64748b);
    transition: color var(--duration-fast) ease;
  }

  .teleport-chip:hover {
    background: color-mix(in srgb, var(--chip-color, #64748b) 20%, transparent);
    border-color: var(--chip-color, #64748b);
    color: white;
  }

  .teleport-chip:hover i {
    color: var(--chip-color, #64748b);
    filter: brightness(1.2);
  }

  .teleport-chip:active {
    transform: scale(0.97);
  }

  .teleport-chip.active {
    background: color-mix(in srgb, var(--chip-color, #64748b) 25%, transparent);
    border-color: var(--chip-color, #64748b);
    color: white;
  }

  .teleport-chip.active i {
    color: var(--chip-color, #64748b);
  }

  /* Toggle Chips */
  .toggle-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* Focus states */
  .collapse-btn:focus-visible,
  .teleport-chip:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .collapse-btn,
    .teleport-chip,
    .biome-dot {
      transition: none;
    }
  }
</style>
