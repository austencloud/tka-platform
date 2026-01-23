<!--
  StaggerOffsetSlider.svelte

  Custom offset slider for stagger mode.
  Shown only when preset is "custom".
  Range: 0 to sequence length in beats, step: 0.5 beats.
-->
<script lang="ts">
  interface Props {
    offsetBeats: number;
    maxBeats: number;
    onOffsetChange: (beats: number) => void;
  }

  let { offsetBeats, maxBeats, onOffsetChange }: Props = $props();

  // Format display value
  const displayValue = $derived(
    offsetBeats === 1 ? "1 beat" : `${offsetBeats} beats`
  );

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    onOffsetChange(parseFloat(target.value));
  }
</script>

<div class="offset-slider-container">
  <label class="slider-label">
    <span class="label-text">Offset:</span>
    <span class="label-value">{displayValue}</span>
  </label>
  <input
    type="range"
    class="offset-slider"
    min="0"
    max={maxBeats}
    step="0.5"
    value={offsetBeats}
    oninput={handleInput}
    aria-label="Custom stagger offset in beats"
  />
</div>

<style>
  .offset-slider-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 300px;
    padding: 0 16px;
  }

  .slider-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .label-text {
    font-weight: 500;
  }

  .label-value {
    color: var(--theme-text, white);
    font-weight: 600;
  }

  .offset-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-radius: 4px;
    cursor: pointer;
  }

  .offset-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    background: var(--theme-accent, #6366f1);
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease;
  }

  .offset-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .offset-slider::-webkit-slider-thumb:active {
    transform: scale(0.95);
  }

  .offset-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: var(--theme-accent, #6366f1);
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease;
  }

  .offset-slider::-moz-range-thumb:hover {
    transform: scale(1.1);
  }

  .offset-slider::-moz-range-track {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-radius: 4px;
    height: 8px;
  }

  .offset-slider:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .offset-slider::-webkit-slider-thumb,
    .offset-slider::-moz-range-thumb {
      transition: none;
    }
  }
</style>
