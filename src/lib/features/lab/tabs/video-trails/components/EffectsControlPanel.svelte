<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import { DETECTOR_REGISTRY } from "../domain/types";

  const { state: trailsState } = getVideoTrailsContext();

  interface EffectSection {
    key: "fire" | "led" | "trails" | "charcoal";
    label: string;
    icon: string;
  }

  const sections: EffectSection[] = [
    { key: "trails", label: "Trails", icon: "fa-wave-square" },
    { key: "fire", label: "Fire", icon: "fa-fire" },
    { key: "led", label: "LED Glow", icon: "fa-lightbulb" },
    { key: "charcoal", label: "Charcoal", icon: "fa-meteor" },
  ];

  function toggleEffect(key: EffectSection["key"]) {
    const current = trailsState.effectConfig[key];
    trailsState.setEffectConfig({ [key]: { ...current, enabled: !current.enabled } });
  }
</script>

<div class="effects-panel">
  <h3 class="panel-title">Effects</h3>

  {#each sections as section}
    <div class="effect-section" class:enabled={trailsState.effectConfig[section.key].enabled}>
      <button class="effect-toggle" onclick={() => toggleEffect(section.key)}>
        <i class="fas {section.icon}" aria-hidden="true"></i>
        <span>{section.label}</span>
        <span class="toggle-indicator">{trailsState.effectConfig[section.key].enabled ? "ON" : "OFF"}</span>
      </button>
    </div>
  {/each}

  <div class="detection-section">
    <h3 class="panel-title">Detection</h3>

    <label class="slider-row">
      <span>Threshold</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={trailsState.detectionConfig.threshold}
        oninput={(e) => trailsState.setDetectionConfig({ threshold: Number((e.target as HTMLInputElement).value) })}
      />
      <span class="value">{trailsState.detectionConfig.threshold.toFixed(2)}</span>
    </label>

    <label class="slider-row">
      <span>Sensitivity</span>
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={trailsState.detectionConfig.sensitivity}
        oninput={(e) => trailsState.setDetectionConfig({ sensitivity: Number((e.target as HTMLInputElement).value) })}
      />
      <span class="value">{trailsState.detectionConfig.sensitivity.toFixed(1)}</span>
    </label>

    <label class="select-row">
      <span>Detector</span>
      <select
        value={trailsState.activeDetectorId}
        onchange={(e) => trailsState.setActiveDetector((e.target as HTMLSelectElement).value)}
      >
        {#each DETECTOR_REGISTRY as reg}
          <option value={reg.id}>{reg.name}</option>
        {/each}
      </select>
    </label>
  </div>
</div>

<style>
  .effects-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--theme-text, #ffffff);
  }

  .effect-section { border-radius: 6px; overflow: hidden; }

  .effect-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    text-align: left;
    transition: background 0.15s;
  }

  .effect-toggle:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .enabled .effect-toggle { color: var(--theme-text, #ffffff); }

  .toggle-indicator {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    opacity: 0.6;
  }

  .enabled .toggle-indicator {
    color: var(--theme-accent, #f43f5e);
    opacity: 1;
  }

  .detection-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .slider-row span:first-child { min-width: 70px; }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--theme-accent, #f43f5e);
  }

  .value {
    min-width: 35px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .select-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .select-row span { min-width: 70px; }

  .select-row select {
    flex: 1;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #ffffff);
    padding: 4px 8px;
  }
</style>
