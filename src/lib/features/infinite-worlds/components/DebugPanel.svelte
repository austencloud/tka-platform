<script lang="ts">
  /**
   * DebugPanel
   *
   * Debug/teleport GUI for exploring infinite worlds.
   * Shows current position, biome, and provides quick teleport to different biomes.
   */

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

  // Biome teleport presets (x, y, z)
  const BIOME_PRESETS = [
    { name: "Forest", x: 0, y: 60, z: 0, color: "#2d5a27" },
    { name: "Plains", x: 500, y: 60, z: 500, color: "#7cb342" },
    { name: "Mountains", x: 0, y: 80, z: 1500, color: "#78909c" },
    { name: "Desert", x: 2000, y: 60, z: 0, color: "#d4a373" },
    { name: "Ocean", x: -800, y: 60, z: -800, color: "#1a6b8a" },
  ];

  function handleTeleport(preset: typeof BIOME_PRESETS[0]) {
    onTeleport(preset.x, preset.y, preset.z);
  }

  function toggleWater() {
    waterVisible = !waterVisible;
    onToggleWater?.(waterVisible);
  }

  function toggleFog() {
    fogEnabled = !fogEnabled;
    onToggleFog?.(fogEnabled);
  }

  function formatCoord(val: number): string {
    return val.toFixed(1);
  }
</script>

<div class="debug-panel" class:collapsed={isCollapsed}>
  <button class="collapse-btn" onclick={() => isCollapsed = !isCollapsed}>
    {isCollapsed ? "+" : "-"}
  </button>

  {#if !isCollapsed}
    <div class="section">
      <div class="section-title">Position</div>
      <div class="coords">
        <span class="coord">X: {formatCoord(position.x)}</span>
        <span class="coord">Y: {formatCoord(position.y)}</span>
        <span class="coord">Z: {formatCoord(position.z)}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Current Biome</div>
      <div class="biome-badge" style="--biome-color: {BIOME_PRESETS.find(p => p.name.toLowerCase() === biome)?.color ?? '#666'}">
        {biome || "Unknown"}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Teleport</div>
      <div class="teleport-grid">
        {#each BIOME_PRESETS as preset}
          <button
            class="teleport-btn"
            style="--btn-color: {preset.color}"
            onclick={() => handleTeleport(preset)}
          >
            {preset.name}
          </button>
        {/each}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Toggles</div>
      <div class="toggles">
        <label class="toggle">
          <input type="checkbox" checked={waterVisible} onchange={toggleWater} />
          <span>Water</span>
        </label>
        <label class="toggle">
          <input type="checkbox" checked={fogEnabled} onchange={toggleFog} />
          <span>Fog</span>
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(0, 0, 0, 0.85);
    padding: 12px 16px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 12px;
    color: white;
    min-width: 180px;
    z-index: 100;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .debug-panel.collapsed {
    min-width: auto;
    padding: 8px 12px;
  }

  .collapse-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }

  .collapse-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .section {
    margin-bottom: 12px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .coords {
    display: flex;
    gap: 12px;
  }

  .coord {
    color: #60a5fa;
  }

  .biome-badge {
    display: inline-block;
    padding: 4px 10px;
    background: var(--biome-color, #666);
    border-radius: 4px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .teleport-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .teleport-btn {
    padding: 6px 10px;
    background: var(--btn-color, #444);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: filter 0.15s;
  }

  .teleport-btn:hover {
    filter: brightness(1.2);
  }

  .teleport-btn:active {
    filter: brightness(0.9);
  }

  .toggles {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .toggle input {
    cursor: pointer;
  }

  .toggle span {
    color: rgba(255, 255, 255, 0.8);
  }
</style>
