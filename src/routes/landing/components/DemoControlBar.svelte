<!--
  DemoControlBar.svelte

  Control buttons for the landing page animation demo.
  Includes: dark mode toggle, fire/LED/trail effect toggles, change prop, and randomize buttons.
-->
<script lang="ts">
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";

  interface Props {
    servicesReady: boolean;
    isLoading: boolean;
    darkMode: boolean;
    fireEnabled: boolean;
    ledEnabled: boolean;
    trailsEnabled: boolean;
    onToggleDarkMode: () => void;
    onToggleFire: () => void;
    onToggleLed: () => void;
    onToggleTrails: () => void;
    onChangeProp: () => void;
    onRandomize: () => void;
  }

  let {
    servicesReady,
    isLoading,
    darkMode,
    fireEnabled,
    ledEnabled,
    trailsEnabled,
    onToggleDarkMode,
    onToggleFire,
    onToggleLed,
    onToggleTrails,
    onChangeProp,
    onRandomize,
  }: Props = $props();

  const isDisabled = $derived(!servicesReady || isLoading);
</script>

<div class="demo-controls">
  <LightsToggleButton
    lightsOn={!darkMode}
    onToggle={onToggleDarkMode}
    disabled={isDisabled}
    size="medium"
  />

  <button
    class="effect-toggle"
    class:active={fireEnabled}
    onclick={onToggleFire}
    disabled={isDisabled}
    aria-label={fireEnabled ? "Turn off fire effect" : "Turn on fire effect"}
    aria-pressed={fireEnabled}
    title={fireEnabled ? "Fire: On" : "Fire: Off"}
    style="--active-color: #f59e0b; --active-glow: rgba(245, 158, 11, {fireEnabled ? '0.2' : '0'});"
  >
    <i class="fas fa-fire" aria-hidden="true"></i>
  </button>

  <button
    class="effect-toggle"
    class:active={ledEnabled}
    onclick={onToggleLed}
    disabled={isDisabled}
    aria-label={ledEnabled ? "Turn off LED effect" : "Turn on LED effect"}
    aria-pressed={ledEnabled}
    title={ledEnabled ? "LED: On" : "LED: Off"}
    style="--active-color: #00ff88; --active-glow: rgba(0, 255, 136, {ledEnabled ? '0.2' : '0'});"
  >
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
  </button>

  <button
    class="effect-toggle"
    class:active={trailsEnabled}
    onclick={onToggleTrails}
    disabled={isDisabled}
    aria-label={trailsEnabled ? "Turn off trails" : "Turn on trails"}
    aria-pressed={trailsEnabled}
    title={trailsEnabled ? "Trails: On" : "Trails: Off"}
    style="--active-color: #818cf8; --active-glow: rgba(129, 140, 248, {trailsEnabled ? '0.2' : '0'});"
  >
    <i class="fas fa-wind" aria-hidden="true"></i>
  </button>

  <button class="change-prop-btn" onclick={onChangeProp} disabled={isDisabled}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        stroke-linecap="round"
      />
    </svg>
    <span>Change Prop</span>
  </button>

  <button class="randomize-btn" onclick={onRandomize} disabled={isDisabled}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
    <span>Try Another</span>
  </button>
</div>

<style>
  .demo-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Effect Toggle Buttons - circular icon buttons matching LightsToggleButton */
  .effect-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.6));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 18px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .effect-toggle:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, #ffffff);
    transform: scale(1.05);
  }

  .effect-toggle:active:not(:disabled) {
    transform: scale(0.95);
  }

  .effect-toggle.active {
    background: color-mix(in srgb, var(--active-color) 15%, transparent);
    border-color: color-mix(in srgb, var(--active-color) 40%, transparent);
    color: var(--active-color);
    box-shadow:
      0 0 16px var(--active-glow),
      inset 0 0 12px color-mix(in srgb, var(--active-color) 10%, transparent);
  }

  .effect-toggle.active:hover:not(:disabled) {
    background: color-mix(in srgb, var(--active-color) 25%, transparent);
    border-color: color-mix(in srgb, var(--active-color) 60%, transparent);
    box-shadow:
      0 0 24px var(--active-glow),
      inset 0 0 16px color-mix(in srgb, var(--active-color) 15%, transparent);
  }

  .effect-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Change Prop Button */
  .change-prop-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
    border: none;
    border-radius: 100px;
    color: white;
    font-size: var(--font-size-base, 1rem);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 4px 20px rgba(13, 148, 136, 0.3);
  }

  .change-prop-btn:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 30px rgba(13, 148, 136, 0.4);
  }

  .change-prop-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }

  .change-prop-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .change-prop-btn svg {
    width: 20px;
    height: 20px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Randomize Button */
  .randomize-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    background: linear-gradient(
      135deg,
      var(--primary, #6366f1) 0%,
      #818cf8 100%
    );
    border: none;
    border-radius: 100px;
    color: white;
    font-size: var(--font-size-base, 1rem);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
  }

  .randomize-btn:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 30px rgba(99, 102, 241, 0.4);
  }

  .randomize-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }

  .randomize-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .randomize-btn svg {
    width: 20px;
    height: 20px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Mobile */
  @media (max-width: 600px) {
    .demo-controls {
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .effect-toggle {
      width: 42px;
      height: 42px;
      font-size: 16px;
    }

    .randomize-btn,
    .change-prop-btn {
      padding: 12px 20px;
      font-size: var(--font-size-sm, 0.875rem);
    }

    .randomize-btn svg,
    .change-prop-btn svg {
      width: 18px;
      height: 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .effect-toggle,
    .randomize-btn,
    .change-prop-btn {
      transition: none;
    }

    .effect-toggle:hover:not(:disabled),
    .effect-toggle:active:not(:disabled),
    .randomize-btn:hover:not(:disabled),
    .randomize-btn:active:not(:disabled),
    .change-prop-btn:hover:not(:disabled),
    .change-prop-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
