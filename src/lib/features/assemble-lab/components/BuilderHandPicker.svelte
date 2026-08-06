<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

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

  const options = $derived([
    {
      value: MotionColor.BLUE,
      label: "Left",
      ariaLabel: `Left hand, ${blueCount} step${blueCount === 1 ? "" : "s"}`,
      tone: "blue" as const,
      disabled,
    },
    {
      value: MotionColor.RED,
      label: "Right",
      ariaLabel: `Right hand, ${redCount} step${redCount === 1 ? "" : "s"}`,
      tone: "red" as const,
      disabled,
    },
  ]);

  function stepCount(hand: MotionColor): number {
    return hand === MotionColor.BLUE ? blueCount : redCount;
  }
</script>

{#snippet handOption(hand: MotionColor)}
  {@const count = stepCount(hand)}
  {@const isLeft = hand === MotionColor.BLUE}
  <span class="hand-option-content" class:left={isLeft} class:right={!isLeft}>
    <span class="hand-name">
      <span class="hand-color-mark" aria-hidden="true"></span>
      {isLeft ? "Left hand" : "Right hand"}
    </span>
    <span class="hand-progress">{count} {count === 1 ? "step" : "steps"}</span>
  </span>
{/snippet}

<div class="hand-picker">
  <div class="hand-picker-heading" aria-hidden="true">
    <strong>Build a hand</strong>
    <span>Switch paths at any time</span>
  </div>
  <SegmentedControl
    {options}
    value={activeHand}
    {onchange}
    color="blue"
    semantics="radiogroup"
    ariaLabel="Active hand"
    optionContent={handOption}
  />
</div>

<style>
  .hand-picker {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: center;
    gap: var(--settings-spacing-md, 12px);
    width: 100%;
    min-width: 0;
  }

  .hand-picker-heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 132px;
  }

  .hand-picker-heading strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 800;
    line-height: 1.2;
  }

  .hand-picker-heading span {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
  }

  .hand-option-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    min-width: 0;
    min-height: 42px;
  }

  .hand-name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: inherit;
    font-size: var(--font-size-min, 14px);
    font-weight: 800;
    white-space: nowrap;
  }

  .hand-color-mark {
    width: 5px;
    height: 28px;
    flex: 0 0 5px;
    border-radius: 999px;
    background: var(--hand-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--hand-color) 52%, transparent);
  }

  .hand-option-content.left {
    --hand-color: var(--prop-blue, #2e8bf0);
  }

  .hand-option-content.right {
    --hand-color: var(--prop-red, #ed1c24);
  }

  .hand-progress {
    flex: 0 0 auto;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--hand-color) 28%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--hand-color) 10%, transparent);
    color: color-mix(in srgb, var(--hand-color) 62%, var(--theme-text, #fff));
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    white-space: nowrap;
  }

  @container tool-panel (max-width: 420px) {
    .hand-picker {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }

    .hand-picker-heading {
      flex-direction: row;
      align-items: baseline;
      justify-content: space-between;
      min-width: 0;
      padding-inline: 4px;
    }

    .hand-option-content {
      min-height: 36px;
    }

    .hand-progress {
      padding-inline: 6px;
    }
  }
</style>
