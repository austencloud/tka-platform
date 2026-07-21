<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let {
    activeHand,
    blueCount,
    redCount,
    disabled = false,
    onchange,
  }: {
    activeHand: MotionColor;
    blueCount: number;
    redCount: number;
    disabled?: boolean;
    onchange: (hand: MotionColor) => void;
  } = $props();

  const hands = [
    {
      value: MotionColor.BLUE,
      label: "Blue",
      color: "var(--prop-blue, #2e8bf0)",
    },
    {
      value: MotionColor.RED,
      label: "Red",
      color: "var(--prop-red, #ed1c24)",
    },
  ] as const;

  function stepCount(hand: MotionColor): number {
    return hand === MotionColor.BLUE ? blueCount : redCount;
  }
</script>

<div class="hand-picker" role="radiogroup" aria-label="Active hand">
  {#each hands as hand}
    <button
      type="button"
      class="hand-option"
      class:active={activeHand === hand.value}
      style="--hand-color: {hand.color}"
      role="radio"
      aria-checked={activeHand === hand.value}
      aria-label="Use {hand.label.toLowerCase()} hand, {stepCount(
        hand.value
      )} steps"
      {disabled}
      onclick={() => onchange(hand.value)}
    >
      <span class="hand-label">{hand.label}</span>
      <span class="hand-count" aria-hidden="true">{stepCount(hand.value)}</span>
    </button>
  {/each}
</div>

<style>
  .hand-picker {
    display: grid;
    grid-template-columns: repeat(2, minmax(78px, 1fr));
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-md, 12px);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(15, 18, 28, 0.84)) 78%,
      transparent
    );
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
  }

  .hand-option {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 7px 10px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--hand-color) 18%, transparent);
    border-radius: calc(var(--settings-radius-md, 12px) - 3px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--hand-color) 9%, transparent),
      color-mix(
        in srgb,
        var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%,
        transparent
      )
    );
    color: color-mix(in srgb, var(--theme-text, #fff) 62%, transparent);
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .hand-option::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      115deg,
      rgba(255, 255, 255, 0.1),
      transparent 38%
    );
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast, 150ms) ease;
  }

  .hand-option:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--hand-color) 48%, transparent);
    color: var(--theme-text, #fff);
  }

  .hand-option:hover:not(:disabled)::before,
  .hand-option.active::before {
    opacity: 1;
  }

  .hand-option.active {
    border-color: color-mix(in srgb, var(--hand-color) 70%, white 8%);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--hand-color) 34%, transparent),
      color-mix(
        in srgb,
        var(--hand-color) 14%,
        var(--theme-card-bg, rgba(255, 255, 255, 0.04))
      )
    );
    color: var(--theme-text, #fff);
    box-shadow:
      0 6px 18px color-mix(in srgb, var(--hand-color) 18%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }

  .hand-option:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
    z-index: 1;
  }

  .hand-option:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .hand-label,
  .hand-count {
    position: relative;
    z-index: 1;
  }

  .hand-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .hand-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    min-height: 24px;
    padding-inline: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--hand-color) 18%, rgba(0, 0, 0, 0.2));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .active .hand-count {
    background: color-mix(in srgb, var(--hand-color) 42%, rgba(0, 0, 0, 0.16));
  }

  @container tool-panel (max-width: 420px) {
    .hand-picker {
      grid-template-columns: repeat(2, minmax(58px, 1fr));
    }

    .hand-label {
      font-size: var(--font-size-compact, 12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-option,
    .hand-option::before {
      transition: none;
    }
  }
</style>
