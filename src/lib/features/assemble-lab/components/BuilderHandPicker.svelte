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
      count: blueCount,
      tone: "blue" as const,
      disabled,
    },
    {
      value: MotionColor.RED,
      label: "Right",
      ariaLabel: `Right hand, ${redCount} step${redCount === 1 ? "" : "s"}`,
      count: redCount,
      tone: "red" as const,
      disabled,
    },
  ]);
</script>

<div class="hand-picker">
  <SegmentedControl
    {options}
    value={activeHand}
    {onchange}
    color="blue"
    semantics="radiogroup"
    ariaLabel="Active hand"
  />
</div>

<style>
  .hand-picker {
    width: 100%;
    min-width: 0;
  }
</style>
