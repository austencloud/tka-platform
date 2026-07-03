<!--
  MotionColorChips.svelte

  Reusable Left (blue) / Right (red) toggle chips for motion visibility.

  Toggle logic: clicking an active chip when the other is also active solos
  that chip off. Clicking the last active chip reactivates both (at least one
  must remain visible).

  Used by:
  - MotionVisibilityToggle (sequence viewer)
  - ViewModeToggle (browse toolbar)
-->
<script lang="ts">
  interface Props {
    showBlue: boolean;
    showRed: boolean;
    onToggleBlue: () => void;
    onToggleRed: () => void;
  }

  let { showBlue, showRed, onToggleBlue, onToggleRed }: Props = $props();
</script>

<div class="motion-color-chips" role="group" aria-label="Motion visibility">
  <button
    type="button"
    class="chip blue"
    class:active={showBlue}
    onclick={() => onToggleBlue()}
    aria-pressed={showBlue}
    aria-label={showBlue ? "Hide left motion" : "Show left motion"}
  >
    Left
  </button>
  <button
    type="button"
    class="chip red"
    class:active={showRed}
    onclick={() => onToggleRed()}
    aria-pressed={showRed}
    aria-label={showRed ? "Hide right motion" : "Show right motion"}
  >
    Right
  </button>
</div>

<style>
  .motion-color-chips {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .chip {
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    color: rgba(255, 255, 255, 0.95);
  }

  .chip.blue.active {
    background: color-mix(in srgb, var(--prop-blue, #2196f3) 22%, transparent);
    border-color: var(--prop-blue, #2196f3);
    color: #fff;
  }

  .chip.red.active {
    background: color-mix(in srgb, var(--prop-red, #f44336) 22%, transparent);
    border-color: var(--prop-red, #f44336);
    color: #fff;
  }
</style>
