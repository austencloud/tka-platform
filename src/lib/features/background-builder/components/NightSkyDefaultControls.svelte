<script lang="ts">
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import type { NightSkyDensityPreset } from "../domain/lab-settings-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  interface LayerState {
    stars: boolean;
    nebula: boolean;
    aurora: boolean;
    milkyWay: boolean;
    meteors: boolean;
    comets: boolean;
    ufo: boolean;
  }

  interface Props {
    quality: QualityLevel;
    layers: LayerState;
    densityPreset: NightSkyDensityPreset;
    onQualityChange: (quality: QualityLevel) => void;
    onLayerToggle: (layer: keyof LayerState) => void;
    onDensityChange: (preset: NightSkyDensityPreset) => void;
    onTriggerMeteor: () => void;
    onTriggerComet: () => void;
    onRegenerate: () => void;
  }

  let {
    quality,
    layers,
    densityPreset,
    onQualityChange,
    onLayerToggle,
    onDensityChange,
    onTriggerMeteor,
    onTriggerComet,
    onRegenerate,
  }: Props = $props();
</script>

<!-- Quality Chips -->
<ChipGroup label="Quality" variant="row">
  <ChipToggle label="High" active={quality === "high"} onclick={() => onQualityChange("high")} />
  <ChipToggle label="Medium" active={quality === "medium"} onclick={() => onQualityChange("medium")} />
  <ChipToggle label="Low" active={quality === "low"} onclick={() => onQualityChange("low")} />
</ChipGroup>

<!-- Layer Chips -->
<ChipGroup label="Layers">
  <ChipToggle label="Stars" icon="fa-star" active={layers.stars} onclick={() => onLayerToggle("stars")} />
  <ChipToggle label="Nebula" icon="fa-cloud" active={layers.nebula} onclick={() => onLayerToggle("nebula")} />
  <ChipToggle label="Aurora" icon="fa-wind" active={layers.aurora} onclick={() => onLayerToggle("aurora")} />
  <ChipToggle label="Milky Way" icon="fa-star-half-stroke" active={layers.milkyWay} onclick={() => onLayerToggle("milkyWay")} />
  <ChipToggle label="Meteors" icon="fa-meteor" active={layers.meteors} onclick={() => onLayerToggle("meteors")} />
  <ChipToggle label="Comets" icon="fa-fire" active={layers.comets} onclick={() => onLayerToggle("comets")} />
  <ChipToggle label="UFO" icon="fa-satellite" active={layers.ufo} onclick={() => onLayerToggle("ufo")} />
</ChipGroup>

<!-- Trigger Buttons -->
<ChipGroup label="Trigger Events">
  <button class="trigger-btn" onclick={onTriggerMeteor}>
    <i class="fas fa-meteor"></i>
    Meteor
  </button>
  <button class="trigger-btn" onclick={onTriggerComet}>
    <i class="fas fa-fire"></i>
    Comet
  </button>
</ChipGroup>

<!-- Density Chips -->
<ChipGroup label="Star Density" variant="row">
  <ChipToggle label="Sparse" active={densityPreset === "sparse"} onclick={() => onDensityChange("sparse")} />
  <ChipToggle label="Normal" active={densityPreset === "normal"} onclick={() => onDensityChange("normal")} />
  <ChipToggle label="Dense" active={densityPreset === "dense"} onclick={() => onDensityChange("dense")} />
  <ChipToggle label="Ultra" active={densityPreset === "ultra"} onclick={() => onDensityChange("ultra")} />
</ChipGroup>

<!-- Regenerate -->
<button class="action-btn" onclick={onRegenerate}>
  <i class="fas fa-sparkles"></i>
  Regenerate
</button>

<!-- Progress Pills -->
<div class="progress-section">
  <span class="label">Progress</span>
  <div class="progress-pills">
    <span class="pill complete">Clean Canvas</span>
    <span class="pill complete">Lab Ready</span>
    <span class="pill complete">Scintillation</span>
    <span class="pill complete">Nebula</span>
    <span class="pill complete">Aurora</span>
    <span class="pill complete">Milky Way</span>
    <span class="pill complete">Meteors</span>
    <span class="pill complete">Comets</span>
    <span class="pill complete">UFO</span>
  </div>
</div>

<style>
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .trigger-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .trigger-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .trigger-btn:active {
    transform: scale(0.97);
    background: rgba(99, 102, 241, 0.3);
  }

  .trigger-btn i {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .progress-section .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .progress-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .pill.complete {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .pill.active {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    animation: pulse 2s infinite;
  }

  .pill.pending {
    background: rgba(255, 255, 255, 0.05);
    color: #6b7280;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>
