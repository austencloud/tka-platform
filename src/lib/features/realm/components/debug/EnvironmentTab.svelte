<script lang="ts">
  /**
   * EnvironmentTab - Debug panel tab for environment controls
   *
   * Controls: Fog, Water, Textures
   */
  import { ChipToggle } from '@austencloud/chip-toggle';

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
    fogEnabled: boolean;
    waterVisible: boolean;
    texturesEnabled: boolean;
    texturesLoaded: boolean;
    atmosphereState: AtmosphereState | null;
    waterState: WaterState | null;
    onToggleFog: () => void;
    onToggleWater: () => void;
    onToggleTextures: () => void;
  }

  let {
    fogEnabled,
    waterVisible,
    texturesEnabled,
    texturesLoaded,
    atmosphereState,
    waterState,
    onToggleFog,
    onToggleWater,
    onToggleTextures,
  }: Props = $props();

  function formatDensity(density: number): string {
    return (density * 1000).toFixed(1);
  }
</script>

<div class="tab-content">
  <div class="toggle-row">
    <ChipToggle
      label="Water"
      icon="fa-droplet"
      active={waterVisible}
      color="cyan"
      size="sm"
      onclick={onToggleWater}
    />
    <ChipToggle
      label="Fog"
      icon="fa-cloud"
      active={fogEnabled}
      color="gray"
      size="sm"
      onclick={onToggleFog}
    />
    <ChipToggle
      label="Textures"
      icon="fa-image"
      active={texturesEnabled}
      color="lime"
      size="sm"
      onclick={onToggleTextures}
    />
  </div>

  <div class="details-section">
    {#if waterState && waterVisible}
      <div class="detail-group">
        <div class="detail-title">
          <i class="fas fa-droplet" style="color: #0ea5e9" aria-hidden="true"></i>
          Water
        </div>
        <div class="detail-row">
          <span class="detail-label">Level</span>
          <span class="detail-value">{waterState.waterLevel}m</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Opacity</span>
          <span class="detail-value">{(waterState.opacity * 100).toFixed(0)}%</span>
        </div>
      </div>
    {/if}

    {#if atmosphereState && fogEnabled}
      <div class="detail-group">
        <div class="detail-title">
          <i class="fas fa-cloud" style="color: #94a3b8" aria-hidden="true"></i>
          Fog
        </div>
        <div class="detail-row">
          <span class="detail-label">Density</span>
          <span class="detail-value">{formatDensity(atmosphereState.fogDensity)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Color</span>
          <span class="color-swatch" style="background: {atmosphereState.fogColor}"></span>
        </div>
      </div>
    {/if}

    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-image" style="color: #84cc16" aria-hidden="true"></i>
        Textures
      </div>
      <div class="detail-row">
        <span class="detail-label">Mode</span>
        <span class="detail-value">{texturesEnabled ? "PBR" : "Vertex Colors"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Loaded</span>
        <span class="detail-value status" class:ok={texturesLoaded} class:pending={!texturesLoaded}>
          {texturesLoaded ? "Yes" : "Loading..."}
        </span>
      </div>
    </div>
  </div>
</div>

<style>
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .details-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-group {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-radius: 12px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .detail-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: white;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .detail-title i {
    font-size: 14px;
    filter: drop-shadow(0 0 8px currentColor);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
  }

  .detail-label {
    color: rgba(255, 255, 255, 0.6);
  }

  .detail-value {
    color: white;
    font-weight: 600;
  }

  .detail-value.status.ok {
    color: #4ade80;
  }

  .detail-value.status.pending {
    color: #fbbf24;
  }

  .color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 0 12px currentColor;
  }
</style>
