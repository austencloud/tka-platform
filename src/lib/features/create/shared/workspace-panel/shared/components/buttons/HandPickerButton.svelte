<!--
  HandPickerButton.svelte

  Split blue/red circle button for switching the active building hand
  in the Assemble tab. The active hand's half is filled, the other is dimmed.
  Tapping toggles between blue and red.
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let {
    activeHand,
    onToggle,
  }: {
    activeHand: MotionColor;
    onToggle: () => void;
  } = $props();

  const isBlue = $derived(activeHand === MotionColor.BLUE);
  const ariaLabel = $derived(
    isBlue ? "Building blue hand. Tap to switch to red." : "Building red hand. Tap to switch to blue."
  );
</script>

<button
  class="hand-picker-button"
  onclick={onToggle}
  aria-label={ariaLabel}
  data-testid="hand-picker-button"
>
  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
    <!-- Blue half (left) -->
    <path
      d="M20,2 A18,18 0 0,0 20,38"
      fill={isBlue ? "var(--prop-blue, #2e8bf0)" : "rgba(46, 139, 240, 0.25)"}
    />
    <!-- Red half (right) -->
    <path
      d="M20,2 A18,18 0 0,1 20,38"
      fill={!isBlue ? "var(--prop-red, #ed1c24)" : "rgba(237, 28, 36, 0.25)"}
    />
    <!-- Center divider -->
    <line x1="20" y1="2" x2="20" y2="38" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
  </svg>
</button>

<style>
  .hand-picker-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 2px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .hand-picker-button:hover {
    transform: scale(1.05);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.35));
  }

  .hand-picker-button:active {
    transform: scale(0.95);
    transition: transform 0.05s ease;
  }

  .hand-picker-button:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }

  .hand-picker-button svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-picker-button {
      transition: none;
    }

    .hand-picker-button:hover,
    .hand-picker-button:active {
      transform: none;
    }
  }
</style>
