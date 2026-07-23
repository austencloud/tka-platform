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
    blueLabel?: string;
    redLabel?: string;
    layout?: "row" | "column";
    showVisibilityIcons?: boolean;
  }

  let {
    showBlue,
    showRed,
    onToggleBlue,
    onToggleRed,
    blueLabel = "Left",
    redLabel = "Right",
    layout = "row",
    showVisibilityIcons = false,
  }: Props = $props();
</script>

<div
  class="motion-color-chips"
  class:column={layout === "column"}
  role="group"
  aria-label="Motion visibility"
>
  <button
    type="button"
    class="chip blue"
    class:active={showBlue}
    onclick={() => onToggleBlue()}
    aria-pressed={showBlue}
    aria-label={`${showBlue ? "Hide" : "Show"} ${blueLabel.toLowerCase()} motion`}
  >
    {#if showVisibilityIcons}
      <i
        class="fas {showBlue ? 'fa-eye' : 'fa-eye-slash'}"
        aria-hidden="true"
      ></i>
    {/if}
    {blueLabel}
  </button>
  <button
    type="button"
    class="chip red"
    class:active={showRed}
    onclick={() => onToggleRed()}
    aria-pressed={showRed}
    aria-label={`${showRed ? "Hide" : "Show"} ${redLabel.toLowerCase()} motion`}
  >
    {#if showVisibilityIcons}
      <i
        class="fas {showRed ? 'fa-eye' : 'fa-eye-slash'}"
        aria-hidden="true"
      ></i>
    {/if}
    {redLabel}
  </button>
</div>

<style>
  .motion-color-chips {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .motion-color-chips.column {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
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

  .chip.blue {
    color: color-mix(
      in srgb,
      var(--prop-blue, #2196f3) 72%,
      var(--theme-text, #fff)
    );
  }

  .chip.red {
    color: color-mix(
      in srgb,
      var(--prop-red, #f44336) 72%,
      var(--theme-text, #fff)
    );
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    filter: brightness(1.18);
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

  .chip i {
    margin-right: 6px;
  }
</style>
