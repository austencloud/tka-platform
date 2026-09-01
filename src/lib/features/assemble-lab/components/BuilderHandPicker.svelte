<script lang="ts">
  import { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  let {
    activeHand,
    leftCount,
    rightCount,
    disabled = false,
    onchange,
  }: {
    activeHand: HandSide;
    leftCount: number;
    rightCount: number;
    disabled?: boolean;
    onchange: (hand: HandSide) => void;
  } = $props();

  const options = $derived([
    {
      value: HandSide.LEFT,
      label: "Left",
      ariaLabel: `Left hand, ${leftCount} step${leftCount === 1 ? "" : "s"}`,
      tone: "blue" as const,
      disabled,
    },
    {
      value: HandSide.RIGHT,
      label: "Right",
      ariaLabel: `Right hand, ${rightCount} step${rightCount === 1 ? "" : "s"}`,
      tone: "red" as const,
      disabled,
    },
  ]);

  function stepCount(hand: HandSide): number {
    return hand === HandSide.LEFT ? leftCount : rightCount;
  }
</script>

{#snippet handOption(hand: HandSide)}
  {@const count = stepCount(hand)}
  {@const isLeft = hand === HandSide.LEFT}
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
    color: #ffffff;
    font-size: var(--assemble-hand-heading-size, 16px);
    font-weight: 900;
    line-height: 1.2;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.22);
  }

  .hand-picker-heading span {
    color: #eef2f8;
    font-size: var(--font-size-compact, 13px);
    font-weight: 700;
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
    color: #f8fafc;
  }

  .hand-name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: inherit;
    font-size: var(--assemble-hand-label-size, 16px);
    font-weight: 900;
    text-shadow: 0 0 10px color-mix(in srgb, var(--hand-color) 32%, transparent);
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

  :global(.segment.selected) .hand-option-content {
    color: #ffffff;
  }

  .hand-picker :global(.indicator[data-tone="blue"]) {
    background: color-mix(in srgb, var(--prop-blue, #2e8bf0) 68%, #05070c);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--prop-blue, #2e8bf0) 48%, white),
      0 0 16px color-mix(in srgb, var(--prop-blue, #2e8bf0) 26%, transparent);
  }

  .hand-picker :global(.indicator[data-tone="red"]) {
    background: color-mix(in srgb, var(--prop-red, #ed1c24) 68%, #05070c);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--prop-red, #ed1c24) 48%, white),
      0 0 16px color-mix(in srgb, var(--prop-red, #ed1c24) 26%, transparent);
  }

  .hand-progress {
    flex: 0 0 auto;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--hand-color) 28%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--hand-color) 10%, transparent);
    color: color-mix(in srgb, var(--hand-color) 34%, white);
    font-size: var(--font-size-compact, 13px);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    white-space: nowrap;
  }

  @container tool-panel (max-width: 520px) {
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
