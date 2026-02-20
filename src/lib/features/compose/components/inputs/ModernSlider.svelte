<!--
  ModernSlider.svelte

  Modern 2026-style slider component with premium visual feedback.
  Features gradient fills, floating value display, and smooth animations.
-->
<script lang="ts">
  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    label = "",
    unit = "",
    formatValue = (v: number) => v.toFixed(1),
    onInput = () => {},
  }: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    unit?: string;
    formatValue?: (value: number) => string;
    onInput?: (value: number) => void;
  } = $props();

  let isDragging = $state(false);
  let percentage = $derived(((value - min) / (max - min)) * 100);

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = parseFloat(target.value);
    onInput(value);
  }

  function handleMouseDown() {
    isDragging = true;
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleTouchStart() {
    isDragging = true;
  }

  function handleTouchEnd() {
    isDragging = false;
  }
</script>

<svelte:window onmouseup={handleMouseUp} ontouchend={handleTouchEnd} />

<div class="modern-slider" class:dragging={isDragging}>
  <!-- Label with current value -->
  <div class="slider-header">
    {#if label}
      <label class="slider-label" for="slider-{label}">
        {label}
      </label>
    {/if}
    <div class="slider-value">
      <span class="value-number">{formatValue(value)}</span>
      {#if unit}
        <span class="value-unit">{unit}</span>
      {/if}
    </div>
  </div>

  <!-- Custom styled slider -->
  <div class="slider-container">
    <!-- Background track with gradient fill -->
    <div class="slider-track">
      <div class="slider-fill" style:width="{percentage}%"></div>
      <div class="slider-glow" style:width="{percentage}%"></div>
    </div>

    <!-- Native input for functionality -->
    <input
      id="slider-{label}"
      type="range"
      {min}
      {max}
      {step}
      {value}
      oninput={handleInput}
      onmousedown={handleMouseDown}
      ontouchstart={handleTouchStart}
      class="slider-input"
      aria-label={label || undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    />

    <!-- Visual thumb indicator -->
    <div class="slider-thumb-visual" style:left="{percentage}%">
      <div class="thumb-inner">
        <div class="thumb-shine"></div>
      </div>
    </div>
  </div>
</div>

<style>
  /* ===========================
     MODERN SLIDER - 2026 Design
     Premium visual feedback
     =========================== */

  .modern-slider {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.2vw, 8px);
  }

  /* ===========================
     HEADER
     =========================== */

  .slider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .slider-label {
    font-size: clamp(10px, 2vw, 11px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
  }

  .slider-value {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: clamp(2px, 0.4vw, 4px) clamp(6px, 1.2vw, 8px);
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: clamp(4px, 0.8vw, 6px);
    transition: all var(--duration-normal) ease;
  }

  .modern-slider.dragging .slider-value {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .value-number {
    font-size: clamp(11px, 2.2vw, 13px);
    font-weight: 700;
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
  }

  .value-unit {
    font-size: clamp(9px, 1.8vw, 10px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: lowercase;
  }

  /* ===========================
     SLIDER CONTAINER
     =========================== */

  .slider-container {
    position: relative;
    width: 100%;
    height: clamp(32px, 6.4vw, 40px);
    display: flex;
    align-items: center;
    padding: 0 clamp(8px, 1.6vw, 10px);
  }

  /* ===========================
     TRACK & FILL
     =========================== */

  .slider-track {
    position: absolute;
    left: clamp(8px, 1.6vw, 10px);
    right: clamp(8px, 1.6vw, 10px);
    height: clamp(6px, 1.2vw, 8px);
    background: var(--theme-card-hover-bg);
    border-radius: clamp(3px, 0.6vw, 4px);
    overflow: hidden;
    box-shadow: inset 0 1px 3px var(--theme-shadow);
  }

  .slider-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--theme-accent);
    transition: width var(--duration-instant) ease;
    border-radius: clamp(3px, 0.6vw, 4px);
  }

  .slider-glow {
    position: absolute;
    top: -2px;
    left: 0;
    height: calc(100% + 4px);
    background: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    filter: blur(4px);
    transition: width var(--duration-instant) ease;
    opacity: 0.6;
    pointer-events: none;
  }

  /* ===========================
     NATIVE INPUT (hidden but functional)
     =========================== */

  .slider-input {
    position: absolute;
    left: 0;
    right: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 10;
    margin: 0;
  }

  /* ===========================
     VISUAL THUMB
     =========================== */

  .slider-thumb-visual {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 5;
    transition: all var(--duration-instant) ease;
  }

  .modern-slider.dragging .slider-thumb-visual {
    transform: translate(-50%, -50%) scale(1.15);
  }

  .thumb-inner {
    position: relative;
    width: clamp(20px, 4vw, 24px);
    height: clamp(20px, 4vw, 24px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, white 98%, transparent) 0%,
      color-mix(in srgb, white 95%, var(--theme-accent)) 100%
    );
    border-radius: 50%;
    box-shadow:
      0 2px 6px var(--theme-shadow),
      0 1px 2px var(--theme-shadow),
      inset 0 1px 0 var(--theme-text);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .modern-slider.dragging .thumb-inner {
    box-shadow:
      0 4px 12px color-mix(in srgb, var(--theme-accent) 50%, transparent),
      0 2px 4px var(--theme-shadow),
      inset 0 1px 0 var(--theme-text);
  }

  /* Thumb shine effect */
  .thumb-shine {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 60%;
    height: 60%;
    background: radial-gradient(
      circle at 30% 30%,
      color-mix(in srgb, white 70%, transparent) 0%,
      transparent 70%
    );
    border-radius: 50%;
  }

  /* ===========================
     HOVER EFFECTS
     =========================== */

  @media (hover: hover) and (pointer: fine) {
    .slider-input:hover ~ .slider-thumb-visual .thumb-inner {
      transform: scale(1.08);
      box-shadow:
        0 3px 10px color-mix(in srgb, var(--theme-accent) 40%, transparent),
        0 1px 3px var(--theme-shadow),
        inset 0 1px 0 var(--theme-text);
    }
  }

  .slider-input:active ~ .slider-thumb-visual .thumb-inner {
    transform: scale(0.95);
  }

  /* ===========================
     DESKTOP CONTAINER QUERY UNITS
     =========================== */

  @container (min-aspect-ratio: 5/4) {
    .modern-slider {
      gap: 0.25cqh;
    }

    .slider-label {
      font-size: 0.9cqh;
    }

    .slider-value {
      padding: 0.2cqh 0.4cqw;
    }

    .value-number {
      font-size: 1cqh;
    }

    .value-unit {
      font-size: 0.8cqh;
    }

    .slider-container {
      height: 2.2cqh;
      padding: 0 0.5cqw;
    }

    .slider-track {
      left: 0.5cqw;
      right: 0.5cqw;
      height: 0.4cqh;
    }

    .thumb-inner {
      width: 1.6cqh;
      height: 1.6cqh;
    }
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .slider-fill,
    .slider-glow,
    .slider-thumb-visual,
    .thumb-inner,
    .slider-value {
      transition: none;
    }

    .modern-slider.dragging .slider-thumb-visual,
    .slider-input:hover ~ .slider-thumb-visual .thumb-inner,
    .slider-input:active ~ .slider-thumb-visual .thumb-inner {
      transform: translate(-50%, -50%);
    }
  }

  /* High contrast */
  @media (prefers-contrast: high) {
    .slider-track {
      background: var(--theme-stroke);
      border: 1px solid var(--theme-stroke-strong);
    }

    .slider-fill {
      background: var(--theme-accent);
    }

    .slider-label,
    .value-number {
      color: #ffffff;
    }
  }

  /* Focus visible for keyboard navigation */
  .slider-input:focus-visible ~ .slider-thumb-visual .thumb-inner {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
