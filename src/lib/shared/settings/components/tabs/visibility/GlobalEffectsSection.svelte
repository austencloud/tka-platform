<!--
  GlobalEffectsSection.svelte

  Global effects controls that apply across all visibility domains:
  - Pictograph, Animation, and Image Export

  Dark Mode: Dark background, inverted grid, white text/outlines
-->
<script lang="ts">
  interface Props {
    darkMode: boolean;
    ondarkModeToggle: () => void;
    disabled?: boolean;
  }

  let { darkMode, ondarkModeToggle, disabled = false }: Props = $props();
</script>

<section class="global-effects-section">
  <span class="section-label">Global Effects</span>
  <div class="effects-row">
    <button
      class="effect-btn dark-mode"
      class:active={darkMode}
      class:disabled
      onclick={ondarkModeToggle}
      {disabled}
      type="button"
      aria-label={darkMode ? "Disable Dark Mode" : "Enable Dark Mode"}
      aria-pressed={darkMode}
    >
      <i class="fas fa-moon" aria-hidden="true"></i>
      <span class="effect-label">Dark Mode</span>
      <span class="effect-status">{darkMode ? "ON" : "OFF"}</span>
    </button>
  </div>
</section>

<style>
  .global-effects-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim);
    padding-left: 4px;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .effects-row {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  .effect-btn {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    min-height: var(--min-touch-target, 48px);
    padding: 14px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .effect-btn i {
    font-size: var(--font-size-base, 16px);
    flex-shrink: 0;
  }

  .effect-label {
    white-space: nowrap;
  }

  .effect-status {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.7;
  }

  .effect-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .effect-btn:active {
    transform: translateY(0) scale(0.98);
    transition-duration: 50ms;
  }

  .effect-btn.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Dark Mode Active - Electric cyan glow */
  .effect-btn.dark-mode.active {
    background: rgba(0, 255, 255, 0.12);
    border-color: rgba(0, 255, 255, 0.4);
    color: #00ffff;
    box-shadow:
      0 0 12px rgba(0, 255, 255, 0.25),
      0 0 24px rgba(0, 255, 255, 0.15),
      inset 0 0 8px rgba(0, 255, 255, 0.08);
  }

  .effect-btn.dark-mode.active i {
    text-shadow: 0 0 10px rgba(0, 255, 255, 0.9);
  }

  .effect-btn.dark-mode.active .effect-status {
    color: #00ffff;
    opacity: 1;
    text-shadow: 0 0 6px rgba(0, 255, 255, 0.6);
  }

  .effect-btn.dark-mode.active:hover {
    background: rgba(0, 255, 255, 0.18);
    border-color: rgba(0, 255, 255, 0.55);
    box-shadow:
      0 0 16px rgba(0, 255, 255, 0.35),
      0 0 32px rgba(0, 255, 255, 0.2),
      inset 0 0 12px rgba(0, 255, 255, 0.1);
  }

  .effect-btn:focus-visible {
    outline: 2px solid rgba(0, 255, 255, 0.5);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .effect-btn {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .effect-btn {
      border-width: 2px;
    }

    .effect-btn.dark-mode.active {
      border-color: #00ffff;
    }

    .effect-btn:focus-visible {
      outline-width: 3px;
    }
  }
</style>
