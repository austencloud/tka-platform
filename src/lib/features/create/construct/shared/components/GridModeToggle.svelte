<!--
GridModeToggle.svelte - Single-button toggle showing opposite grid mode
Action-oriented pattern: Shows the mode you can switch TO (not current mode)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const { currentGridMode = GridMode.DIAMOND, onGridModeChange } = $props<{
    currentGridMode?: GridMode;
    onGridModeChange?: (gridMode: GridMode) => void;
  }>();

  const hapticService = getHapticFeedback();

  // Action-oriented: Show the mode you can switch TO
  const oppositeMode = $derived(
    currentGridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND
  );

  const oppositeLabel = $derived(
    oppositeMode === GridMode.DIAMOND ? t("assembly_diamond") : t("assembly_box")
  );

  const switchAriaLabel = $derived(t("assembly_switch_to_mode", { mode: oppositeLabel }));

  function handleToggle() {
    hapticService?.trigger("selection");
    onGridModeChange?.(oppositeMode);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  }
</script>

<button
  class="grid-mode-toggle"
  onclick={handleToggle}
  onkeydown={handleKeyDown}
  role="switch"
  aria-checked={currentGridMode === GridMode.BOX}
  aria-label={switchAriaLabel}
  title={switchAriaLabel}
>
  <span class="mode-label">{oppositeLabel}</span>
</button>

<style>
  .grid-mode-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    /* Bigger touch target */
    min-height: var(--min-touch-target);
    padding: 0 20px;

    /* Glass morphism styling */
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 24px;

    /* Typography */
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    letter-spacing: 0.3px;

    /* Interaction */
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    /* Smooth transitions */
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);

    /* Shadow */
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 var(--theme-stroke);
  }

  .mode-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  /* Hover state */
  @media (hover: hover) {
    .grid-mode-toggle:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
  }

  /* Active/pressed state */
  .grid-mode-toggle:active {
    transform: translateY(0) scale(0.98);
    transition: transform var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Focus state */
  .grid-mode-toggle:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-mode-toggle {
      transition: none;
    }

    .grid-mode-toggle:hover {
      transform: none;
    }

    .grid-mode-toggle:active {
      transform: scale(0.98);
    }
  }

  /* Mobile responsive */
  @media (max-width: 600px) {
    .grid-mode-toggle {
      min-height: var(--min-touch-target);
      padding: 0 16px;
    }

    .mode-label {
      font-size: var(--font-size-sm);
    }
  }
</style>
