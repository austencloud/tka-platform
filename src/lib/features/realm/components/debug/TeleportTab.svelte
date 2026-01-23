<script lang="ts">
  /**
   * TeleportTab - Debug panel tab for quick travel
   *
   * Instant teleportation to biome presets
   */

  interface Props {
    currentBiome: string;
    position: { x: number; y: number; z: number };
    onTeleport: (x: number, y: number, z: number) => void;
  }

  let { currentBiome, position, onTeleport }: Props = $props();

  const BIOME_PRESETS = [
    { name: "Forest", x: 0, y: 60, z: 0, color: "#22c55e", icon: "fa-tree" },
    { name: "Plains", x: 500, y: 60, z: 500, color: "#84cc16", icon: "fa-seedling" },
    { name: "Mountains", x: 0, y: 80, z: 1500, color: "#94a3b8", icon: "fa-mountain" },
    { name: "Desert", x: 2000, y: 60, z: 0, color: "#f59e0b", icon: "fa-sun" },
    { name: "Ocean", x: -800, y: 60, z: -800, color: "#0ea5e9", icon: "fa-water" },
  ];

  // Custom teleport input
  let customX = $state("");
  let customY = $state("");
  let customZ = $state("");

  function handleTeleport(preset: (typeof BIOME_PRESETS)[0]) {
    onTeleport(preset.x, preset.y, preset.z);
  }

  function handleCustomTeleport() {
    const x = parseFloat(customX) || position.x;
    const y = parseFloat(customY) || position.y;
    const z = parseFloat(customZ) || position.z;
    onTeleport(x, y, z);
  }

  const currentBiomeColor = $derived(
    BIOME_PRESETS.find((p) => p.name.toLowerCase() === currentBiome)?.color ?? "#64748b"
  );

  function formatCoord(val: number): string {
    return val.toFixed(1);
  }
</script>

<div class="tab-content">
  <!-- Current Position -->
  <div class="position-display">
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
    <div class="biome-pill" style="--biome-color: {currentBiomeColor}">
      <span class="biome-dot"></span>
      <span class="biome-name">{currentBiome || "Unknown"}</span>
    </div>
  </div>

  <!-- Quick Travel Buttons -->
  <div class="section-label">Quick Travel</div>
  <div class="teleport-grid">
    {#each BIOME_PRESETS as preset}
      <button
        class="teleport-chip"
        class:active={currentBiome === preset.name.toLowerCase()}
        style="--chip-color: {preset.color}"
        onclick={() => handleTeleport(preset)}
        aria-label="Teleport to {preset.name}"
      >
        <i class="fas {preset.icon}" aria-hidden="true"></i>
        <span>{preset.name}</span>
      </button>
    {/each}
  </div>

  <!-- Custom Teleport -->
  <div class="section-label">Custom Position</div>
  <div class="custom-teleport">
    <div class="input-row">
      <input
        type="number"
        placeholder="X"
        bind:value={customX}
        class="coord-input"
      />
      <input
        type="number"
        placeholder="Y"
        bind:value={customY}
        class="coord-input"
      />
      <input
        type="number"
        placeholder="Z"
        bind:value={customZ}
        class="coord-input"
      />
    </div>
    <button class="go-btn" onclick={handleCustomTeleport}>
      <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
      Go
    </button>
  </div>
</div>

<style>
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .position-display {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .coords-grid {
    display: flex;
    gap: 8px;
  }

  .coord-item {
    flex: 1;
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.15) 0%, rgba(96, 165, 250, 0.05) 100%);
    border-radius: 12px;
    padding: 10px 8px;
    text-align: center;
    border: 1px solid rgba(96, 165, 250, 0.2);
  }

  .coord-label {
    display: block;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .coord-value {
    display: block;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 16px;
    color: #93c5fd;
    font-weight: 600;
  }

  .biome-pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    align-self: flex-start;
  }

  .biome-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--biome-color, #64748b);
    box-shadow: 0 0 12px var(--biome-color, #64748b);
  }

  .biome-name {
    font-weight: 600;
    text-transform: capitalize;
    color: white;
    font-size: 14px;
  }

  .section-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
  }

  .teleport-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .teleport-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 10px 18px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .teleport-chip i {
    font-size: 14px;
    color: var(--chip-color, #64748b);
    filter: drop-shadow(0 0 6px var(--chip-color, #64748b));
  }

  .teleport-chip:hover {
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--chip-color, #64748b) 25%, transparent) 0%,
      color-mix(in srgb, var(--chip-color, #64748b) 10%, transparent) 100%);
    border-color: color-mix(in srgb, var(--chip-color, #64748b) 60%, transparent);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--chip-color, #64748b) 30%, transparent);
  }

  .teleport-chip.active {
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--chip-color, #64748b) 35%, transparent) 0%,
      color-mix(in srgb, var(--chip-color, #64748b) 15%, transparent) 100%);
    border-color: var(--chip-color, #64748b);
    color: white;
    box-shadow: 0 0 20px color-mix(in srgb, var(--chip-color, #64748b) 40%, transparent);
  }

  .custom-teleport {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .input-row {
    display: flex;
    gap: 8px;
  }

  .coord-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 12px 10px;
    color: white;
    font-size: 14px;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    text-align: center;
    min-width: 0;
    transition: all 0.2s ease;
  }

  .coord-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .coord-input:focus {
    outline: none;
    border-color: #60a5fa;
    background: rgba(96, 165, 250, 0.1);
    box-shadow: 0 0 20px rgba(96, 165, 250, 0.15);
  }

  .go-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    min-height: 48px;
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.25) 0%, rgba(96, 165, 250, 0.1) 100%);
    border: 2px solid rgba(96, 165, 250, 0.4);
    border-radius: 12px;
    color: #93c5fd;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .go-btn:hover {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.35) 0%, rgba(96, 165, 250, 0.2) 100%);
    border-color: rgba(96, 165, 250, 0.6);
    color: #bfdbfe;
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(96, 165, 250, 0.25);
  }

  .go-btn i {
    font-size: 14px;
  }

  /* Focus states */
  .teleport-chip:focus-visible,
  .go-btn:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .teleport-chip,
    .go-btn,
    .biome-dot,
    .coord-input {
      transition: none;
    }
    .teleport-chip:hover,
    .go-btn:hover {
      transform: none;
    }
  }
</style>
