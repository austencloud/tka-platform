<script lang="ts">
  /**
   * CameraTab - Debug panel tab for camera controls
   *
   * Controls: Mode, FOV, sensitivity
   */

  interface Props {
    cameraMode: "first-person" | "third-person" | "orbit";
    fov: number;
    sensitivity: number;
    position: { x: number; y: number; z: number };
    onModeChange?: (mode: "first-person" | "third-person" | "orbit") => void;
    onFovChange?: (fov: number) => void;
    onSensitivityChange?: (sensitivity: number) => void;
  }

  let {
    cameraMode,
    fov,
    sensitivity,
    position,
    onModeChange,
    onFovChange,
    onSensitivityChange,
  }: Props = $props();

  const modeOptions: Array<{ value: typeof cameraMode; label: string; icon: string }> = [
    { value: "first-person", label: "FP", icon: "fa-eye" },
    { value: "third-person", label: "TP", icon: "fa-user" },
    { value: "orbit", label: "Orbit", icon: "fa-rotate" },
  ];

  function handleFovChange(e: Event) {
    const target = e.target as HTMLInputElement;
    onFovChange?.(parseInt(target.value, 10));
  }

  function handleSensitivityChange(e: Event) {
    const target = e.target as HTMLInputElement;
    onSensitivityChange?.(parseFloat(target.value));
  }

  function formatCoord(val: number): string {
    return val.toFixed(1);
  }
</script>

<div class="tab-content">
  <!-- Mode Selector -->
  <div class="mode-selector">
    {#each modeOptions as option}
      <button
        class="mode-btn"
        class:active={cameraMode === option.value}
        onclick={() => onModeChange?.(option.value)}
        aria-label="Switch to {option.label} camera"
      >
        <i class="fas {option.icon}" aria-hidden="true"></i>
        <span>{option.label}</span>
      </button>
    {/each}
  </div>

  <div class="details-section">
    <!-- Camera Settings -->
    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-sliders" style="color: #a78bfa" aria-hidden="true"></i>
        Settings
      </div>

      <div class="slider-row">
        <span class="slider-label">Field of View</span>
        <span class="slider-value">{fov}°</span>
      </div>
      <input
        type="range"
        min="45"
        max="120"
        step="5"
        value={fov}
        oninput={handleFovChange}
        class="slider"
      />

      <div class="slider-row">
        <span class="slider-label">Sensitivity</span>
        <span class="slider-value">{sensitivity.toFixed(1)}x</span>
      </div>
      <input
        type="range"
        min="0.1"
        max="3.0"
        step="0.1"
        value={sensitivity}
        oninput={handleSensitivityChange}
        class="slider"
      />
    </div>

    <!-- Position -->
    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-crosshairs" style="color: #60a5fa" aria-hidden="true"></i>
        Camera Position
      </div>
      <div class="coords-row">
        <div class="coord">
          <span class="coord-label">X</span>
          <span class="coord-value">{formatCoord(position.x)}</span>
        </div>
        <div class="coord">
          <span class="coord-label">Y</span>
          <span class="coord-value">{formatCoord(position.y)}</span>
        </div>
        <div class="coord">
          <span class="coord-label">Z</span>
          <span class="coord-value">{formatCoord(position.z)}</span>
        </div>
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

  .mode-selector {
    display: flex;
    gap: 6px;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%);
    padding: 6px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mode-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 6px;
    min-height: 48px;
    background: transparent;
    border: 2px solid transparent;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .mode-btn i {
    font-size: 16px;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-2px);
  }

  .mode-btn.active {
    background: linear-gradient(135deg, rgba(167, 139, 250, 0.25) 0%, rgba(167, 139, 250, 0.1) 100%);
    border-color: rgba(167, 139, 250, 0.5);
    color: #c4b5fd;
    box-shadow: 0 0 20px rgba(167, 139, 250, 0.25);
  }

  .mode-btn.active i {
    filter: drop-shadow(0 0 8px #a78bfa);
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

  .slider-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    margin-bottom: 6px;
  }

  .slider-label {
    color: rgba(255, 255, 255, 0.6);
  }

  .slider-value {
    color: #c4b5fd;
    font-weight: 600;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 14px;
  }

  .slider {
    width: 100%;
    height: 48px;
    background: transparent;
    appearance: none;
    cursor: pointer;
    margin-bottom: 8px;
  }

  .slider::-webkit-slider-runnable-track {
    height: 6px;
    background: linear-gradient(90deg, rgba(167, 139, 250, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%);
    border-radius: 3px;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%);
    border-radius: 50%;
    cursor: pointer;
    margin-top: -9px;
    box-shadow: 0 0 12px rgba(167, 139, 250, 0.5);
  }

  .slider::-moz-range-track {
    height: 6px;
    background: linear-gradient(90deg, rgba(167, 139, 250, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%);
    border-radius: 3px;
  }

  .slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%);
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 12px rgba(167, 139, 250, 0.5);
  }

  .coords-row {
    display: flex;
    gap: 8px;
  }

  .coord {
    flex: 1;
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.15) 0%, rgba(96, 165, 250, 0.05) 100%);
    border-radius: 10px;
    padding: 8px;
    text-align: center;
    border: 1px solid rgba(96, 165, 250, 0.2);
  }

  .coord-label {
    display: block;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .coord-value {
    display: block;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 14px;
    color: #93c5fd;
    font-weight: 600;
  }

  /* Focus states */
  .mode-btn:focus-visible {
    outline: 2px solid #a78bfa;
    outline-offset: 2px;
  }

  .slider:focus-visible {
    outline: 2px solid #a78bfa;
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mode-btn {
      transition: none;
    }
    .mode-btn:hover {
      transform: none;
    }
    .slider::-webkit-slider-thumb,
    .slider::-moz-range-thumb {
      box-shadow: none;
    }
  }
</style>
