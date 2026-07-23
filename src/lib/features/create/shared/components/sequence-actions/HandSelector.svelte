<!--
  HandSelector.svelte

  Hand/color selector shared by Sequence Actions and the mandala viewer.
  Defaults to Left / Both / Right; callers can supply labels for the same
  blue / purple / red visual states.

  Thin domain wrapper around the shared SegmentedControl. Prop tones live in
  that primitive, so every Left/Blue and Right/Red option follows the same
  color policy instead of rebuilding it here.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { TargetHand } from "../../state/panel-coordination-state.svelte.ts";

  interface Props {
    value: TargetHand;
    onChange: (hand: TargetHand) => void;
    sectionLabel?: string;
    labelId?: string;
    labels?: Record<TargetHand, string>;
  }

  let {
    value,
    onChange,
    sectionLabel = "Apply To",
    labelId = "apply-to-label",
    labels = { blue: "Left", both: "Both", red: "Right" },
  }: Props = $props();

  const options = $derived.by(
    (): {
      value: TargetHand;
      label: string;
      tone: "blue" | "red" | "accent";
    }[] => [
      { value: "blue", label: labels.blue, tone: "blue" },
      { value: "both", label: labels.both, tone: "accent" },
      { value: "red", label: labels.red, tone: "red" },
    ]
  );
</script>

<div class="hand-selector-section">
  <span class="section-label" id={labelId}>{sectionLabel}</span>

  <SegmentedControl
    {options}
    {value}
    onchange={onChange}
    color="accent"
    ariaLabelledby={labelId}
  />
</div>

<style>
  .hand-selector-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }

</style>
